import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora de rentabilidad — Tercol" },
      {
        name: "description",
        content:
          "Calcula rentabilidad por producto combinando lista de precios o negociación, costos de producto y costos operacionales.",
      },
    ],
  }),
});
