import * as React from "react";
import { createFileRoute, Outlet, useLocation, Link, redirect } from "@tanstack/react-router";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { useAuth } from "@/contexts/AuthContext";
import { ChevronRight } from "lucide-react";
import { readStoredSession } from "@/lib/session";

export const Route = createFileRoute("/_app")({
  // Las vistas autenticadas dependen de localStorage. Renderizarlas en el
  // servidor causa un hydration mismatch (server=null user, client=hydrated)
  // que provoca re-monte total del árbol y rompe los chunks lazy.
  ssr: false,
  beforeLoad: () => {
    if (typeof window === "undefined") return;
    const session = readStoredSession();
    if (!session) throw redirect({ to: "/login" });
  },
  component: AppLayout,
});

const ROUTE_LABELS: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/listas-precios": "Listas de precios",
  "/costos-productos": "Costos",
  "/costos-operacionales": "Costos operacionales",
  "/calculadora": "Calculadora",
  "/negocios-fijos": "Negocios fijos",
  "/analisis-ventas": "Análisis de ventas",
  "/historial": "Historial",
  "/configuraciones": "Configuraciones",
};

function AppLayout() {
  const { user } = useAuth();
  const location = useLocation();

  // El guard de beforeLoad ya garantiza que existe sesión en localStorage,
  // y como esta ruta es ssr:false el lazy-init de AuthContext entrega el
  // user inmediatamente. Si por alguna razón no hay user, no renderizamos
  // (beforeLoad redirige).
  if (!user) return null;

  const currentLabel = ROUTE_LABELS[location.pathname] ?? "Tercol";

  return (
    <SidebarProvider>
      <div className="relative flex min-h-screen w-full bg-background">
        {/* Decorative fixed orb (un solo orbe, más liviano) */}
        <div className="pointer-events-none fixed -top-32 right-0 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,oklch(0.62_0.18_250/0.10),transparent_70%)] blur-3xl" />

        <AppSidebar />

        <div className="relative z-10 flex flex-1 flex-col">
          <header className="sticky top-0 z-20 flex h-14 items-center gap-3 border-b border-border/60 bg-white/70 px-4 backdrop-blur-xl">
            <SidebarTrigger className="text-muted-foreground hover:text-foreground" />
            <div className="flex items-center gap-1.5 text-sm">
              <Link
                to="/dashboard"
                className="font-medium text-muted-foreground hover:text-foreground"
              >
                Tercol
              </Link>
              <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
              <span className="font-semibold text-foreground">{currentLabel}</span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full border border-border/60 bg-white/60 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur md:inline-flex">
                <span className="h-1.5 w-1.5 rounded-full bg-gradient-brand" />
                {user.name}
              </span>
            </div>
          </header>

          <main className="flex-1 min-w-0">
            <Outlet />
          </main>
        </div>
      </div>
    </SidebarProvider>
  );
}
