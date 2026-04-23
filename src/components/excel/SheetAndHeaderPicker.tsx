import * as React from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import type { SheetPreview } from "@/lib/excel";
import { cn } from "@/lib/utils";

interface Props {
  sheets: SheetPreview[];
  value: { sheet: string; headerRow: number };
  onChange: (v: { sheet: string; headerRow: number }) => void;
}

export function SheetAndHeaderPicker({ sheets, value, onChange }: Props) {
  const current = sheets.find((s) => s.name === value.sheet) ?? sheets[0];
  const previewRows = current?.rows.slice(0, 8) ?? [];
  const maxCols = Math.max(0, ...previewRows.map((r) => r.length));

  return (
    <div className="space-y-4">
      <div>
        <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Hoja del archivo
        </Label>
        <Select
          value={value.sheet}
          onValueChange={(sheet) => onChange({ sheet, headerRow: 0 })}
        >
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {sheets.map((s) => (
              <SelectItem key={s.name} value={s.name}>
                {s.name} <span className="text-muted-foreground">({s.rowCount} filas)</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          ¿Cuál fila contiene los encabezados?
        </Label>
        <p className="mb-2 text-xs text-muted-foreground">
          Selecciona la fila donde están los nombres de columna (Referencia, Precio, etc.).
        </p>
        <RadioGroup
          value={String(value.headerRow)}
          onValueChange={(v) => onChange({ sheet: value.sheet, headerRow: Number(v) })}
        >
          <div className="overflow-x-auto rounded-xl border border-border/60 bg-white/60 backdrop-blur">
            <table className="w-full text-xs">
              <thead className="bg-muted/30">
                <tr>
                  <th className="w-10 px-2 py-2 text-left font-medium text-muted-foreground">#</th>
                  {Array.from({ length: maxCols }).map((_, i) => (
                    <th key={i} className="px-2 py-2 text-left font-medium text-muted-foreground">
                      Col {i + 1}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row, idx) => {
                  const id = `hdr-row-${idx}`;
                  const selected = idx === value.headerRow;
                  return (
                    <tr
                      key={idx}
                      className={cn(
                        "cursor-pointer border-t transition-colors hover:bg-muted/40",
                        selected && "bg-gradient-brand-soft",
                      )}
                      onClick={() => onChange({ sheet: value.sheet, headerRow: idx })}
                    >
                      <td className="px-2 py-2">
                        <RadioGroupItem value={String(idx)} id={id} />
                      </td>
                      {Array.from({ length: maxCols }).map((_, ci) => (
                        <td
                          key={ci}
                          className={cn(
                            "max-w-[140px] truncate px-2 py-2",
                            selected && "font-semibold text-foreground",
                          )}
                        >
                          {row[ci] == null ? "" : String(row[ci])}
                        </td>
                      ))}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}