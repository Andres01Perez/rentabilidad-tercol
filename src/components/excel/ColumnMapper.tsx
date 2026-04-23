import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";

export interface MapField<TKey extends string = string> {
  key: TKey;
  label: string;
  required?: boolean;
  hint?: string;
}

interface Props<TKey extends string> {
  headers: string[];
  /** Sample data rows (each row indexed by header position). */
  sampleRows: (string | number | null)[][];
  fields: MapField<TKey>[];
  value: Partial<Record<TKey, string | null>>;
  onChange: (v: Partial<Record<TKey, string | null>>) => void;
}

const NONE_VALUE = "__none__";

export function ColumnMapper<TKey extends string>({
  headers,
  sampleRows,
  fields,
  value,
  onChange,
}: Props<TKey>) {
  const cleanHeaders = React.useMemo(
    () => headers.map((h, i) => ({ label: h || `Col ${i + 1}`, raw: h, index: i })).filter((h) => h.raw !== ""),
    [headers],
  );

  const handleChange = (key: TKey, header: string) => {
    onChange({ ...value, [key]: header === NONE_VALUE ? null : header });
  };

  // Indices of mapped columns (for highlight in preview)
  const mappedIndices = new Set<number>();
  fields.forEach((f) => {
    const h = value[f.key];
    if (h) {
      const idx = headers.findIndex((x) => x === h);
      if (idx >= 0) mappedIndices.add(idx);
    }
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {fields.map((f) => (
          <div key={f.key}>
            <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {f.label} {f.required && <span className="text-destructive">*</span>}
            </Label>
            <Select
              value={value[f.key] ?? NONE_VALUE}
              onValueChange={(v) => handleChange(f.key, v)}
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecciona una columna" />
              </SelectTrigger>
              <SelectContent>
                {!f.required && (
                  <SelectItem value={NONE_VALUE}>
                    <span className="text-muted-foreground">(no usar)</span>
                  </SelectItem>
                )}
                {cleanHeaders.map((h) => (
                  <SelectItem key={`${h.index}-${h.raw}`} value={h.raw}>
                    {h.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {f.hint && <p className="mt-1 text-[11px] text-muted-foreground">{f.hint}</p>}
          </div>
        ))}
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Vista previa del mapeo
        </p>
        <div className="overflow-x-auto rounded-xl border border-border/60 bg-white/60 backdrop-blur">
          <table className="w-full text-xs">
            <thead className="bg-muted/30">
              <tr>
                {headers.map((h, i) => (
                  <th
                    key={i}
                    className={cn(
                      "px-2 py-2 text-left font-medium",
                      mappedIndices.has(i)
                        ? "bg-gradient-brand-soft text-foreground"
                        : "text-muted-foreground",
                    )}
                  >
                    {h || `Col ${i + 1}`}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sampleRows.slice(0, 5).map((row, ri) => (
                <tr key={ri} className="border-t">
                  {headers.map((_, ci) => (
                    <td
                      key={ci}
                      className={cn(
                        "max-w-[160px] truncate px-2 py-1.5",
                        mappedIndices.has(ci) && "font-medium",
                      )}
                    >
                      {row[ci] == null ? "" : String(row[ci])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}