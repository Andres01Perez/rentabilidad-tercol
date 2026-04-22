import { createFileRoute } from "@tanstack/react-router";
import { Package } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/costos-productos")({
  head: () => ({
    meta: [
      { title: "Costos — Tercol" },
      { name: "description", content: "Costos unitarios por producto para cálculos de rentabilidad." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={Package}
      eyebrow="Operación"
      title="Costos de producto"
      description="Define el costo unitario de cada producto. Estos valores alimentan la calculadora de rentabilidad y los reportes de margen."
      previews={[
        { title: "Catálogo de costos", hint: "Costo unitario actual", variant: "table" },
        { title: "Variación histórica", hint: "Tendencia de costos", variant: "chart" },
        { title: "Cargar costos", hint: "Importación masiva", variant: "form" },
      ]}
    />
  ),
});
