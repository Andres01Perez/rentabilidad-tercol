import { createFileRoute } from "@tanstack/react-router";
import { CostosProductosPage } from "@/features/costos-productos/CostosProductosPage";

export const Route = createFileRoute("/_app/costos-productos")({
  head: () => ({
    meta: [
      { title: "Costos — Tercol" },
      { name: "description", content: "Costos unitarios por producto para cálculos de rentabilidad." },
    ],
  }),
  component: CostosProductosPage,
});
