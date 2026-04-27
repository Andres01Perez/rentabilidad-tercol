import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  fetchOperationalByMonths,
  fetchProductCostsByMonths,
  fetchSourceItems,
  type OpMonthInfo,
  type ProductCostByMonth,
  type SourceItem,
  type SourceKind,
  type SourceOption,
} from "./useCalculadora";

export const MONTH_CATALOG_KEY = ["calc", "month-catalog"] as const;
export const sourceOptionsKey = (kind: SourceKind) =>
  ["calc", "source-options", kind] as const;
export const sourceItemsKey = (kind: SourceKind, id: string) =>
  ["calc", "source-items", kind, id] as const;
export const productCostsKey = (months: string[]) =>
  ["calc", "product-costs", months.slice().sort().join("|")] as const;
export const operationalKey = (months: string[]) =>
  ["calc", "operational", months.slice().sort().join("|")] as const;

/**
 * Catálogo de meses disponibles. Antes paginábamos manualmente
 * `product_costs` y `operational_costs` con varios round-trips; ahora
 * usamos un único RPC server-side.
 */
export const monthCatalogQueryOptions = () =>
  queryOptions({
    queryKey: MONTH_CATALOG_KEY,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<{ costMonths: string[]; opMonths: string[] }> => {
      const { data, error } = await supabase.rpc("get_period_catalog");
      if (error) throw error;
      const j = (data ?? {}) as { cost_months?: string[]; op_months?: string[] };
      return {
        costMonths: (j.cost_months ?? []).map(String),
        opMonths: (j.op_months ?? []).map(String),
      };
    },
  });

/**
 * Opciones de fuente (lista de precios o negociación). Usa el RPC
 * `get_source_options` que ya devuelve nombre + items_count en una sola
 * llamada (antes hacíamos N+1 con un `count` por lista).
 */
export const sourceOptionsQueryOptions = (kind: SourceKind) =>
  queryOptions({
    queryKey: sourceOptionsKey(kind),
    queryFn: async (): Promise<SourceOption[]> => {
      const { data, error } = await supabase.rpc("get_source_options", {
        p_kind: kind,
      });
      if (error) throw error;
      const arr = (data as Array<{
        id: string;
        name: string;
        items_count: number;
        total: number | null;
      }>) ?? [];
      return arr.map((o) => ({
        id: o.id,
        name: o.name,
        itemsCount: Number(o.items_count ?? 0),
        total: o.total === null || o.total === undefined ? null : Number(o.total),
      }));
    },
  });

export const sourceItemsQueryOptions = (kind: SourceKind, id: string | null) =>
  queryOptions({
    queryKey: id ? sourceItemsKey(kind, id) : ["calc", "source-items", "none"],
    enabled: !!id,
    queryFn: async (): Promise<SourceItem[]> => {
      if (!id) return [];
      return fetchSourceItems(kind, id);
    },
  });

export const productCostsQueryOptions = (months: string[]) =>
  queryOptions({
    queryKey: productCostsKey(months),
    enabled: months.length > 0,
    queryFn: async (): Promise<ProductCostByMonth> =>
      fetchProductCostsByMonths(months),
  });

export const operationalQueryOptions = (months: string[]) =>
  queryOptions({
    queryKey: operationalKey(months),
    enabled: months.length > 0,
    queryFn: async (): Promise<{ perMonth: OpMonthInfo[]; avgPct: number }> =>
      fetchOperationalByMonths(months),
  });