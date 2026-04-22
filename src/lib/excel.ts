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

export type ColumnMap<TKey extends string> = Record<TKey, string[]>;

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