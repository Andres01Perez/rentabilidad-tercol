import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/negociaciones")({
  head: () => ({
    meta: [
      { title: "Negociaciones — Tercol" },
      { name: "description", content: "Crea cotizaciones y negociaciones con referencias, cantidades y precios." },
    ],
  }),
});