const MONTHS_ES = [
  "Enero",
  "Febrero",
  "Marzo",
  "Abril",
  "Mayo",
  "Junio",
  "Julio",
  "Agosto",
  "Septiembre",
  "Octubre",
  "Noviembre",
  "Diciembre",
];

/** Returns "YYYY-MM-01" string (date-safe, no timezone). */
export function monthToDate(year: number, monthIndex: number): string {
  const m = String(monthIndex + 1).padStart(2, "0");
  return `${year}-${m}-01`;
}

export function currentMonthDate(): string {
  const d = new Date();
  return monthToDate(d.getFullYear(), d.getMonth());
}

/** Format a "YYYY-MM-DD" or Date into "Abril 2026". */
export function formatMonth(value: string | Date): string {
  const [y, m] = typeof value === "string"
    ? value.split("-").map(Number)
    : [value.getFullYear(), value.getMonth() + 1];
  return `${MONTHS_ES[(m ?? 1) - 1]} ${y}`;
}

/** Returns last N months, most recent first, as { value: "YYYY-MM-01", label }. */
export function lastNMonths(n = 24): { value: string; label: string }[] {
  const out: { value: string; label: string }[] = [];
  const now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = monthToDate(d.getFullYear(), d.getMonth());
    out.push({ value, label: formatMonth(value) });
  }
  return out;
}

/** Subtract one month. Accepts "YYYY-MM-DD" or "YYYY-MM-01". */
export function previousMonth(value: string): string {
  const [y, m] = value.split("-").map(Number);
  const d = new Date(y, (m ?? 1) - 2, 1);
  return monthToDate(d.getFullYear(), d.getMonth());
}

// Caché de Intl.NumberFormat: instanciar es caro (~0.1-1ms cada uno).
// Para tablas con miles de filas, reutilizar la misma instancia ahorra mucho tiempo.
const _numberFmtCache = new Map<string, Intl.NumberFormat>();
function getNumberFmt(opts?: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = opts ? JSON.stringify(opts) : "_default";
  let fmt = _numberFmtCache.get(key);
  if (!fmt) {
    fmt = new Intl.NumberFormat("es-CO", opts);
    _numberFmtCache.set(key, fmt);
  }
  return fmt;
}

const _currencyFmt = new Intl.NumberFormat("es-CO", {
  style: "currency",
  currency: "COP",
  maximumFractionDigits: 0,
});

const _percentFmtCache = new Map<number, Intl.NumberFormat>();
function getPercentFmt(decimals: number): Intl.NumberFormat {
  let fmt = _percentFmtCache.get(decimals);
  if (!fmt) {
    fmt = new Intl.NumberFormat("es-CO", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    });
    _percentFmtCache.set(decimals, fmt);
  }
  return fmt;
}

export function formatNumber(n: number | null | undefined, opts?: Intl.NumberFormatOptions): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return getNumberFmt(opts).format(n);
}

export function formatCurrency(n: number | null | undefined): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return _currencyFmt.format(n);
}

export function formatPercent(n: number | null | undefined, decimals = 2): string {
  if (n === null || n === undefined || Number.isNaN(n)) return "—";
  return `${getPercentFmt(decimals).format(n)}%`;
}

/** Parse "YYYY-MM-DD" into a local Date (no timezone shift). */
export function parseDateString(value: string): Date {
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

/** Format "YYYY-MM-DD" as "DD/MM/YYYY". */
export function formatDay(value: string): string {
  const [y, m, d] = value.split("-");
  return `${d}/${m}/${y}`;
}

/** Format "YYYY-MM-DD" as short "DD MMM" in Spanish. */
export function formatDayShort(value: string): string {
  const d = parseDateString(value);
  return new Intl.DateTimeFormat("es-CO", { day: "2-digit", month: "short" }).format(d);
}