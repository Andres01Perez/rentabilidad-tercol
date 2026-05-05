import { createFileRoute } from "@tanstack/react-router";
import { ListasPreciosPage } from "@/features/listas-precios/ListasPreciosPage";
import { RouteSkeleton } from "@/components/layout/RouteSkeleton";

export const Route = createFileRoute("/_app/listas-precios")({
  head: () => ({
    meta: [
      { title: "Listas de precios — Tercol" },
      { name: "description", content: "Gestión de listas de precios completas y precios unitarios por producto." },
    ],
  }),
  component: ListasPreciosPage,
  pendingComponent: RouteSkeleton,
  pendingMs: 200,
  pendingMinMs: 300,
});
