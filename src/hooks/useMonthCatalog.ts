import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface MonthCatalog {
  costMonths: string[];
  opMonths: string[];
  loading: boolean;
}

/**
 * Catálogo compartido de meses disponibles (product_costs y operational_costs).
 * Se cachea 5 min para no martillar Supabase entre vistas.
 */
export function useMonthCatalog(): MonthCatalog {
  const { data, isLoading } = useQuery({
    queryKey: ["period-catalog"] as const,
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
  return {
    costMonths: data?.costMonths ?? [],
    opMonths: data?.opMonths ?? [],
    loading: isLoading,
  };
}