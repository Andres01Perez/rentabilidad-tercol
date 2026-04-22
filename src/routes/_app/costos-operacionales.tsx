import { createFileRoute } from "@tanstack/react-router";
import { Building2 } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/costos-operacionales")({
  head: () => ({
    meta: [
      { title: "Costos operacionales — Tercol" },
      { name: "description", content: "Porcentaje de costo operacional por centro de costos." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={Building2}
      eyebrow="Operación"
      title="Costos operacionales"
      description="Configura el porcentaje de costo operacional por centro de costos. Estos porcentajes se aplicarán automáticamente a las simulaciones de rentabilidad."
      previews={[
        { title: "Centros de costo", hint: "% operacional asignado", variant: "table" },
        { title: "Distribución", hint: "Peso por centro", variant: "chart" },
      ]}
    />
  ),
});
