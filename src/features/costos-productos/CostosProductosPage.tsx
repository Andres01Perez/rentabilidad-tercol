import * as React from "react";
import { Package, Upload, Loader2, Search, ChevronRight, ChevronDown } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MonthSelect } from "@/components/period/MonthSelect";
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
import type { WizardField, ImportWizardDialog as ImportWizardDialogType } from "@/components/excel/ImportWizardDialog";
import { chunkedInsert } from "@/lib/excel";
import { currentMonthDate, formatMonth, formatNumber, previousMonth } from "@/lib/period";
import { cn } from "@/lib/utils";
import {
  productCostsKey,
  productCostsQueryOptions,
  type ProductCostRow,
} from "./queries";

// Lazy: SheetJS pesa ~80 KiB. Solo se descarga al abrir "Subir Excel".
const ImportWizardDialog = React.lazy(() =>
  import("@/components/excel/ImportWizardDialog").then((m) => ({
    default: m.ImportWizardDialog,
  })),
) as unknown as typeof ImportWizardDialogType;

type ProductCost = ProductCostRow;

type ColKey =
  | "grupo" | "referencia" | "descripcion" | "cant"
  | "cumat" | "cumo" | "cunago" | "ctmat" | "ctmo" | "ctsit"
  | "pct_part" | "cifu" | "mou" | "ctu" | "ct" | "puv" | "preciotot" | "pct_cto";

const NUMERIC_KEYS: ColKey[] = [
  "cant", "cumat", "cumo", "cunago", "ctmat", "ctmo", "ctsit",
  "pct_part", "cifu", "mou", "ctu", "ct", "puv", "preciotot", "pct_cto",
];

const WIZARD_FIELDS: WizardField<ColKey>[] = [
  { key: "referencia", label: "Referencia", required: true,
    suggestedAliases: ["REFERENCIA", "REF", "Referencia", "CODIGO", "Código", "COD"] },
  { key: "ctu", label: "CTU (Costo Total Unitario)", required: true,
    suggestedAliases: ["CTU", "CT U", "COSTO TOTAL UNITARIO", "Costo total unitario", "COSTO UNITARIO"] },
  { key: "grupo", label: "Grupo", suggestedAliases: ["GRUPO", "Grupo", "FAMILIA", "CATEGORIA", "Categoría"] },
  { key: "descripcion", label: "Descripción",
    suggestedAliases: ["DESCRIPCION", "DESCRIPCIÓN", "Descripción", "NOMBRE", "PRODUCTO"] },
  { key: "cant", label: "Cantidad", suggestedAliases: ["CANT", "CANTIDAD"] },
  { key: "cumat", label: "CUMAT", suggestedAliases: ["CUMAT", "CU MAT"] },
  { key: "cumo", label: "CUMO", suggestedAliases: ["CUMO", "CU MO"] },
  { key: "cunago", label: "CUNAGO", suggestedAliases: ["CUNAGO", "CU NAGO"] },
  { key: "ctmat", label: "CTMAT", suggestedAliases: ["CTMAT", "CT MAT"] },
  { key: "ctmo", label: "CTMO", suggestedAliases: ["CTMO", "CT MO"] },
  { key: "ctsit", label: "CTSIT", suggestedAliases: ["CTSIT", "CT SIT"] },
  { key: "pct_part", label: "% Participación",
    suggestedAliases: ["%PART", "% PART", "PORCENTAJE PART", "PCT PART"] },
  { key: "cifu", label: "CIFU", suggestedAliases: ["CIFU"] },
  { key: "mou", label: "MOU", suggestedAliases: ["MOU"] },
  { key: "ct", label: "CT (Costo Total)", suggestedAliases: ["CT", "COSTO TOTAL"] },
  { key: "puv", label: "PUV", suggestedAliases: ["PUV"] },
  { key: "preciotot", label: "Precio Total",
    suggestedAliases: ["PRECIOTOT", "PRECIO TOT", "PRECIO TOTAL"] },
  { key: "pct_cto", label: "% Costo", suggestedAliases: ["%CTO", "% CTO", "PCT CTO"] },
];

type ColDef = { key: keyof ProductCost; label: string; numeric?: boolean };
type GroupId = "cu" | "ct";
type Section =
  | { kind: "cols"; cols: ColDef[] }
  | { kind: "group"; id: GroupId; label: string; cols: ColDef[] };

const SECTIONS: Section[] = [
  {
    kind: "cols",
    cols: [
      { key: "grupo", label: "GRUPO" },
      { key: "referencia", label: "REF" },
      { key: "descripcion", label: "DESCRIPCIÓN" },
      { key: "cant", label: "CANT", numeric: true },
    ],
  },
  {
    kind: "group",
    id: "cu",
    label: "CU",
    cols: [
      { key: "cumat", label: "CUMAT", numeric: true },
      { key: "cumo", label: "CUMO", numeric: true },
      { key: "cunago", label: "CUNAGO", numeric: true },
    ],
  },
  {
    kind: "group",
    id: "ct",
    label: "CT desglose",
    cols: [
      { key: "ctmat", label: "CTMAT", numeric: true },
      { key: "ctmo", label: "CTMO", numeric: true },
      { key: "ctsit", label: "CTSIT", numeric: true },
    ],
  },
  {
    kind: "cols",
    cols: [
      { key: "pct_part", label: "%PART", numeric: true },
      { key: "cifu", label: "CIFU", numeric: true },
      { key: "mou", label: "MOU", numeric: true },
      { key: "ctu", label: "CTU", numeric: true },
      { key: "ct", label: "CT", numeric: true },
      { key: "puv", label: "PUV", numeric: true },
      { key: "preciotot", label: "PRECIOTOT", numeric: true },
      { key: "pct_cto", label: "%CTO", numeric: true },
    ],
  },
];

export function CostosProductosPage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const [month, setMonth] = React.useState(() => previousMonth(currentMonthDate()));
  const { data: rows = [], isFetching } = useQuery(productCostsQueryOptions(month));
  const [search, setSearch] = React.useState("");
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState<{ cu: boolean; ct: boolean }>({
    cu: false,
    ct: false,
  });

  const toggleGroup = React.useCallback((id: GroupId) => {
    setExpanded((s) => ({ ...s, [id]: !s[id] }));
  }, []);

  const visibleColCount = React.useMemo(
    () =>
      SECTIONS.reduce(
        (n, s) => n + (s.kind === "cols" || expanded[s.id] ? s.cols.length : 1),
        0,
      ),
    [expanded],
  );

  const refresh = React.useCallback(
    (m: string) => {
      void queryClient.invalidateQueries({ queryKey: productCostsKey(m) });
    },
    [queryClient],
  );

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
          {isFetching && <Loader2 className="h-3 w-3 animate-spin" />}
          {formatMonth(month)} · {filtered.length} productos
        </p>
      </div>

      <div className={cn("mt-4 glass overflow-hidden rounded-2xl transition-opacity", isFetching && "opacity-60")}>
        <div className="max-h-[calc(100vh-280px)] overflow-auto">
          <Table>
            <TableHeader className="sticky top-0 z-10 bg-background/95 backdrop-blur">
              <TableRow>
                {SECTIONS.map((s, idx) => {
                  if (s.kind === "cols") {
                    return s.cols.map((c) => (
                      <TableHead key={c.key} className={c.numeric ? "text-right text-xs" : "text-xs"}>
                        {c.label}
                      </TableHead>
                    ));
                  }
                  if (!expanded[s.id]) {
                    return (
                      <TableHead key={`g-${s.id}-${idx}`} className="text-center text-xs">
                        <button
                          type="button"
                          onClick={() => toggleGroup(s.id)}
                          className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                          title={`Mostrar ${s.label}`}
                        >
                          <ChevronRight className="h-3 w-3" />
                          {s.label}
                        </button>
                      </TableHead>
                    );
                  }
                  return s.cols.map((c, ci) => (
                    <TableHead key={c.key} className={c.numeric ? "text-right text-xs" : "text-xs"}>
                      <span className="inline-flex items-center gap-1">
                        {ci === 0 && (
                          <button
                            type="button"
                            onClick={() => toggleGroup(s.id)}
                            className="inline-flex h-4 w-4 items-center justify-center rounded text-muted-foreground hover:bg-muted hover:text-foreground"
                            title={`Ocultar ${s.label}`}
                          >
                            <ChevronDown className="h-3 w-3" />
                          </button>
                        )}
                        {c.label}
                      </span>
                    </TableHead>
                  ));
                })}
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={visibleColCount} className="h-40 text-center">
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
                    {SECTIONS.map((s, idx) => {
                      if (s.kind === "group" && !expanded[s.id]) {
                        return (
                          <TableCell
                            key={`g-${s.id}-${idx}`}
                            className="text-center text-xs text-muted-foreground"
                          >
                            …
                          </TableCell>
                        );
                      }
                      return s.cols.map((c) => {
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
                      });
                    })}
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </div>

      {uploadOpen && (
        <React.Suspense fallback={null}>
          <CostosUploadWizard
            defaultMonth={month}
            onClose={() => setUploadOpen(false)}
            onDone={(m) => {
              setUploadOpen(false);
              setMonth(m);
              refresh(m);
            }}
            userId={user?.id ?? null}
            userName={user?.name ?? "Sistema"}
          />
        </React.Suspense>
      )}
    </div>
  );
}

function CostosUploadWizard({
  defaultMonth,
  onClose,
  onDone,
  userId,
  userName,
}: {
  defaultMonth: string;
  onClose: () => void;
  onDone: (month: string) => void;
  userId: string | null;
  userName: string;
}) {
  const [month, setMonth] = React.useState(defaultMonth);
  const [pendingRows, setPendingRows] = React.useState<
    Record<ColKey, string | number | null>[] | null
  >(null);
  const [confirm, setConfirm] = React.useState<{ existingCount: number } | null>(null);
  const [overwriting, setOverwriting] = React.useState(false);

  const insertRows = React.useCallback(
    async (rowsToInsert: Record<ColKey, string | number | null>[]) => {
      // Replace any existing rows for that month, then insert.
      await supabase.from("product_costs").delete().eq("period_month", month);
      const items = rowsToInsert
        .filter((r) => r.referencia != null && String(r.referencia).trim() !== "")
        .map((r) => {
          const base: Record<string, unknown> = {
            period_month: month,
            referencia: String(r.referencia).trim(),
            created_by_id: userId,
            created_by_name: userName,
          };
          for (const k of NUMERIC_KEYS) {
            base[k] = r[k] ?? null;
          }
          if (r.grupo != null) base.grupo = String(r.grupo).trim() || null;
          if (r.descripcion != null) base.descripcion = String(r.descripcion).trim() || null;
          return base;
        });
      await chunkedInsert(items, 500, async (batch) => {
        const { error } = await supabase.from("product_costs").insert(batch as never);
        if (error) throw error;
      });
      toast.success(`${items.length} productos cargados para ${formatMonth(month)}`);
      onDone(month);
    },
    [month, userId, userName, onDone],
  );

  const handleConfirm = React.useCallback(
    async (rows: Record<ColKey, string | number | null>[]) => {
      const { count, error } = await supabase
        .from("product_costs")
        .select("id", { count: "exact", head: true })
        .eq("period_month", month);
      if (error) {
        toast.error("No se pudo verificar el mes");
        return false;
      }
      if ((count ?? 0) > 0) {
        // Defer until user confirms overwrite.
        setPendingRows(rows);
        setConfirm({ existingCount: count ?? 0 });
        return false;
      }
      try {
        await insertRows(rows);
        return true;
      } catch (e) {
        console.error(e);
        toast.error("Error al subir el Excel");
        return false;
      }
    },
    [month, insertRows],
  );

  const handleOverwrite = async () => {
    if (!pendingRows) return;
    setOverwriting(true);
    try {
      await insertRows(pendingRows);
      setConfirm(null);
      setPendingRows(null);
    } catch (e) {
      console.error(e);
      toast.error("Error al sobrescribir el mes");
    } finally {
      setOverwriting(false);
    }
  };

  return (
    <>
      <ImportWizardDialog<ColKey>
        open
        onClose={onClose}
        title="Subir costos del mes"
        description="Elige hoja, fila de encabezados y mapea las columnas. Solo Referencia y CTU son obligatorios."
        fields={WIZARD_FIELDS}
        numericKeys={NUMERIC_KEYS}
        submitLabel="Subir costos"
        onConfirm={handleConfirm}
        textFilterKey="referencia"
        extraStep1={
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Mes
            </label>
            <MonthSelect value={month} onValueChange={setMonth} className="h-10 w-full" />
          </div>
        }
      />
      <AlertDialog
        open={!!confirm}
        onOpenChange={(o) => {
          if (!o && !overwriting) {
            setConfirm(null);
            setPendingRows(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Sobrescribir mes</AlertDialogTitle>
            <AlertDialogDescription>
              Ya hay {confirm?.existingCount} productos para {formatMonth(month)}. Si continúas se reemplazarán por los del nuevo Excel.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={overwriting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleOverwrite} disabled={overwriting}>
              {overwriting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Sí, sobrescribir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
