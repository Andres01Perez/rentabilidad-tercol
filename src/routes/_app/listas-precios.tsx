import { createFileRoute } from "@tanstack/react-router";
import { Tags } from "lucide-react";
import { PagePlaceholder } from "@/components/layout/PagePlaceholder";

export const Route = createFileRoute("/_app/listas-precios")({
  head: () => ({
    meta: [
      { title: "Listas de precios — Tercol" },
      { name: "description", content: "Gestión de listas de precios completas y precios unitarios por producto." },
    ],
  }),
  component: () => (
    <PagePlaceholder
      icon={Tags}
      eyebrow="Operación"
      title="Listas de precios"
      description="Administra precios unitarios y listas completas por canal, cliente o segmento. Cada lista quedará versionada para análisis histórico."
      previews={[
        { title: "Listas activas", hint: "Por canal y vigencia", variant: "table" },
        { title: "Crear nueva lista", hint: "Importar desde plantilla", variant: "form" },
      ]}
    />
  ),
});
