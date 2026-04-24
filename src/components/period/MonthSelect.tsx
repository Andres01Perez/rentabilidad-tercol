import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { lastNMonths } from "@/lib/period";

interface MonthSelectProps {
  value: string;
  onValueChange: (value: string) => void;
  months?: number;
  options?: { value: string; label: string }[];
  className?: string;
  placeholder?: string;
}

export function MonthSelect({
  value,
  onValueChange,
  months = 24,
  options,
  className,
  placeholder = "Selecciona un mes",
}: MonthSelectProps) {
  const resolvedOptions = React.useMemo(
    () => options ?? lastNMonths(months),
    [options, months],
  );
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {resolvedOptions.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}