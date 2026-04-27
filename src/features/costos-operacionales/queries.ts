import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type CostCenterRow = {
  id: string;
  name: string;
  is_active: boolean;
  created_by_name: string;
  created_at: string;
};

export type AssignmentRow = {
  id: string;
  cost_center_id: string;
  cost_center_name: string;
  percentage: number;
  updated_at: string;
  updated_by_name: string | null;
  created_by_name: string;
};

export const COST_CENTERS_KEY = ["cost-centers"] as const;
export const operationalCostsKey = (month: string) =>
  ["operational-costs", month] as const;

export const costCentersQueryOptions = () =>
  queryOptions({
    queryKey: COST_CENTERS_KEY,
    queryFn: async (): Promise<CostCenterRow[]> => {
      const { data, error } = await supabase
        .from("cost_centers")
        .select("*")
        .order("is_active", { ascending: false })
        .order("name");
      if (error) throw error;
      return (data ?? []) as CostCenterRow[];
    },
  });

export const operationalCostsQueryOptions = (month: string) =>
  queryOptions({
    queryKey: operationalCostsKey(month),
    queryFn: async (): Promise<AssignmentRow[]> => {
      const { data, error } = await supabase
        .from("operational_costs")
        .select(
          "id, cost_center_id, percentage, updated_at, updated_by_name, created_by_name, cost_centers(name)",
        )
        .eq("period_month", month);
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        cost_center_id: r.cost_center_id,
        cost_center_name:
          (r.cost_centers as { name?: string } | null)?.name ?? "—",
        percentage: Number(r.percentage),
        updated_at: r.updated_at,
        updated_by_name: r.updated_by_name,
        created_by_name: r.created_by_name,
      }));
    },
  });