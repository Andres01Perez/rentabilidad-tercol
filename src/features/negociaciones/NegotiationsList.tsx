import * as React from "react";
import { Loader2, Plus, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatCurrency } from "@/lib/period";
import { cn } from "@/lib/utils";
import type { NegotiationRow } from "./NegociacionesPage";

export function NegotiationsList({
  rows,
  loading,
  selectedId,
  isNew,
  onSelect,
  onNew,
}: {
  rows: NegotiationRow[];
  loading: boolean;
  selectedId: string | null;
  isNew: boolean;
  onSelect: (id: string) => void;
  onNew: () => void;
}) {
  const [filter, setFilter] = React.useState("");
  const filtered = React.useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((r) => r.name.toLowerCase().includes(q));
  }, [rows, filter]);

  return (
    <aside className="glass flex h-[calc(100vh-200px)] flex-col rounded-2xl border border-border/60 p-3">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <h2 className="text-sm font-semibold">Negociaciones</h2>
        <Button size="sm" variant="ghost" onClick={onNew} className="h-7 gap-1 text-xs">
          <Plus className="h-3.5 w-3.5" /> Nueva
        </Button>
      </div>
      <Input
        placeholder="Buscar…"
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mb-2 h-8"
      />
      <ScrollArea className="flex-1">
        <div className="space-y-1 pr-2">
          {isNew && (
            <button
              type="button"
              onClick={() => undefined}
              className={cn(
                "flex w-full flex-col gap-0.5 rounded-lg border border-dashed border-primary/60 bg-primary/5 p-2.5 text-left transition-colors",
              )}
            >
              <div className="flex items-center gap-1.5 text-sm font-semibold text-primary">
                <Sparkles className="h-3.5 w-3.5" /> Nueva negociación
              </div>
              <span className="text-[11px] text-muted-foreground">Sin guardar</span>
            </button>
          )}
          {loading && rows.length === 0 ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : filtered.length === 0 ? (
            <p className="px-2 py-6 text-center text-xs text-muted-foreground">
              {filter ? "Sin resultados" : "Aún no hay negociaciones."}
            </p>
          ) : (
            filtered.map((r) => {
              const active = !isNew && r.id === selectedId;
              return (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onSelect(r.id)}
                  className={cn(
                    "flex w-full flex-col gap-1 rounded-lg border p-2.5 text-left transition-all",
                    active
                      ? "border-primary bg-primary/5 shadow-sm"
                      : "border-border/40 hover:bg-accent/50",
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-semibold">{r.name}</span>
                    <Badge variant="secondary" className="shrink-0 text-[10px]">
                      {r.items_count}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                    <span className="truncate">{r.created_by_name}</span>
                    <span className="tabular-nums">{formatCurrency(r.total)}</span>
                  </div>
                </button>
              );
            })
          )}
        </div>
      </ScrollArea>
    </aside>
  );
}
