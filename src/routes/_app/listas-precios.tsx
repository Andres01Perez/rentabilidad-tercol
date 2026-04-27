import { createFileRoute } from "@tanstack/react-router";
import { priceListsQueryOptions } from "@/features/listas-precios/queries";

export const Route = createFileRoute("/_app/listas-precios")({
  head: () => ({
    meta: [
      { title: "Listas de precios — Tercol" },
      { name: "description", content: "Gestión de listas de precios completas y precios unitarios por producto." },
    ],
  }),
  loader: ({ context }) =>
    context.queryClient.ensureQueryData(priceListsQueryOptions()),
});
