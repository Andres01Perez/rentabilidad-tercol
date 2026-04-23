import * as XLSX from "xlsx";

/** Normalize a header: lowercase, strip accents, collapse spaces. */
function normalize(s: string): string {
  return s
    .toString()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9%]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export type ColumnMap<TKey extends string> = Record<TKey, readonly string[]>;

export interface ParsedExcelResult<TKey extends string> {
  rows: Record<TKey, string | number | null>[];
  warnings: string[];
  totalRows: number;
  skippedRows: number;
  detectedHeaders: string[];
}

/** Read a File and parse the first sheet into rows mapped by columnMap aliases. */
export async function parseExcel<TKey extends string>(
  file: File,
  columnMap: ColumnMap<TKey>,
  options?: {
    requiredKeys?: TKey[];
    /** Numeric keys: parsed as numbers. */
    numericKeys?: TKey[];
  },
): Promise<ParsedExcelResult<TKey>> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const firstSheet = wb.SheetNames[0];
  if (!firstSheet) throw new Error("El archivo no contiene hojas");
  const ws = wb.Sheets[firstSheet];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, {
    defval: null,
    raw: true,
  });

  const warnings: string[] = [];
  if (raw.length === 0) {
    return { rows: [], warnings: ["La hoja está vacía"], totalRows: 0, skippedRows: 0, detectedHeaders: [] };
  }

  const headers = Object.keys(raw[0] ?? {});
  const headerNorm = headers.map((h) => ({ original: h, norm: normalize(h) }));

  // Build mapping key -> original header
  const resolved: Partial<Record<TKey, string>> = {};
  (Object.keys(columnMap) as TKey[]).forEach((key) => {
    const aliases = columnMap[key].map(normalize);
    const match = headerNorm.find((h) => aliases.includes(h.norm));
    if (match) resolved[key] = match.original;
  });

  const required = options?.requiredKeys ?? [];
  const missing = required.filter((k) => !resolved[k]);
  if (missing.length) {
    throw new Error(
      `Faltan columnas requeridas: ${missing.join(", ")}. Encabezados detectados: ${headers.join(", ")}`,
    );
  }

  const numericSet = new Set<string>(options?.numericKeys ?? []);
  const rows: Record<TKey, string | number | null>[] = [];
  let skipped = 0;

  for (const r of raw) {
    const out = {} as Record<TKey, string | number | null>;
    let hasRequired = true;
    for (const key of Object.keys(columnMap) as TKey[]) {
      const header = resolved[key];
      const v = header ? r[header] : null;
      if (v === null || v === undefined || v === "") {
        out[key] = null;
      } else if (numericSet.has(key)) {
        const n = typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
        out[key] = Number.isFinite(n) ? n : null;
      } else {
        out[key] = String(v).trim();
      }
      if (required.includes(key) && (out[key] === null || out[key] === "")) {
        hasRequired = false;
      }
    }
    if (!hasRequired) {
      skipped++;
      continue;
    }
    rows.push(out);
  }

  if (skipped > 0) {
    warnings.push(`${skipped} filas se descartaron por falta de datos requeridos.`);
  }

  return { rows, warnings, totalRows: raw.length, skippedRows: skipped, detectedHeaders: headers };
}

/** Insert array in chunks to respect Supabase row limits. */
export async function chunkedInsert<T>(
  items: T[],
  chunkSize: number,
  insertFn: (batch: T[]) => Promise<void>,
): Promise<void> {
  for (let i = 0; i < items.length; i += chunkSize) {
    await insertFn(items.slice(i, i + chunkSize));
  }
}

/** Read sheet names + raw matrix preview (first N rows) for each sheet. */
export interface SheetPreview {
  name: string;
  /** Raw rows as 2D array; first ~30 rows. */
  rows: (string | number | null)[][];
  /** Total raw rows (excluding fully empty trailing rows). */
  rowCount: number;
}

export async function parseExcelSheets(
  file: File,
  previewRows = 30,
): Promise<SheetPreview[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  return wb.SheetNames.map((name) => {
    const ws = wb.Sheets[name];
    const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
      header: 1,
      defval: null,
      raw: true,
      blankrows: false,
    });
    return {
      name,
      rows: matrix.slice(0, previewRows).map((r) => r.map((c) => (c === undefined ? null : (c as string | number | null)))),
      rowCount: matrix.length,
    };
  });
}

/** Parse with explicit sheet, header row index, and user-provided mapping. */
export interface MappingOptions<TKey extends string> {
  sheetName: string;
  /** 0-based index of the row that contains headers. */
  headerRowIndex: number;
  /** Map field-key -> exact header label (or null to skip). */
  mapping: Partial<Record<TKey, string | null>>;
  requiredKeys?: TKey[];
  numericKeys?: TKey[];
  /** Drop rows whose numeric required value parses to 0. */
  dropZeroForKey?: TKey;
  /** Key whose text value identifies the row code; used to drop "TOTAL"/"SUBTOTAL" rows. */
  textFilterKey?: TKey;
}

/** Detect labels like "TOTAL", "Subtotal", "TOTAL GENERAL", or junk-looking codes. */
function isTotalLikeValue(v: unknown): boolean {
  if (v === null || v === undefined) return false;
  const raw = String(v).trim();
  if (raw === "") return false;
  if (raw.length > 50) return true;
  const norm = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
  if (/^[0\-\s]+$/.test(norm)) return true;
  const patterns = [
    /^total\b/,
    /\bsubtotal\b/,
    /^suma\b/,
    /^totales\b/,
    /^gran total\b/,
    /^total general\b/,
  ];
  return patterns.some((p) => p.test(norm));
}

export async function parseExcelWithMapping<TKey extends string>(
  file: File,
  options: MappingOptions<TKey>,
): Promise<ParsedExcelResult<TKey>> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: "array" });
  const ws = wb.Sheets[options.sheetName];
  if (!ws) throw new Error(`La hoja "${options.sheetName}" no existe`);

  const matrix = XLSX.utils.sheet_to_json<(string | number | null)[]>(ws, {
    header: 1,
    defval: null,
    raw: true,
    blankrows: false,
  });

  const headerRow = matrix[options.headerRowIndex] ?? [];
  const headers = headerRow.map((h) => (h == null ? "" : String(h).trim()));
  const dataRows = matrix.slice(options.headerRowIndex + 1);

  // Resolve column index per mapped key.
  const resolved: Partial<Record<TKey, number>> = {};
  (Object.keys(options.mapping) as TKey[]).forEach((key) => {
    const target = options.mapping[key];
    if (target == null || target === "") return;
    const idx = headers.findIndex((h) => h === target);
    if (idx >= 0) resolved[key] = idx;
  });

  const required = options.requiredKeys ?? [];
  const missing = required.filter((k) => resolved[k] === undefined);
  if (missing.length) {
    throw new Error(`Faltan columnas requeridas: ${missing.join(", ")}`);
  }

  const numericSet = new Set<string>(options.numericKeys ?? []);
  const rows: Record<TKey, string | number | null>[] = [];
  const warnings: string[] = [];
  let skipped = 0;
  let totalsSkipped = 0;

  for (const r of dataRows) {
    // Skip fully-empty rows
    const allEmpty = r.every((c) => c === null || c === undefined || c === "");
    if (allEmpty) continue;

    // Drop rows that look like "TOTAL"/"SUBTOTAL" labels in the configured text key.
    if (options.textFilterKey !== undefined) {
      const idx = resolved[options.textFilterKey];
      if (idx !== undefined && isTotalLikeValue(r[idx])) {
        totalsSkipped++;
        skipped++;
        continue;
      }
    }

    const out = {} as Record<TKey, string | number | null>;
    let hasRequired = true;
    for (const key of Object.keys(options.mapping) as TKey[]) {
      const idx = resolved[key];
      const v = idx !== undefined ? r[idx] : null;
      if (v === null || v === undefined || v === "") {
        out[key] = null;
      } else if (numericSet.has(key)) {
        const n =
          typeof v === "number" ? v : Number(String(v).replace(/[^0-9.\-]/g, ""));
        out[key] = Number.isFinite(n) ? n : null;
      } else {
        out[key] = String(v).trim();
      }
      if (required.includes(key) && (out[key] === null || out[key] === "")) {
        hasRequired = false;
      }
    }
    if (!hasRequired) {
      skipped++;
      continue;
    }
    if (options.dropZeroForKey && out[options.dropZeroForKey] === 0) {
      skipped++;
      continue;
    }
    rows.push(out);
  }

  if (totalsSkipped > 0) {
    warnings.push(`${totalsSkipped} filas descartadas por ser totales o subtotales.`);
  }
  const otherSkipped = skipped - totalsSkipped;
  if (otherSkipped > 0) {
    warnings.push(`${otherSkipped} filas se descartaron por falta de datos requeridos o precio en cero.`);
  }

  return {
    rows,
    warnings,
    totalRows: dataRows.length,
    skippedRows: skipped,
    detectedHeaders: headers.filter((h) => h !== ""),
  };
}

/** Suggest a header label from a list, given a set of aliases. Returns null if none matches. */
export function suggestHeader(headers: string[], aliases: readonly string[]): string | null {
  const norm = headers.map((h) => ({ original: h, n: normalize(h) }));
  const aliasNorm = aliases.map(normalize);
  const m = norm.find((h) => aliasNorm.includes(h.n));
  return m?.original ?? null;
}

/** Heuristic: pick the first row that looks like a header (≥3 non-numeric, non-empty cells). */
export function suggestHeaderRow(matrix: (string | number | null)[][]): number {
  for (let i = 0; i < Math.min(matrix.length, 15); i++) {
    const row = matrix[i] ?? [];
    const textCells = row.filter(
      (c) => c != null && c !== "" && typeof c !== "number" && isNaN(Number(c)),
    );
    if (textCells.length >= 3) return i;
  }
  return 0;
}