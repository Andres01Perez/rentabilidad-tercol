import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type ProductCostRow = {
  id: string;
  grupo: string | null;
  referencia: string;
  descripcion: string | null;
  cant: number | null;
  cumat: number | null;
  cumo: number | null;
  cunago: number | null;
  ctmat: number | null;
  ctmo: number | null;
  ctsit: number | null;
  pct_part: number | null;
  cifu: number | null;
  mou: number | null;
  ctu: number | null;
  ct: number | null;
  puv: number | null;
  preciotot: number | null;
  pct_cto: number | null;
};

export const productCostsKey = (month: string) =>
  ["product-costs", month] as const;

export const productCostsQueryOptions = (month: string) =>
  queryOptions({
    queryKey: productCostsKey(month),
    queryFn: async (): Promise<ProductCostRow[]> => {
      const { data, error } = await supabase
        .from("product_costs")
        .select("*")
        .eq("period_month", month)
        .order("referencia", { ascending: true })
        .limit(5000);
      if (error) throw error;
      return (data ?? []) as ProductCostRow[];
    },
  });