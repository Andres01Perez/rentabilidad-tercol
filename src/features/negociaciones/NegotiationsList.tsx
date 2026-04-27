import * as React from "react";
import { Loader2, Plus, Pencil, Briefcase } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/period";
import { cn } from "@/lib/utils";
import type { NegotiationRow } from "./queries";

export function NegotiationsList({
  rows,
  loading,
  onEdit,
  onNew,
}: {
  rows: NegotiationRow[];
  loading: boolean;
  onEdit: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.name.toLowerCase().includes(q) ||
        r.created_by_name.toLowerCase().includes(q),
    );
  }, [rows, filter]);

  return (
    <section className="glass rounded-2xl border border-border/60 p-4 sm:p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <Input
          placeholder="Buscar por nombre o autor…"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="h-9 sm:max-w-xs"
        />
        <Button
          onClick={onNew}
          size="sm"
          className="bg-gradient-brand text-white shadow-elegant"
        >
          <Plus className="mr-1 h-4 w-4" /> Nueva negociación
        </Button>
      </div>

      <div className="mt-5">
        {loading && rows.length === 0 ? (
          <div className="flex h-40 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex h-40 flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
            <Briefcase className="h-6 w-6 opacity-50" />
            {filter ? "Sin resultados para tu búsqueda." : "Aún no hay negociaciones. Crea la primera."}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {filtered.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => onEdit(r.id)}
                className={cn(
                  "group flex flex-col gap-3 rounded-xl border border-border/50 bg-background/50 p-4 text-left transition-all",
                  "hover:border-primary/60 hover:shadow-md",
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="truncate text-base font-semibold">{r.name}</h3>
                  <Badge variant="secondary" className="shrink-0 text-[10px]">
                    {r.items_count} {r.items_count === 1 ? "ítem" : "ítems"}
                  </Badge>
                </div>
                <div className="space-y-1 text-xs text-muted-foreground">
                  <div className="flex items-center justify-between">
                    <span>Total</span>
                    <span className="font-medium tabular-nums text-foreground">
                      {formatCurrency(r.total)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="truncate">Por {r.created_by_name}</span>
                    <span className="tabular-nums">
                      {new Date(r.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                </div>
                <div className="mt-1 flex justify-end">
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-primary opacity-0 transition-opacity group-hover:opacity-100">
                    <Pencil className="h-3.5 w-3.5" /> Editar
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
