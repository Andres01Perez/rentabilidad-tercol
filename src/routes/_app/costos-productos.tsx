import { createFileRoute } from "@tanstack/react-router";
import { CostosProductosPage } from "@/features/costos-productos/CostosProductosPage";
import { RouteSkeleton } from "@/components/layout/RouteSkeleton";

export const Route = createFileRoute("/_app/costos-productos")({
  head: () => ({
    meta: [
      { title: "Costos — Tercol" },
      { name: "description", content: "Costos unitarios por producto para cálculos de rentabilidad." },
    ],
  }),
  component: CostosProductosPage,
  pendingComponent: RouteSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
});
