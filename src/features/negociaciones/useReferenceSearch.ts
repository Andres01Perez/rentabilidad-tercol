import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { referenceSearchQueryOptions, type MasterReferenceRow } from "./queries";

export type MasterReference = MasterReferenceRow;

/**
 * Búsqueda de referencias maestras.
 * - Debounce de 250 ms para no martillar la BD mientras se escribe.
 * - Resultados cacheados 5 min en React Query: repetir la misma búsqueda
 *   (muy común al añadir varias referencias seguidas) es instantáneo.
 */
export function useReferenceSearch(query: string, debounceMs = 250) {
  const [debounced, setDebounced] = React.useState(query);
  React.useEffect(() => {
    const handle = setTimeout(() => setDebounced(query), debounceMs);
    return () => clearTimeout(handle);
  }, [query, debounceMs]);

  const q = debounced.trim();
  const { data, isFetching } = useQuery(referenceSearchQueryOptions(q));
  const results = q.length >= 2 ? data ?? [] : [];
  const loading = q.length >= 2 && isFetching;
  return { results, loading };
}