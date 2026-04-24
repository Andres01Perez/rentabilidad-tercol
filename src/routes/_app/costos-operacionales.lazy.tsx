import { createLazyFileRoute } from "@tanstack/react-router";
import { CostosOperacionalesPage } from "@/features/costos-operacionales/CostosOperacionalesPage";

export const Route = createLazyFileRoute("/_app/costos-operacionales")({
  component: CostosOperacionalesPage,
});