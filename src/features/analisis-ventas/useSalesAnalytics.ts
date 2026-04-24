import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export interface SaleRow {
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
}

export interface AnalyticsRow extends SaleRow {
  ctu: number | null;
  costoLinea: number;
  margenBruto: number;
  margenPct: number | null;
  /** true si la referencia tiene registro de costo pero es <= 0 */
  costoCero: boolean;
  /** true si la referencia no tiene registro de costo en el período */
  sinCosto: boolean;
  /** true cuando la línea participa en KPIs de margen (ctu > 0) */
  computable: boolean;
}

export interface RankingItem {
  key: string;
  ventas: number;
  costo: number;
  margenBruto: number;
  margenPct: number;
  cantidad: number;
}

export interface MonthlySeries {
  month: string;
  label: string;
  ventas: number;
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

const MONTHS_ES_SHORT = [
  "Ene", "Feb", "Mar", "Abr", "May", "Jun",
  "Jul", "Ago", "Sep", "Oct", "Nov", "Dic",
];

function fmtMonthShort(year: number, month: number) {
  return `${MONTHS_ES_SHORT[month - 1]} ${year}`;
}

function toIsoDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
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

function getMonthBounds(monthValue: string) {
  const [y, m] = monthValue.split("-").map(Number);
  const from = new Date(y, (m ?? 1) - 1, 1);
  const to = new Date(y, m ?? 1, 0);
  return { from: toIsoDate(from), to: toIsoDate(to) };
}

function sortMonthsDesc(values: string[]) {
  return Array.from(new Set(values)).sort((a, b) => b.localeCompare(a));
}

export function useSalesAnalytics(args: UseSalesAnalyticsArgs) {
  const { salesMonth, costPeriodMonth, opPeriodMonth, financialDiscountPct, filters, refreshKey } = args;
  const [salesRows, setSalesRows] = React.useState<SaleRow[]>([]);
  const [salesMonths, setSalesMonths] = React.useState<string[]>([]);
  const [financialDiscounts, setFinancialDiscounts] = React.useState<FinancialDiscountOption[]>([]);
  const [ctuMap, setCtuMap] = React.useState<Map<string, number>>(new Map());
  const [zeroCostSet, setZeroCostSet] = React.useState<Set<string>>(new Set());
  const [pctOperacional, setPctOperacional] = React.useState<number>(0);
  const [operationalBreakdown, setOperationalBreakdown] = React.useState<OperationalBreakdownItem[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [hasAnySales, setHasAnySales] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const PAGE = 1000;
      const { from: fromDate, to: toDate } = getMonthBounds(salesMonth);
      const baseSelect = "id, sale_date, year, month, day, vendedor, dependencia, tercero, referencia, cantidad, valor_total, precio_unitario";
      const buildQuery = (from: number, to: number, withCount = false) => {
        let q = supabase
          .from("sales")
          .select(baseSelect, withCount ? { count: "exact" } : undefined)
          .order("sale_date", { ascending: true })
          .range(from, to);
        q = q.gte("sale_date", fromDate).lte("sale_date", toDate);
        return q;
      };
      const first = await buildQuery(0, PAGE - 1, true);
      if (first.error) {
        console.error("Error loading sales", first.error);
        if (!cancelled) {
          setLoading(false);
          setHasLoadedOnce(true);
        }
        return;
      }
      const total = first.count ?? (first.data?.length ?? 0);
      const all: SaleRow[] = [...((first.data ?? []) as SaleRow[])];
      if (total > PAGE) {
        const ranges: Array<[number, number]> = [];
        for (let from = PAGE; from < total; from += PAGE) {
          ranges.push([from, Math.min(from + PAGE - 1, total - 1)]);
        }
        const results = await Promise.all(ranges.map(([f, t]) => buildQuery(f, t)));
        for (const r of results) {
          if (r.error) {
            console.error("Error loading sales page", r.error);
            continue;
          }
          all.push(...((r.data ?? []) as SaleRow[]));
        }
      }
      if (cancelled) return;
      setSalesRows(all);
      if (all.length > 0) setHasAnySales(true);
      setLoading(false);
      setHasLoadedOnce(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [salesMonth, refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { count } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true });
      if (!cancelled) setHasAnySales((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const PAGE = 1000;
      const months: string[] = [];
      let from = 0;
      let keepGoing = true;
      while (keepGoing) {
        const { data, error } = await supabase
          .from("sales")
          .select("year, month")
          .order("year", { ascending: false })
          .order("month", { ascending: false })
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("Error loading sales months", error);
          break;
        }
        const batch = data ?? [];
        for (const row of batch) {
          const year = Number(row.year);
          const month = Number(row.month);
          if (!Number.isFinite(year) || !Number.isFinite(month)) continue;
          months.push(`${year}-${String(month).padStart(2, "0")}-01`);
        }
        if (batch.length < PAGE) keepGoing = false;
        else from += PAGE;
      }
      if (!cancelled) setSalesMonths(sortMonthsDesc(months));
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("financial_discounts" as never)
        .select("id, label, percentage, sort_order, is_active")
        .eq("is_active", true)
        .order("sort_order", { ascending: true });
      if (error) {
        console.error("Error loading financial discounts", error);
        return;
      }
      if (cancelled) return;
      const rows = ((data ?? []) as Array<{
        id: string;
        label: string;
        percentage: number | string;
      }>).map((row) => ({
        id: row.id,
        label: row.label,
        percentage: Number(row.percentage ?? 0),
      }));
      setFinancialDiscounts(rows);
    })();
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<string, number>();
      const zeros = new Set<string>();
      const PAGE = 1000;
      let from = 0;
      let keepGoing = true;
      while (keepGoing) {
        const { data, error } = await supabase
          .from("product_costs")
          .select("referencia, ctu")
          .eq("period_month", costPeriodMonth)
          .range(from, from + PAGE - 1);
        if (error) {
          console.error("Error loading product_costs", error);
          break;
        }
        const batch = data ?? [];
        for (const r of batch) {
          if (r.ctu !== null && r.ctu !== undefined) {
            const v = Number(r.ctu);
            if (v > 0) {
              map.set(r.referencia, v);
            } else {
              zeros.add(r.referencia);
            }
          }
        }
        if (batch.length < PAGE) keepGoing = false;
        else from += PAGE;
      }
      if (!cancelled) {
        setCtuMap(map);
        setZeroCostSet(zeros);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [costPeriodMonth]);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("operational_costs")
        .select("percentage, cost_center_id, cost_centers!inner(is_active)")
        .eq("period_month", opPeriodMonth);
      if (error) {
        const { data: simple } = await supabase
          .from("operational_costs")
          .select("percentage")
          .eq("period_month", opPeriodMonth);
        if (!cancelled) {
          const sum = (simple ?? []).reduce((acc, r) => acc + Number(r.percentage ?? 0), 0);
          setPctOperacional(sum);
        }
        return;
      }
      if (!cancelled) {
        const sum = (data ?? []).reduce((acc, r) => acc + Number(r.percentage ?? 0), 0);
        setPctOperacional(sum);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [opPeriodMonth]);

  const filteredRows = React.useMemo<AnalyticsRow[]>(() => {
    const vSet = new Set(filters.vendedores);
    const dSet = new Set(filters.dependencias);
    const tSet = new Set(filters.terceros);
    return salesRows
      .filter((r) => (vSet.size ? vSet.has(r.vendedor ?? "") : true))
      .filter((r) => (dSet.size ? dSet.has(r.dependencia ?? "") : true))
      .filter((r) => (tSet.size ? tSet.has(r.tercero ?? "") : true))
      .map((r) => {
        const ctu = ctuMap.get(r.referencia) ?? null;
        const costoCero = ctu === null && zeroCostSet.has(r.referencia);
        const sinCosto = ctu === null && !costoCero;
        const computable = ctu !== null;
        const costoLinea = computable ? (ctu as number) * Number(r.cantidad) : 0;
        const margenBruto = computable ? Number(r.valor_total) - costoLinea : 0;
        const margenPct =
          computable && Number(r.valor_total) !== 0
            ? (margenBruto / Number(r.valor_total)) * 100
            : null;
        return {
          ...r,
          ctu,
          costoLinea,
          margenBruto,
          margenPct,
          costoCero,
          sinCosto,
          computable,
        };
      });
  }, [salesRows, ctuMap, filters]);

  const kpis = React.useMemo(() => {
    let ventas = 0;
    let costo = 0;
    let margenBruto = 0;
    let ventasComputables = 0;
    let lineasExcluidas = 0;
    let ventasExcluidas = 0;
    let lineasCostoCero = 0;
    let lineasSinCosto = 0;
    const productos = new Set<string>();
    const clientes = new Set<string>();
    const vendedores = new Set<string>();

    for (const r of filteredRows) {
      ventas += Number(r.valor_total);
      if (r.computable) {
        ventasComputables += Number(r.valor_total);
        costo += r.costoLinea;
        margenBruto += r.margenBruto;
      } else {
        lineasExcluidas++;
        ventasExcluidas += Number(r.valor_total);
        if (r.costoCero) lineasCostoCero++;
        if (r.sinCosto) lineasSinCosto++;
      }
      productos.add(r.referencia);
      if (r.tercero) clientes.add(r.tercero);
      if (r.vendedor) vendedores.add(r.vendedor);
    }

    const descuentoFinancieroMonto = ventasComputables * (financialDiscountPct / 100);
    const ventasNetas = ventasComputables - descuentoFinancieroMonto;
    const utilidad = ventasNetas - costo;
    const operacionalMonto = ventas * (pctOperacional / 100);
    const utilidadOperacional = utilidad - operacionalMonto;
    const margenPct = ventasComputables !== 0 ? (margenBruto / ventasComputables) * 100 : 0;
    const utilidadOperacionalPct = margenPct - pctOperacional;

    return {
      ventas,
      ventasComputables,
      costo,
      margenBruto,
      margenPct,
      pctOperacional,
      operacionalMonto,
      descuentoFinancieroPct: financialDiscountPct,
      descuentoFinancieroMonto,
      ventasNetas,
      utilidad,
      utilidadOperacional,
      utilidadOperacionalPct,
      productos: productos.size,
      clientes: clientes.size,
      vendedores: vendedores.size,
      lineas: filteredRows.length,
      lineasExcluidas,
      ventasExcluidas,
      lineasCostoCero,
      lineasSinCosto,
    };
  }, [filteredRows, financialDiscountPct, pctOperacional]);

  const monthlySeries = React.useMemo<MonthlySeries[]>(() => {
    const map = new Map<string, MonthlySeries>();
    for (const r of filteredRows) {
      if (!r.computable) continue;
      const key = `${r.year}-${String(r.month).padStart(2, "0")}`;
      const existing = map.get(key) ?? {
        month: key,
        label: fmtMonthShort(r.year, r.month),
        ventas: 0,
        costo: 0,
        margen: 0,
      };
      existing.ventas += Number(r.valor_total);
      existing.costo += r.costoLinea;
      existing.margen += r.margenBruto;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.month.localeCompare(b.month));
  }, [filteredRows]);

  const dailySeries = React.useMemo<DailySeries[]>(() => {
    const map = new Map<string, DailySeries>();
    for (const r of filteredRows) {
      const key = r.sale_date;
      const existing = map.get(key) ?? {
        day: key,
        label: `${String(r.day).padStart(2, "0")}/${String(r.month).padStart(2, "0")}`,
        ventas: 0,
      };
      existing.ventas += Number(r.valor_total);
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => a.day.localeCompare(b.day));
  }, [filteredRows]);

  const buildRanking = React.useCallback(
    (getKey: (r: AnalyticsRow) => string | null | undefined): RankingItem[] => {
      const map = new Map<string, RankingItem>();
      for (const r of filteredRows) {
        if (!r.computable) continue;
        const k = getKey(r);
        if (!k) continue;
        const existing = map.get(k) ?? {
          key: k,
          ventas: 0,
          costo: 0,
          margenBruto: 0,
          margenPct: 0,
          cantidad: 0,
        };
        existing.ventas += Number(r.valor_total);
        existing.costo += r.costoLinea;
        existing.margenBruto += r.margenBruto;
        existing.cantidad += Number(r.cantidad);
        map.set(k, existing);
      }
      const arr = Array.from(map.values()).map((x) => ({
        ...x,
        margenPct: x.ventas !== 0 ? (x.margenBruto / x.ventas) * 100 : 0,
      }));
      arr.sort((a, b) => b.margenBruto - a.margenBruto);
      return arr;
    },
    [filteredRows],
  );

  const rankings = React.useMemo(() => {
    return {
      vendedores: buildRanking((r) => r.vendedor).slice(0, 10),
      dependencias: buildRanking((r) => r.dependencia).slice(0, 10),
      terceros: buildRanking((r) => r.tercero).slice(0, 10),
      productos: buildRanking((r) => r.referencia).slice(0, 10),
    };
  }, [buildRanking]);

  const uniques = React.useMemo(() => {
    const v = new Set<string>();
    const d = new Set<string>();
    const t = new Set<string>();
    for (const r of salesRows) {
      if (r.vendedor) v.add(r.vendedor);
      if (r.dependencia) d.add(r.dependencia);
      if (r.tercero) t.add(r.tercero);
    }
    return {
      vendedores: Array.from(v).sort(),
      dependencias: Array.from(d).sort(),
      terceros: Array.from(t).sort(),
    };
  }, [salesRows]);

  return {
    loading,
    hasLoadedOnce,
    hasAnySales,
    salesMonths,
    financialDiscounts,
    pctOperacional,
    salesRows,
    filteredRows,
    kpis,
    monthlySeries,
    dailySeries,
    rankings,
    uniques,
    ctuMapSize: ctuMap.size,
    zeroCostCount: zeroCostSet.size,
  };
}
