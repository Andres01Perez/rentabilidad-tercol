import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import { productCostsQueryOptions } from "@/features/costos-productos/queries";
import { currentMonthDate, previousMonth } from "@/lib/period";

const defaultMonth = () => previousMonth(currentMonthDate());

const searchSchema = z.object({
  month: fallback(z.string(), defaultMonth()).default(defaultMonth()),
});

export const Route = createFileRoute("/_app/costos-productos")({
  head: () => ({
    meta: [
      { title: "Costos — Tercol" },
      { name: "description", content: "Costos unitarios por producto para cálculos de rentabilidad." },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ context, deps }) =>
    context.queryClient.ensureQueryData(productCostsQueryOptions(deps.month)),
});
