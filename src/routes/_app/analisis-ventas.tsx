import { createFileRoute } from "@tanstack/react-router";
import { TrendingUp } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/analisis-ventas")({
  head: () => ({
    meta: [
      { title: "Análisis de ventas — Tercol" },
      { name: "description", content: "Análisis profundo de ventas con cruces de costo y margen." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={TrendingUp}
      eyebrow="Análisis"
      title="Análisis de ventas"
      description="Cruza ventas con precios, costos y centros de costo para identificar oportunidades de mejora en margen y mix de producto."
      previews={[
        { title: "Ventas vs margen", hint: "Comparativo período", variant: "chart" },
        { title: "Mix de producto", hint: "Top contribuidores", variant: "table" },
        { title: "Alertas", hint: "Productos con bajo margen", variant: "list" },
      ]}
    />
  ),
});
