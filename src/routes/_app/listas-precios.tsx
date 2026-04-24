import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_app/listas-precios")({
  head: () => ({
    meta: [
      { title: "Listas de precios — Tercol" },
      { name: "description", content: "Gestión de listas de precios completas y precios unitarios por producto." },
    ],
  }),
});
