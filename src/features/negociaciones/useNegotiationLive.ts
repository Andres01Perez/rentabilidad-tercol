import * as React from "react";
import { useQuery, keepPreviousData } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { negotiationLiveKey } from "./queries";

export interface LiveItem {
  referencia: string;
  descripcion: string | null;
  cantidad: number;
  precio: number;
  descuentoPct: number;
}

export interface LiveRow {
  referencia: string;
  descripcion: string;
  cantidad: number;
  precio: number;
  descuentoPct: number;
  precioNeto: number;
  subtotal: number;
  ctuProm: number | null;
  margenUnit: number | null;
  margenPct: number | null;
  margenNetoUnit: number | null;
  margenNetoPct: number | null;
  costoCero: boolean;
  sinCosto: boolean;
}

export interface LiveTotals {
  ventasBrutas: number;
  ventasNetas: number;
  costoTotal: number;
  margenBruto: number;
  margenBrutoPct: number;
  margenNeto: number;
  margenNetoPct: number;
  avgOpPct: number;
  opFactor: number;
  minMarginPct: number;
  belowMin: boolean;
  gapPct: number;
}

export interface LiveSuggestion {
  referencia: string;
  descripcion: string | null;
  precio: number;
  ctuProm: number;
  margenPct: number;
}

export interface LiveResult {
  rows: LiveRow[];
  totals: LiveTotals;
  suggestions: LiveSuggestion[];
}

const EMPTY_TOTALS: LiveTotals = {
  ventasBrutas: 0,
  ventasNetas: 0,
  costoTotal: 0,
  margenBruto: 0,
  margenBrutoPct: 0,
  margenNeto: 0,
  margenNetoPct: 0,
  avgOpPct: 0,
  opFactor: 0,
  minMarginPct: 36,
  belowMin: false,
  gapPct: 0,
};

const EMPTY_RESULT: LiveResult = {
  rows: [],
  totals: EMPTY_TOTALS,
  suggestions: [],
};

function hashItems(items: LiveItem[]): string {
  return items
    .map(
      (it) =>
        `${it.referencia}|${it.cantidad}|${it.precio}|${it.descuentoPct}`,
    )
    .sort()
    .join("~");
}

/**
 * Cálculo de rentabilidad en vivo de una negociación.
 *
 * - Debounce de 300 ms para no martillar la BD mientras el usuario tipea.
 * - `placeholderData: keepPreviousData` para evitar parpadeos durante recálculos.
 * - Items inválidos (cantidad o precio <= 0) se excluyen del payload.
 */
export function useNegotiationLive(args: {
  items: LiveItem[];
  costMonths: string[];
  opMonths: string[];
  minMarginPct: number;
  topSuggestions?: number;
  sourcePriceListId: string | null;
  enabled?: boolean;
}) {
  const {
    items,
    costMonths,
    opMonths,
    minMarginPct,
    topSuggestions = 5,
    sourcePriceListId,
    enabled = true,
  } = args;

  const validItems = React.useMemo(
    () =>
      items.filter(
        (it) =>
          it.referencia &&
          Number.isFinite(it.cantidad) &&
          it.cantidad > 0 &&
          Number.isFinite(it.precio) &&
          it.precio >= 0,
      ),
    [items],
  );

  const itemsHash = React.useMemo(() => hashItems(validItems), [validItems]);
  const [debouncedHash, setDebouncedHash] = React.useState(itemsHash);
  const [debouncedItems, setDebouncedItems] = React.useState<LiveItem[]>(validItems);
  React.useEffect(() => {
    const h = setTimeout(() => {
      setDebouncedHash(itemsHash);
      setDebouncedItems(validItems);
    }, 300);
    return () => clearTimeout(h);
  }, [itemsHash, validItems]);

  const q = useQuery({
    queryKey: negotiationLiveKey(
      debouncedHash,
      costMonths,
      opMonths,
      minMarginPct,
      topSuggestions,
      sourcePriceListId,
    ),
    enabled: enabled && costMonths.length > 0,
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<LiveResult> => {
      const payload = debouncedItems.map((it) => ({
        referencia: it.referencia,
        descripcion: it.descripcion ?? "",
        cantidad: it.cantidad,
        precio: it.precio,
        descuentoPct: it.descuentoPct,
      }));
      const { data, error } = await supabase.rpc("get_negotiation_realtime", {
        p_items: payload,
        p_cost_months: costMonths,
        p_op_months: opMonths,
        p_min_margin_pct: minMarginPct,
        p_top_suggestions: topSuggestions,
        p_source_price_list_id: sourcePriceListId ?? undefined,
      });
      if (error) throw error;
      const j = (data ?? {}) as {
        rows?: LiveRow[];
        totals?: Partial<LiveTotals>;
        suggestions?: LiveSuggestion[];
      };
      return {
        rows: (j.rows ?? []).map((r) => ({
          ...r,
          cantidad: Number(r.cantidad ?? 0),
          precio: Number(r.precio ?? 0),
          descuentoPct: Number(r.descuentoPct ?? 0),
          precioNeto: Number(r.precioNeto ?? 0),
          subtotal: Number(r.subtotal ?? 0),
          ctuProm: r.ctuProm === null || r.ctuProm === undefined ? null : Number(r.ctuProm),
          margenUnit:
            r.margenUnit === null || r.margenUnit === undefined ? null : Number(r.margenUnit),
          margenPct:
            r.margenPct === null || r.margenPct === undefined ? null : Number(r.margenPct),
          margenNetoUnit:
            r.margenNetoUnit === null || r.margenNetoUnit === undefined
              ? null
              : Number(r.margenNetoUnit),
          margenNetoPct:
            r.margenNetoPct === null || r.margenNetoPct === undefined
              ? null
              : Number(r.margenNetoPct),
        })),
        totals: { ...EMPTY_TOTALS, ...(j.totals ?? {}) } as LiveTotals,
        suggestions: (j.suggestions ?? []).map((s) => ({
          referencia: s.referencia,
          descripcion: s.descripcion ?? null,
          precio: Number(s.precio ?? 0),
          ctuProm: Number(s.ctuProm ?? 0),
          margenPct: Number(s.margenPct ?? 0),
        })),
      };
    },
  });

  return {
    data: q.data ?? EMPTY_RESULT,
    loading: q.isFetching,
    initialLoading: q.isLoading,
    pending: itemsHash !== debouncedHash,
  };
}