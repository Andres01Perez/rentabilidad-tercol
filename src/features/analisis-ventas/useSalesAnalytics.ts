import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

// ---------- Tipos públicos (compatibles con la versión anterior) ----------
export interface RankingItem {
  key: string;
  ventas: number;
  ventasNetas: number;
  costo: number;
  margenBruto: number;
  margenPct: number;
  cantidad: number;
}

export interface MonthlySeries {
  month: string;
  label: string;
  ventas: number;
  ventasNetas: number;
  costo: number;
  margen: number;
}

export interface DailySeries {
  day: string;
  label: string;
  ventas: number;
}

export interface FinancialDiscountOption {
  id: string;
  label: string;
  percentage: number;
}

export interface OperationalBreakdownItem {
  id: string;
  name: string;
  percentage: number;
}

export interface DashboardKpis {
  ventas: number;
  ventasComputables: number;
  costo: number;
  margenBruto: number;
  margenPct: number;
  pctOperacional: number;
  operacionalMonto: number;
  descuentoFinancieroPct: number;
  descuentoFinancieroMonto: number;
  ventasNetas: number;
  utilidad: number;
  utilidadOperacional: number;
  utilidadOperacionalPct: number;
  productos: number;
  clientes: number;
  vendedores: number;
  lineas: number;
  lineasExcluidas: number;
  ventasExcluidas: number;
  lineasCostoCero: number;
  lineasSinCosto: number;
}

export interface DashboardData {
  kpis: DashboardKpis;
  monthlySeries: MonthlySeries[];
  dailySeries: DailySeries[];
  rankings: {
    vendedores: RankingItem[];
    dependencias: RankingItem[];
    terceros: RankingItem[];
    productos: RankingItem[];
  };
  uniques: { vendedores: string[]; dependencias: string[]; terceros: string[] };
  operationalBreakdown: OperationalBreakdownItem[];
  ctuMapSize: number;
  hasAnySales: boolean;
}

export interface UseSalesAnalyticsArgs {
  salesMonth: string;
  costPeriodMonth: string;
  opPeriodMonth: string;
  financialDiscountPct: number;
  filters: {
    vendedores: string[];
    dependencias: string[];
    terceros: string[];
  };
  refreshKey: number;
}

const EMPTY_KPIS: DashboardKpis = {
  ventas: 0, ventasComputables: 0, costo: 0, margenBruto: 0, margenPct: 0,
  pctOperacional: 0, operacionalMonto: 0, descuentoFinancieroPct: 0,
  descuentoFinancieroMonto: 0, ventasNetas: 0, utilidad: 0,
  utilidadOperacional: 0, utilidadOperacionalPct: 0,
  productos: 0, clientes: 0, vendedores: 0, lineas: 0,
  lineasExcluidas: 0, ventasExcluidas: 0, lineasCostoCero: 0, lineasSinCosto: 0,
};

const EMPTY_DATA: DashboardData = {
  kpis: EMPTY_KPIS,
  monthlySeries: [],
  dailySeries: [],
  rankings: { vendedores: [], dependencias: [], terceros: [], productos: [] },
  uniques: { vendedores: [], dependencias: [], terceros: [] },
  operationalBreakdown: [],
  ctuMapSize: 0,
  hasAnySales: false,
};

function toCostMonthDate(salesMonth: string): string {
  // 'YYYY-MM-01' ya es el formato correcto.
  return salesMonth;
}

// =====================================================================
// Query options reutilizables (cache compartido entre montajes)
// =====================================================================

const salesMonthsQueryOptions = () => ({
  queryKey: ["sales-analytics", "months"] as const,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<string[]> => {
    const { data, error } = await supabase.rpc("get_sales_months");
    if (error) throw error;
    return ((data ?? []) as Array<{ month_value: string }>).map((r) =>
      String(r.month_value),
    );
  },
});

const financialDiscountsQueryOptions = () => ({
  queryKey: ["sales-analytics", "financial-discounts"] as const,
  staleTime: 5 * 60_000,
  queryFn: async (): Promise<FinancialDiscountOption[]> => {
    const { data, error } = await supabase
      .from("financial_discounts")
      .select("id, label, percentage")
      .eq("is_active", true)
      .order("sort_order", { ascending: true });
    if (error) throw error;
    return (data ?? []).map((r) => ({
      id: r.id,
      label: r.label,
      percentage: Number(r.percentage ?? 0),
    }));
  },
});

const dashboardQueryOptions = (args: UseSalesAnalyticsArgs) => {
  const { salesMonth, costPeriodMonth, opPeriodMonth, financialDiscountPct, filters, refreshKey } = args;
  const vKey = filters.vendedores.join("|");
  const dKey = filters.dependencias.join("|");
  const tKey = filters.terceros.join("|");
  return {
    queryKey: [
      "sales-analytics",
      "dashboard",
      salesMonth,
      costPeriodMonth,
      opPeriodMonth,
      financialDiscountPct,
      vKey,
      dKey,
      tKey,
      refreshKey,
    ] as const,
    queryFn: async (): Promise<DashboardData> => {
      const { data: json, error } = await supabase.rpc("get_sales_dashboard", {
        p_sales_month: salesMonth,
        p_cost_month: toCostMonthDate(costPeriodMonth),
        p_op_month: toCostMonthDate(opPeriodMonth),
        p_financial_pct: financialDiscountPct,
        p_vendedores: vKey ? vKey.split("|") : undefined,
        p_dependencias: dKey ? dKey.split("|") : undefined,
        p_terceros: tKey ? tKey.split("|") : undefined,
      });
      if (error) throw error;
      const j = (json ?? {}) as Record<string, unknown>;
      return {
        kpis: { ...EMPTY_KPIS, ...((j.kpis as Partial<DashboardKpis>) ?? {}) } as DashboardKpis,
        monthlySeries: (j.monthlySeries as MonthlySeries[]) ?? [],
        dailySeries: (j.dailySeries as DailySeries[]) ?? [],
        rankings: (j.rankings as DashboardData["rankings"]) ?? EMPTY_DATA.rankings,
        uniques: (j.uniques as DashboardData["uniques"]) ?? EMPTY_DATA.uniques,
        operationalBreakdown: (j.operationalBreakdown as OperationalBreakdownItem[]) ?? [],
        ctuMapSize: Number(j.ctuMapSize ?? 0),
        hasAnySales: Boolean(j.hasAnySales),
      };
    },
  };
};

export function useSalesAnalytics(args: UseSalesAnalyticsArgs) {
  const monthsQ = useQuery(salesMonthsQueryOptions());
  const discountsQ = useQuery(financialDiscountsQueryOptions());
  const dashQ = useQuery(dashboardQueryOptions(args));
  const salesMonths = monthsQ.data ?? [];
  const financialDiscounts = discountsQ.data ?? [];
  const data = dashQ.data ?? EMPTY_DATA;
  const loading = dashQ.isFetching;
  const hasLoadedOnce = !dashQ.isLoading;

  // Estabilizamos el objeto de retorno para que componentes consumidores
  // memoizados (KpiCard, MultiSelectFilter, etc.) no vean nuevas referencias
  // en cada render del padre cuando los datos no cambiaron.
  return React.useMemo(
    () => ({
      loading,
      hasLoadedOnce,
      hasAnySales: data.hasAnySales,
      salesMonths,
      financialDiscounts,
      pctOperacional: data.kpis.pctOperacional,
      operationalBreakdown: data.operationalBreakdown,
      kpis: data.kpis,
      monthlySeries: data.monthlySeries,
      dailySeries: data.dailySeries,
      rankings: data.rankings,
      uniques: data.uniques,
      ctuMapSize: data.ctuMapSize,
    }),
    [loading, hasLoadedOnce, data, salesMonths, financialDiscounts],
  );
}

// =====================================================================
// Hook independiente para la tabla detalle (paginada server-side)
// =====================================================================

export interface DetailRow {
  id: string;
  sale_date: string;
  year: number;
  month: number;
  day: number;
  vendedor: string | null;
  dependencia: string | null;
  tercero: string | null;
  referencia: string;
  cantidad: number;
  valor_total: number;
  precio_unitario: number | null;
  ctu: number | null;
  precioUnitarioNeto: number | null;
  margenUnitario: number | null;
  margenPct: number | null;
}

export interface UseSalesDetailArgs {
  salesMonth: string;
  costPeriodMonth: string;
  financialDiscountPct: number;
  filters: { vendedores: string[]; dependencias: string[]; terceros: string[] };
  search: string;
  sortKey: string;
  sortDir: "asc" | "desc";
  limit?: number;
  refreshKey: number;
  enabled?: boolean;
}

export function useSalesDetail(args: UseSalesDetailArgs) {
  const {
    salesMonth, costPeriodMonth, financialDiscountPct,
    filters, search, sortKey, sortDir,
    limit = 500, refreshKey, enabled = true,
  } = args;
  const vKey = filters.vendedores.join("|");
  const dKey = filters.dependencias.join("|");
  const tKey = filters.terceros.join("|");

  // Debounce ligero para búsqueda/filtros: la queryKey solo cambia cuando se
  // estabiliza el input.
  const [debouncedSearch, setDebouncedSearch] = React.useState(search);
  React.useEffect(() => {
    const h = setTimeout(() => setDebouncedSearch(search), 250);
    return () => clearTimeout(h);
  }, [search]);

  const q = useQuery({
    queryKey: [
      "sales-analytics",
      "detail",
      salesMonth,
      costPeriodMonth,
      financialDiscountPct,
      vKey,
      dKey,
      tKey,
      debouncedSearch,
      sortKey,
      sortDir,
      limit,
      refreshKey,
    ] as const,
    enabled,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_sales_detail", {
        p_sales_month: salesMonth,
        p_cost_month: costPeriodMonth,
        p_financial_pct: financialDiscountPct,
        p_vendedores: vKey ? vKey.split("|") : undefined,
        p_dependencias: dKey ? dKey.split("|") : undefined,
        p_terceros: tKey ? tKey.split("|") : undefined,
        p_search: debouncedSearch || undefined,
        p_sort_key: sortKey,
        p_sort_dir: sortDir,
        p_offset: 0,
        p_limit: limit,
      });
      if (error) throw error;
      const j = (data ?? {}) as { rows?: DetailRow[]; total?: number };
      return {
        rows: (j.rows ?? []).map((r) => ({
          ...r,
          cantidad: Number(r.cantidad),
          valor_total: Number(r.valor_total),
          precio_unitario: r.precio_unitario === null ? null : Number(r.precio_unitario),
          ctu: r.ctu === null ? null : Number(r.ctu),
          precioUnitarioNeto: r.precioUnitarioNeto === null ? null : Number(r.precioUnitarioNeto),
          margenUnitario: r.margenUnitario === null ? null : Number(r.margenUnitario),
          margenPct: r.margenPct === null ? null : Number(r.margenPct),
        })),
        total: Number(j.total ?? 0),
      };
    },
  });
  return {
    rows: q.data?.rows ?? [],
    total: q.data?.total ?? 0,
    loading: q.isFetching,
  };
}
