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
  Users,
  Building2,
  UserCheck,
  AlertTriangle,
  Filter,
  X,
  ChevronUp,
  ChevronDown,
  ChevronsUpDown,
  Landmark,
  Receipt,
} from "lucide-react";
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSalesAnalytics, type RankingItem } from "./useSalesAnalytics";
import { UploadVentasDialog } from "./UploadVentasDialog";
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

function KpiCard({
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
}

function MultiSelectFilter({
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
  const filtered = React.useMemo(
    () => options.filter((o) => o.toLowerCase().includes(search.toLowerCase())),
    [options, search],
  );
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
}

function OperationalSplitCard({
  percentage,
  amount,
}: {
  percentage: string;
  amount: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl border border-border/60 bg-gradient-to-br from-card to-card p-5 shadow-sm backdrop-blur">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Operacional
        </span>
        <Landmark className="h-4 w-4 shrink-0 text-muted-foreground" />
      </div>
      <p className="mt-2 truncate text-2xl font-bold tracking-tight md:text-3xl">{percentage}</p>
      <p className="mt-1 truncate text-sm text-muted-foreground">{amount}</p>
    </div>
  );
}

function RankingCard({
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
}

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
type ColFilters = Record<SortKey, string>;

type NumFilter =
  | { kind: "eq"; a: number }
  | { kind: "gt"; a: number }
  | { kind: "gte"; a: number }
  | { kind: "lt"; a: number }
  | { kind: "lte"; a: number }
  | { kind: "range"; a: number; b: number };

function parseNumLiteral(s: string): number | null {
  // Limpia separadores de miles y acepta coma decimal.
  const cleaned = s.replace(/\s+/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseNumFilter(input: string): NumFilter | null {
  const s = input.trim();
  if (!s) return null;
  if (s.startsWith(">=")) {
    const a = parseNumLiteral(s.slice(2));
    return a === null ? null : { kind: "gte", a };
  }
  if (s.startsWith("<=")) {
    const a = parseNumLiteral(s.slice(2));
    return a === null ? null : { kind: "lte", a };
  }
  if (s.startsWith(">")) {
    const a = parseNumLiteral(s.slice(1));
    return a === null ? null : { kind: "gt", a };
  }
  if (s.startsWith("<")) {
    const a = parseNumLiteral(s.slice(1));
    return a === null ? null : { kind: "lt", a };
  }
  // Rango "a-b" (admite negativos en a sólo si no inicia con "-")
  const m = s.match(/^(-?\d[\d.,]*)\s*-\s*(-?\d[\d.,]*)$/);
  if (m) {
    const a = parseNumLiteral(m[1]);
    const b = parseNumLiteral(m[2]);
    if (a === null || b === null) return null;
    return { kind: "range", a: Math.min(a, b), b: Math.max(a, b) };
  }
  const a = parseNumLiteral(s);
  return a === null ? null : { kind: "eq", a };
}

function matchNumFilter(value: number | null | undefined, f: NumFilter | null): boolean {
  if (!f) return true;
  if (value === null || value === undefined || !Number.isFinite(value)) return false;
  switch (f.kind) {
    case "eq":
      return Math.abs(value - f.a) < 0.5;
    case "gt":
      return value > f.a;
    case "gte":
      return value >= f.a;
    case "lt":
      return value < f.a;
    case "lte":
      return value <= f.a;
    case "range":
      return value >= f.a && value <= f.b;
  }
}

function matchTextFilter(value: string | null | undefined, q: string): boolean {
  if (!q.trim()) return true;
  return (value ?? "").toLowerCase().includes(q.trim().toLowerCase());
}

function SortableHead({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align = "left",
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
}) {
  const active = current === sortKey;
  return (
    <TableHead className={cn(align === "right" && "text-right", "p-0")}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "flex h-10 w-full items-center gap-1 px-2 text-xs font-medium transition-colors hover:text-foreground",
          align === "right" ? "justify-end" : "justify-start",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? (
            <ChevronUp className="h-3 w-3" />
          ) : (
            <ChevronDown className="h-3 w-3" />
          )
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </TableHead>
  );
}

function FilterCell({
  value,
  onChange,
  numeric = false,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <TableHead className="p-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (numeric ? ">0" : "Filtrar…")}
        className={cn("h-7 px-2 text-xs", numeric && "text-right tabular-nums")}
      />
    </TableHead>
  );
}

export function AnalisisVentasPage() {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const previousMonthDefault = React.useMemo(() => previousMonth(currentMonthDate()), []);
  const [salesMonth, setSalesMonth] = React.useState<string>(previousMonthDefault);
  const [costPeriod, setCostPeriod] = React.useState<string>(previousMonthDefault);
  const [opPeriod, setOpPeriod] = React.useState<string>(previousMonthDefault);
  const [vendedoresF, setVendedoresF] = React.useState<string[]>([]);
  const [dependenciasF, setDependenciasF] = React.useState<string[]>([]);
  const [tercerosF, setTercerosF] = React.useState<string[]>([]);
  const [financialDiscountPct, setFinancialDiscountPct] = React.useState<number>(2.5);
  const [search, setSearch] = React.useState("");
  // useDeferredValue para que el input de búsqueda no bloquee el render
  // mientras se filtran/ordenan miles de filas.
  const deferredSearch = React.useDeferredValue(search);
  const [sortKey, setSortKey] = React.useState<SortKey>("sale_date");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [colFilters, setColFilters] = React.useState<ColFilters>({
    sale_date: "",
    vendedor: "",
    dependencia: "",
    tercero: "",
    referencia: "",
    cantidad: "",
    precio_unitario: "",
    ctu: "",
    margenU: "",
    margenPct: "",
  });

  const analytics = useSalesAnalytics({
    salesMonth,
    costPeriodMonth: costPeriod,
    opPeriodMonth: opPeriod,
    financialDiscountPct,
    filters: {
      vendedores: vendedoresF,
      dependencias: dependenciasF,
      terceros: tercerosF,
    },
    refreshKey,
  });
  const salesMonthOptions = React.useMemo(() => mapMonthOptions(analytics.salesMonths), [analytics.salesMonths]);
  const discountOptions = React.useMemo(() => analytics.financialDiscounts, [analytics.financialDiscounts]);

  React.useEffect(() => {
    if (discountOptions.length === 0) return;
    const defaultOption = discountOptions.find((item) => Math.abs(item.percentage - 2.5) < 0.001);
    const selectedExists = discountOptions.some((item) => Math.abs(item.percentage - financialDiscountPct) < 0.001);
    if (!selectedExists) {
      setFinancialDiscountPct(defaultOption?.percentage ?? discountOptions[0].percentage);
    }
  }, [discountOptions, financialDiscountPct]);


  React.useEffect(() => {
    if (analytics.salesMonths.length === 0) return;
    setSalesMonth((current) => pickDefaultMonth(analytics.salesMonths, current));
  }, [analytics.salesMonths]);

  const filteredCount = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const numFilters = {
      cantidad: parseNumFilter(colFilters.cantidad),
      precio_unitario: parseNumFilter(colFilters.precio_unitario),
      ctu: parseNumFilter(colFilters.ctu),
      margenU: parseNumFilter(colFilters.margenU),
      margenPct: parseNumFilter(colFilters.margenPct),
    };
    let count = 0;
    for (const r of analytics.filteredRows) {
      if (q) {
        const hit =
          (r.referencia ?? "").toLowerCase().includes(q) ||
          (r.tercero ?? "").toLowerCase().includes(q) ||
          (r.vendedor ?? "").toLowerCase().includes(q);
        if (!hit) continue;
      }
      if (!matchTextFilter(r.sale_date, colFilters.sale_date)) continue;
      if (!matchTextFilter(r.vendedor, colFilters.vendedor)) continue;
      if (!matchTextFilter(r.dependencia, colFilters.dependencia)) continue;
      if (!matchTextFilter(r.tercero, colFilters.tercero)) continue;
      if (!matchTextFilter(r.referencia, colFilters.referencia)) continue;
      if (!matchNumFilter(Number(r.cantidad), numFilters.cantidad)) continue;
      if (!matchNumFilter(r.precio_unitario, numFilters.precio_unitario)) continue;
      if (!matchNumFilter(r.ctu, numFilters.ctu)) continue;
      const margenU = (r.precio_unitario ?? 0) - (r.ctu ?? 0);
      if (!matchNumFilter(margenU, numFilters.margenU)) continue;
      if (!matchNumFilter(r.margenPct, numFilters.margenPct)) continue;
      count++;
    }
    return count;
  }, [analytics.filteredRows, deferredSearch, colFilters]);

  const detailRows = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const numFilters = {
      cantidad: parseNumFilter(colFilters.cantidad),
      precio_unitario: parseNumFilter(colFilters.precio_unitario),
      ctu: parseNumFilter(colFilters.ctu),
      margenU: parseNumFilter(colFilters.margenU),
      margenPct: parseNumFilter(colFilters.margenPct),
    };
    const filtered = analytics.filteredRows.filter((r) => {
      if (q) {
        const hit =
          (r.referencia ?? "").toLowerCase().includes(q) ||
          (r.tercero ?? "").toLowerCase().includes(q) ||
          (r.vendedor ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (!matchTextFilter(r.sale_date, colFilters.sale_date)) return false;
      if (!matchTextFilter(r.vendedor, colFilters.vendedor)) return false;
      if (!matchTextFilter(r.dependencia, colFilters.dependencia)) return false;
      if (!matchTextFilter(r.tercero, colFilters.tercero)) return false;
      if (!matchTextFilter(r.referencia, colFilters.referencia)) return false;
      if (!matchNumFilter(Number(r.cantidad), numFilters.cantidad)) return false;
      if (!matchNumFilter(r.precio_unitario, numFilters.precio_unitario)) return false;
      if (!matchNumFilter(r.ctu, numFilters.ctu)) return false;
      const margenU = (r.precio_unitario ?? 0) - (r.ctu ?? 0);
      if (!matchNumFilter(margenU, numFilters.margenU)) return false;
      if (!matchNumFilter(r.margenPct, numFilters.margenPct)) return false;
      return true;
    });

    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (r: (typeof filtered)[number]): string | number | null => {
      switch (sortKey) {
        case "sale_date":
          return r.sale_date;
        case "vendedor":
          return r.vendedor;
        case "dependencia":
          return r.dependencia;
        case "tercero":
          return r.tercero;
        case "referencia":
          return r.referencia;
        case "cantidad":
          return Number(r.cantidad);
        case "precio_unitario":
          return r.precio_unitario;
        case "ctu":
          return r.ctu;
        case "margenU":
          return (r.precio_unitario ?? 0) - (r.ctu ?? 0);
        case "margenPct":
          return r.margenPct;
      }
    };
    const sorted = [...filtered].sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      const aNull = av === null || av === undefined || av === "";
      const bNull = bv === null || bv === undefined || bv === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1; // nulos siempre al final
      if (bNull) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return sorted.slice(0, 2000);
  }, [analytics.filteredRows, deferredSearch, colFilters, sortKey, sortDir]);

  const hasAnyColFilter = React.useMemo(
    () => Object.values(colFilters).some((v) => v.trim() !== ""),
    [colFilters],
  );
  const hasAnyFilter = hasAnyColFilter || search.trim() !== "";

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const clearAllFilters = () => {
    setColFilters({
      sale_date: "",
      vendedor: "",
      dependencia: "",
      tercero: "",
      referencia: "",
      cantidad: "",
      precio_unitario: "",
      ctu: "",
      margenU: "",
      margenPct: "",
    });
    setSearch("");
  };

  return (
    <div className="mx-auto w-full max-w-[1600px] space-y-8 overflow-x-hidden px-4 py-10 sm:px-6 lg:px-10">
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
          {/* Barra de progreso sutil durante recargas no destructivas */}
          {analytics.loading && (
            <div className="-mb-6 h-0.5 overflow-hidden rounded-full">
              <div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] bg-gradient-brand" />
            </div>
          )}
          {/* Filtros sticky */}
          <div className="glass sticky top-16 z-20 flex flex-wrap items-center gap-3 rounded-2xl border border-border/60 p-4">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mes de ventas
              </span>
              <MonthSelect
                value={salesMonth}
                onValueChange={setSalesMonth}
                className="w-44"
                options={salesMonthOptions}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mes de costos
              </span>
              <MonthSelect value={costPeriod} onValueChange={setCostPeriod} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Mes operacional
              </span>
              <MonthSelect value={opPeriod} onValueChange={setOpPeriod} className="w-40" />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Descuento financiero
              </span>
              <Select
                value={String(financialDiscountPct)}
                onValueChange={(value) => setFinancialDiscountPct(Number(value))}
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
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <MultiSelectFilter
                label="Vendedor"
                options={analytics.uniques.vendedores}
                selected={vendedoresF}
                onChange={setVendedoresF}
              />
              <MultiSelectFilter
                label="Dependencia"
                options={analytics.uniques.dependencias}
                selected={dependenciasF}
                onChange={setDependenciasF}
              />
              <MultiSelectFilter
                label="Tercero"
                options={analytics.uniques.terceros}
                selected={tercerosF}
                onChange={setTercerosF}
              />
            </div>
          </div>

          {/* Aviso de cobertura de costos */}
          {analytics.ctuMapSize === 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-amber-300/60 bg-amber-50/60 px-4 py-3 text-xs text-amber-800">
              <AlertTriangle className="h-4 w-4" />
              No hay costos de producto cargados para el mes seleccionado. El margen se calculará
              como ventas totales (sin costos).
            </div>
          )}

          {/* Aviso de líneas excluidas del cálculo de margen */}
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

          {/* KPIs */}
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
              hint={`Base computable: ${formatCurrency(analytics.kpis.ventasComputables)}`}
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
              hint={`CTU mes ${costPeriod.slice(0, 7)}`}
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
          {/* Rankings */}
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
                  Mostrando {formatNumber(detailRows.length)} de {formatNumber(analytics.filteredRows.length)} líneas
                  {hasAnyColFilter && (
                    <span> · filtradas: {formatNumber(filteredCount)}</span>
                  )}
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
            <div className="mt-4 max-h-[calc(100vh-200px)] min-h-[600px] overflow-auto rounded-xl border border-border/40">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <TableRow>
                    <SortableHead label="Fecha" sortKey="sale_date" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHead label="Vendedor" sortKey="vendedor" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHead label="Dependencia" sortKey="dependencia" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHead label="Tercero" sortKey="tercero" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHead label="Ref" sortKey="referencia" current={sortKey} dir={sortDir} onClick={toggleSort} />
                    <SortableHead label="Cant" sortKey="cantidad" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="PUV" sortKey="precio_unitario" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="CTU" sortKey="ctu" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="Margen U." sortKey="margenU" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                    <SortableHead label="Margen %" sortKey="margenPct" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
                  </TableRow>
                  <TableRow className="hover:bg-transparent">
                    <FilterCell value={colFilters.sale_date} onChange={(v) => setColFilters((p) => ({ ...p, sale_date: v }))} placeholder="2024-03" />
                    <FilterCell value={colFilters.vendedor} onChange={(v) => setColFilters((p) => ({ ...p, vendedor: v }))} />
                    <FilterCell value={colFilters.dependencia} onChange={(v) => setColFilters((p) => ({ ...p, dependencia: v }))} />
                    <FilterCell value={colFilters.tercero} onChange={(v) => setColFilters((p) => ({ ...p, tercero: v }))} />
                    <FilterCell value={colFilters.referencia} onChange={(v) => setColFilters((p) => ({ ...p, referencia: v }))} />
                    <FilterCell value={colFilters.cantidad} onChange={(v) => setColFilters((p) => ({ ...p, cantidad: v }))} numeric />
                    <FilterCell value={colFilters.precio_unitario} onChange={(v) => setColFilters((p) => ({ ...p, precio_unitario: v }))} numeric />
                    <FilterCell value={colFilters.ctu} onChange={(v) => setColFilters((p) => ({ ...p, ctu: v }))} numeric />
                    <FilterCell value={colFilters.margenU} onChange={(v) => setColFilters((p) => ({ ...p, margenU: v }))} numeric />
                    <FilterCell value={colFilters.margenPct} onChange={(v) => setColFilters((p) => ({ ...p, margenPct: v }))} numeric />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detailRows.map((r) => {
                    const margenU = (r.precio_unitario ?? 0) - (r.ctu ?? 0);
                    const isNeg = (r.margenPct ?? 0) < 0;
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="whitespace-nowrap">{r.sale_date}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{r.vendedor ?? "—"}</TableCell>
                        <TableCell className="max-w-[140px] truncate">{r.dependencia ?? "—"}</TableCell>
                        <TableCell className="max-w-[160px] truncate">{r.tercero ?? "—"}</TableCell>
                        <TableCell className="font-medium">{r.referencia}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatNumber(r.cantidad)}</TableCell>
                        <TableCell className="text-right tabular-nums">{formatCurrency(r.precio_unitario ?? 0)}</TableCell>
                        <TableCell className="text-right tabular-nums">
                          {r.ctu !== null ? (
                            formatCurrency(r.ctu)
                          ) : r.costoCero ? (
                            <Badge variant="outline" className="border-rose-300 bg-rose-50 text-[10px] font-medium text-rose-700">
                              Costo 0
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-[10px] font-medium text-amber-700">
                              Sin costo
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", r.computable && margenU < 0 && "text-rose-600")}>
                          {r.computable ? formatCurrency(margenU) : <span className="text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", isNeg && "font-semibold text-rose-600")}>
                          {r.margenPct === null ? "—" : formatPercent(r.margenPct, 1)}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                  {detailRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={10} className="py-8 text-center text-sm text-muted-foreground">
                        Sin resultados con los filtros aplicados.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </div>
        </>
      )}

      <UploadVentasDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={() => setRefreshKey((k) => k + 1)}
      />
    </div>
  );
}