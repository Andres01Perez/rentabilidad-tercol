import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X, Download } from "lucide-react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber, formatPercent } from "@/lib/period";
import { cn } from "@/lib/utils";
import type { RentabilidadRow } from "./useCalculadora";

type SortKey =
  | "referencia"
  | "descripcion"
  | "cantidad"
  | "precio"
  | "descuentoPct"
  | "precioNeto"
  | "ctuProm"
  | "margenUnit"
  | "margenPct"
  | "margenNetoUnit"
  | "margenNetoPct";
type SortDir = "asc" | "desc";
type ColFilters = Record<SortKey, string>;

const EMPTY_FILTERS: ColFilters = {
  referencia: "",
  descripcion: "",
  cantidad: "",
  precio: "",
  descuentoPct: "",
  precioNeto: "",
  ctuProm: "",
  margenUnit: "",
  margenPct: "",
  margenNetoUnit: "",
  margenNetoPct: "",
};

type NumFilter =
  | { kind: "eq"; a: number }
  | { kind: "gt"; a: number }
  | { kind: "gte"; a: number }
  | { kind: "lt"; a: number }
  | { kind: "lte"; a: number }
  | { kind: "range"; a: number; b: number };

function parseNumLiteral(s: string): number | null {
  const cleaned = s.replace(/\s+/g, "").replace(/\.(?=\d{3}(\D|$))/g, "").replace(",", ".");
  if (cleaned === "" || cleaned === "-" || cleaned === "+") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function parseNumFilter(input: string): NumFilter | null {
  const s = input.trim();
  if (!s) return null;
  if (s.startsWith(">=")) {
    const a = parseNumLiteral(s.slice(2));
    return a === null ? null : { kind: "gte", a };
  }
  if (s.startsWith("<=")) {
    const a = parseNumLiteral(s.slice(2));
    return a === null ? null : { kind: "lte", a };
  }
  if (s.startsWith(">")) {
    const a = parseNumLiteral(s.slice(1));
    return a === null ? null : { kind: "gt", a };
  }
  if (s.startsWith("<")) {
    const a = parseNumLiteral(s.slice(1));
    return a === null ? null : { kind: "lt", a };
  }
  const m = s.match(/^(-?\d[\d.,]*)\s*-\s*(-?\d[\d.,]*)$/);
  if (m) {
    const a = parseNumLiteral(m[1]);
    const b = parseNumLiteral(m[2]);
    if (a === null || b === null) return null;
    return { kind: "range", a: Math.min(a, b), b: Math.max(a, b) };
  }
  const a = parseNumLiteral(s);
  return a === null ? null : { kind: "eq", a };
}

function matchNum(value: number | null | undefined, f: NumFilter | null): boolean {
  if (!f) return true;
  if (value === null || value === undefined || !Number.isFinite(value)) return false;
  switch (f.kind) {
    case "eq":
      return Math.abs(value - f.a) < 0.5;
    case "gt":
      return value > f.a;
    case "gte":
      return value >= f.a;
    case "lt":
      return value < f.a;
    case "lte":
      return value <= f.a;
    case "range":
      return value >= f.a && value <= f.b;
  }
}

function matchText(value: string | null | undefined, q: string): boolean {
  if (!q.trim()) return true;
  return (value ?? "").toLowerCase().includes(q.trim().toLowerCase());
}

// ----- Definición de columnas (header y filas comparten esta config) -----
const COLS: Array<{ key: SortKey; label: string; width: number; align: "left" | "right"; numeric: boolean }> = [
  { key: "referencia",     label: "Ref",         width: 120, align: "left",  numeric: false },
  { key: "descripcion",    label: "Descripción", width: 240, align: "left",  numeric: false },
  { key: "cantidad",       label: "Cant",        width: 80,  align: "right", numeric: true  },
  { key: "precio",         label: "Precio",      width: 110, align: "right", numeric: true  },
  { key: "descuentoPct",   label: "Desc %",      width: 90,  align: "right", numeric: true  },
  { key: "precioNeto",     label: "Precio neto", width: 120, align: "right", numeric: true  },
  { key: "ctuProm",        label: "CTU prom",    width: 110, align: "right", numeric: true  },
  { key: "margenUnit",     label: "Margen U",    width: 110, align: "right", numeric: true  },
  { key: "margenPct",      label: "Margen %",    width: 100, align: "right", numeric: true  },
  { key: "margenNetoUnit", label: "M. neto U",   width: 110, align: "right", numeric: true  },
  { key: "margenNetoPct",  label: "M. neto %",   width: 100, align: "right", numeric: true  },
];
const TOTAL_WIDTH = COLS.reduce((s, c) => s + c.width, 0);

// ----- Cabecera ordenable (memo) -----
const SortableHead = React.memo(function SortableHead({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align,
  width,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align: "left" | "right";
  width: number;
}) {
  const active = current === sortKey;
  return (
    <div
      className={cn(
        "flex h-10 items-center px-2 text-xs font-medium border-b border-border/40",
        align === "right" ? "justify-end" : "justify-start",
      )}
      style={{ width, flexShrink: 0 }}
    >
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "flex items-center gap-1 transition-colors hover:text-foreground",
          active ? "text-foreground" : "text-muted-foreground",
        )}
      >
        <span>{label}</span>
        {active ? (
          dir === "asc" ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronsUpDown className="h-3 w-3 opacity-40" />
        )}
      </button>
    </div>
  );
});

// ----- Celda de filtro (memo + onChange estable por columna) -----
const FilterCell = React.memo(function FilterCell({
  colKey,
  value,
  numeric,
  width,
  onChange,
}: {
  colKey: SortKey;
  value: string;
  numeric: boolean;
  width: number;
  onChange: (key: SortKey, v: string) => void;
}) {
  const handleChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => onChange(colKey, e.target.value),
    [colKey, onChange],
  );
  return (
    <div className="p-1 border-b border-border/40" style={{ width, flexShrink: 0 }}>
      <Input
        value={value}
        onChange={handleChange}
        placeholder={numeric ? ">0" : "Filtrar…"}
        className={cn("h-7 px-2 text-xs", numeric && "text-right tabular-nums")}
      />
    </div>
  );
});

// ----- Fila virtualizada (memo) -----
const VirtualRow = React.memo(function VirtualRow({ r }: { r: RentabilidadRow }) {
  const tone =
    r.margenNetoPct === null
      ? ""
      : r.margenNetoPct < 0
        ? "bg-rose-50/40 dark:bg-rose-500/10"
        : r.margenNetoPct < 5
          ? "bg-amber-50/40 dark:bg-amber-500/10"
          : "";
  return (
    <div className={cn("flex items-center border-b border-border/40 text-sm hover:bg-accent/30", tone)}>
      <div
        className="px-2 font-bold truncate"
        style={{ width: COLS[0].width, flexShrink: 0, fontFamily: "Montserrat, sans-serif" }}
      >
        {r.referencia}
      </div>
      <div
        className="px-2 truncate text-xs text-muted-foreground"
        style={{ width: COLS[1].width, flexShrink: 0 }}
        title={r.descripcion ?? undefined}
      >
        {r.descripcion ?? "—"}
      </div>
      <div className="px-2 text-right tabular-nums" style={{ width: COLS[2].width, flexShrink: 0 }}>
        {formatNumber(r.cantidad)}
      </div>
      <div className="px-2 text-right tabular-nums" style={{ width: COLS[3].width, flexShrink: 0 }}>
        {formatCurrency(r.precio)}
      </div>
      <div className="px-2 text-right tabular-nums" style={{ width: COLS[4].width, flexShrink: 0 }}>
        {r.descuentoPct ? formatPercent(r.descuentoPct, 1) : "—"}
      </div>
      <div
        className="px-2 text-right tabular-nums font-medium"
        style={{ width: COLS[5].width, flexShrink: 0 }}
      >
        {formatCurrency(r.precioNeto)}
      </div>
      <div className="px-2 text-right tabular-nums" style={{ width: COLS[6].width, flexShrink: 0 }}>
        {r.ctuProm === null ? (
          <span
            className={cn(
              "inline-block rounded-md border px-1.5 py-0.5 text-[10px] font-medium",
              r.costoCero
                ? "border-rose-400/60 text-rose-600 dark:text-rose-300"
                : "border-amber-400/60 text-amber-700 dark:text-amber-300",
            )}
          >
            {r.costoCero ? "Costo 0" : "Sin costo"}
          </span>
        ) : (
          formatCurrency(r.ctuProm)
        )}
      </div>
      <div
        className={cn(
          "px-2 text-right tabular-nums",
          r.margenUnit !== null && r.margenUnit < 0 && "text-rose-600",
        )}
        style={{ width: COLS[7].width, flexShrink: 0 }}
      >
        {r.margenUnit === null ? "—" : formatCurrency(r.margenUnit)}
      </div>
      <div
        className={cn(
          "px-2 text-right tabular-nums",
          r.margenPct !== null && r.margenPct < 0 && "font-semibold text-rose-600",
        )}
        style={{ width: COLS[8].width, flexShrink: 0 }}
      >
        {r.margenPct === null ? "—" : formatPercent(r.margenPct, 1)}
      </div>
      <div
        className={cn(
          "px-2 text-right tabular-nums",
          r.margenNetoUnit !== null && r.margenNetoUnit < 0 && "text-rose-600",
        )}
        style={{ width: COLS[9].width, flexShrink: 0 }}
      >
        {r.margenNetoUnit === null ? "—" : formatCurrency(r.margenNetoUnit)}
      </div>
      <div
        className={cn(
          "px-2 text-right tabular-nums",
          r.margenNetoPct !== null && r.margenNetoPct < 0 && "font-semibold text-rose-600",
        )}
        style={{ width: COLS[10].width, flexShrink: 0 }}
      >
        {r.margenNetoPct === null ? "—" : formatPercent(r.margenNetoPct, 1)}
      </div>
    </div>
  );
});

interface RentabilidadTableProps {
  rows: RentabilidadRow[];
  onExport: () => void;
}

export function RentabilidadTable({ rows, onExport }: RentabilidadTableProps) {
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("margenNetoPct");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [colFilters, setColFilters] = React.useState<ColFilters>(EMPTY_FILTERS);

  // Inputs responden al instante; el filtrado/sort usa valores diferidos
  // para no bloquear la UI con cada keystroke.
  const deferredSearch = React.useDeferredValue(search);
  const deferredFilters = React.useDeferredValue(colFilters);

  const toggleSort = React.useCallback((k: SortKey) => {
    setSortKey((cur) => {
      if (cur === k) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return cur;
      }
      setSortDir("asc");
      return k;
    });
  }, []);

  // Una sola función estable: FilterCell la usa pasando su propia key.
  const handleFilterChange = React.useCallback((key: SortKey, v: string) => {
    setColFilters((p) => (p[key] === v ? p : { ...p, [key]: v }));
  }, []);

  const filteredRows = React.useMemo(() => {
    const q = deferredSearch.trim().toLowerCase();
    const numF = {
      cantidad: parseNumFilter(deferredFilters.cantidad),
      precio: parseNumFilter(deferredFilters.precio),
      descuentoPct: parseNumFilter(deferredFilters.descuentoPct),
      precioNeto: parseNumFilter(deferredFilters.precioNeto),
      ctuProm: parseNumFilter(deferredFilters.ctuProm),
      margenUnit: parseNumFilter(deferredFilters.margenUnit),
      margenPct: parseNumFilter(deferredFilters.margenPct),
      margenNetoUnit: parseNumFilter(deferredFilters.margenNetoUnit),
      margenNetoPct: parseNumFilter(deferredFilters.margenNetoPct),
    };
    const filtered = rows.filter((r) => {
      if (q) {
        const hit =
          r.referencia.toLowerCase().includes(q) ||
          (r.descripcion ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (!matchText(r.referencia, deferredFilters.referencia)) return false;
      if (!matchText(r.descripcion, deferredFilters.descripcion)) return false;
      if (!matchNum(r.cantidad, numF.cantidad)) return false;
      if (!matchNum(r.precio, numF.precio)) return false;
      if (!matchNum(r.descuentoPct, numF.descuentoPct)) return false;
      if (!matchNum(r.precioNeto, numF.precioNeto)) return false;
      if (!matchNum(r.ctuProm, numF.ctuProm)) return false;
      if (!matchNum(r.margenUnit, numF.margenUnit)) return false;
      if (!matchNum(r.margenPct, numF.margenPct)) return false;
      if (!matchNum(r.margenNetoUnit, numF.margenNetoUnit)) return false;
      if (!matchNum(r.margenNetoPct, numF.margenNetoPct)) return false;
      return true;
    });
    const dir = sortDir === "asc" ? 1 : -1;
    const getVal = (r: RentabilidadRow): string | number | null => {
      switch (sortKey) {
        case "referencia": return r.referencia;
        case "descripcion": return r.descripcion;
        case "cantidad": return r.cantidad;
        case "precio": return r.precio;
        case "descuentoPct": return r.descuentoPct;
        case "precioNeto": return r.precioNeto;
        case "ctuProm": return r.ctuProm;
        case "margenUnit": return r.margenUnit;
        case "margenPct": return r.margenPct;
        case "margenNetoUnit": return r.margenNetoUnit;
        case "margenNetoPct": return r.margenNetoPct;
      }
    };
    filtered.sort((a, b) => {
      const av = getVal(a);
      const bv = getVal(b);
      const aNull = av === null || av === undefined || av === "";
      const bNull = bv === null || bv === undefined || bv === "";
      if (aNull && bNull) return 0;
      if (aNull) return 1;
      if (bNull) return -1;
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
    return filtered;
  }, [rows, deferredSearch, deferredFilters, sortKey, sortDir]);

  const isStale = deferredSearch !== search || deferredFilters !== colFilters;

  const hasFilters =
    search.trim() !== "" || Object.values(colFilters).some((v) => v.trim() !== "");

  const clear = React.useCallback(() => {
    setSearch("");
    setColFilters(EMPTY_FILTERS);
  }, []);

  const parentRef = React.useRef<HTMLDivElement>(null);
  const virtualizer = useVirtualizer({
    count: filteredRows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 36,
    overscan: 12,
  });

  return (
    <div className="glass rounded-2xl border border-border/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Rentabilidad por producto</h3>
          <p className="text-xs text-muted-foreground">
            Mostrando {formatNumber(filteredRows.length)} de {formatNumber(rows.length)} productos
            {isStale && <span className="ml-2 text-[10px] italic">filtrando…</span>}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasFilters && (
            <Button variant="outline" size="sm" onClick={clear} className="gap-1.5">
              <X className="h-3.5 w-3.5" /> Limpiar filtros
            </Button>
          )}
          <div className="relative w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar referencia o descripción…"
              className="h-9 pl-8"
            />
          </div>
          <Button onClick={onExport} className="gap-1.5 bg-gradient-brand text-white">
            <Download className="h-4 w-4" /> Excel
          </Button>
        </div>
      </div>

      <div
        ref={parentRef}
        className={cn(
          "mt-4 max-h-[calc(100vh-200px)] min-h-[500px] overflow-auto rounded-xl border border-border/40 transition-opacity",
          isStale && "opacity-70",
        )}
      >
        <div style={{ width: TOTAL_WIDTH, minWidth: "100%" }}>
          {/* Cabecera + fila de filtros sticky */}
          <div className="sticky top-0 z-10 bg-card/95 backdrop-blur" style={{ width: TOTAL_WIDTH }}>
            <div className="flex" style={{ width: TOTAL_WIDTH }}>
              {COLS.map((c) => (
                <SortableHead
                  key={c.key}
                  label={c.label}
                  sortKey={c.key}
                  current={sortKey}
                  dir={sortDir}
                  onClick={toggleSort}
                  align={c.align}
                  width={c.width}
                />
              ))}
            </div>
            <div className="flex" style={{ width: TOTAL_WIDTH }}>
              {COLS.map((c) => (
                <FilterCell
                  key={c.key}
                  colKey={c.key}
                  value={colFilters[c.key]}
                  numeric={c.numeric}
                  width={c.width}
                  onChange={handleFilterChange}
                />
              ))}
            </div>
          </div>

          {/* Cuerpo virtualizado */}
          {filteredRows.length === 0 ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              Sin resultados con los filtros aplicados.
            </div>
          ) : (
            <div
              style={{
                height: virtualizer.getTotalSize(),
                position: "relative",
                width: TOTAL_WIDTH,
              }}
            >
              {virtualizer.getVirtualItems().map((vRow) => {
                const r = filteredRows[vRow.index];
                return (
                  <div
                    key={r.referencia}
                    data-index={vRow.index}
                    ref={virtualizer.measureElement}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: TOTAL_WIDTH,
                      transform: `translateY(${vRow.start}px)`,
                    }}
                  >
                    <VirtualRow r={r} />
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}