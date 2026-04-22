import { createFileRoute } from "@tanstack/react-router";
import { Briefcase } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/negocios-fijos")({
  head: () => ({
    meta: [
      { title: "Negocios fijos — Tercol" },
      { name: "description", content: "Seguimiento de negocios fijos y contratos recurrentes." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={Briefcase}
      eyebrow="Análisis"
      title="Negocios fijos"
      description="Registra y monitorea negocios fijos, contratos recurrentes y acuerdos de largo plazo con su rentabilidad asociada."
      previews={[
        { title: "Negocios activos", hint: "Cliente, vigencia, margen", variant: "table" },
        { title: "Rentabilidad acumulada", hint: "Por negocio", variant: "chart" },
      ]}
    />
  ),
});
