import { createFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/dashboard")({
  head: () => ({
    meta: [
      { title: "Dashboard — Tercol" },
      { name: "description", content: "Resumen ejecutivo de rentabilidad, ventas y costos en Tercol." },
    ],
  }),
});

function DashboardPage() {
  return (
    <PagePlaceholder
      icon={LayoutDashboard}
      eyebrow="Inicio"
      title="Dashboard ejecutivo"
      description="Vista consolidada de rentabilidad, márgenes y desempeño operacional. Aquí aparecerán los KPIs principales y gráficos comparativos cuando conectemos los datos."
      previews={[
        { title: "Margen por centro de costos", hint: "Comparativo mensual", variant: "chart" },
        { title: "Top productos", hint: "Por contribución a la utilidad", variant: "table" },
        { title: "Movimientos recientes", hint: "Últimas actualizaciones", variant: "list" },
      ]}
      status="Próximamente"
    />
  );
}
