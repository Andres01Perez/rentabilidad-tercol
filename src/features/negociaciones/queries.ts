import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { NegotiationRow } from "./NegociacionesPage";

export const NEGOTIATIONS_KEY = ["negotiations"] as const;
export const PRICE_LISTS_LIGHT_KEY = ["price-lists-light"] as const;
export const negotiationItemsKey = (id: string) =>
  ["negotiation-items", id] as const;
export const referenceSearchKey = (q: string) =>
  ["ref-search", q] as const;
export const negotiationLiveKey = (
  itemsHash: string,
  costMonths: string[],
  opMonths: string[],
  minMarginPct: number,
  topSuggestions: number,
  sourcePriceListId: string | null,
) =>
  [
    "negotiation-live",
    itemsHash,
    costMonths.slice().sort().join("|"),
    opMonths.slice().sort().join("|"),
    minMarginPct,
    topSuggestions,
    sourcePriceListId ?? "",
  ] as const;

export const negotiationsQueryOptions = () =>
  queryOptions({
    queryKey: NEGOTIATIONS_KEY,
    queryFn: async (): Promise<NegotiationRow[]> => {
      const { data, error } = await supabase
        .from("negotiations")
        .select(
          "id, name, notes, total, items_count, source_price_list_id, created_by_name, updated_by_name, created_at, updated_at",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        ...r,
        total: Number(r.total),
      })) as NegotiationRow[];
    },
  });

export type PriceListLightRow = { id: string; name: string };

export const priceListsLightQueryOptions = () =>
  queryOptions({
    queryKey: PRICE_LISTS_LIGHT_KEY,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<PriceListLightRow[]> => {
      const { data, error } = await supabase
        .from("price_lists")
        .select("id, name")
        .order("name", { ascending: true });
      if (error) throw error;
      return (data ?? []) as PriceListLightRow[];
    },
  });

export type NegotiationItemRow = {
  id: string;
  referencia: string;
  descripcion: string | null;
  cantidad: number;
  precio_unitario: number;
  descuento_pct: number | null;
  source_price_list_id: string | null;
};

export const negotiationItemsQueryOptions = (id: string | null) =>
  queryOptions({
    queryKey: id ? negotiationItemsKey(id) : ["negotiation-items", "none"],
    enabled: !!id,
    queryFn: async (): Promise<NegotiationItemRow[]> => {
      if (!id) return [];
      const { data, error } = await supabase
        .from("negotiation_items")
        .select(
          "id, referencia, descripcion, cantidad, precio_unitario, descuento_pct, source_price_list_id",
        )
        .eq("negotiation_id", id)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as NegotiationItemRow[];
    },
  });

export type MasterReferenceRow = {
  referencia: string;
  descripcion: string | null;
};

export const referenceSearchQueryOptions = (q: string) =>
  queryOptions({
    queryKey: referenceSearchKey(q),
    enabled: q.trim().length >= 2,
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<MasterReferenceRow[]> => {
      const escaped = q.trim().replace(/[%,()]/g, " ");
      const { data, error } = await supabase
        .from("master_references" as never)
        .select("referencia, descripcion")
        .or(`referencia.ilike.%${escaped}%,descripcion.ilike.%${escaped}%`)
        .limit(20);
      if (error) return [];
      return (data ?? []) as MasterReferenceRow[];
    },
  });