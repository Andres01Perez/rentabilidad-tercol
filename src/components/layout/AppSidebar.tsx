import * as React from "react";
import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Tags,
  Package,
  Building2,
  Calculator,
  Briefcase,
  TrendingUp,
  History,
  Settings,
  LogOut,
  Sparkles,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

type NavItem = {
  title: string;
  to: string;
  icon: React.ComponentType<{ className?: string }>;
  featured?: boolean;
};

const operacion: NavItem[] = [
  { title: "Dashboard", to: "/dashboard", icon: LayoutDashboard },
  { title: "Listas de precios", to: "/listas-precios", icon: Tags },
  { title: "Costos", to: "/costos-productos", icon: Package },
  { title: "Costos operacionales", to: "/costos-operacionales", icon: Building2 },
];

const analisis: NavItem[] = [
  { title: "Negociaciones", to: "/negociaciones", icon: Briefcase },
  { title: "Calculadora", to: "/calculadora", icon: Calculator, featured: true },
  { title: "Análisis de ventas", to: "/analisis-ventas", icon: TrendingUp },
  { title: "Historial", to: "/historial", icon: History },
];

const sistema: NavItem[] = [
  { title: "Configuraciones", to: "/configuraciones", icon: Settings },
];

const NavGroup = React.memo(function NavGroup({
  label,
  items,
  currentPath,
}: {
  label: string;
  items: NavItem[];
  currentPath: string;
}) {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  return (
    <SidebarGroup>
      {!collapsed && (
        <SidebarGroupLabel className="px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/70">
          {label}
        </SidebarGroupLabel>
      )}
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => {
            const isActive = currentPath === item.to || currentPath.startsWith(item.to + "/");
            if (item.featured) {
              return (
                <SidebarMenuItem key={item.to}>
                  <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                    <Link
                      to={item.to}
                      className={cn(
                        "relative flex items-center gap-3 rounded-lg font-semibold text-white transition-all",
                        "bg-gradient-brand shadow-elegant hover:brightness-110",
                      )}
                    >
                      <item.icon className="h-4 w-4 shrink-0 text-white" />
                      <span className="flex-1">{item.title}</span>
                      {!collapsed && <Sparkles className="h-3.5 w-3.5 text-white/90" />}
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              );
            }
            return (
              <SidebarMenuItem key={item.to}>
                <SidebarMenuButton asChild tooltip={item.title} isActive={isActive}>
                  <Link
                    to={item.to}
                    className={cn(
                      "relative flex items-center gap-3 rounded-lg transition-all",
                      isActive
                        ? "bg-gradient-brand-soft font-semibold text-foreground"
                        : "text-muted-foreground hover:bg-accent hover:text-foreground",
                    )}
                  >
                    {isActive && (
                      <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-gradient-brand" />
                    )}
                    <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-foreground")} />
                    <span>{item.title}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            );
          })}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
});

export function AppSidebar() {
  const location = useLocation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";

  const handleLogout = () => {
    logout();
    navigate({ to: "/login" });
  };

  const initials = user
    ? user.name
        .split(" ")
        .map((p: string) => p[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "?";

  return (
    <Sidebar collapsible="icon" className="border-r border-border/60">
      <SidebarHeader className="border-b border-border/60 px-3 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-brand shadow-elegant">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          {!collapsed && (
            <div className="flex flex-col leading-tight">
              <span className="text-lg font-bold tracking-tight text-gradient-brand">Tercol</span>
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Rentabilidad
              </span>
            </div>
          )}
        </div>
      </SidebarHeader>

      <SidebarContent className="px-2 py-4">
        <NavGroup label="Operación" items={operacion} currentPath={location.pathname} />
        <NavGroup label="Análisis" items={analisis} currentPath={location.pathname} />
        <NavGroup label="Sistema" items={sistema} currentPath={location.pathname} />
      </SidebarContent>

      <SidebarFooter className="border-t border-border/60 p-3">
        <div className={cn("flex items-center gap-3", collapsed && "flex-col")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white shadow-soft">
            {initials}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{user?.name ?? "—"}</p>
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">En sesión</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            title="Cerrar sesión"
            className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}
