import { createLazyFileRoute } from "@tanstack/react-router";
import { LayoutDashboard } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createLazyFileRoute("/_app/dashboard")({
  component: DashboardPage,
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