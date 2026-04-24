import * as XLSX from "xlsx";
import type { RentabilidadRow, OpMonthInfo, SourceOption, SourceKind } from "./useCalculadora";
import { formatMonth } from "@/lib/period";

interface ExportArgs {
  rows: RentabilidadRow[];
  source: { kind: SourceKind; option: SourceOption };
  costMonths: string[];
  opMonths: OpMonthInfo[];
  avgOpPct: number;
}

export function exportRentabilidadExcel({
  rows,
  source,
  costMonths,
  opMonths,
  avgOpPct,
}: ExportArgs) {
  const wb = XLSX.utils.book_new();

  // Hoja 1: Rentabilidad
  const sheet1Header = [
    "Referencia",
    "Descripción",
    "Cantidad",
    "Precio",
    "Descuento %",
    "Precio neto",
    "CTU promedio",
    "Margen unit.",
    "Margen %",
    "Margen neto unit.",
    "Margen neto %",
  ];
  const sheet1: (string | number | null)[][] = [sheet1Header];
  for (const r of rows) {
    sheet1.push([
      r.referencia,
      r.descripcion,
      r.cantidad,
      r.precio,
      r.descuentoPct,
      r.precioNeto,
      r.ctuProm,
      r.margenUnit,
      r.margenPct,
      r.margenNetoUnit,
      r.margenNetoPct,
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet1), "Rentabilidad");

  // Hoja 2: Resumen
  const sheet2: (string | number)[][] = [
    ["Calculadora de rentabilidad"],
    [],
    ["Fuente", source.kind === "price_list" ? "Lista de precios" : "Negociación"],
    ["Nombre", source.option.name],
    ["Items", source.option.itemsCount],
    [],
    ["Meses de costos seleccionados"],
    ...costMonths.map((m) => [formatMonth(m)]),
    [],
    ["Costos operacionales por mes"],
    ["Mes", "% mes", "# centros"],
    ...opMonths.map((m) => [formatMonth(m.month), m.totalPct, m.centerCount]),
    ["Promedio aplicado", avgOpPct],
  ];
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet2), "Resumen");

  // Hoja 3: Costos por mes (CTU)
  const sheet3Header = ["Referencia", ...costMonths.map((m) => formatMonth(m)), "Promedio"];
  const sheet3: (string | number | null)[][] = [sheet3Header];
  for (const r of rows) {
    sheet3.push([
      r.referencia,
      ...costMonths.map((m) => r.ctuByMonth[m] ?? null),
      r.ctuProm,
    ]);
  }
  XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet3), "Costos por mes");

  // Hoja 4: Productos excluidos del margen
  const excluded = rows.filter((r) => r.ctuProm === null);
  if (excluded.length > 0) {
    const sheet4: (string | number | null)[][] = [
      ["Referencia", "Descripción", "Cantidad", "Precio neto", "Motivo"],
    ];
    for (const r of excluded) {
      sheet4.push([
        r.referencia,
        r.descripcion,
        r.cantidad,
        r.precioNeto,
        r.costoCero ? "Costo en cero" : "Sin registro de costo",
      ]);
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(sheet4), "Productos excluidos");
  }

  const fileName = `rentabilidad-${source.option.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fileName);
}