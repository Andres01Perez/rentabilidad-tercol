import * as React from "react";
import { createLazyFileRoute, Link, useRouter } from "@tanstack/react-router";
import { AnalisisVentasPage } from "@/features/analisis-ventas/AnalisisVentasPage";
import { Button } from "@/components/ui/button";
import { AlertTriangle, RotateCw, Home } from "lucide-react";

export const Route = createLazyFileRoute("/_app/analisis-ventas")({
  component: AnalisisVentasPage,
  errorComponent: AnalisisVentasError,
});

function AnalisisVentasError({ error, reset }: { error: Error; reset: () => void }) {
  const router = useRouter();
  const isDev = import.meta.env.DEV;

  const handleRetry = () => {
    // Reintentar: invalidar router y resetear el error boundary.
    // Si el chunk falló por cache, una recarga completa lo resuelve.
    try {
      router.invalidate();
      reset();
    } catch {
      window.location.reload();
    }
  };

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="glass max-w-md rounded-3xl p-8 text-center">
        <div className="mx-auto mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-destructive/10">
          <AlertTriangle className="h-7 w-7 text-destructive" />
        </div>
        <h2 className="mb-2 text-xl font-semibold">No se pudo cargar Análisis de ventas</h2>
        <p className="mb-6 text-sm text-muted-foreground">
          Hubo un problema al cargar el módulo. Esto suele resolverse reintentando o recargando la página.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row sm:justify-center">
          <Button onClick={handleRetry} className="bg-gradient-brand text-white">
            <RotateCw className="mr-1 h-4 w-4" />
            Reintentar
          </Button>
          <Button asChild variant="outline">
            <Link to="/dashboard">
              <Home className="mr-1 h-4 w-4" />
              Volver al dashboard
            </Link>
          </Button>
        </div>
        {isDev && error?.message && (
          <pre className="mt-6 max-h-40 overflow-auto rounded-lg bg-muted/40 p-3 text-left text-xs text-muted-foreground">
            {error.message}
          </pre>
        )}
      </div>
    </div>
  );
}