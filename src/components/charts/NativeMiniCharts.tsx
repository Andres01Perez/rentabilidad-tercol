import * as React from "react";
import { cn } from "@/lib/utils";

interface BarDatum {
  label: string;
  value: number;
  tone?: "primary" | "danger" | "muted";
  meta?: string;
}

interface MultiLineDatum {
  label: string;
  values: Record<string, number>;
}

interface ScatterDatum {
  x: number;
  y: number;
  label: string;
}

const toneClass: Record<NonNullable<BarDatum["tone"]>, string> = {
  primary: "bg-primary",
  danger: "bg-destructive",
  muted: "bg-muted-foreground/35",
};

function useMaxValue(values: number[]) {
  return React.useMemo(() => {
    const max = Math.max(...values.map((v) => Math.abs(v)), 0);
    return max <= 0 ? 1 : max;
  }, [values]);
}

export function NativeBarList({
  data,
  formatter,
  emptyLabel = "Sin datos",
}: {
  data: BarDatum[];
  formatter: (value: number) => string;
  emptyLabel?: string;
}) {
  const max = useMaxValue(data.map((item) => item.value));

  if (data.length === 0) {
    return <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-3">
      {data.map((item) => {
        const width = `${Math.max((Math.abs(item.value) / max) * 100, 4)}%`;
        const tone = toneClass[item.tone ?? "primary"];
        return (
          <div key={item.label} className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-xs">
              <span className="truncate font-medium" title={item.label}>
                {item.label}
              </span>
              <div className="shrink-0 text-right">
                <div className="tabular-nums font-semibold">{formatter(item.value)}</div>
                {item.meta && <div className="text-[10px] text-muted-foreground">{item.meta}</div>}
              </div>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-muted/70">
              <div className={cn("h-full rounded-full", tone)} style={{ width }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function NativeColumnChart({
  data,
  formatter,
  emptyLabel = "Sin datos",
}: {
  data: BarDatum[];
  formatter: (value: number) => string;
  emptyLabel?: string;
}) {
  const max = useMaxValue(data.map((item) => item.value));

  if (data.length === 0) {
    return <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">{emptyLabel}</div>;
  }

  return (
    <div className="space-y-3">
      <div className="grid h-72 auto-cols-fr grid-flow-col items-end gap-2 overflow-hidden">
        {data.map((item) => {
          const height = `${Math.max((Math.abs(item.value) / max) * 100, 6)}%`;
          return (
            <div key={item.label} className="flex min-w-0 flex-col items-center justify-end gap-2">
              <div className="text-[10px] font-semibold tabular-nums text-muted-foreground">
                {formatter(item.value)}
              </div>
              <div className="flex h-full w-full items-end justify-center rounded-md bg-muted/35 px-1">
                <div
                  className={cn(
                    "w-full rounded-t-md",
                    toneClass[item.tone ?? "primary"],
                  )}
                  style={{ height }}
                />
              </div>
              <div className="w-full truncate text-center text-[10px] text-muted-foreground" title={item.label}>
                {item.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function NativeLineChart({
  data,
  series,
  emptyLabel = "Sin datos",
}: {
  data: MultiLineDatum[];
  series: Array<{ key: string; label: string; colorVar: string }>;
  emptyLabel?: string;
}) {
  const width = 640;
  const height = 240;
  const padding = 20;
  const allValues = data.flatMap((item) => series.map((s) => item.values[s.key] ?? 0));
  const max = Math.max(...allValues, 0);
  const safeMax = max <= 0 ? 1 : max;

  if (data.length === 0) {
    return <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">{emptyLabel}</div>;
  }

  const getX = (index: number) => {
    if (data.length === 1) return width / 2;
    return padding + (index * (width - padding * 2)) / (data.length - 1);
  };

  const getY = (value: number) => height - padding - (value / safeMax) * (height - padding * 2);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-3 text-[11px] text-muted-foreground">
        {series.map((item) => (
          <div key={item.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: `hsl(var(${item.colorVar}))` }} />
            <span>{item.label}</span>
          </div>
        ))}
      </div>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full overflow-visible rounded-xl bg-muted/20">
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="hsl(var(--border))" strokeWidth="1" />
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="hsl(var(--border))" strokeWidth="1" />
        {series.map((item) => {
          const points = data
            .map((row, index) => `${getX(index)},${getY(row.values[item.key] ?? 0)}`)
            .join(" ");
          return (
            <polyline
              key={item.key}
              fill="none"
              stroke={`hsl(var(${item.colorVar}))`}
              strokeWidth="3"
              strokeLinejoin="round"
              strokeLinecap="round"
              points={points}
            />
          );
        })}
        {data.map((row, index) => (
          <g key={row.label}>
            <text
              x={getX(index)}
              y={height - 4}
              fontSize="10"
              textAnchor="middle"
              fill="hsl(var(--muted-foreground))"
            >
              {row.label}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

export function NativeScatterChart({
  data,
  xFormatter,
  yFormatter,
  emptyLabel = "Sin datos",
}: {
  data: ScatterDatum[];
  xFormatter: (value: number) => string;
  yFormatter: (value: number) => string;
  emptyLabel?: string;
}) {
  const width = 640;
  const height = 260;
  const padding = 28;
  const xs = data.map((d) => d.x);
  const ys = data.map((d) => d.y);
  const minX = Math.min(...xs, 0);
  const maxX = Math.max(...xs, 1);
  const minY = Math.min(...ys, 0);
  const maxY = Math.max(...ys, 1);
  const safeRangeX = maxX - minX || 1;
  const safeRangeY = maxY - minY || 1;

  if (data.length === 0) {
    return <div className="flex h-72 items-center justify-center text-xs text-muted-foreground">{emptyLabel}</div>;
  }

  const xAt = (value: number) => padding + ((value - minX) / safeRangeX) * (width - padding * 2);
  const yAt = (value: number) => height - padding - ((value - minY) / safeRangeY) * (height - padding * 2);

  return (
    <div className="space-y-3">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-72 w-full rounded-xl bg-muted/20">
        <line x1={padding} x2={padding} y1={padding} y2={height - padding} stroke="hsl(var(--border))" strokeWidth="1" />
        <line x1={padding} x2={width - padding} y1={height - padding} y2={height - padding} stroke="hsl(var(--border))" strokeWidth="1" />
        {data.map((item) => (
          <g key={`${item.label}-${item.x}-${item.y}`}>
            <circle cx={xAt(item.x)} cy={yAt(item.y)} r="4" fill="hsl(var(--primary))" opacity="0.85" />
            <title>{`${item.label} · ${xFormatter(item.x)} · ${yFormatter(item.y)}`}</title>
          </g>
        ))}
        <text x={padding} y={16} fontSize="10" fill="hsl(var(--muted-foreground))">
          {yFormatter(maxY)}
        </text>
        <text x={width - padding} y={height - 8} fontSize="10" textAnchor="end" fill="hsl(var(--muted-foreground))">
          {xFormatter(maxX)}
        </text>
      </svg>
    </div>
  );
}