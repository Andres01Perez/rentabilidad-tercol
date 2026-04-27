import { QueryClient } from "@tanstack/react-query";

/**
 * Cliente de cache para queries de Supabase.
 * - staleTime 60s: durante un minuto los datos se consideran frescos y no
 *   se vuelven a pedir al servidor (cero spinners al cambiar de vista).
 * - gcTime 5min: los datos cacheados se mantienen en memoria 5 minutos
 *   después de dejar de usarse.
 * - refetchOnWindowFocus desactivado: evita pedidos al volver a la pestaña.
 */
export function makeQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 60_000,
        gcTime: 5 * 60_000,
        refetchOnWindowFocus: false,
        retry: 1,
      },
    },
  });
}