import { createFileRoute } from "@tanstack/react-router";
import { CostosOperacionalesPage } from "@/features/costos-operacionales/CostosOperacionalesPage";
import { RouteSkeleton } from "@/components/layout/RouteSkeleton";

export const Route = createFileRoute("/_app/costos-operacionales")({
  head: () => ({
    meta: [
      { title: "Costos operacionales — Tercol" },
      { name: "description", content: "Porcentaje de costo operacional por centro de costos." },
    ],
  }),
  component: CostosOperacionalesPage,
  pendingComponent: RouteSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
});
