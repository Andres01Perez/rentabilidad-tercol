import * as React from "react";
import { supabase } from "@/integrations/supabase/client";
import type { DateRange } from "@/components/period/DateRangePicker";

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
  margenNeto: number;
}

export interface RankingItem {
  key: string;
  ventas: number;
  costo: number;
  margenBruto: number;
  margenNeto: number;
  margenPct: number;
  cantidad: number;
}

export interface MonthlySeries {
  month: string; // "YYYY-MM"
  label: string;
  ventas: number;
  costo: number;
  margen: number;
}

export interface DailySeries {
  day: string; // "YYYY-MM-DD"
  label: string;
  ventas: number;
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
  range: DateRange;
  costPeriodMonth: string; // "YYYY-MM-01"
  opPeriodMonth: string; // "YYYY-MM-01"
  filters: {
    vendedores: string[];
    dependencias: string[];
    terceros: string[];
  };
  refreshKey: number;
}

export function useSalesAnalytics(args: UseSalesAnalyticsArgs) {
  const { range, costPeriodMonth, opPeriodMonth, filters, refreshKey } = args;
  const [salesRows, setSalesRows] = React.useState<SaleRow[]>([]);
  const [ctuMap, setCtuMap] = React.useState<Map<string, number>>(new Map());
  const [pctOperacional, setPctOperacional] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [hasAnySales, setHasAnySales] = React.useState(false);

  // Load sales filtered by date range (paginated to bypass 1000-row default)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const all: SaleRow[] = [];
      const PAGE = 1000;
      let from = 0;
      let keepGoing = true;
      while (keepGoing) {
        let q = supabase
          .from("sales")
          .select("id, sale_date, year, month, day, vendedor, dependencia, tercero, referencia, cantidad, valor_total, precio_unitario")
          .order("sale_date", { ascending: true })
          .range(from, from + PAGE - 1);
        if (range.from) q = q.gte("sale_date", toIsoDate(range.from));
        if (range.to) q = q.lte("sale_date", toIsoDate(range.to));
        const { data, error } = await q;
        if (error) {
          console.error("Error loading sales", error);
          break;
        }
        const batch = (data ?? []) as SaleRow[];
        all.push(...batch);
        if (batch.length < PAGE) keepGoing = false;
        else from += PAGE;
      }
      if (cancelled) return;
      // Stale-while-revalidate: solo reemplazamos al éxito, nunca limpiamos
      // la data anterior mientras llegan los nuevos resultados.
      setSalesRows(all);
      setHasAnySales(all.length > 0);
      setLoading(false);
      setHasLoadedOnce(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, refreshKey]);

  // If no sales in range, double-check global existence (for empty state UX)
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      if (salesRows.length > 0) return;
      const { count } = await supabase
        .from("sales")
        .select("id", { count: "exact", head: true });
      if (!cancelled) setHasAnySales((count ?? 0) > 0);
    })();
    return () => {
      cancelled = true;
    };
  }, [salesRows.length, refreshKey]);

  // Load product_costs for selected month → Map<referencia, ctu>
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const map = new Map<string, number>();
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
            map.set(r.referencia, Number(r.ctu));
          }
        }
        if (batch.length < PAGE) keepGoing = false;
        else from += PAGE;
      }
      if (!cancelled) setCtuMap(map);
    })();
    return () => {
      cancelled = true;
    };
  }, [costPeriodMonth]);

  // Load operational_costs for selected month → sum of percentages
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data, error } = await supabase
        .from("operational_costs")
        .select("percentage, cost_center_id, cost_centers!inner(is_active)")
        .eq("period_month", opPeriodMonth);
      if (error) {
        // Fallback without join if FK relation name differs
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

  // Compute analytics rows + filters
  const filteredRows = React.useMemo<AnalyticsRow[]>(() => {
    const vSet = new Set(filters.vendedores);
    const dSet = new Set(filters.dependencias);
    const tSet = new Set(filters.terceros);
    const opFactor = 1 - pctOperacional / 100;
    return salesRows
      .filter((r) => (vSet.size ? vSet.has(r.vendedor ?? "") : true))
      .filter((r) => (dSet.size ? dSet.has(r.dependencia ?? "") : true))
      .filter((r) => (tSet.size ? tSet.has(r.tercero ?? "") : true))
      .map((r) => {
        const ctu = ctuMap.get(r.referencia) ?? null;
        const costoLinea = (ctu ?? 0) * Number(r.cantidad);
        const margenBruto = Number(r.valor_total) - costoLinea;
        const margenPct =
          Number(r.valor_total) !== 0
            ? (margenBruto / Number(r.valor_total)) * 100
            : null;
        const margenNeto = margenBruto * opFactor;
        return { ...r, ctu, costoLinea, margenBruto, margenPct, margenNeto };
      });
  }, [salesRows, ctuMap, pctOperacional, filters]);

  // KPIs
  const kpis = React.useMemo(() => {
    let ventas = 0,
      costo = 0,
      margenBruto = 0,
      margenNeto = 0;
    const productos = new Set<string>();
    const clientes = new Set<string>();
    const vendedores = new Set<string>();
    for (const r of filteredRows) {
      ventas += Number(r.valor_total);
      costo += r.costoLinea;
      margenBruto += r.margenBruto;
      margenNeto += r.margenNeto;
      productos.add(r.referencia);
      if (r.tercero) clientes.add(r.tercero);
      if (r.vendedor) vendedores.add(r.vendedor);
    }
    return {
      ventas,
      costo,
      margenBruto,
      margenNeto,
      margenPct: ventas !== 0 ? (margenBruto / ventas) * 100 : 0,
      margenNetoPct: ventas !== 0 ? (margenNeto / ventas) * 100 : 0,
      productos: productos.size,
      clientes: clientes.size,
      vendedores: vendedores.size,
      lineas: filteredRows.length,
    };
  }, [filteredRows]);

  // Monthly series
  const monthlySeries = React.useMemo<MonthlySeries[]>(() => {
    const map = new Map<string, MonthlySeries>();
    for (const r of filteredRows) {
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

  // Daily series (last month in range or whole range if small)
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

  // Generic ranking builder
  const buildRanking = React.useCallback(
    (getKey: (r: AnalyticsRow) => string | null | undefined): RankingItem[] => {
      const map = new Map<string, RankingItem>();
      const opFactor = 1 - pctOperacional / 100;
      for (const r of filteredRows) {
        const k = getKey(r);
        if (!k) continue;
        const existing = map.get(k) ?? {
          key: k,
          ventas: 0,
          costo: 0,
          margenBruto: 0,
          margenNeto: 0,
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
        margenNeto: x.margenBruto * opFactor,
        margenPct: x.ventas !== 0 ? (x.margenBruto / x.ventas) * 100 : 0,
      }));
      arr.sort((a, b) => b.margenBruto - a.margenBruto);
      return arr;
    },
    [filteredRows, pctOperacional],
  );

  const rankings = React.useMemo(() => {
    return {
      vendedores: buildRanking((r) => r.vendedor).slice(0, 10),
      dependencias: buildRanking((r) => r.dependencia).slice(0, 10),
      terceros: buildRanking((r) => r.tercero).slice(0, 10),
      productos: buildRanking((r) => r.referencia).slice(0, 10),
    };
  }, [buildRanking]);

  // Unique values for filter dropdowns
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
    pctOperacional,
    salesRows,
    filteredRows,
    kpis,
    monthlySeries,
    dailySeries,
    rankings,
    uniques,
    ctuMapSize: ctuMap.size,
  };
}