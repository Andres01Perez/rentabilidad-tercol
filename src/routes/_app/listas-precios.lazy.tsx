import { createLazyFileRoute } from "@tanstack/react-router";
import { ListasPreciosPage } from "@/features/listas-precios/ListasPreciosPage";

export const Route = createLazyFileRoute("/_app/listas-precios")({
  component: ListasPreciosPage,
});