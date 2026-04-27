import { createFileRoute } from "@tanstack/react-router";
import { zodValidator, fallback } from "@tanstack/zod-adapter";
import { z } from "zod";
import {
  costCentersQueryOptions,
  operationalCostsQueryOptions,
} from "@/features/costos-operacionales/queries";
import { currentMonthDate, previousMonth } from "@/lib/period";

const defaultMonth = () => previousMonth(currentMonthDate());

const searchSchema = z.object({
  month: fallback(z.string(), defaultMonth()).default(defaultMonth()),
});

export const Route = createFileRoute("/_app/costos-operacionales")({
  head: () => ({
    meta: [
      { title: "Costos operacionales — Tercol" },
      { name: "description", content: "Porcentaje de costo operacional por centro de costos." },
    ],
  }),
  validateSearch: zodValidator(searchSchema),
  loaderDeps: ({ search }) => ({ month: search.month }),
  loader: ({ context, deps }) => {
    void context.queryClient.ensureQueryData(costCentersQueryOptions());
    return context.queryClient.ensureQueryData(
      operationalCostsQueryOptions(deps.month),
    );
  },
});
