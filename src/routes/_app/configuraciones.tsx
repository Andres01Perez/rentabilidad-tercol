import { createFileRoute } from "@tanstack/react-router";
import { Settings } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/configuraciones")({
  head: () => ({
    meta: [
      { title: "Configuraciones — Tercol" },
      { name: "description", content: "Ajustes generales de la plataforma Tercol." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={Settings}
      eyebrow="Sistema"
      title="Configuraciones"
      description="Parámetros generales de la plataforma: usuarios, centros de costo, monedas, redondeos y reglas de cálculo."
      previews={[
        { title: "Parámetros generales", hint: "Moneda, redondeo, IVA", variant: "form" },
        { title: "Usuarios", hint: "Trazabilidad y accesos", variant: "list" },
      ]}
    />
  ),
});
