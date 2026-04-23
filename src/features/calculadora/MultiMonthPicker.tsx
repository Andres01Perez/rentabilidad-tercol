import * as React from "react";
import { Calendar, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { formatMonth } from "@/lib/period";
import { cn } from "@/lib/utils";

interface MultiMonthPickerProps {
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
}

export function MultiMonthPicker({
  available,
  selected,
  onChange,
  emptyLabel = "Selecciona mes(es)",
}: MultiMonthPickerProps) {
  const toggle = (m: string) => {
    onChange(selected.includes(m) ? selected.filter((x) => x !== m) : [...selected, m]);
  };
  return (
    <div className="space-y-2">
      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline" className="w-full justify-start gap-2">
            <Calendar className="h-4 w-4" />
            {selected.length === 0
              ? emptyLabel
              : `${selected.length} mes${selected.length > 1 ? "es" : ""} seleccionado${selected.length > 1 ? "s" : ""}`}
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-72 p-0" align="start">
          <div className="max-h-72 overflow-y-auto p-1">
            {available.length === 0 && (
              <p className="px-2 py-3 text-center text-xs text-muted-foreground">
                Sin meses disponibles
              </p>
            )}
            {available.map((m) => {
              const checked = selected.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggle(m)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-sm transition-colors hover:bg-accent",
                    checked && "bg-accent",
                  )}
                >
                  <span>{formatMonth(m)}</span>
                  {checked && <span className="text-xs text-primary">✓</span>}
                </button>
              );
            })}
          </div>
          {selected.length > 0 && (
            <div className="border-t border-border/60 p-2">
              <Button variant="ghost" size="sm" className="w-full" onClick={() => onChange([])}>
                <X className="mr-1 h-3 w-3" /> Limpiar
              </Button>
            </div>
          )}
        </PopoverContent>
      </Popover>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selected.map((m) => (
            <Badge key={m} variant="secondary" className="gap-1 pr-1">
              {formatMonth(m)}
              <button
                type="button"
                onClick={() => toggle(m)}
                className="rounded p-0.5 transition-colors hover:bg-background"
                aria-label={`Quitar ${formatMonth(m)}`}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}