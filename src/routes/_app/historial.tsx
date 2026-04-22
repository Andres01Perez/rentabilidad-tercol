import { createFileRoute } from "@tanstack/react-router";
import { History } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/historial")({
  head: () => ({
    meta: [
      { title: "Historial — Tercol" },
      { name: "description", content: "Historial de cambios y trazabilidad de acciones por usuario." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={History}
      eyebrow="Análisis"
      title="Historial"
      description="Registro completo de cambios y acciones, con trazabilidad por usuario para auditoría y control de cambios en precios y costos."
      previews={[
        { title: "Actividad reciente", hint: "Usuario, acción, fecha", variant: "list" },
        { title: "Cambios de precios", hint: "Versiones por lista", variant: "table" },
      ]}
    />
  ),
});
