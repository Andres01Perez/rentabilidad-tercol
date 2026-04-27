import * as React from "react";
import {
  TrendingUp,
  Upload,
  Loader2,
  Search,
  Wallet,
  PiggyBank,
  Percent,
  ShoppingCart,
  AlertTriangle,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Landmark,
  Receipt,
  RefreshCw,
} from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { MonthSelect } from "@/components/period/MonthSelect";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSalesAnalytics, useSalesDetail, type RankingItem, type DetailRow } from "./useSalesAnalytics";
// El dialog de subida es secundario y pesado (xlsx parser, etc.):
// lo cargamos perezosamente para que NO viaje en el chunk inicial de la página.
const UploadVentasDialog = React.lazy(() =>
  import("./UploadVentasDialog").then((m) => ({ default: m.UploadVentasDialog })),
);
import { currentMonthDate, formatCurrency, formatNumber, formatPercent, previousMonth } from "@/lib/period";
import { cn } from "@/lib/utils";

function pickDefaultMonth(available: string[], preferred: string) {
  if (available.includes(preferred)) return preferred;
  return available[0] ?? preferred;
}

function mapMonthOptions(months: string[]) {
  return months.map((value) => {
    const date = new Date(`${value}T00:00:00`);
    const label = new Intl.DateTimeFormat("es-CO", {
      month: "long",
      year: "numeric",
    }).format(date);
    return {
      value,
      label: label.charAt(0).toUpperCase() + label.slice(1),
    };
  });
}

const KpiCard = React.memo(function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
  valueClassName,
  hintClassName,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative" | "primary";
  valueClassName?: string;
  hintClassName?: string;
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
      <p className={cn("mt-2 truncate text-xl font-bold tracking-tight md:text-2xl", valueClassName)}>{value}</p>
      {hint && <p className={cn("mt-1 truncate text-xs text-muted-foreground", hintClassName)}>{hint}</p>}
    </div>
  );
});

const MultiSelectFilter = React.memo(function MultiSelectFilter({
  label,
  options,
  selected,
  onChange,
}: {
  label: string;
  options: string[];
  selected: string[];
  onChange: (next: string[]) => void;
}) {
  const [search, setSearch] = React.useState("");
  // El input responde al instante; el filtrado de opciones (puede ser de
  // miles de terceros) se aplica con valor diferido.
  const deferredSearch = React.useDeferredValue(search);
  const filtered = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    if (!q) return options;
    return options.filter((o) => o.toLowerCase().includes(q));
  }, [options, deferredSearch]);
  const toggle = (v: string) => {
    onChange(selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v]);
  };
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <Filter className="h-3.5 w-3.5" />
          {label}
          {selected.length > 0 && (
            <Badge variant="secondary" className="ml-1 h-5 px-1.5 text-[10px]">
              {selected.length}
            </Badge>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <div className="border-b border-border/60 p-2">
          <Input
            placeholder={`Buscar ${label.toLowerCase()}…`}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-8"
          />
        </div>
        <div className="max-h-64 overflow-y-auto p-1">
          {filtered.length === 0 && (
            <p className="px-2 py-3 text-center text-xs text-muted-foreground">Sin resultados</p>
          )}
          {filtered.map((opt) => {
            const checked = selected.includes(opt);
            return (
              <button
                key={opt}
                type="button"
                onClick={() => toggle(opt)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                  checked && "bg-accent",
                )}
              >
                <span className="truncate">{opt}</span>
                {checked && <span className="text-xs text-muted-foreground">✓</span>}
              </button>
            );
          })}
        </div>
        {selected.length > 0 && (
          <div className="border-t border-border/60 p-2">
            <Button
              variant="ghost"
              size="sm"
              className="w-full"
              onClick={() => onChange([])}
            >
              <X className="mr-1 h-3 w-3" /> Limpiar selección
            </Button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
});

const OperationalSplitCard = React.memo(function OperationalSplitCard({
  percentage,
  amount,
  items,
}: {
  percentage: string;
  amount: string;
  items: Array<{ id: string; name: string; percentage: number }>;
}) {
  const visibleItems = items.slice(0, 4);
  return (
    <div className="min-w-0 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card p-5 shadow-sm backdrop-blur md:min-h-[132px]">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Operacional
        </span>
        <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <div className="mt-3 grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(180px,220px)] md:items-start">
        <div className="min-w-0">
          <p className="truncate text-2xl font-bold tracking-tight md:text-3xl">{percentage}</p>
          <p className="mt-1 truncate text-sm text-muted-foreground">{amount}</p>
        </div>
        {visibleItems.length > 0 && (
          <div className="min-w-0 space-y-2 border-t border-border/50 pt-3 md:mt-0 md:border-l md:border-t-0 md:pl-4 md:pt-0">
            {visibleItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3 gap-y-1 text-xs">
                <span className="min-w-0 truncate text-muted-foreground" title={item.name}>{item.name}</span>
                <span className="shrink-0 text-right font-medium tabular-nums">
                  {formatPercent(item.percentage, 1)}
                </span>
                <div className="col-span-2 h-1 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className="h-full rounded-full bg-gradient-brand"
                    style={{ width: `${Math.max(6, Math.min(item.percentage, 100))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

const RankingCard = React.memo(function RankingCard({
  title,
  items,
  flagNegative = false,
}: {
  title: string;
  items: RankingItem[];
  flagNegative?: boolean;
}) {
  const max = Math.max(1, ...items.map((i) => Math.abs(i.margenBruto)));
  return (
    <div className="glass rounded-2xl border border-border/60 p-5">
      <h3 className="text-sm font-semibold">{title}</h3>
      {items.length === 0 ? (
        <p className="mt-4 text-xs text-muted-foreground">Sin datos en el período seleccionado.</p>
      ) : (
        <ul className="mt-4 space-y-2">
          {items.map((item) => {
            const pctWidth = (Math.abs(item.margenBruto) / max) * 100;
            const isNeg = item.margenBruto < 0;
            return (
              <li key={item.key} className="space-y-1">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="truncate font-medium" title={item.key}>
                    {item.key}
                  </span>
                  <span className={cn("shrink-0 tabular-nums", isNeg && "text-rose-600")}>
                    {formatCurrency(item.margenBruto)}
                  </span>
                </div>
                <div className="relative h-1.5 overflow-hidden rounded-full bg-muted/60">
                  <div
                    className={cn(
                      "absolute inset-y-0 left-0 rounded-full",
                      isNeg ? "bg-rose-500" : "bg-gradient-brand",
                    )}
                    style={{ width: `${pctWidth}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-[10px] text-muted-foreground">
                  <span>Ventas: {formatCurrency(item.ventas)}</span>
                  <span
                    className={cn(
                      flagNegative && item.margenPct < 0 && "font-semibold text-rose-600",
                    )}
                  >
                    {formatPercent(item.margenPct, 1)}
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
});

type SortKey =
  | "sale_date"
  | "vendedor"
  | "dependencia"
  | "tercero"
  | "referencia"
  | "cantidad"
  | "precio_unitario"
  | "ctu"
  | "margenU"
  | "margenPct";
type SortDir = "asc" | "desc";

const SortableHead = React.memo(function SortableHead({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align = "left",
  width,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
  width: string;
}) {
  const active = current === sortKey;
  return (
    <div
      className={cn(
        "flex h-10 items-center px-3 text-xs font-medium border-b border-border/40",
        align === "right" ? "justify-end" : "justify-start",
      )}
      style={{ width, flexShrink: 0 }}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </div>
  );
});

// Definición de columnas (anchos px) — usada por header y por cada fila virtual.
const COLS: Array<{ key: SortKey; label: string; width: number; align: "left" | "right" }> = [
  { key: "sale_date", label: "Fecha", width: 110, align: "left" },
  { key: "vendedor", label: "Vendedor", width: 150, align: "left" },
  { key: "dependencia", label: "Dependencia", width: 150, align: "left" },
  { key: "tercero", label: "Tercero", width: 220, align: "left" },
  { key: "referencia", label: "Ref", width: 140, align: "left" },
  { key: "cantidad", label: "Cant", width: 90, align: "right" },
  { key: "precio_unitario", label: "PUV", width: 110, align: "right" },
  { key: "ctu", label: "CTU", width: 110, align: "right" },
  { key: "margenU", label: "Margen U.", width: 120, align: "right" },
  { key: "margenPct", label: "Margen %", width: 100, align: "right" },
];

const TOTAL_WIDTH = COLS.reduce((sum, c) => sum + c.width, 0);

const VirtualRow = React.memo(function VirtualRow({ row }: { row: DetailRow }) {
  const margenU = row.margenUnitario;
  const isNegPct = (row.margenPct ?? 0) < 0;
  return (
    <div className="flex items-center border-b border-border/40 text-sm hover:bg-accent/30">
      <div className="px-3 whitespace-nowrap" style={{ width: COLS[0].width, flexShrink: 0 }}>{row.sale_date}</div>
      <div className="px-3 truncate" style={{ width: COLS[1].width, flexShrink: 0 }}>{row.vendedor ?? "—"}</div>
      <div className="px-3 truncate" style={{ width: COLS[2].width, flexShrink: 0 }}>{row.dependencia ?? "—"}</div>
      <div className="px-3 truncate" style={{ width: COLS[3].width, flexShrink: 0 }}>{row.tercero ?? "—"}</div>
      <div className="px-3 font-medium truncate" style={{ width: COLS[4].width, flexShrink: 0 }}>{row.referencia}</div>
      <div className="px-3 text-right tabular-nums" style={{ width: COLS[5].width, flexShrink: 0 }}>{formatNumber(row.cantidad)}</div>
      <div className="px-3 text-right tabular-nums" style={{ width: COLS[6].width, flexShrink: 0 }}>{formatCurrency(row.precio_unitario ?? 0)}</div>
      <div className="px-3 text-right tabular-nums" style={{ width: COLS[7].width, flexShrink: 0 }}>
        {row.ctu !== null ? formatCurrency(row.ctu) : <span className="text-[10px] text-muted-foreground">—</span>}
      </div>
      <div className={cn("px-3 text-right tabular-nums", row.ctu !== null && (margenU ?? 0) < 0 && "text-rose-600")} style={{ width: COLS[8].width, flexShrink: 0 }}>
        {row.ctu !== null && margenU !== null ? formatCurrency(margenU) : <span className="text-muted-foreground">—</span>}
      </div>
      <div className={cn("px-3 text-right tabular-nums", isNegPct && "font-semibold text-rose-600")} style={{ width: COLS[9].width, flexShrink: 0 }}>
        {row.margenPct === null ? "—" : formatPercent(row.margenPct, 1)}
      </div>
    </div>
  );
});

function DetailVirtualTable({
  rows,
  sortKey,
  sortDir,
  onToggleSort,
}: {
  rows: DetailRow[];
  sortKey: SortKey;
  sortDir: SortDir;
  onToggleSort: (k: SortKey) => void;
}) {
  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  return (
    <div ref={parentRef} className="mt-4 max-h-[calc(100vh-200px)] min-h-[600px] overflow-auto rounded-xl border border-border/40">
      <div style={{ width: TOTAL_WIDTH, minWidth: "100%" }}>
        {/* Header sticky */}
        <div className="sticky top-0 z-10 flex bg-card/95 backdrop-blur border-b border-border/60" style={{ width: TOTAL_WIDTH }}>
          {COLS.map((c) => (
            <SortableHead
              key={c.key}
              label={c.label}
              sortKey={c.key}
              current={sortKey}
              dir={sortDir}
              onClick={onToggleSort}
              align={c.align}
              width={`${c.width}px`}
            />
          ))}
        </div>
        {/* Body virtualizado */}
        {rows.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Sin resultados con los filtros aplicados.
          </div>
        ) : (
          <div style={{ height: virtualizer.getTotalSize(), position: "relative", width: TOTAL_WIDTH }}>
            {virtualizer.getVirtualItems().map((vRow) => {
              const row = rows[vRow.index];
              return (
                <div
                  key={row.id}
                  data-index={vRow.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: TOTAL_WIDTH,
                    transform: `translateY(${vRow.start}px)`,
                  }}
                >
                  <VirtualRow row={row} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export function AnalisisVentasPage() {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const queryClient = useQueryClient();
  const previousMonthDefault = React.useMemo(() => previousMonth(currentMonthDate()), []);
  // Estado borrador (lo que el usuario edita en la barra de filtros)
  const [draftSalesMonth, setDraftSalesMonth] = React.useState<string>(previousMonthDefault);
  const [draftCostPeriod, setDraftCostPeriod] = React.useState<string>(previousMonthDefault);
  const [draftOpPeriod, setDraftOpPeriod] = React.useState<string>(previousMonthDefault);
  const [draftVendedoresF, setDraftVendedoresF] = React.useState<string[]>([]);
  const [draftDependenciasF, setDraftDependenciasF] = React.useState<string[]>([]);
  const [draftTercerosF, setDraftTercerosF] = React.useState<string[]>([]);
  const [draftFinancialDiscountPct, setDraftFinancialDiscountPct] = React.useState<number>(2.5);
  // Estado aplicado (lo que efectivamente se envía a las RPCs)
  const [applied, setApplied] = React.useState({
    salesMonth: previousMonthDefault,
    costPeriod: previousMonthDefault,
    opPeriod: previousMonthDefault,
    financialDiscountPct: 2.5,
    vendedores: [] as string[],
    dependencias: [] as string[],
    terceros: [] as string[],
  });
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("sale_date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  // El input responde al instante; el RPC sólo se dispara con el valor diferido
  // (combinado con el debounce interno del hook).
  const deferredSearch = React.useDeferredValue(search);

  const appliedFilters = React.useMemo(
    () => ({
      vendedores: applied.vendedores,
      dependencias: applied.dependencias,
      terceros: applied.terceros,
    }),
    [applied.vendedores, applied.dependencias, applied.terceros],
  );

  const analytics = useSalesAnalytics({
    salesMonth: applied.salesMonth,
    costPeriodMonth: applied.costPeriod,
    opPeriodMonth: applied.opPeriod,
    financialDiscountPct: applied.financialDiscountPct,
    filters: appliedFilters,
    refreshKey,
  });

  const detail = useSalesDetail({
    salesMonth: applied.salesMonth,
    costPeriodMonth: applied.costPeriod,
    financialDiscountPct: applied.financialDiscountPct,
    filters: appliedFilters,
    search: deferredSearch,
    sortKey,
    sortDir,
    limit: 500,
    refreshKey,
    enabled: analytics.hasAnySales,
  });

  const salesMonthOptions = React.useMemo(() => mapMonthOptions(analytics.salesMonths), [analytics.salesMonths]);
  const discountOptions = analytics.financialDiscounts;

  // Estabilizamos las referencias de `uniques` por contenido para evitar
  // re-renders en cascada de los `MultiSelectFilter` cuando el hook devuelve
  // un objeto nuevo con los mismos arrays.
  const vendedoresOptions = React.useMemo(
    () => analytics.uniques.vendedores,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analytics.uniques.vendedores.join("|")],
  );
  const dependenciasOptions = React.useMemo(
    () => analytics.uniques.dependencias,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analytics.uniques.dependencias.join("|")],
  );
  const tercerosOptions = React.useMemo(
    () => analytics.uniques.terceros,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [analytics.uniques.terceros.join("|")],
  );

  React.useEffect(() => {
    if (discountOptions.length === 0) return;
    const defaultOption = discountOptions.find((item) => Math.abs(item.percentage - 2.5) < 0.001);
    const selectedExists = discountOptions.some(
      (item) => Math.abs(item.percentage - draftFinancialDiscountPct) < 0.001,
    );
    if (!selectedExists) {
      const next = defaultOption?.percentage ?? discountOptions[0].percentage;
      setDraftFinancialDiscountPct(next);
      setApplied((prev) =>
        Math.abs(prev.financialDiscountPct - next) < 0.001
          ? prev
          : { ...prev, financialDiscountPct: next },
      );
    }
  }, [discountOptions, draftFinancialDiscountPct]);

  React.useEffect(() => {
    if (analytics.salesMonths.length === 0) return;
    setDraftSalesMonth((current) => pickDefaultMonth(analytics.salesMonths, current));
    setApplied((prev) => {
      const next = pickDefaultMonth(analytics.salesMonths, prev.salesMonth);
      return next === prev.salesMonth ? prev : { ...prev, salesMonth: next };
    });
  }, [analytics.salesMonths]);

  const toggleSort = React.useCallback((key: SortKey) => {
    setSortKey((cur) => {
      if (cur === key) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return cur;
      }
      setSortDir("asc");
      return key;
    });
  }, []);

  const clearAllFilters = React.useCallback(() => {
    setSearch("");
  }, []);

  const hasAnyFilter = search.trim() !== "";

  // ¿Hay diferencias entre borrador y aplicado?
  const arraysEqual = (a: string[], b: string[]) => {
    if (a.length !== b.length) return false;
    const sa = [...a].sort();
    const sb = [...b].sort();
    for (let i = 0; i < sa.length; i++) if (sa[i] !== sb[i]) return false;
    return true;
  };
  const hasPendingChanges =
    draftSalesMonth !== applied.salesMonth ||
    draftCostPeriod !== applied.costPeriod ||
    draftOpPeriod !== applied.opPeriod ||
    Math.abs(draftFinancialDiscountPct - applied.financialDiscountPct) > 0.0001 ||
    !arraysEqual(draftVendedoresF, applied.vendedores) ||
    !arraysEqual(draftDependenciasF, applied.dependencias) ||
    !arraysEqual(draftTercerosF, applied.terceros);

  const handleApply = React.useCallback(() => {
    setApplied({
      salesMonth: draftSalesMonth,
      costPeriod: draftCostPeriod,
      opPeriod: draftOpPeriod,
      financialDiscountPct: draftFinancialDiscountPct,
      vendedores: draftVendedoresF,
      dependencias: draftDependenciasF,
      terceros: draftTercerosF,
    });
  }, [
    draftSalesMonth,
    draftCostPeriod,
    draftOpPeriod,
    draftFinancialDiscountPct,
    draftVendedoresF,
    draftDependenciasF,
    draftTercerosF,
  ]);

  const handleDiscard = React.useCallback(() => {
    setDraftSalesMonth(applied.salesMonth);
    setDraftCostPeriod(applied.costPeriod);
    setDraftOpPeriod(applied.opPeriod);
    setDraftFinancialDiscountPct(applied.financialDiscountPct);
    setDraftVendedoresF(applied.vendedores);
    setDraftDependenciasF(applied.dependencias);
    setDraftTercerosF(applied.terceros);
  }, [applied]);

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 px-4 py-10 sm:px-6 lg:px-10">
      <PageHeader
        icon={TrendingUp}
        eyebrow="Análisis"
        title="Análisis de ventas"
        description="Dashboard cruzado de ventas con costos de producto y costos operacionales para identificar margen real por mes, vendedor, dependencia y cliente."
        actions={
          <Button onClick={() => setUploadOpen(true)} className="gap-2">
            <Upload className="h-4 w-4" /> Subir Excel de ventas
          </Button>
        }
      />

      {analytics.loading && !analytics.hasLoadedOnce ? (
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          <Loader2 className="mr-2 h-5 w-5 animate-spin" /> Cargando análisis…
        </div>
      ) : !analytics.hasAnySales ? (
        <div className="glass mx-auto max-w-lg rounded-3xl border border-border/60 p-10 text-center">
          <TrendingUp className="mx-auto h-10 w-10 text-muted-foreground" />
          <h2 className="mt-4 text-lg font-semibold">Aún no hay ventas cargadas</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            Sube tu Excel con las columnas Año, Mes, Día, Vendedor, Dependencia, Tercero,
            ProductoC, Valor y Cantidad para activar el dashboard.
          </p>
          <Button className="mt-6 gap-2" onClick={() => setUploadOpen(true)}>
            <Upload className="h-4 w-4" /> Subir Excel de ventas
          </Button>
        </div>
      ) : (
        <>
          {analytics.loading && (
            <div className="-mb-6 h-0.5 overflow-hidden rounded-full">
              <div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] bg-gradient-brand" />
            </div>
          )}
          {/* Filtros sticky */}
          <div className="glass sticky top-16 z-30 mt-2 flex flex-wrap items-end justify-between gap-4 rounded-2xl border border-border/60 bg-card/95 p-4 shadow-sm backdrop-blur-xl">
            {/* Bloque izquierdo: filtros */}
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mes de ventas
                </span>
                <MonthSelect
                  value={draftSalesMonth}
                  onValueChange={setDraftSalesMonth}
                  className="w-44"
                  options={salesMonthOptions}
                />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mes de costos
                </span>
                <MonthSelect value={draftCostPeriod} onValueChange={setDraftCostPeriod} className="w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Mes operacional
                </span>
                <MonthSelect value={draftOpPeriod} onValueChange={setDraftOpPeriod} className="w-40" />
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Descuento financiero
                </span>
                <Select
                  value={String(draftFinancialDiscountPct)}
                  onValueChange={(value) => setDraftFinancialDiscountPct(Number(value))}
                >
                  <SelectTrigger className="w-40">
                    <SelectValue placeholder="Selecciona" />
                  </SelectTrigger>
                  <SelectContent>
                    {discountOptions.map((option) => (
                      <SelectItem key={option.id} value={String(option.percentage)}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Filtros adicionales
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <MultiSelectFilter
                    label="Vendedor"
                    options={vendedoresOptions}
                    selected={draftVendedoresF}
                    onChange={setDraftVendedoresF}
                  />
                  <MultiSelectFilter
                    label="Dependencia"
                    options={dependenciasOptions}
                    selected={draftDependenciasF}
                    onChange={setDraftDependenciasF}
                  />
                  <MultiSelectFilter
                    label="Tercero"
                    options={tercerosOptions}
                    selected={draftTercerosF}
                    onChange={setDraftTercerosF}
                  />
                </div>
              </div>
            </div>

            {/* Bloque derecho: acciones, alineadas al fondo */}
            <div className="flex flex-wrap items-center gap-2">
              {hasPendingChanges && (
                <Badge variant="outline" className="gap-1 border-amber-300 bg-amber-50 text-amber-800">
                  <AlertTriangle className="h-3 w-3" />
                  Cambios sin aplicar
                </Badge>
              )}
              {hasPendingChanges && (
                <Button variant="outline" size="sm" onClick={handleDiscard} className="gap-1.5">
                  <X className="h-3.5 w-3.5" /> Descartar
                </Button>
              )}
              <Button
                size="sm"
                onClick={handleApply}
                disabled={!hasPendingChanges || analytics.loading}
                className="gap-1.5"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", analytics.loading && "animate-spin")} />
                Actualizar
              </Button>
            </div>
          </div>

          {analytics.ctuMapSize === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              No hay costos de producto cargados para el mes seleccionado. El margen se calculará
              como ventas totales (sin costos).
            </div>
          )}

          {analytics.kpis.lineasExcluidas > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                <strong>{formatNumber(analytics.kpis.lineasExcluidas)}</strong> líneas
                ({formatCurrency(analytics.kpis.ventasExcluidas)} en ventas) se excluyen del cálculo
                de margen para evitar sesgo.
              </span>
              {analytics.kpis.lineasCostoCero > 0 && (
                <Badge variant="outline" className="border-rose-300 bg-rose-50 text-rose-700">
                  Costo 0: {formatNumber(analytics.kpis.lineasCostoCero)}
                </Badge>
              )}
              {analytics.kpis.lineasSinCosto > 0 && (
                <Badge variant="outline" className="border-amber-300 bg-amber-100 text-amber-800">
                  Sin costo: {formatNumber(analytics.kpis.lineasSinCosto)}
                </Badge>
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
            <KpiCard
              icon={Wallet}
              label="Ventas totales"
              value={formatCurrency(analytics.kpis.ventas)}
              hint={`${formatNumber(analytics.kpis.lineas)} líneas`}
              tone="primary"
            />
            <KpiCard
              icon={PiggyBank}
              label="Margen bruto en plata"
              value={formatCurrency(analytics.kpis.margenBruto)}
              hint={`Base neta: ${formatCurrency(analytics.kpis.ventasNetas)}`}
              tone={analytics.kpis.margenBruto >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              icon={Percent}
              label="Margen bruto %"
              value={formatPercent(analytics.kpis.margenPct, 2)}
              hint={`Descuento fin. ${formatPercent(analytics.kpis.descuentoFinancieroPct, 1)}`}
              tone={analytics.kpis.margenPct >= 0 ? "positive" : "negative"}
              valueClassName="text-2xl md:text-3xl"
            />
            <OperationalSplitCard
              percentage={formatPercent(analytics.kpis.pctOperacional, 1)}
              amount={formatCurrency(analytics.kpis.operacionalMonto)}
              items={analytics.operationalBreakdown}
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4 [&>*]:min-w-0">
            <KpiCard
              icon={Receipt}
              label="Ventas netas"
              value={formatCurrency(analytics.kpis.ventasNetas)}
              hint={`Desc. financiero: ${formatCurrency(analytics.kpis.descuentoFinancieroMonto)}`}
              tone="primary"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Costo total"
              value={formatCurrency(analytics.kpis.costo)}
              hint={`CTU mes ${applied.costPeriod.slice(0, 7)}`}
            />
            <KpiCard
              icon={Landmark}
              label="Utilidad operacional"
              value={formatCurrency(analytics.kpis.utilidadOperacional)}
              hint={`Utilidad: ${formatCurrency(analytics.kpis.utilidad)}`}
              tone={analytics.kpis.utilidadOperacional >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              icon={Percent}
              label="Utilidad operacional %"
              value={formatPercent(analytics.kpis.utilidadOperacionalPct, 2)}
              hint={`${formatPercent(analytics.kpis.margenPct, 2)} - ${formatPercent(analytics.kpis.pctOperacional, 1)}`}
              tone={analytics.kpis.utilidadOperacionalPct >= 0 ? "positive" : "negative"}
              valueClassName="text-2xl md:text-3xl"
            />
          </div>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RankingCard title="Top vendedores · margen bruto" items={analytics.rankings.vendedores} />
            <RankingCard title="Top dependencias · margen bruto" items={analytics.rankings.dependencias} />
            <RankingCard title="Top terceros · margen bruto" items={analytics.rankings.terceros} />
            <RankingCard title="Top productos · margen bruto" items={analytics.rankings.productos} flagNegative />
          </div>

          {/* Tabla detalle */}
          <div className="glass rounded-2xl border border-border/60 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Detalle de ventas</h3>
                <p className="text-xs text-muted-foreground">
                  Mostrando {formatNumber(detail.rows.length)} de {formatNumber(detail.total)} líneas filtradas
                  {detail.loading && <span className="ml-2 inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> actualizando…</span>}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {hasAnyFilter && (
                  <Button variant="outline" size="sm" onClick={clearAllFilters} className="gap-1.5">
                    <X className="h-3.5 w-3.5" /> Limpiar filtros
                  </Button>
                )}
                <div className="relative w-72">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Buscar referencia, tercero o vendedor…"
                    className="h-9 pl-8"
                  />
                </div>
              </div>
            </div>
            <DetailVirtualTable
              rows={detail.rows}
              sortKey={sortKey}
              sortDir={sortDir}
              onToggleSort={toggleSort}
            />
          </div>
        </>
      )}

      {/* Solo montamos el dialog cuando el usuario lo abre — esto evita
          descargar el chunk de xlsx hasta que realmente se necesita. */}
      {uploadOpen && (
        <React.Suspense fallback={null}>
          <UploadVentasDialog
            open={uploadOpen}
            onOpenChange={setUploadOpen}
            onUploaded={() => setRefreshKey((k) => k + 1)}
          />
        </React.Suspense>
      )}
    </div>
  );
}
