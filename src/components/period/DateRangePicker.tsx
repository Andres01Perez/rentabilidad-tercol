import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

interface DateRangePickerProps {
  value: DateRange;
  onChange: (value: DateRange) => void;
  className?: string;
}

export function DateRangePicker({ value, onChange, className }: DateRangePickerProps) {
  const label = React.useMemo(() => {
    if (value.from && value.to) {
      return `${format(value.from, "dd MMM yyyy", { locale: es })} → ${format(value.to, "dd MMM yyyy", { locale: es })}`;
    }
    if (value.from) return `Desde ${format(value.from, "dd MMM yyyy", { locale: es })}`;
    if (value.to) return `Hasta ${format(value.to, "dd MMM yyyy", { locale: es })}`;
    return "Todo el período";
  }, [value]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn("justify-start gap-2 font-normal", className)}
        >
          <CalendarIcon className="h-4 w-4" />
          <span className="truncate">{label}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <div className="flex flex-col gap-2 p-3">
          <div className="flex flex-wrap gap-1">
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const now = new Date();
                onChange({
                  from: new Date(now.getFullYear(), now.getMonth(), 1),
                  to: new Date(now.getFullYear(), now.getMonth() + 1, 0),
                });
              }}
            >
              Mes actual
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                const now = new Date();
                onChange({
                  from: new Date(now.getFullYear(), 0, 1),
                  to: new Date(now.getFullYear(), 11, 31),
                });
              }}
            >
              Año actual
            </Button>
            <Button size="sm" variant="ghost" onClick={() => onChange({ from: null, to: null })}>
              Todo
            </Button>
          </div>
          <Calendar
            mode="range"
            selected={{ from: value.from ?? undefined, to: value.to ?? undefined }}
            onSelect={(range) =>
              onChange({ from: range?.from ?? null, to: range?.to ?? null })
            }
            numberOfMonths={2}
            locale={es}
            className={cn("p-0 pointer-events-auto")}
          />
        </div>
      </PopoverContent>
    </Popover>
  );
}