import * as React from "react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Calculator,
  Loader2,
  Tags,
  Briefcase,
  Sparkles,
  Wallet,
  PiggyBank,
  Percent,
  Package,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { currentMonthDate, formatCurrency, formatMonth, formatNumber, formatPercent, previousMonth } from "@/lib/period";
import { cn } from "@/lib/utils";
import { StepCard } from "./StepCard";
import { MultiMonthPicker } from "./MultiMonthPicker";
import { RentabilidadTable } from "./RentabilidadTable";
import { RentabilidadCharts } from "./RentabilidadCharts";
import {
  useMonthCatalog,
  useSourceOptions,
  fetchSourceItems,
  fetchProductCostsByMonths,
  fetchOperationalByMonths,
  computeRentabilidad,
  type SourceKind,
  type RentabilidadRow,
  type OpMonthInfo,
  type SourceOption,
} from "./useCalculadora";
import {
  operationalQueryOptions,
  productCostsKey,
} from "./queries";
import { exportRentabilidadExcel } from "./exportExcel";

function pickDefaultMonth(available: string[], preferred: string) {
  if (available.includes(preferred)) return preferred;
  return available[0] ?? "";
}

const KpiCard = React.memo(function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "primary";
}) {
  const toneClasses = {
    default: "from-card to-card",
    primary: "from-primary/10 to-primary/5",
    positive: "from-emerald-500/10 to-emerald-500/5",
    negative: "from-rose-500/10 to-rose-500/5",
  }[tone];
  return (
    <div
      className={cn(
        "min-w-0 rounded-2xl border border-border/60 bg-gradient-to-br p-5 shadow-sm backdrop-blur",
        toneClasses,
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-2 truncate text-xl font-bold tracking-tight md:text-2xl">{value}</p>
      {hint && <p className="mt-1 truncate text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
});

interface CalcResult {
  rows: RentabilidadRow[];
  source: { kind: SourceKind; option: SourceOption };
  costMonths: string[];
  opMonths: OpMonthInfo[];
  avgOpPct: number;
}

export function CalculadoraPage() {
  const { costMonths: availCost, opMonths: availOp, loading: catalogLoading } =
    useMonthCatalog();
  const previousMonthDefault = React.useMemo(() => previousMonth(currentMonthDate()), []);
  const queryClient = useQueryClient();

  // Paso 1
  const [sourceKind, setSourceKind] = React.useState<SourceKind>("price_list");
  const [sourceId, setSourceId] = React.useState<string>("");
  const { options: sourceOptions, loading: sourceLoading } = useSourceOptions(sourceKind);

  React.useEffect(() => {
    setSourceId("");
  }, [sourceKind]);

  // Paso 2 y 3
  const [costMonthsSel, setCostMonthsSel] = React.useState<string[]>([]);
  const [opMonthsSel, setOpMonthsSel] = React.useState<string[]>([]);

  React.useEffect(() => {
    if (availCost.length === 0) return;
    setCostMonthsSel((current) =>
      current.length > 0 ? current : [pickDefaultMonth(availCost, previousMonthDefault)],
    );
  }, [availCost, previousMonthDefault]);

  React.useEffect(() => {
    if (availOp.length === 0) return;
    setOpMonthsSel((current) =>
      current.length > 0 ? current : [pickDefaultMonth(availOp, previousMonthDefault)],
    );
  }, [availOp, previousMonthDefault]);

  // Preview operacional con cache (60s). Se aprovecha también al pulsar
  // "Calcular" porque el cache se reutiliza.
  const { data: opPreviewData, isFetching: opPreviewLoading } = useQuery(
    operationalQueryOptions(opMonthsSel),
  );
  const opPreview: OpMonthInfo[] = opPreviewData?.perMonth ?? [];

  const opAvgPreview =
    opPreview.length > 0
      ? opPreview.reduce((a, b) => a + b.totalPct, 0) / opPreview.length
      : 0;

  // Preview de costos: una sola RPC que devuelve el conteo por mes.
  // Antes hacíamos N requests (uno por mes) descargando filas completas.
  const { data: costPreview = [] } = useQuery({
    queryKey: ["calc", "cost-preview", costMonthsSel.slice().sort().join("|")],
    enabled: costMonthsSel.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_cost_month_summary", {
        p_months: costMonthsSel,
      });
      if (error) throw error;
      const rows = (data as Array<{ month: string; product_count: number }>) ?? [];
      return rows.map((r) => ({ month: String(r.month), count: Number(r.product_count) }));
    },
  });

  // Resultado
  const [calculating, setCalculating] = React.useState(false);
  const [result, setResult] = React.useState<CalcResult | null>(null);

  const step1Done = sourceId !== "";
  const step2Done = costMonthsSel.length > 0;
  const step3Done = opMonthsSel.length > 0;
  const canCalculate = step1Done && step2Done && step3Done;

  const handleCalculate = async () => {
    if (!canCalculate) return;
    const option = sourceOptions.find((o) => o.id === sourceId);
    if (!option) return;
    setCalculating(true);
    try {
      // Reutilizamos los datos cacheados por React Query cuando ya están
      // frescos: si el usuario cambió de fuente pero los meses son iguales,
      // no se vuelven a pedir costos ni operacionales.
      const [items, costs, op] = await Promise.all([
        queryClient.fetchQuery({
          queryKey: ["calc", "source-items", sourceKind, sourceId],
          queryFn: () => fetchSourceItems(sourceKind, sourceId),
        }),
        queryClient.fetchQuery({
          queryKey: productCostsKey(costMonthsSel),
          queryFn: () => fetchProductCostsByMonths(costMonthsSel),
        }),
        queryClient.fetchQuery({
          ...operationalQueryOptions(opMonthsSel),
        }),
      ]);
      const rows = computeRentabilidad(items, costs, costMonthsSel, op.avgPct);
      setResult({
        rows,
        source: { kind: sourceKind, option },
        costMonths: costMonthsSel,
        opMonths: op.perMonth,
        avgOpPct: op.avgPct,
      });
      const excluded = rows.filter((r) => r.ctuProm === null).length;
      const cero = rows.filter((r) => r.costoCero).length;
      if (excluded > 0) {
        toast.warning(
          `${excluded} productos excluidos del margen` +
            (cero > 0 ? ` (${cero} con costo en cero)` : ""),
        );
      } else {
        toast.success(`Rentabilidad calculada para ${rows.length} productos.`);
      }
    } catch (e) {
      console.error(e);
      toast.error("Error al calcular rentabilidad");
    } finally {
      setCalculating(false);
    }
  };

  const kpis = React.useMemo(() => {
    if (!result) return null;
    let precioTot = 0;
    let costoTot = 0;
    let margenBruto = 0;
    let margenNeto = 0;
    let withMargen = 0;
    let sinCosto = 0;
    let costoCero = 0;
    for (const r of result.rows) {
      precioTot += r.precioNeto * r.cantidad;
      if (r.ctuProm === null) {
        sinCosto++;
        if (r.costoCero) costoCero++;
        continue;
      }
      costoTot += r.ctuProm * r.cantidad;
      margenBruto += (r.margenUnit ?? 0) * r.cantidad;
      margenNeto += (r.margenNetoUnit ?? 0) * r.cantidad;
      withMargen++;
    }
    return {
      total: result.rows.length,
      withMargen,
      sinCosto,
      costoCero,
      sinRegistro: sinCosto - costoCero,
      precioTot,
      costoTot,
      margenBruto,
      margenNeto,
      margenBrutoPct: precioTot !== 0 ? (margenBruto / precioTot) * 100 : 0,
      margenNetoPct: precioTot !== 0 ? (margenNeto / precioTot) * 100 : 0,
    };
  }, [result]);

  const [showExcluded, setShowExcluded] = React.useState(false);
  const excludedRows = React.useMemo(
    () => (result ? result.rows.filter((r) => r.ctuProm === null) : []),
    [result],
  );

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 overflow-x-hidden px-4 py-10 sm:px-6 lg:px-10">
      <PageHeader
        icon={Calculator}
        eyebrow="Análisis"
        title="Calculadora de rentabilidad"
        description="Sigue los pasos: elige fuente de precios, meses de costos y meses operacionales, y calcula la rentabilidad real producto por producto."
      />

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Paso 1 */}
        <StepCard step={1} title="Fuente de precios" done={step1Done}>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setSourceKind("price_list")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-xs transition-all",
                  sourceKind === "price_list"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/60 hover:bg-muted",
                )}
              >
                <Tags className="h-4 w-4 text-primary" />
                <span className="font-semibold">Lista de precios</span>
                <span className="text-[10px] text-muted-foreground">Sin descuentos</span>
              </button>
              <button
                type="button"
                onClick={() => setSourceKind("negotiation")}
                className={cn(
                  "flex flex-col items-start gap-1 rounded-xl border p-3 text-left text-xs transition-all",
                  sourceKind === "negotiation"
                    ? "border-primary bg-primary/5 shadow-sm"
                    : "border-border/60 hover:bg-muted",
                )}
              >
                <Briefcase className="h-4 w-4 text-primary" />
                <span className="font-semibold">Negociación</span>
                <span className="text-[10px] text-muted-foreground">Aplica descuentos</span>
              </button>
            </div>
            <Select value={sourceId} onValueChange={setSourceId}>
              <SelectTrigger className="h-10">
                <SelectValue
                  placeholder={
                    sourceLoading
                      ? "Cargando…"
                      : sourceOptions.length === 0
                        ? "Sin opciones disponibles"
                        : sourceKind === "price_list"
                          ? "Selecciona una lista"
                          : "Selecciona una negociación"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                {sourceOptions.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    <div className="flex flex-col">
                      <span className="font-medium">{o.name}</span>
                      <span className="text-[10px] text-muted-foreground">
                        {o.itemsCount} items
                        {o.total ? ` · ${formatCurrency(o.total)}` : ""}
                      </span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {sourceId && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
                <span className="font-semibold">
                  {sourceOptions.find((o) => o.id === sourceId)?.name}
                </span>
                <span className="ml-2 text-muted-foreground">
                  {sourceOptions.find((o) => o.id === sourceId)?.itemsCount} items
                </span>
              </div>
            )}
          </div>
        </StepCard>

        {/* Paso 2 */}
        <StepCard
          step={2}
          title="Costos de producto"
          description="Promedia CTU si eliges varios meses"
          done={step2Done}
          disabled={!step1Done}
        >
          <div className="space-y-3">
            {catalogLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MultiMonthPicker
                available={availCost}
                selected={costMonthsSel}
                onChange={setCostMonthsSel}
                emptyLabel="Selecciona meses de costo"
              />
            )}
            {costPreview.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    Detalle por mes
                  </span>
                  {costPreview.length > 1 && (
                    <Badge variant="secondary" className="text-[10px]">
                      Promedio aplicado
                    </Badge>
                  )}
                </div>
                <ul className="space-y-1">
                  {costPreview.map((c) => (
                    <li key={c.month} className="flex justify-between">
                      <span>{formatMonth(c.month)}</span>
                      <span className="tabular-nums text-muted-foreground">
                        {formatNumber(c.count)} productos
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </StepCard>

        {/* Paso 3 */}
        <StepCard
          step={3}
          title="Costos operacionales"
          description="Promedia % si eliges varios meses"
          done={step3Done}
          disabled={!step2Done}
        >
          <div className="space-y-3">
            {catalogLoading ? (
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            ) : (
              <MultiMonthPicker
                available={availOp}
                selected={opMonthsSel}
                onChange={setOpMonthsSel}
                emptyLabel="Selecciona meses operacionales"
              />
            )}
            {opPreviewLoading && (
              <Loader2 className="h-3 w-3 animate-spin text-muted-foreground" />
            )}
            {opPreview.length > 0 && (
              <div className="rounded-lg border border-border/60 bg-muted/30 p-2.5 text-xs">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    % por mes
                  </span>
                  {opPreview.length > 1 && (
                    <Badge variant="secondary" className="text-[10px]">
                      Promedio aplicado
                    </Badge>
                  )}
                </div>
                <ul className="space-y-1">
                  {opPreview.map((o) => (
                    <li key={o.month} className="flex justify-between">
                      <span>{formatMonth(o.month)}</span>
                      <span className="tabular-nums">
                        {formatPercent(o.totalPct, 2)}
                        <span className="ml-1 text-[10px] text-muted-foreground">
                          · {o.centerCount} centros
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
                <div className="mt-2 flex items-center justify-between border-t border-border/60 pt-2">
                  <span className="font-semibold">Promedio</span>
                  <span className="font-bold tabular-nums text-primary">
                    {formatPercent(opAvgPreview, 2)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </StepCard>
      </div>

      {/* Paso 4 — calcular */}
      <div className="flex flex-col items-center gap-2">
        <Button
          size="lg"
          onClick={handleCalculate}
          disabled={!canCalculate || calculating}
          className={cn(
            "h-14 gap-2 px-10 text-base font-semibold shadow-elegant",
            canCalculate && "bg-gradient-brand text-white",
          )}
        >
          {calculating ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <Sparkles className="h-5 w-5" />
          )}
          Calcular rentabilidad
        </Button>
        {!canCalculate && (
          <p className="text-xs text-muted-foreground">Completa los 3 pasos para activar el cálculo</p>
        )}
      </div>

      {/* Resultado */}
      {result && kpis && (
        <>
          {kpis.sinCosto > 0 && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-800 dark:bg-amber-500/10 dark:text-amber-200">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    <strong>{kpis.sinCosto}</strong> producto{kpis.sinCosto > 1 ? "s" : ""} excluido
                    {kpis.sinCosto > 1 ? "s" : ""} del cálculo de margen
                    {kpis.costoCero > 0 && (
                      <>
                        {" "}
                        ·{" "}
                        <strong>{kpis.costoCero}</strong> con costo en cero
                      </>
                    )}
                    {kpis.sinRegistro > 0 && (
                      <>
                        {" "}
                        · <strong>{kpis.sinRegistro}</strong> sin registro de costo
                      </>
                    )}
                    .
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowExcluded((v) => !v)}
                  className="h-7 gap-1 text-xs text-amber-900 hover:bg-amber-100 dark:text-amber-100 dark:hover:bg-amber-500/20"
                >
                  {showExcluded ? (
                    <>
                      <ChevronUp className="h-3 w-3" /> Ocultar lista
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3" /> Ver lista
                    </>
                  )}
                </Button>
              </div>
              {showExcluded && (
                <div className="mt-3 max-h-72 overflow-auto rounded-lg border border-amber-300/40 bg-white/60 p-2 dark:bg-black/20">
                  <table className="w-full text-xs">
                    <thead className="sticky top-0 bg-white/95 text-left dark:bg-black/40">
                      <tr className="border-b border-amber-300/40">
                        <th className="px-2 py-1 font-semibold">Referencia</th>
                        <th className="px-2 py-1 font-semibold">Descripción</th>
                        <th className="px-2 py-1 font-semibold">Motivo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {excludedRows.map((r) => (
                        <tr key={r.referencia} className="border-b border-amber-200/30 last:border-0">
                          <td
                            className="px-2 py-1 font-bold"
                            style={{ fontFamily: "Montserrat, sans-serif" }}
                          >
                            {r.referencia}
                          </td>
                          <td className="px-2 py-1 text-muted-foreground">
                            {r.descripcion ?? "—"}
                          </td>
                          <td className="px-2 py-1">
                            <Badge
                              variant="outline"
                              className={cn(
                                "text-[10px]",
                                r.costoCero
                                  ? "border-rose-400/60 text-rose-700 dark:text-rose-300"
                                  : "border-amber-400/60 text-amber-700 dark:text-amber-300",
                              )}
                            >
                              {r.costoCero ? "Costo en cero" : "Sin registro"}
                            </Badge>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-6 [&>*]:min-w-0">
            <KpiCard
              icon={Package}
              label="Productos"
              value={formatNumber(kpis.total)}
              hint={`${kpis.withMargen} con costo`}
              tone="primary"
            />
            <KpiCard
              icon={Wallet}
              label="Precio total"
              value={formatCurrency(kpis.precioTot)}
              hint="Suma precio neto × cant"
            />
            <KpiCard
              icon={Package}
              label="Costo total"
              value={formatCurrency(kpis.costoTot)}
              hint="CTU prom × cant"
            />
            <KpiCard
              icon={PiggyBank}
              label="Margen bruto"
              value={formatCurrency(kpis.margenBruto)}
              hint={formatPercent(kpis.margenBrutoPct, 2)}
              tone={kpis.margenBruto >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              icon={Percent}
              label="Margen neto"
              value={formatCurrency(kpis.margenNeto)}
              hint={`${formatPercent(kpis.margenNetoPct, 2)} · op. ${formatPercent(result.avgOpPct, 1)}`}
              tone={kpis.margenNeto >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              icon={Sparkles}
              label="Margen neto %"
              value={formatPercent(kpis.margenNetoPct, 2)}
              hint={`Op. promedio ${formatPercent(result.avgOpPct, 2)}`}
              tone={kpis.margenNetoPct >= 0 ? "positive" : "negative"}
            />
          </div>

          <RentabilidadTable
            rows={result.rows}
            onExport={() => {
              void exportRentabilidadExcel(result);
            }}
          />

          <RentabilidadCharts rows={result.rows} />
        </>
      )}
    </div>
  );
}