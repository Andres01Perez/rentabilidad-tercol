import { createLazyFileRoute } from "@tanstack/react-router";
import { CostosProductosPage } from "@/features/costos-productos/CostosProductosPage";

export const Route = createLazyFileRoute("/_app/costos-productos")({
  component: CostosProductosPage,
});