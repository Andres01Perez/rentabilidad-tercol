import * as React from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RTooltip,
  CartesianGrid,
  ScatterChart,
  Scatter,
  Cell,
} from "recharts";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/period";

const fmtCurrency = (v: unknown) =>
  typeof v === "number" ? formatCurrency(v) : String(v ?? "");
const fmtPct = (v: unknown) =>
  typeof v === "number" ? formatPercent(v, 1) : String(v ?? "");
const fmtCount = (v: unknown) =>
  typeof v === "number" ? `${formatNumber(v)} productos` : String(v ?? "");
const fmtScatter = (v: unknown, n: unknown) => {
  if (typeof v !== "number") return String(v ?? "");
  return n === "precio" ? formatCurrency(v) : formatPercent(v, 1);
};
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

  const topByMargen = React.useMemo(() => {
    return [...withMargen]
      .sort((a, b) => (b.margenUnit ?? 0) * b.cantidad - (a.margenUnit ?? 0) * a.cantidad)
      .slice(0, 10)
      .map((r) => ({
        ref: r.referencia,
        margen: (r.margenUnit ?? 0) * r.cantidad,
      }));
  }, [withMargen]);

  const worstByPct = React.useMemo(() => {
    return [...withMargen]
      .sort((a, b) => (a.margenPct ?? 0) - (b.margenPct ?? 0))
      .slice(0, 10)
      .map((r) => ({
        ref: r.referencia,
        pct: r.margenPct ?? 0,
      }));
  }, [withMargen]);

  const distribution = React.useMemo(() => {
    return BUCKETS.map((b) => ({
      label: b.label,
      count: withMargen.filter(
        (r) => (r.margenPct ?? 0) >= b.min && (r.margenPct ?? 0) < b.max,
      ).length,
    }));
  }, [withMargen]);

  const scatter = React.useMemo(() => {
    return withMargen.map((r) => ({
      ref: r.referencia,
      precio: r.precioNeto,
      pct: r.margenPct ?? 0,
    }));
  }, [withMargen]);

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
      <div className="glass rounded-2xl border border-border/60 p-5 min-w-0">
        <h3 className="text-sm font-semibold">Top 10 productos por margen total</h3>
        <p className="text-xs text-muted-foreground">Margen unitario × cantidad</p>
        <div className="mt-4 h-72 w-full min-w-0">
          {topByMargen.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
              <BarChart data={topByMargen} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={10} tickFormatter={(v) => formatNumber(v / 1000) + "k"} />
                <YAxis type="category" dataKey="ref" fontSize={10} width={80} />
                <RTooltip formatter={fmtCurrency} />
                <Bar dataKey="margen" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl border border-border/60 p-5 min-w-0">
        <h3 className="text-sm font-semibold">Top 10 productos con peor margen %</h3>
        <p className="text-xs text-muted-foreground">Productos que más erosionan rentabilidad</p>
        <div className="mt-4 h-72 w-full min-w-0">
          {worstByPct.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
              <BarChart data={worstByPct} layout="vertical" margin={{ left: 60 }}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis type="number" fontSize={10} tickFormatter={(v) => v.toFixed(0) + "%"} />
                <YAxis type="category" dataKey="ref" fontSize={10} width={80} />
                <RTooltip formatter={fmtPct} />
                <Bar dataKey="pct" radius={[0, 4, 4, 0]}>
                  {worstByPct.map((d) => (
                    <Cell key={d.ref} fill={d.pct < 0 ? "hsl(0 72% 51%)" : "hsl(28 95% 55%)"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl border border-border/60 p-5 min-w-0">
        <h3 className="text-sm font-semibold">Distribución de margen %</h3>
        <p className="text-xs text-muted-foreground">Cuántos productos caen en cada rango</p>
        <div className="mt-4 h-72 w-full min-w-0">
          {withMargen.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis dataKey="label" fontSize={11} />
                <YAxis fontSize={11} />
                <RTooltip formatter={fmtCount} />
                <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                  {distribution.map((d) => (
                    <Cell key={d.label} fill={d.label === "<0%" ? "hsl(0 72% 51%)" : "hsl(var(--primary))"} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>

      <div className="glass rounded-2xl border border-border/60 p-5 min-w-0">
        <h3 className="text-sm font-semibold">Precio neto vs margen %</h3>
        <p className="text-xs text-muted-foreground">Detecta productos caros con bajo margen</p>
        <div className="mt-4 h-72 w-full min-w-0">
          {scatter.length === 0 ? (
            <div className="flex h-full items-center justify-center text-xs text-muted-foreground">Sin datos</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%" minHeight={250}>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                <XAxis
                  type="number"
                  dataKey="precio"
                  name="Precio"
                  fontSize={10}
                  tickFormatter={(v) => formatNumber(v / 1000) + "k"}
                />
                <YAxis
                  type="number"
                  dataKey="pct"
                  name="Margen %"
                  fontSize={10}
                  tickFormatter={(v) => v.toFixed(0) + "%"}
                />
                <RTooltip
                  formatter={fmtScatter}
                  labelFormatter={() => ""}
                  cursor={{ strokeDasharray: "3 3" }}
                />
                <Scatter data={scatter} fill="hsl(var(--primary))" />
              </ScatterChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  );
}