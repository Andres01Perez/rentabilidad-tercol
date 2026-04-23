import * as React from "react";
import { ChevronDown, ChevronUp, ChevronsUpDown, Search, X, Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

function SortableHead({
  label,
  sortKey,
  current,
  dir,
  onClick,
  align = "left",
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: SortDir;
  onClick: (k: SortKey) => void;
  align?: "left" | "right";
  className?: string;
}) {
  const active = current === sortKey;
  return (
    <TableHead className={cn(align === "right" && "text-right", "p-0", className)}>
      <button
        type="button"
        onClick={() => onClick(sortKey)}
        className={cn(
          "flex h-10 w-full items-center gap-1 px-2 text-xs font-medium transition-colors hover:text-foreground",
          align === "right" ? "justify-end" : "justify-start",
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
    </TableHead>
  );
}

function FilterCell({
  value,
  onChange,
  numeric = false,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  numeric?: boolean;
  placeholder?: string;
}) {
  return (
    <TableHead className="p-1">
      <Input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder ?? (numeric ? ">0" : "Filtrar…")}
        className={cn("h-7 px-2 text-xs", numeric && "text-right tabular-nums")}
      />
    </TableHead>
  );
}

interface RentabilidadTableProps {
  rows: RentabilidadRow[];
  onExport: () => void;
}

export function RentabilidadTable({ rows, onExport }: RentabilidadTableProps) {
  const [search, setSearch] = React.useState("");
  const [sortKey, setSortKey] = React.useState<SortKey>("margenNetoPct");
  const [sortDir, setSortDir] = React.useState<SortDir>("desc");
  const [colFilters, setColFilters] = React.useState<ColFilters>(EMPTY_FILTERS);

  const toggleSort = (k: SortKey) => {
    if (sortKey === k) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortKey(k);
      setSortDir("asc");
    }
  };

  const setF = (k: SortKey) => (v: string) =>
    setColFilters((p) => ({ ...p, [k]: v }));

  const filteredRows = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    const numF = {
      cantidad: parseNumFilter(colFilters.cantidad),
      precio: parseNumFilter(colFilters.precio),
      descuentoPct: parseNumFilter(colFilters.descuentoPct),
      precioNeto: parseNumFilter(colFilters.precioNeto),
      ctuProm: parseNumFilter(colFilters.ctuProm),
      margenUnit: parseNumFilter(colFilters.margenUnit),
      margenPct: parseNumFilter(colFilters.margenPct),
      margenNetoUnit: parseNumFilter(colFilters.margenNetoUnit),
      margenNetoPct: parseNumFilter(colFilters.margenNetoPct),
    };
    const filtered = rows.filter((r) => {
      if (q) {
        const hit =
          r.referencia.toLowerCase().includes(q) ||
          (r.descripcion ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (!matchText(r.referencia, colFilters.referencia)) return false;
      if (!matchText(r.descripcion, colFilters.descripcion)) return false;
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
    const sorted = [...filtered].sort((a, b) => {
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
    return sorted;
  }, [rows, search, colFilters, sortKey, sortDir]);

  const hasFilters =
    search.trim() !== "" || Object.values(colFilters).some((v) => v.trim() !== "");

  const clear = () => {
    setSearch("");
    setColFilters(EMPTY_FILTERS);
  };

  return (
    <div className="glass rounded-2xl border border-border/60 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-semibold">Rentabilidad por producto</h3>
          <p className="text-xs text-muted-foreground">
            Mostrando {formatNumber(filteredRows.length)} de {formatNumber(rows.length)} productos
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
      <div className="mt-4 max-h-[calc(100vh-200px)] min-h-[500px] overflow-auto rounded-xl border border-border/40">
        <Table>
          <TableHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur">
            <TableRow>
              <SortableHead label="Ref" sortKey="referencia" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHead label="Descripción" sortKey="descripcion" current={sortKey} dir={sortDir} onClick={toggleSort} />
              <SortableHead label="Cant" sortKey="cantidad" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="Precio" sortKey="precio" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="Desc %" sortKey="descuentoPct" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="Precio neto" sortKey="precioNeto" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="CTU prom" sortKey="ctuProm" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="Margen U" sortKey="margenUnit" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="Margen %" sortKey="margenPct" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="M. neto U" sortKey="margenNetoUnit" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
              <SortableHead label="M. neto %" sortKey="margenNetoPct" current={sortKey} dir={sortDir} onClick={toggleSort} align="right" />
            </TableRow>
            <TableRow className="hover:bg-transparent">
              <FilterCell value={colFilters.referencia} onChange={setF("referencia")} />
              <FilterCell value={colFilters.descripcion} onChange={setF("descripcion")} />
              <FilterCell value={colFilters.cantidad} onChange={setF("cantidad")} numeric />
              <FilterCell value={colFilters.precio} onChange={setF("precio")} numeric />
              <FilterCell value={colFilters.descuentoPct} onChange={setF("descuentoPct")} numeric />
              <FilterCell value={colFilters.precioNeto} onChange={setF("precioNeto")} numeric />
              <FilterCell value={colFilters.ctuProm} onChange={setF("ctuProm")} numeric />
              <FilterCell value={colFilters.margenUnit} onChange={setF("margenUnit")} numeric />
              <FilterCell value={colFilters.margenPct} onChange={setF("margenPct")} numeric />
              <FilterCell value={colFilters.margenNetoUnit} onChange={setF("margenNetoUnit")} numeric />
              <FilterCell value={colFilters.margenNetoPct} onChange={setF("margenNetoPct")} numeric />
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredRows.map((r) => {
              const neto = r.margenNetoPct;
              const tone =
                neto === null
                  ? ""
                  : neto < 0
                    ? "bg-rose-50/40 dark:bg-rose-500/10"
                    : neto < 5
                      ? "bg-amber-50/40 dark:bg-amber-500/10"
                      : "";
              return (
                <TableRow key={r.referencia} className={tone}>
                  <TableCell className="font-bold" style={{ fontFamily: "Montserrat, sans-serif" }}>
                    {r.referencia}
                  </TableCell>
                  <TableCell className="max-w-[220px] truncate text-xs text-muted-foreground">
                    {r.descripcion ?? "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">{formatNumber(r.cantidad)}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatCurrency(r.precio)}</TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.descuentoPct ? formatPercent(r.descuentoPct, 1) : "—"}
                  </TableCell>
                  <TableCell className="text-right tabular-nums font-medium">
                    {formatCurrency(r.precioNeto)}
                  </TableCell>
                  <TableCell className="text-right tabular-nums">
                    {r.ctuProm === null ? <span className="text-muted-foreground">—</span> : formatCurrency(r.ctuProm)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", r.margenUnit !== null && r.margenUnit < 0 && "text-rose-600")}>
                    {r.margenUnit === null ? "—" : formatCurrency(r.margenUnit)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", r.margenPct !== null && r.margenPct < 0 && "font-semibold text-rose-600")}>
                    {r.margenPct === null ? "—" : formatPercent(r.margenPct, 1)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", r.margenNetoUnit !== null && r.margenNetoUnit < 0 && "text-rose-600")}>
                    {r.margenNetoUnit === null ? "—" : formatCurrency(r.margenNetoUnit)}
                  </TableCell>
                  <TableCell className={cn("text-right tabular-nums", r.margenNetoPct !== null && r.margenNetoPct < 0 && "font-semibold text-rose-600")}>
                    {r.margenNetoPct === null ? "—" : formatPercent(r.margenNetoPct, 1)}
                  </TableCell>
                </TableRow>
              );
            })}
            {filteredRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={11} className="py-8 text-center text-sm text-muted-foreground">
                  Sin resultados con los filtros aplicados.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}