import { createLazyFileRoute } from "@tanstack/react-router";
import { NegociacionesPage } from "@/features/negociaciones/NegociacionesPage";

export const Route = createLazyFileRoute("/_app/negociaciones")({
  component: NegociacionesPage,
});