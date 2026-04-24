import * as React from "react";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/period";
import {
  NativeBarList,
  NativeColumnChart,
  NativeScatterChart,
} from "@/components/charts/NativeMiniCharts";
import type { RentabilidadRow } from "./useCalculadora";

interface ChartsProps {
  rows: RentabilidadRow[];
}

const BUCKETS = [
  { label: "<0%", min: -Infinity, max: 0 },
  { label: "0-10%", min: 0, max: 10 },
  { label: "10-20%", min: 10, max: 20 },
  { label: "20-30%", min: 20, max: 30 },
  { label: "30-40%", min: 30, max: 40 },
  { label: "40%+", min: 40, max: Infinity },
];

export function RentabilidadCharts({ rows }: ChartsProps) {
  const withMargen = React.useMemo(
    () => rows.filter((r) => r.margenUnit !== null && r.margenPct !== null),
    [rows],
  );

  const topByMargen = React.useMemo(
    () =>
      [...withMargen]
        .sort((a, b) => (b.margenUnit ?? 0) * b.cantidad - (a.margenUnit ?? 0) * a.cantidad)
        .slice(0, 10)
        .map((r) => ({
          label: r.referencia,
          value: (r.margenUnit ?? 0) * r.cantidad,
          meta: `${formatNumber(r.cantidad)} und`,
          tone: (((r.margenUnit ?? 0) * r.cantidad) < 0 ? "danger" : "primary") as "danger" | "primary",
        })),
    [withMargen],
  );

  const worstByPct = React.useMemo(
    () =>
      [...withMargen]
        .sort((a, b) => (a.margenPct ?? 0) - (b.margenPct ?? 0))
        .slice(0, 10)
        .map((r) => ({
          label: r.referencia,
          value: r.margenPct ?? 0,
          meta: formatCurrency(r.precioNeto),
          tone: ((r.margenPct ?? 0) < 0 ? "danger" : "muted") as "danger" | "muted",
        })),
    [withMargen],
  );

  const distribution = React.useMemo(() => {
    return BUCKETS.map((b) => ({
      label: b.label,
      value: withMargen.filter(
        (r) => (r.margenPct ?? 0) >= b.min && (r.margenPct ?? 0) < b.max,
      ).length,
      tone: b.label === "<0%" ? "danger" as const : "primary" as const,
    }));
  }, [withMargen]);

  const scatter = React.useMemo(() => {
    return withMargen.map((r) => ({
      label: r.referencia,
      x: r.precioNeto,
      y: r.margenPct ?? 0,
    }));
  }, [withMargen]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="glass min-w-0 rounded-2xl border border-border/60 p-5">
        <h3 className="text-sm font-semibold">Top 10 productos por margen total</h3>
        <p className="text-xs text-muted-foreground">Margen unitario × cantidad</p>
        <div className="mt-4 min-w-0">
          <NativeBarList data={topByMargen} formatter={formatCurrency} />
        </div>
      </div>

      <div className="glass min-w-0 rounded-2xl border border-border/60 p-5">
        <h3 className="text-sm font-semibold">Top 10 productos con peor margen %</h3>
        <p className="text-xs text-muted-foreground">Productos que más erosionan rentabilidad</p>
        <div className="mt-4 min-w-0">
          <NativeBarList data={worstByPct} formatter={(v) => formatPercent(v, 1)} />
        </div>
      </div>

      <div className="glass min-w-0 rounded-2xl border border-border/60 p-5">
        <h3 className="text-sm font-semibold">Distribución de margen %</h3>
        <p className="text-xs text-muted-foreground">Cuántos productos caen en cada rango</p>
        <div className="mt-4 min-w-0">
          <NativeColumnChart data={distribution} formatter={(v) => `${formatNumber(v)}`} />
        </div>
      </div>

      <div className="glass min-w-0 rounded-2xl border border-border/60 p-5">
        <h3 className="text-sm font-semibold">Precio neto vs margen %</h3>
        <p className="text-xs text-muted-foreground">Detecta productos caros con bajo margen</p>
        <div className="mt-4 min-w-0">
          <NativeScatterChart
            data={scatter}
            xFormatter={formatCurrency}
            yFormatter={(v) => formatPercent(v, 1)}
          />
        </div>
      </div>
    </div>
  );
}
