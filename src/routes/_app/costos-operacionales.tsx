import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/costos-operacionales")({
  head: () => ({
    meta: [
      { title: "Costos operacionales — Tercol" },
      { name: "description", content: "Porcentaje de costo operacional por centro de costos." },
    ],
  }),
});
