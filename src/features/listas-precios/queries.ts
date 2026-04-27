import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type PriceListRow = {
  id: string;
  name: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  updated_by_name: string | null;
  items_count: number;
};

export type PriceItemRow = {
  id: string;
  referencia: string;
  descripcion: string | null;
  unidad_empaque: string | null;
  precio: number | null;
};

export const PRICE_LISTS_KEY = ["price-lists"] as const;

export const priceListsQueryOptions = () =>
  queryOptions({
    queryKey: PRICE_LISTS_KEY,
    queryFn: async (): Promise<PriceListRow[]> => {
      const { data, error } = await supabase
        .from("price_lists")
        .select(
          "id, name, created_by_name, created_at, updated_at, updated_by_name, price_list_items(count)",
        )
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        name: r.name,
        created_by_name: r.created_by_name,
        created_at: r.created_at,
        updated_at: r.updated_at,
        updated_by_name: r.updated_by_name,
        items_count:
          Array.isArray(r.price_list_items) && r.price_list_items[0]
            ? (r.price_list_items[0] as { count: number }).count
            : 0,
      }));
    },
  });

export const priceListItemsQueryOptions = (listId: string | null) =>
  queryOptions({
    queryKey: ["price-list-items", listId] as const,
    enabled: !!listId,
    queryFn: async (): Promise<PriceItemRow[]> => {
      if (!listId) return [];
      const { data, error } = await supabase
        .from("price_list_items")
        .select("id, referencia, descripcion, unidad_empaque, precio")
        .eq("price_list_id", listId)
        .order("referencia", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as PriceItemRow[];
    },
  });