import { createFileRoute } from "@tanstack/react-router";
import { Calculator } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/calculadora")({
  head: () => ({
    meta: [
      { title: "Calculadora — Tercol" },
      { name: "description", content: "Simulador de rentabilidad por producto y escenario." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={Calculator}
      eyebrow="Análisis"
      title="Calculadora de rentabilidad"
      description="Simulador interactivo de rentabilidad. La definición de entradas y salidas se diseñará en la siguiente iteración según el flujo planeado."
      previews={[
        { title: "Entradas del simulador", hint: "Producto, precio, costo", variant: "form" },
        { title: "Resultado", hint: "Margen y utilidad", variant: "list" },
      ]}
      status="Próximamente"
    />
  ),
});
