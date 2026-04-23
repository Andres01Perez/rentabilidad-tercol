import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export type SourceKind = "price_list" | "negotiation";

export interface SourceOption {
  id: string;
  name: string;
  itemsCount: number;
  total?: number | null;
}

export interface SourceItem {
  referencia: string;
  descripcion: string | null;
  /** Precio unitario base (sin descuento). */
  precio: number;
  /** % descuento (solo negociaciones). 0 para listas. */
  descuentoPct: number;
  /** Cantidad estimada (negociación). 1 si lista. */
  cantidad: number;
}

export interface CostMonthInfo {
  month: string; // YYYY-MM-01
  productCount: number;
}

export interface OpMonthInfo {
  month: string; // YYYY-MM-01
  totalPct: number;
  centerCount: number;
}

export interface ProductCostByMonth {
  /** referencia -> month -> ctu */
  byRefMonth: Map<string, Map<string, number>>;
  /** referencia -> ctu promedio (entre meses con dato) */
  avgByRef: Map<string, number>;
}

export interface RentabilidadRow {
  referencia: string;
  descripcion: string | null;
  precio: number;
  descuentoPct: number;
  precioNeto: number;
  cantidad: number;
  ctuProm: number | null;
  ctuByMonth: Record<string, number | null>;
  margenUnit: number | null;
  margenPct: number | null;
  margenNetoUnit: number | null;
  margenNetoPct: number | null;
}

function uniqueSorted(values: string[]): string[] {
  return Array.from(new Set(values)).sort((a, b) => b.localeCompare(a));
}

/** Catálogo de meses disponibles en product_costs y operational_costs. */
export function useMonthCatalog() {
  const [costMonths, setCostMonths] = React.useState<string[]>([]);
  const [opMonths, setOpMonths] = React.useState<string[]>([]);
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const PAGE = 1000;
      // product_costs
      const cm: string[] = [];
      let from = 0;
      while (true) {
        const { data } = await supabase
          .from("product_costs")
          .select("period_month")
          .range(from, from + PAGE - 1);
        const batch = data ?? [];
        for (const r of batch) cm.push(String(r.period_month));
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      const om: string[] = [];
      from = 0;
      while (true) {
        const { data } = await supabase
          .from("operational_costs")
          .select("period_month")
          .range(from, from + PAGE - 1);
        const batch = data ?? [];
        for (const r of batch) om.push(String(r.period_month));
        if (batch.length < PAGE) break;
        from += PAGE;
      }
      if (cancelled) return;
      setCostMonths(uniqueSorted(cm));
      setOpMonths(uniqueSorted(om));
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return { costMonths, opMonths, loading };
}

/** Lista de fuentes según el tipo elegido. */
export function useSourceOptions(kind: SourceKind) {
  const [options, setOptions] = React.useState<SourceOption[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (kind === "price_list") {
        const { data } = await supabase
          .from("price_lists")
          .select("id, name")
          .order("updated_at", { ascending: false });
        const list = data ?? [];
        const counts = await Promise.all(
          list.map((l) =>
            supabase
              .from("price_list_items")
              .select("id", { count: "exact", head: true })
              .eq("price_list_id", l.id)
              .then((r) => r.count ?? 0),
          ),
        );
        if (!cancelled) {
          setOptions(
            list.map((l, i) => ({ id: l.id, name: l.name, itemsCount: counts[i] })),
          );
        }
      } else {
        const { data } = await supabase
          .from("negotiations")
          .select("id, name, items_count, total")
          .order("updated_at", { ascending: false });
        if (!cancelled) {
          setOptions(
            (data ?? []).map((n) => ({
              id: n.id,
              name: n.name,
              itemsCount: n.items_count,
              total: Number(n.total ?? 0),
            })),
          );
        }
      }
      if (!cancelled) setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [kind]);

  return { options, loading };
}

/** Trae los items de la fuente elegida normalizados. */
export async function fetchSourceItems(
  kind: SourceKind,
  id: string,
): Promise<SourceItem[]> {
  if (kind === "price_list") {
    const { data } = await supabase
      .from("price_list_items")
      .select("referencia, descripcion, precio")
      .eq("price_list_id", id)
      .limit(10000);
    return (data ?? []).map((r) => ({
      referencia: String(r.referencia),
      descripcion: r.descripcion,
      precio: Number(r.precio ?? 0),
      descuentoPct: 0,
      cantidad: 1,
    }));
  }
  const { data } = await supabase
    .from("negotiation_items")
    .select("referencia, descripcion, precio_unitario, descuento_pct, cantidad, precio_venta")
    .eq("negotiation_id", id)
    .limit(10000);
  return (data ?? []).map((r) => ({
    referencia: String(r.referencia),
    descripcion: r.descripcion,
    precio: Number(r.precio_unitario ?? r.precio_venta ?? 0),
    descuentoPct: Number(r.descuento_pct ?? 0),
    cantidad: Number(r.cantidad ?? 1),
  }));
}

/** Para los meses elegidos: { byRefMonth, avgByRef }. */
export async function fetchProductCostsByMonths(
  months: string[],
): Promise<ProductCostByMonth> {
  const byRefMonth = new Map<string, Map<string, number>>();
  if (months.length === 0) return { byRefMonth, avgByRef: new Map() };
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("product_costs")
      .select("referencia, ctu, period_month")
      .in("period_month", months)
      .range(from, from + PAGE - 1);
    if (error) break;
    const batch = data ?? [];
    for (const r of batch) {
      if (r.ctu === null || r.ctu === undefined) continue;
      const ref = String(r.referencia);
      const m = String(r.period_month);
      const cur = byRefMonth.get(ref) ?? new Map<string, number>();
      cur.set(m, Number(r.ctu));
      byRefMonth.set(ref, cur);
    }
    if (batch.length < PAGE) break;
    from += PAGE;
  }
  const avgByRef = new Map<string, number>();
  for (const [ref, mmap] of byRefMonth) {
    const vals = Array.from(mmap.values());
    if (vals.length > 0) {
      avgByRef.set(ref, vals.reduce((a, b) => a + b, 0) / vals.length);
    }
  }
  return { byRefMonth, avgByRef };
}

/** Suma % de centros activos por mes, devuelve detalle + promedio. */
export async function fetchOperationalByMonths(months: string[]): Promise<{
  perMonth: OpMonthInfo[];
  avgPct: number;
}> {
  if (months.length === 0) return { perMonth: [], avgPct: 0 };
  const { data, error } = await supabase
    .from("operational_costs")
    .select("percentage, period_month, cost_centers!inner(is_active)")
    .in("period_month", months);
  let rows: { period_month: string; percentage: number; active: boolean }[] = [];
  if (error) {
    const { data: simple } = await supabase
      .from("operational_costs")
      .select("percentage, period_month")
      .in("period_month", months);
    rows = (simple ?? []).map((r) => ({
      period_month: String(r.period_month),
      percentage: Number(r.percentage ?? 0),
      active: true,
    }));
  } else {
    rows = (data ?? []).map((r) => ({
      period_month: String(r.period_month),
      percentage: Number(r.percentage ?? 0),
      active:
        (r.cost_centers as { is_active?: boolean } | null)?.is_active ?? true,
    }));
  }
  const perMonth: OpMonthInfo[] = months.map((m) => {
    const ms = rows.filter((r) => r.period_month === m && r.active);
    return {
      month: m,
      totalPct: ms.reduce((acc, r) => acc + r.percentage, 0),
      centerCount: ms.length,
    };
  });
  const avgPct =
    perMonth.length > 0
      ? perMonth.reduce((a, b) => a + b.totalPct, 0) / perMonth.length
      : 0;
  return { perMonth, avgPct };
}

/** Calcula la rentabilidad por producto. */
export function computeRentabilidad(
  items: SourceItem[],
  costs: ProductCostByMonth,
  costMonths: string[],
  avgOpPct: number,
): RentabilidadRow[] {
  const opFactor = avgOpPct / 100;
  return items.map((it) => {
    const precioNeto = it.precio * (1 - it.descuentoPct / 100);
    const ctuProm = costs.avgByRef.get(it.referencia) ?? null;
    const ctuByMonth: Record<string, number | null> = {};
    const mmap = costs.byRefMonth.get(it.referencia);
    for (const m of costMonths) {
      ctuByMonth[m] = mmap?.get(m) ?? null;
    }
    const margenUnit = ctuProm === null ? null : precioNeto - ctuProm;
    const margenPct =
      margenUnit === null || precioNeto === 0
        ? null
        : (margenUnit / precioNeto) * 100;
    const margenNetoUnit =
      margenUnit === null ? null : margenUnit - precioNeto * opFactor;
    const margenNetoPct =
      margenNetoUnit === null || precioNeto === 0
        ? null
        : (margenNetoUnit / precioNeto) * 100;
    return {
      referencia: it.referencia,
      descripcion: it.descripcion,
      precio: it.precio,
      descuentoPct: it.descuentoPct,
      precioNeto,
      cantidad: it.cantidad,
      ctuProm,
      ctuByMonth,
      margenUnit,
      margenPct,
      margenNetoUnit,
      margenNetoPct,
    };
  });
}