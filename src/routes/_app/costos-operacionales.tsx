import { createFileRoute } from "@tanstack/react-router";
import { CostosOperacionalesPage } from "@/features/costos-operacionales/CostosOperacionalesPage";

export const Route = createFileRoute("/_app/costos-operacionales")({
  head: () => ({
    meta: [
      { title: "Costos operacionales — Tercol" },
      { name: "description", content: "Porcentaje de costo operacional por centro de costos." },
    ],
  }),
  component: CostosOperacionalesPage,
});
