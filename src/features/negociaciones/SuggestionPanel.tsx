import * as React from "react";
import { Sparkles, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatPercent } from "@/lib/period";
import type { LiveSuggestion } from "./useNegotiationLive";

export function SuggestionPanel({
  suggestions,
  onAdd,
}: {
  suggestions: LiveSuggestion[];
  onAdd: (s: LiveSuggestion) => void;
}) {
  if (suggestions.length === 0) return null;
  return (
    <div className="rounded-xl border border-emerald-300/60 bg-emerald-50/60 p-4 dark:border-emerald-500/30 dark:bg-emerald-500/10">
      <div className="mb-3 flex items-center gap-2 text-sm font-semibold text-emerald-900 dark:text-emerald-200">
        <Sparkles className="h-4 w-4" />
        Sugerencias para subir el margen
      </div>
      <p className="mb-3 text-xs text-emerald-900/80 dark:text-emerald-200/80">
        Estos productos tienen costo conocido y % de margen por encima de la meta.
        Añadirlos puede ayudarte a balancear la negociación.
      </p>
      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
        {suggestions.map((s) => (
          <div
            key={s.referencia}
            className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-background/60 p-2.5 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-bold">{s.referencia}</div>
              {s.descripcion && (
                <div className="truncate text-[11px] text-muted-foreground">
                  {s.descripcion}
                </div>
              )}
              <div className="mt-1 flex items-center gap-2 tabular-nums">
                <span>{formatCurrency(s.precio)}</span>
                <span className="text-muted-foreground">·</span>
                <span className="font-semibold text-emerald-700 dark:text-emerald-300">
                  {formatPercent(s.margenPct, 1)}
                </span>
              </div>
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 shrink-0 text-emerald-700 hover:bg-emerald-200/60 hover:text-emerald-800 dark:text-emerald-300"
              onClick={() => onAdd(s)}
              title="Añadir a la negociación"
            >
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}
