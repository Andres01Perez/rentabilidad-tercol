import * as React from "react";
import { Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Dropzone } from "@/components/excel/Dropzone";
import { parseExcel, chunkedInsert } from "@/lib/excel";
import { formatNumber } from "@/lib/period";

interface UploadVentasDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onUploaded: () => void;
}

const COLUMN_MAP = {
  year: ["año", "ano", "year"],
  month: ["mes", "month"],
  day: ["dia", "día", "day"],
  vendedor: ["vendedor"],
  dependencia: ["dependencia"],
  tercero: ["tercero", "cliente"],
  referencia: ["productoc", "producto c", "producto", "ref", "referencia"],
  valor_total: ["valor", "valor total", "total"],
  cantidad: ["cantidad", "cant"],
} as const;

type ColKey = keyof typeof COLUMN_MAP;

interface ParsedRow {
  year: number;
  month: number;
  day: number;
  vendedor: string | null;
  dependencia: string | null;
  tercero: string | null;
  referencia: string;
  cantidad: number;
  valor_total: number;
  sale_date: string;
}

function pad(n: number) {
  return String(n).padStart(2, "0");
}

export function UploadVentasDialog({ open, onOpenChange, onUploaded }: UploadVentasDialogProps) {
  const { user } = useCurrentUser();
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [parsed, setParsed] = React.useState<ParsedRow[] | null>(null);
  const [warnings, setWarnings] = React.useState<string[]>([]);
  const [confirmOpen, setConfirmOpen] = React.useState(false);
  const [currentCount, setCurrentCount] = React.useState<number | null>(null);
  const [uploading, setUploading] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setFile(null);
      setParsed(null);
      setWarnings([]);
      setUploading(false);
    }
  }, [open]);

  React.useEffect(() => {
    if (!file) {
      setParsed(null);
      setWarnings([]);
      return;
    }
    let cancelled = false;
    (async () => {
      setParsing(true);
      try {
        const result = await parseExcel<ColKey>(file, COLUMN_MAP, {
          requiredKeys: ["year", "month", "day", "referencia", "cantidad", "valor_total"],
          numericKeys: ["year", "month", "day", "cantidad", "valor_total"],
        });
        if (cancelled) return;
        const localWarnings = [...result.warnings];
        const cleaned: ParsedRow[] = [];
        let invalidDates = 0;
        for (const r of result.rows) {
          const y = Number(r.year);
          const m = Number(r.month);
          const d = Number(r.day);
          const cant = Number(r.cantidad);
          const val = Number(r.valor_total);
          if (
            !Number.isFinite(y) || y < 1900 || y > 9999 ||
            !Number.isFinite(m) || m < 1 || m > 12 ||
            !Number.isFinite(d) || d < 1 || d > 31 ||
            !Number.isFinite(cant) || !Number.isFinite(val)
          ) {
            invalidDates++;
            continue;
          }
          cleaned.push({
            year: y,
            month: m,
            day: d,
            sale_date: `${y}-${pad(m)}-${pad(d)}`,
            vendedor: (r.vendedor as string | null) ?? null,
            dependencia: (r.dependencia as string | null) ?? null,
            tercero: (r.tercero as string | null) ?? null,
            referencia: String(r.referencia ?? "").trim(),
            cantidad: cant,
            valor_total: val,
          });
        }
        if (invalidDates > 0) {
          localWarnings.push(`${invalidDates} filas se descartaron por fecha o números inválidos.`);
        }
        setParsed(cleaned);
        setWarnings(localWarnings);
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "Error al leer el Excel");
        setFile(null);
      } finally {
        if (!cancelled) setParsing(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [file]);

  const requestUpload = async () => {
    if (!parsed || parsed.length === 0) return;
    const { count } = await supabase
      .from("sales")
      .select("id", { count: "exact", head: true });
    setCurrentCount(count ?? 0);
    setConfirmOpen(true);
  };

  const performUpload = async () => {
    if (!parsed) return;
    setConfirmOpen(false);
    setUploading(true);
    try {
      // Reemplazo total
      const { error: delErr } = await supabase.from("sales").delete().not("id", "is", null);
      if (delErr) throw delErr;
      const payload = parsed.map((r) => ({
        sale_date: r.sale_date,
        year: r.year,
        month: r.month,
        day: r.day,
        vendedor: r.vendedor,
        dependencia: r.dependencia,
        tercero: r.tercero,
        referencia: r.referencia,
        cantidad: r.cantidad,
        valor_total: r.valor_total,
        created_by_id: user?.id ?? null,
        created_by_name: user?.name ?? "Sistema",
      }));
      await chunkedInsert(payload, 500, async (batch) => {
        const { error } = await supabase.from("sales").insert(batch);
        if (error) throw error;
      });
      toast.success(`Se importaron ${formatNumber(parsed.length)} ventas.`);
      onOpenChange(false);
      onUploaded();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al subir el Excel");
    } finally {
      setUploading(false);
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Subir Excel de ventas</DialogTitle>
            <DialogDescription>
              Reemplaza completamente las ventas existentes. Columnas esperadas: Año, Mes, Día,
              Vendedor, Dependencia, Tercero, ProductoC, Valor, Cantidad.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Dropzone file={file} onFile={setFile} />
            {parsing && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Leyendo archivo…
              </p>
            )}
            {parsed && !parsing && (
              <div className="space-y-2 rounded-xl border border-border/60 bg-white/60 p-4 backdrop-blur">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  {formatNumber(parsed.length)} filas listas para importar
                </p>
                {warnings.length > 0 && (
                  <ul className="space-y-1 text-xs text-amber-700">
                    {warnings.map((w, i) => (
                      <li key={i} className="flex items-start gap-1">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        {w}
                      </li>
                    ))}
                  </ul>
                )}
                {parsed.length > 0 && (
                  <div className="overflow-x-auto rounded-lg border border-border/40 text-xs">
                    <table className="w-full">
                      <thead className="bg-muted/50">
                        <tr>
                          <th className="px-2 py-1 text-left">Fecha</th>
                          <th className="px-2 py-1 text-left">Vendedor</th>
                          <th className="px-2 py-1 text-left">Tercero</th>
                          <th className="px-2 py-1 text-left">Ref</th>
                          <th className="px-2 py-1 text-right">Cant</th>
                          <th className="px-2 py-1 text-right">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        {parsed.slice(0, 5).map((r, i) => (
                          <tr key={i} className="border-t border-border/40">
                            <td className="px-2 py-1">{r.sale_date}</td>
                            <td className="px-2 py-1 truncate max-w-[120px]">{r.vendedor ?? "—"}</td>
                            <td className="px-2 py-1 truncate max-w-[120px]">{r.tercero ?? "—"}</td>
                            <td className="px-2 py-1">{r.referencia}</td>
                            <td className="px-2 py-1 text-right">{formatNumber(r.cantidad)}</td>
                            <td className="px-2 py-1 text-right">{formatNumber(r.valor_total)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={uploading}>
              Cancelar
            </Button>
            <Button
              onClick={requestUpload}
              disabled={!parsed || parsed.length === 0 || uploading || !user}
            >
              {uploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Subiendo…
                </>
              ) : (
                "Importar y reemplazar"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reemplazar ventas existentes</AlertDialogTitle>
            <AlertDialogDescription>
              {currentCount && currentCount > 0
                ? `Esto borrará las ${formatNumber(currentCount)} ventas actuales y subirá ${formatNumber(parsed?.length ?? 0)} nuevas. ¿Continuar?`
                : `Se subirán ${formatNumber(parsed?.length ?? 0)} ventas. ¿Continuar?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={performUpload}>Sí, reemplazar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}