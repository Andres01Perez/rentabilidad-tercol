import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TableCell, TableRow } from "@/components/ui/table";
import { formatCurrency, formatPercent } from "@/lib/period";
import { cn } from "@/lib/utils";

export type EditorItemRowData = {
  uid: string;
  referencia: string;
  cantidad: string;
  precio_unitario: string;
  descuento_pct: string;
};

export interface RowMetric {
  ctuProm: number | null;
  margenUnit: number | null;
  margenPct: number | null;
  subtotal: number;
  sinCosto?: boolean;
  costoCero?: boolean;
}

interface NegotiationItemRowProps {
  item: EditorItemRowData;
  metric: RowMetric | undefined;
  errors: { qty?: boolean; price?: boolean; disc?: boolean } | undefined;
  minMarginPct: number;
  onUpdate: (uid: string, patch: Partial<EditorItemRowData>) => void;
  onRemove: (uid: string) => void;
}

function NegotiationItemRowImpl({
  item,
  metric,
  errors,
  minMarginPct,
  onUpdate,
  onRemove,
}: NegotiationItemRowProps) {
  const negM = (metric?.margenPct ?? 0) < 0;
  const lowM = metric?.margenPct != null && metric.margenPct < minMarginPct;
  return (
    <TableRow>
      <TableCell className="text-sm font-bold">{item.referencia}</TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={item.cantidad}
          onChange={(e) => onUpdate(item.uid, { cantidad: e.target.value })}
          className={cn(
            "h-8 w-full min-w-0 px-2 text-right tabular-nums",
            errors?.qty && "border-destructive",
          )}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          value={item.precio_unitario}
          onChange={(e) => onUpdate(item.uid, { precio_unitario: e.target.value })}
          className={cn(
            "h-8 w-full min-w-0 px-2 text-right tabular-nums",
            errors?.price && "border-destructive",
          )}
        />
      </TableCell>
      <TableCell>
        <Input
          type="number"
          inputMode="decimal"
          min={0}
          max={100}
          value={item.descuento_pct}
          onChange={(e) => onUpdate(item.uid, { descuento_pct: e.target.value })}
          className={cn(
            "h-8 w-full min-w-0 px-2 text-right tabular-nums",
            errors?.disc && "border-destructive",
          )}
        />
      </TableCell>
      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
        {metric?.ctuProm == null ? (
          metric?.sinCosto ? (
            <span className="text-amber-600">sin costo</span>
          ) : metric?.costoCero ? (
            <span className="text-rose-600">costo 0</span>
          ) : (
            "—"
          )
        ) : (
          formatCurrency(metric.ctuProm)
        )}
      </TableCell>
      <TableCell
        className={cn(
          "text-right text-xs tabular-nums",
          negM && "font-semibold text-rose-600",
        )}
      >
        {metric?.margenUnit == null ? "—" : formatCurrency(metric.margenUnit)}
      </TableCell>
      <TableCell
        className={cn(
          "text-right text-xs tabular-nums",
          negM
            ? "font-semibold text-rose-600"
            : lowM
              ? "text-amber-600"
              : metric?.margenPct != null
                ? "text-emerald-700 dark:text-emerald-400"
                : "",
        )}
      >
        {metric?.margenPct == null ? "—" : formatPercent(metric.margenPct, 1)}
      </TableCell>
      <TableCell className="text-right text-sm font-semibold tabular-nums">
        {formatCurrency(metric?.subtotal ?? 0)}
      </TableCell>
      <TableCell>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-muted-foreground hover:text-destructive"
          onClick={() => onRemove(item.uid)}
          title="Quitar"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </Button>
      </TableCell>
    </TableRow>
  );
}

export const NegotiationItemRow = React.memo(NegotiationItemRowImpl);