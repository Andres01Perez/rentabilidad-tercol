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
} from "lucide-react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  Legend,
} from "recharts";
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
import { DateRangePicker, type DateRange } from "@/components/period/DateRangePicker";
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
import { currentMonthDate, formatCurrency, formatNumber, formatPercent } from "@/lib/period";
import { cn } from "@/lib/utils";

function KpiCard({
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
        "rounded-2xl border border-border/60 bg-gradient-to-br p-5 shadow-sm backdrop-blur",
        toneClasses,
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="mt-2 text-2xl font-bold tracking-tight">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
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

export function AnalisisVentasPage() {
  const [uploadOpen, setUploadOpen] = React.useState(false);
  const [refreshKey, setRefreshKey] = React.useState(0);
  const [range, setRange] = React.useState<DateRange>({ from: null, to: null });
  // Rango debounced (300ms) para evitar reconsultas en cascada al ajustar
  // dos fechas seguidas.
  const [debouncedRange, setDebouncedRange] = React.useState<DateRange>(range);
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedRange(range), 300);
    return () => clearTimeout(t);
  }, [range]);
  const [costPeriod, setCostPeriod] = React.useState<string>(currentMonthDate());
  const [opPeriod, setOpPeriod] = React.useState<string>(currentMonthDate());
  const [vendedoresF, setVendedoresF] = React.useState<string[]>([]);
  const [dependenciasF, setDependenciasF] = React.useState<string[]>([]);
  const [tercerosF, setTercerosF] = React.useState<string[]>([]);
  const [search, setSearch] = React.useState("");

  const analytics = useSalesAnalytics({
    range: debouncedRange,
    costPeriodMonth: costPeriod,
    opPeriodMonth: opPeriod,
    filters: {
      vendedores: vendedoresF,
      dependencias: dependenciasF,
      terceros: tercerosF,
    },
    refreshKey,
  });

  const detailRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const arr = q
      ? analytics.filteredRows.filter(
          (r) =>
            (r.referencia ?? "").toLowerCase().includes(q) ||
            (r.tercero ?? "").toLowerCase().includes(q) ||
            (r.vendedor ?? "").toLowerCase().includes(q),
        )
      : analytics.filteredRows;
    return arr.slice(0, 500);
  }, [analytics.filteredRows, search]);

  const tooltipFormatter = (v: unknown) =>
    typeof v === "number" ? formatCurrency(v) : String(v ?? "");

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
            <DateRangePicker value={range} onChange={setRange} />
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

          {/* KPIs */}
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard
              icon={Wallet}
              label="Ventas totales"
              value={formatCurrency(analytics.kpis.ventas)}
              hint={`${formatNumber(analytics.kpis.lineas)} líneas`}
              tone="primary"
            />
            <KpiCard
              icon={ShoppingCart}
              label="Costo total"
              value={formatCurrency(analytics.kpis.costo)}
              hint={`CTU mes ${costPeriod.slice(0, 7)}`}
            />
            <KpiCard
              icon={PiggyBank}
              label="Margen bruto"
              value={formatCurrency(analytics.kpis.margenBruto)}
              hint={formatPercent(analytics.kpis.margenPct, 2)}
              tone={analytics.kpis.margenBruto >= 0 ? "positive" : "negative"}
            />
            <KpiCard
              icon={Percent}
              label="Margen neto"
              value={formatCurrency(analytics.kpis.margenNeto)}
              hint={`${formatPercent(analytics.kpis.margenNetoPct, 2)} · op. ${formatPercent(analytics.pctOperacional, 1)}`}
              tone={analytics.kpis.margenNeto >= 0 ? "positive" : "negative"}
            />
          </div>
          <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <KpiCard icon={ShoppingCart} label="Productos" value={formatNumber(analytics.kpis.productos)} />
            <KpiCard icon={Users} label="Clientes" value={formatNumber(analytics.kpis.clientes)} />
            <KpiCard icon={UserCheck} label="Vendedores" value={formatNumber(analytics.kpis.vendedores)} />
            <KpiCard icon={Building2} label="Dependencias" value={formatNumber(analytics.uniques.dependencias.length)} />
          </div>

          {/* Series temporales */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="glass rounded-2xl border border-border/60 p-5">
              <h3 className="text-sm font-semibold">Ventas, costo y margen por mes</h3>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={analytics.monthlySeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" fontSize={11} />
                    <YAxis fontSize={11} tickFormatter={(v) => formatNumber(v / 1000) + "k"} />
                    <RTooltip formatter={tooltipFormatter} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="ventas" name="Ventas" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="costo" name="Costo" stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="margen" name="Margen" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="glass rounded-2xl border border-border/60 p-5">
              <h3 className="text-sm font-semibold">Ventas por día</h3>
              <div className="mt-4 h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={analytics.dailySeries}>
                    <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                    <XAxis dataKey="label" fontSize={10} interval="preserveStartEnd" />
                    <YAxis fontSize={11} tickFormatter={(v) => formatNumber(v / 1000) + "k"} />
                    <RTooltip formatter={tooltipFormatter} />
                    <Bar dataKey="ventas" name="Ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Rankings */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-4">
            <RankingCard title="Top vendedores · margen" items={analytics.rankings.vendedores} />
            <RankingCard title="Top dependencias · margen" items={analytics.rankings.dependencias} />
            <RankingCard title="Top terceros · margen" items={analytics.rankings.terceros} />
            <RankingCard title="Top productos · margen" items={analytics.rankings.productos} flagNegative />
          </div>

          {/* Tabla detalle */}
          <div className="glass rounded-2xl border border-border/60 p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold">Detalle de ventas</h3>
                <p className="text-xs text-muted-foreground">
                  Mostrando {formatNumber(detailRows.length)} de {formatNumber(analytics.filteredRows.length)} líneas
                </p>
              </div>
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
            <div className="mt-4 max-h-[500px] overflow-auto rounded-xl border border-border/40">
              <Table>
                <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
                  <TableRow>
                    <TableHead>Fecha</TableHead>
                    <TableHead>Vendedor</TableHead>
                    <TableHead>Dependencia</TableHead>
                    <TableHead>Tercero</TableHead>
                    <TableHead>Ref</TableHead>
                    <TableHead className="text-right">Cant</TableHead>
                    <TableHead className="text-right">PUV</TableHead>
                    <TableHead className="text-right">CTU</TableHead>
                    <TableHead className="text-right">Margen U.</TableHead>
                    <TableHead className="text-right">Margen %</TableHead>
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
                          {r.ctu === null ? <span className="text-muted-foreground">—</span> : formatCurrency(r.ctu)}
                        </TableCell>
                        <TableCell className={cn("text-right tabular-nums", margenU < 0 && "text-rose-600")}>
                          {formatCurrency(margenU)}
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