import * as React from "react";
import { Download, Upload, ClipboardPaste, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dropzone } from "@/components/excel/Dropzone";
import { parseExcel } from "@/lib/excel";

export type ImportedItem = {
  referencia: string;
  cantidad: number;
  precio: number;
};

type ParsedRow = {
  referencia: string;
  cantidad: number;
  precio: number;
  status: "ok" | "zero" | "duplicateInFile" | "duplicateInNeg" | "invalid";
};

const COLUMN_MAP = {
  referencia: ["referencia", "ref", "codigo", "código"],
  cantidad: ["cantidad", "cant", "qty", "unidades"],
  precio: [
    "precio unitario",
    "precio_unitario",
    "precio",
    "precio unit",
    "puv",
    "valor unitario",
  ],
} as const;

type Key = keyof typeof COLUMN_MAP;

async function downloadTemplate() {
  const XLSX = await import("xlsx");
  const ws = XLSX.utils.aoa_to_sheet([["Referencia", "cantidad", "precio unitario"]]);
  ws["!cols"] = [{ wch: 24 }, { wch: 12 }, { wch: 16 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Negociacion");
  XLSX.writeFile(wb, "plantilla_negociacion.xlsx");
}

function parsePastedText(text: string): { headers: string[]; rows: (string | number | null)[][] } {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
  if (lines.length === 0) return { headers: [], rows: [] };

  // Detect separator from header line
  const first = lines[0];
  const sep = first.includes("\t") ? "\t" : first.includes(";") ? ";" : ",";
  const headers = first.split(sep).map((h) => h.trim());
  const rows = lines.slice(1).map((l) =>
    l.split(sep).map((c) => {
      const t = c.trim();
      return t === "" ? null : t;
    }),
  );
  return { headers, rows };
}

function normalize(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function mapPastedToRows(
  headers: string[],
  rows: (string | number | null)[][],
): { items: { referencia: string | null; cantidad: number | null; precio: number | null }[]; missing: Key[] } {
  const headerNorm = headers.map((h) => normalize(h));
  const resolved: Partial<Record<Key, number>> = {};
  (Object.keys(COLUMN_MAP) as Key[]).forEach((key) => {
    const aliases = COLUMN_MAP[key].map(normalize);
    const idx = headerNorm.findIndex((h) => aliases.includes(h));
    if (idx >= 0) resolved[key] = idx;
  });
  const missing = (Object.keys(COLUMN_MAP) as Key[]).filter((k) => resolved[k] === undefined);
  if (missing.length) return { items: [], missing };

  const items = rows.map((r) => {
    const refRaw = r[resolved.referencia!];
    const qtyRaw = r[resolved.cantidad!];
    const prRaw = r[resolved.precio!];
    const referencia = refRaw == null ? null : String(refRaw).trim();
    const toNum = (v: unknown): number | null => {
      if (v == null || v === "") return null;
      const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
      return Number.isFinite(n) ? n : null;
    };
    return {
      referencia: referencia && referencia.length > 0 ? referencia : null,
      cantidad: toNum(qtyRaw),
      precio: toNum(prRaw),
    };
  });
  return { items, missing: [] };
}

function classify(
  raw: { referencia: string | null; cantidad: number | null; precio: number | null }[],
  existingRefs: Set<string>,
  includeZero: boolean,
): { rows: ParsedRow[]; counts: { total: number; ok: number; zero: number; dupFile: number; dupNeg: number; invalid: number } } {
  const seen = new Set<string>();
  const out: ParsedRow[] = [];
  let ok = 0,
    zero = 0,
    dupFile = 0,
    dupNeg = 0,
    invalid = 0;

  for (const r of raw) {
    if (!r.referencia || r.cantidad == null || r.precio == null) {
      invalid++;
      out.push({
        referencia: r.referencia ?? "(vacío)",
        cantidad: r.cantidad ?? 0,
        precio: r.precio ?? 0,
        status: "invalid",
      });
      continue;
    }
    if (existingRefs.has(r.referencia)) {
      dupNeg++;
      out.push({ referencia: r.referencia, cantidad: r.cantidad, precio: r.precio, status: "duplicateInNeg" });
      continue;
    }
    if (seen.has(r.referencia)) {
      dupFile++;
      out.push({ referencia: r.referencia, cantidad: r.cantidad, precio: r.precio, status: "duplicateInFile" });
      continue;
    }
    seen.add(r.referencia);
    if ((r.cantidad <= 0 || r.precio <= 0) && !includeZero) {
      zero++;
      out.push({ referencia: r.referencia, cantidad: r.cantidad, precio: r.precio, status: "zero" });
      continue;
    }
    ok++;
    out.push({ referencia: r.referencia, cantidad: r.cantidad, precio: r.precio, status: "ok" });
  }
  return { rows: out, counts: { total: raw.length, ok, zero, dupFile, dupNeg, invalid } };
}

export function ImportItemsDialog({
  open,
  onOpenChange,
  existingRefs,
  onImport,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingRefs: string[];
  onImport: (items: ImportedItem[]) => void;
}) {
  const [tab, setTab] = React.useState<"upload" | "paste" | "template">("upload");
  const [file, setFile] = React.useState<File | null>(null);
  const [pasted, setPasted] = React.useState("");
  const [parsing, setParsing] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [includeZero, setIncludeZero] = React.useState(false);
  const [raw, setRaw] = React.useState<
    { referencia: string | null; cantidad: number | null; precio: number | null }[]
  >([]);

  const refsSet = React.useMemo(() => new Set(existingRefs), [existingRefs]);

  // Parse file when selected
  React.useEffect(() => {
    if (!file) {
      setRaw([]);
      setError(null);
      return;
    }
    setParsing(true);
    setError(null);
    parseExcel(file, COLUMN_MAP, {
      requiredKeys: ["referencia", "cantidad", "precio"],
      numericKeys: ["cantidad", "precio"],
    })
      .then((res) => {
        setRaw(
          res.rows.map((r) => ({
            referencia: r.referencia == null ? null : String(r.referencia).trim(),
            cantidad: typeof r.cantidad === "number" ? r.cantidad : null,
            precio: typeof r.precio === "number" ? r.precio : null,
          })),
        );
      })
      .catch((e: Error) => {
        setError(e.message);
        setRaw([]);
      })
      .finally(() => setParsing(false));
  }, [file]);

  // Parse pasted text when changed
  React.useEffect(() => {
    if (tab !== "paste") return;
    if (pasted.trim().length === 0) {
      setRaw([]);
      setError(null);
      return;
    }
    try {
      const { headers, rows } = parsePastedText(pasted);
      const { items, missing } = mapPastedToRows(headers, rows);
      if (missing.length) {
        setError(
          `Faltan columnas en la cabecera: ${missing.join(", ")}. Encabezados detectados: ${headers.join(" | ")}`,
        );
        setRaw([]);
        return;
      }
      setError(null);
      setRaw(items);
    } catch (e) {
      setError((e as Error).message);
      setRaw([]);
    }
  }, [pasted, tab]);

  const { rows: classified, counts } = React.useMemo(
    () => classify(raw, refsSet, includeZero),
    [raw, refsSet, includeZero],
  );

  const handleImport = () => {
    const items: ImportedItem[] = classified
      .filter((r) => r.status === "ok")
      .map((r) => ({ referencia: r.referencia, cantidad: r.cantidad, precio: r.precio }));
    if (items.length === 0) {
      toast.error("No hay items válidos para importar");
      return;
    }
    onImport(items);
    toast.success(
      `Importados ${items.length}. Omitidos: ${counts.dupNeg + counts.dupFile} duplicados, ${counts.zero} en cero, ${counts.invalid} inválidos.`,
    );
    handleClose();
  };

  const handleClose = () => {
    setFile(null);
    setPasted("");
    setRaw([]);
    setError(null);
    setIncludeZero(false);
    setTab("upload");
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(true) : handleClose())}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Importar items a la negociación</DialogTitle>
          <DialogDescription>
            Sube un archivo, pega filas o descarga la plantilla. Formato requerido:{" "}
            <strong>Referencia</strong>, <strong>cantidad</strong>, <strong>precio unitario</strong>.
          </DialogDescription>
        </DialogHeader>

        <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="upload">
              <Upload className="mr-1 h-4 w-4" /> Excel / CSV
            </TabsTrigger>
            <TabsTrigger value="paste">
              <ClipboardPaste className="mr-1 h-4 w-4" /> Pegar texto
            </TabsTrigger>
            <TabsTrigger value="template">
              <Download className="mr-1 h-4 w-4" /> Plantilla
            </TabsTrigger>
          </TabsList>

          <TabsContent value="upload" className="mt-4">
            <Dropzone
              file={file}
              onFile={setFile}
              accept=".xlsx,.xls,.csv"
              hint="Excel (.xlsx, .xls) o CSV"
            />
            {parsing && (
              <p className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Analizando…
              </p>
            )}
          </TabsContent>

          <TabsContent value="paste" className="mt-4">
            <Textarea
              value={pasted}
              onChange={(e) => setPasted(e.target.value)}
              rows={8}
              placeholder={"Pega aquí desde Excel/Sheets. Primera fila debe ser:\nReferencia\tcantidad\tprecio unitario"}
              className="font-mono text-xs"
            />
          </TabsContent>

          <TabsContent value="template" className="mt-4 space-y-3">
            <p className="text-sm text-muted-foreground">
              Descarga la plantilla con los encabezados exactos, llénala y súbela en la pestaña "Excel / CSV".
            </p>
            <Button onClick={() => void downloadTemplate()} className="gap-1.5">
              <Download className="h-4 w-4" /> Descargar plantilla_negociacion.xlsx
            </Button>
            <div className="rounded-lg border border-border/60 bg-muted/30 p-3 text-xs">
              <div className="mb-1 font-semibold">Estructura esperada:</div>
              <code className="block">Referencia | cantidad | precio unitario</code>
            </div>
          </TabsContent>
        </Tabs>

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/10 p-3 text-xs text-destructive">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {raw.length > 0 && !error && (
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <Badge variant="secondary">Total: {counts.total}</Badge>
              <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100 dark:bg-emerald-500/20 dark:text-emerald-200">
                Válidos: {counts.ok}
              </Badge>
              {counts.zero > 0 && (
                <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100 dark:bg-amber-500/20 dark:text-amber-200">
                  En cero: {counts.zero}
                </Badge>
              )}
              {counts.dupNeg > 0 && (
                <Badge variant="outline">Ya en negociación: {counts.dupNeg}</Badge>
              )}
              {counts.dupFile > 0 && (
                <Badge variant="outline">Duplicados en archivo: {counts.dupFile}</Badge>
              )}
              {counts.invalid > 0 && (
                <Badge variant="destructive">Inválidos: {counts.invalid}</Badge>
              )}
            </div>

            <div className="flex items-center justify-between rounded-lg border border-border/60 p-2">
              <label htmlFor="incZero" className="text-xs">
                Incluir filas con cantidad o precio en 0
              </label>
              <Switch id="incZero" checked={includeZero} onCheckedChange={setIncludeZero} />
            </div>

            <div className="max-h-64 overflow-auto rounded-lg border border-border/60">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-muted/60">
                  <tr>
                    <th className="px-2 py-1 text-left">Referencia</th>
                    <th className="px-2 py-1 text-right">Cantidad</th>
                    <th className="px-2 py-1 text-right">Precio</th>
                    <th className="px-2 py-1 text-left">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {classified.slice(0, 50).map((r, i) => (
                    <tr key={i} className="border-t border-border/40">
                      <td className="px-2 py-1 font-mono">{r.referencia}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.cantidad}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.precio}</td>
                      <td className="px-2 py-1">
                        {r.status === "ok" && (
                          <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" /> válido
                          </span>
                        )}
                        {r.status === "zero" && <span className="text-amber-600">cant/precio = 0</span>}
                        {r.status === "duplicateInNeg" && (
                          <span className="text-muted-foreground">ya en negociación</span>
                        )}
                        {r.status === "duplicateInFile" && (
                          <span className="text-muted-foreground">duplicado en archivo</span>
                        )}
                        {r.status === "invalid" && <span className="text-destructive">inválido</span>}
                      </td>
                    </tr>
                  ))}
                  {classified.length > 50 && (
                    <tr>
                      <td colSpan={4} className="px-2 py-2 text-center text-muted-foreground">
                        … y {classified.length - 50} filas más
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancelar
          </Button>
          <Button onClick={handleImport} disabled={counts.ok === 0}>
            Importar {counts.ok} item{counts.ok !== 1 ? "s" : ""}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
