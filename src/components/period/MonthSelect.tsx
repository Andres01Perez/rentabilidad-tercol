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
  className?: string;
  placeholder?: string;
}

export function MonthSelect({
  value,
  onValueChange,
  months = 24,
  className,
  placeholder = "Selecciona un mes",
}: MonthSelectProps) {
  const options = React.useMemo(() => lastNMonths(months), [months]);
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={className}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {options.map((o) => (
          <SelectItem key={o.value} value={o.value}>
            {o.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}