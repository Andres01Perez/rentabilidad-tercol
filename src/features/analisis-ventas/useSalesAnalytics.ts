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
  // ctuMap solo contiene referencias con CTU > 0 (válidas para margen).
  const [ctuMap, setCtuMap] = React.useState<Map<string, number>>(new Map());
  // zeroCostSet: referencias con registro pero CTU <= 0 (excluidas del margen).
  const [zeroCostSet, setZeroCostSet] = React.useState<Set<string>>(new Set());
  const [pctOperacional, setPctOperacional] = React.useState<number>(0);
  const [loading, setLoading] = React.useState(true);
  const [hasLoadedOnce, setHasLoadedOnce] = React.useState(false);
  const [hasAnySales, setHasAnySales] = React.useState(false);

  // Load sales filtered by date range. Primera página secuencial para descubrir
  // el total; el resto se trae en paralelo (3x más rápido en datasets grandes).
  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const PAGE = 1000;
      const baseSelect = "id, sale_date, year, month, day, vendedor, dependencia, tercero, referencia, cantidad, valor_total, precio_unitario";
      const buildQuery = (from: number, to: number, withCount = false) => {
        let q = supabase
          .from("sales")
          .select(baseSelect, withCount ? { count: "exact" } : undefined)
          .order("sale_date", { ascending: true })
          .range(from, to);
        if (range.from) q = q.gte("sale_date", toIsoDate(range.from));
        if (range.to) q = q.lte("sale_date", toIsoDate(range.to));
        return q;
      };
      // Primera página con count exacto.
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
        const results = await Promise.all(
          ranges.map(([f, t]) => buildQuery(f, t)),
        );
        for (const r of results) {
          if (r.error) {
            console.error("Error loading sales page", r.error);
            continue;
          }
          all.push(...((r.data ?? []) as SaleRow[]));
        }
      }
      if (cancelled) return;
      // Stale-while-revalidate: solo reemplazamos al éxito, nunca limpiamos
      // la data anterior mientras llegan los nuevos resultados.
      setSalesRows(all);
      if (all.length > 0) setHasAnySales(true);
      setLoading(false);
      setHasLoadedOnce(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [range.from, range.to, refreshKey]);

  // Chequeo global de existencia de ventas — solo una vez al montar (y al
  // forzar refresh). Evita reconsultas en cascada y parpadeos del estado vacío.
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

  // Load product_costs for selected month → Map<referencia, ctu>
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
            // Solo costos > 0 son válidos para cálculo de margen.
            // CTU <= 0 sesgaría el margen al 100%, los marcamos como excluidos.
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
        const costoCero = ctu === null && zeroCostSet.has(r.referencia);
        const sinCosto = ctu === null && !costoCero;
        const computable = ctu !== null;
        const costoLinea = computable ? (ctu as number) * Number(r.cantidad) : 0;
        const margenBruto = computable ? Number(r.valor_total) - costoLinea : 0;
        const margenPct =
          computable && Number(r.valor_total) !== 0
            ? (margenBruto / Number(r.valor_total)) * 100
            : null;
        const margenNeto = computable ? margenBruto * opFactor : 0;
        return {
          ...r,
          ctu,
          costoLinea,
          margenBruto,
          margenPct,
          margenNeto,
          costoCero,
          sinCosto,
          computable,
        };
      });
  }, [salesRows, ctuMap, pctOperacional, filters]);

  // KPIs — solo cuentan filas computables (con CTU > 0) para el margen.
  // Las filas excluidas se contabilizan aparte para mostrar el impacto.
  const kpis = React.useMemo(() => {
    let ventas = 0,
      costo = 0,
      margenBruto = 0,
      margenNeto = 0;
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
        margenNeto += r.margenNeto;
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
    return {
      ventas,
      ventasComputables,
      costo,
      margenBruto,
      margenNeto,
      // Margen % calculado solo sobre ventas computables (sin sesgo).
      margenPct: ventasComputables !== 0 ? (margenBruto / ventasComputables) * 100 : 0,
      margenNetoPct: ventasComputables !== 0 ? (margenNeto / ventasComputables) * 100 : 0,
      productos: productos.size,
      clientes: clientes.size,
      vendedores: vendedores.size,
      lineas: filteredRows.length,
      lineasExcluidas,
      ventasExcluidas,
      lineasCostoCero,
      lineasSinCosto,
    };
  }, [filteredRows]);

  // Monthly series — solo filas computables para no sesgar margen.
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
        if (!r.computable) continue;
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
    zeroCostCount: zeroCostSet.size,
  };
}