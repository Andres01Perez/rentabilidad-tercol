import { createFileRoute } from "@tanstack/react-router";
import { NegociacionesPage } from "@/features/negociaciones/NegociacionesPage";

export const Route = createFileRoute("/_app/negociaciones")({
  head: () => ({
    meta: [
      { title: "Negociaciones — Tercol" },
      { name: "description", content: "Crea cotizaciones y negociaciones con referencias, cantidades y precios." },
    ],
  }),
  component: NegociacionesPage,
});