import * as React from "react";
import { Package, Upload, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthSelect } from "@/components/period/MonthSelect";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dropzone } from "@/components/excel/Dropzone";
import { parseExcel, chunkedInsert } from "@/lib/excel";
import { currentMonthDate, formatMonth, formatNumber } from "@/lib/period";

type ProductCost = {
  id: string;
  grupo: string | null;
  referencia: string;
  descripcion: string | null;
  cant: number | null;
  cumat: number | null;
  cumo: number | null;
  cunago: number | null;
  ctmat: number | null;
  ctmo: number | null;
  ctsit: number | null;
  pct_part: number | null;
  cifu: number | null;
  mou: number | null;
  ctu: number | null;
  ct: number | null;
  puv: number | null;
  preciotot: number | null;
  pct_cto: number | null;
};

const COLUMN_MAP = {
  grupo: ["GRUPO", "Grupo"],
  referencia: ["REFERENCIA", "REF", "Referencia"],
  descripcion: ["DESCRIPCION", "DESCRIPCIÓN", "Descripción"],
  cant: ["CANT", "CANTIDAD"],
  cumat: ["CUMAT", "CU MAT"],
  cumo: ["CUMO", "CU MO"],
  cunago: ["CUNAGO", "CU NAGO"],
  ctmat: ["CTMAT", "CT MAT"],
  ctmo: ["CTMO", "CT MO"],
  ctsit: ["CTSIT", "CT SIT"],
  pct_part: ["%PART", "% PART", "PORCENTAJE PART", "PCT PART"],
  cifu: ["CIFU"],
  mou: ["MOU"],
  ctu: ["CTU"],
  ct: ["CT"],
  puv: ["PUV"],
  preciotot: ["PRECIOTOT", "PRECIO TOT", "PRECIO TOTAL"],
  pct_cto: ["%CTO", "% CTO", "PCT CTO"],
} as const;

type ColKey = keyof typeof COLUMN_MAP;

const NUMERIC_KEYS: readonly ColKey[] = [
  "cant", "cumat", "cumo", "cunago", "ctmat", "ctmo", "ctsit",
  "pct_part", "cifu", "mou", "ctu", "ct", "puv", "preciotot", "pct_cto",
];

const COLUMNS: { key: keyof ProductCost; label: string; numeric?: boolean }[] = [
  { key: "grupo", label: "GRUPO" },
  { key: "referencia", label: "REF" },
  { key: "descripcion", label: "DESCRIPCIÓN" },
  { key: "cant", label: "CANT", numeric: true },
  { key: "cumat", label: "CUMAT", numeric: true },
  { key: "cumo", label: "CUMO", numeric: true },
  { key: "cunago", label: "CUNAGO", numeric: true },
  { key: "ctmat", label: "CTMAT", numeric: true },
  { key: "ctmo", label: "CTMO", numeric: true },
  { key: "ctsit", label: "CTSIT", numeric: true },
  { key: "pct_part", label: "%PART", numeric: true },
  { key: "cifu", label: "CIFU", numeric: true },
  { key: "mou", label: "MOU", numeric: true },
  { key: "ctu", label: "CTU", numeric: true },
  { key: "ct", label: "CT", numeric: true },
  { key: "puv", label: "PUV", numeric: true },
  { key: "preciotot", label: "PRECIOTOT", numeric: true },
  { key: "pct_cto", label: "%CTO", numeric: true },
];

export function CostosProductosPage() {
  const { user } = useAuth();
  const [month, setMonth] = React.useState(currentMonthDate());
  const [rows, setRows] = React.useState<ProductCost[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [uploadOpen, setUploadOpen] = React.useState(false);

  const load = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("product_costs")
      .select("*")
      .eq("period_month", month)
      .order("referencia", { ascending: true })
      .limit(5000);
    if (error) {
      toast.error("Error cargando costos");
      setLoading(false);
      return;
    }
    // Stale-while-revalidate: solo reemplazamos al recibir respuesta exitosa.
    setRows((data ?? []) as ProductCost[]);
    setLoading(false);
  }, [month]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.referencia.toLowerCase().includes(q) ||
        (r.descripcion?.toLowerCase().includes(q) ?? false),
    );
  }, [rows, search]);

  return (
    <div className="mx-auto max-w-[1600px] px-6 py-10 lg:px-10">
      <PageHeader
        icon={Package}
        eyebrow="Operación"
        title="Costos de producto"
        description="Costos unitarios y totales por producto, mes a mes."
        actions={
          <>
            <MonthSelect value={month} onValueChange={setMonth} className="h-10 w-44" />
            <Button onClick={() => setUploadOpen(true)} className="bg-gradient-brand text-white shadow-elegant">
              <Upload className="mr-1 h-4 w-4" />
              Subir Excel del mes
            </Button>
          </>
        }
      />

      <div className="mt-6 flex items-center justify-between gap-3">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por referencia o descripción"
            className="pl-9"
          />
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          {loading && rows.length > 0 && <Loader2 className="h-3 w-3 animate-spin" />}
          {formatMonth(month)} · {filtered.length} productos
        </p>
      </div>

      <div className={cn("mt-4 glass overflow-hidden rounded-2xl transition-opacity", loading && rows.length > 0 && "opacity-60")}>
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
              <TableRow>
                {COLUMNS.map((c) => (
                  <TableHead key={c.key} className={c.numeric ? "text-right text-xs" : "text-xs"}>
                    {c.label}
                  </TableHead>
                ))}
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading && rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="h-32 text-center text-muted-foreground">
                    <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                  </TableCell>
                </TableRow>
              ) : filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={COLUMNS.length} className="h-40 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <p className="text-sm text-muted-foreground">
                        Sin datos para {formatMonth(month)}.
                      </p>
                      <Button variant="outline" onClick={() => setUploadOpen(true)}>
                        <Upload className="mr-1 h-4 w-4" />
                        Subir Excel del mes
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((r) => (
                  <TableRow key={r.id}>
                    {COLUMNS.map((c) => {
                      const v = r[c.key];
                      return (
                        <TableCell key={c.key} className={c.numeric ? "text-right text-xs tabular-nums" : "text-xs"}>
                          {c.numeric
                            ? typeof v === "number"
                              ? formatNumber(v, { maximumFractionDigits: 2 })
                              : "—"
                            : (v as string | null) ?? "—"}
                        </TableCell>
                      );
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {uploadOpen && user && (
        <UploadDialog
          defaultMonth={month}
          onClose={() => setUploadOpen(false)}
          onDone={(m) => {
            setUploadOpen(false);
            setMonth(m);
            void load();
          }}
          userId={user.id}
          userName={user.name}
        />
      )}
    </div>
  );
}

function UploadDialog({
  defaultMonth,
  onClose,
  onDone,
  userId,
  userName,
}: {
  defaultMonth: string;
  onClose: () => void;
  onDone: (month: string) => void;
  userId: string;
  userName: string;
}) {
  const [month, setMonth] = React.useState(defaultMonth);
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirm, setConfirm] = React.useState<{ existingCount: number } | null>(null);
  const [preview, setPreview] = React.useState<{
    rows: Record<ColKey, string | number | null>[];
    warnings: string[];
  } | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    setParsing(true);
    parseExcel(file, COLUMN_MAP, {
      requiredKeys: ["referencia"],
      numericKeys: [...NUMERIC_KEYS],
    })
      .then((res) => setPreview({ rows: res.rows as Record<ColKey, string | number | null>[], warnings: res.warnings }))
      .catch((e: Error) => {
        toast.error(e.message);
        setFile(null);
      })
      .finally(() => setParsing(false));
  }, [file]);

  const handleAttempt = async () => {
    if (!preview) return;
    const { count, error } = await supabase
      .from("product_costs")
      .select("id", { count: "exact", head: true })
      .eq("period_month", month);
    if (error) {
      toast.error("No se pudo verificar el mes");
      return;
    }
    if ((count ?? 0) > 0) {
      setConfirm({ existingCount: count ?? 0 });
    } else {
      await doUpload();
    }
  };

  const doUpload = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      await supabase.from("product_costs").delete().eq("period_month", month);
      const items = preview.rows.map((r) => {
        const base: Record<string, unknown> = {
          period_month: month,
          referencia: String(r.referencia),
          created_by_id: userId,
          created_by_name: userName,
        };
        for (const k of Object.keys(COLUMN_MAP) as ColKey[]) {
          if (k === "referencia") continue;
          base[k] = r[k];
        }
        return base;
      });
      await chunkedInsert(items, 500, async (batch) => {
        const { error } = await supabase.from("product_costs").insert(batch as never);
        if (error) throw error;
      });
      toast.success(`${items.length} productos cargados para ${formatMonth(month)}`);
      onDone(month);
    } catch (e) {
      console.error(e);
      toast.error("Error al subir el Excel");
    } finally {
      setSubmitting(false);
      setConfirm(null);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Subir costos del mes</DialogTitle>
            <DialogDescription>
              Selecciona el mes y el Excel con las 18 columnas (GRUPO, REF, DESCRIPCION, CANT, CUMAT… %CTO).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Mes
              </label>
              <MonthSelect value={month} onValueChange={setMonth} className="h-10 w-full" />
            </div>
            <Dropzone file={file} onFile={setFile} />
            {parsing && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Procesando Excel…
              </p>
            )}
            {preview && (
              <div className="rounded-xl border border-border/60 bg-white/60 p-3 backdrop-blur">
                <p className="text-xs font-semibold">{preview.rows.length} filas detectadas</p>
                {preview.warnings.map((w, i) => (
                  <p key={i} className="text-xs text-muted-foreground">⚠ {w}</p>
                ))}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={handleAttempt}
              disabled={!preview || preview.rows.length === 0 || submitting}
              className="bg-gradient-brand text-white"
            >
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Subir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={!!confirm} onOpenChange={(o) => !o && setConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sobrescribir mes</AlertDialogTitle>
            <AlertDialogDescription>
              Ya hay {confirm?.existingCount} productos para {formatMonth(month)}. Si continúas se reemplazarán por los del nuevo Excel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={doUpload} disabled={submitting}>
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Sí, sobrescribir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}