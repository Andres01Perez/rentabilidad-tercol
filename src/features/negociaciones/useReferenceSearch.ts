import * as React from "react";
import { supabase } from "@/integrations/supabase/client";

export type MasterReference = {
  referencia: string;
  descripcion: string | null;
};

export function useReferenceSearch(query: string, debounceMs = 250) {
  const [results, setResults] = React.useState<MasterReference[]>([]);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    const q = query.trim();
    if (q.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const handle = setTimeout(async () => {
      const escaped = q.replace(/[%,()]/g, " ");
      const { data, error } = await supabase
        .from("master_references" as never)
        .select("referencia, descripcion")
        .or(`referencia.ilike.%${escaped}%,descripcion.ilike.%${escaped}%`)
        .limit(20);
      if (!error && data) {
        setResults(data as MasterReference[]);
      } else {
        setResults([]);
      }
      setLoading(false);
    }, debounceMs);
    return () => clearTimeout(handle);
  }, [query, debounceMs]);

  return { results, loading };
}