import { createFileRoute } from "@tanstack/react-router";
import { AnalisisVentasPage } from "@/features/analisis-ventas/AnalisisVentasPage";

export const Route = createFileRoute("/_app/analisis-ventas")({
  head: () => ({
    meta: [
      { title: "Análisis de ventas — Tercol" },
      { name: "description", content: "Análisis profundo de ventas con cruces de costo y margen." },
    ],
  }),
  component: AnalisisVentasPage,
});
