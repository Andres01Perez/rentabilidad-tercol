import * as React from "react";
import { Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { formatMonth } from "@/lib/period";
import { cn } from "@/lib/utils";

interface MultiMonthPickerProps {
  available: string[];
  selected: string[];
  onChange: (next: string[]) => void;
  emptyLabel?: string;
  className?: string;
}

export function MultiMonthPicker({
  available,
  selected,
  onChange,
  emptyLabel = "Selecciona mes(es)",
  className,
}: MultiMonthPickerProps) {
  const [open, setOpen] = React.useState(false);

  const toggle = (value: string) => {
    if (selected.includes(value)) {
      onChange(selected.filter((v) => v !== value));
    } else {
      onChange([...selected, value]);
    }
  };

  const label =
    selected.length === 0
      ? emptyLabel
      : selected.length === 1
        ? formatMonth(selected[0])
        : `${selected.length} meses`;

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-9 w-full justify-between font-normal", className)}
        >
          <span className={cn("truncate", selected.length === 0 && "text-muted-foreground")}>{label}</span>
          <ChevronDown className="h-4 w-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="max-h-72 w-56 overflow-auto p-1">
        {available.length === 0 ? (
          <div className="p-3 text-sm text-muted-foreground">Sin meses disponibles</div>
        ) : (
          available.map((value) => {
            const isSelected = selected.includes(value);
            return (
              <button
                type="button"
                key={value}
                onClick={() => toggle(value)}
                className={cn(
                  "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-sm transition-colors",
                  isSelected ? "bg-accent text-foreground" : "hover:bg-accent/60",
                )}
              >
                <span>{formatMonth(value)}</span>
                {isSelected && <Check className="h-4 w-4 text-primary" />}
              </button>
            );
          })
        )}
      </PopoverContent>
    </Popover>
  );
}