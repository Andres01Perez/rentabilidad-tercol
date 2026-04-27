import * as React from "react";
import { ChevronDown, UserRound, Loader2, LogOut, Check } from "lucide-react";
import { toast } from "sonner";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser, DEFAULT_USER, type TercolUser } from "@/hooks/useCurrentUser";
import { cn } from "@/lib/utils";

interface UserSwitcherProps {
  collapsed?: boolean;
}

/**
 * Selector ligero de identidad para auditoría.
 * - Carga la lista de `app_users` ÚNICAMENTE al abrir el dropdown.
 * - Permite seleccionar un usuario existente, crear uno nuevo o
 *   cerrar identidad (vuelve a "Sistema").
 */
export function UserSwitcher({ collapsed }: UserSwitcherProps) {
  const { user, setUser, clearUser } = useCurrentUser();
  // Evitamos hydration mismatch: el primer render (SSR + primer paint del
  // cliente) muestra siempre el usuario por defecto. Tras montar leemos la
  // identidad real desde sessionStorage.
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => setMounted(true), []);
  const displayUser: TercolUser = mounted ? user ?? DEFAULT_USER : DEFAULT_USER;
  const [open, setOpen] = React.useState(false);
  const [loading, setLoading] = React.useState(false);
  const [users, setUsers] = React.useState<TercolUser[]>([]);
  const [loadedOnce, setLoadedOnce] = React.useState(false);
  const [newName, setNewName] = React.useState("");
  const [creating, setCreating] = React.useState(false);

  const loadUsers = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("app_users")
      .select("id, name, is_default")
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });
    if (error) {
      console.error("Error loading app_users", error);
      toast.error("No se pudieron cargar los usuarios");
    } else {
      setUsers((data ?? []).map((u) => ({ id: u.id, name: u.name })));
      setLoadedOnce(true);
    }
    setLoading(false);
  }, []);

  // Carga on-demand: solo cuando se abre el popover por primera vez.
  React.useEffect(() => {
    if (open && !loadedOnce && !loading) {
      void loadUsers();
    }
  }, [open, loadedOnce, loading, loadUsers]);

  const handleSelect = (u: TercolUser) => {
    setUser(u);
    setOpen(false);
    toast.success(`Firmando como ${u.name}`);
  };

  const handleCreate = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("app_users")
        .insert({ name: trimmed, is_default: false })
        .select("id, name")
        .single();
      if (error) {
        // Duplicado: recuperamos el existente
        if (error.code === "23505") {
          const { data: existing } = await supabase
            .from("app_users")
            .select("id, name")
            .eq("name", trimmed)
            .single();
          if (existing) {
            handleSelect({ id: existing.id, name: existing.name });
            await loadUsers();
            setNewName("");
            return;
          }
        }
        throw error;
      }
      handleSelect({ id: data.id, name: data.name });
      await loadUsers();
      setNewName("");
    } catch (e) {
      console.error(e);
      toast.error("No se pudo crear el usuario");
    } finally {
      setCreating(false);
    }
  };

  const handleClear = () => {
    clearUser();
    setOpen(false);
    toast.success(`Firmando como ${DEFAULT_USER.name}`);
  };

  const initials = displayUser.name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "flex w-full items-center gap-3 rounded-lg p-1.5 text-left transition-colors hover:bg-accent",
            collapsed && "justify-center",
          )}
          title={displayUser.name}
          suppressHydrationWarning
        >
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-brand text-xs font-bold text-white shadow-soft"
            suppressHydrationWarning
          >
            {initials}
          </div>
          {!collapsed && (
            <>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold" suppressHydrationWarning>
                  {displayUser.name}
                </p>
                <p
                  className="text-[10px] uppercase tracking-wider text-muted-foreground"
                  suppressHydrationWarning
                >
                  Firmando
                </p>
              </div>
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-72 p-0">
        <div className="border-b border-border/60 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Firmar como
          </p>
          <p className="text-xs text-muted-foreground">
            Tu nombre quedará registrado en lo que crees o modifiques.
          </p>
        </div>

        <div className="max-h-56 overflow-y-auto p-1">
          {loading ? (
            <div className="flex items-center justify-center py-6 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
            </div>
          ) : users.length === 0 ? (
            <p className="px-3 py-4 text-center text-xs text-muted-foreground">
              Aún no hay usuarios registrados.
            </p>
          ) : (
            users.map((u) => {
              const active = user?.id === u.id;
              return (
                <button
                  key={u.id}
                  onClick={() => handleSelect(u)}
                  className={cn(
                    "flex w-full items-center justify-between gap-2 rounded-md px-2 py-1.5 text-sm transition-colors hover:bg-accent",
                    active && "bg-accent font-semibold",
                  )}
                >
                  <span className="flex items-center gap-2 truncate">
                    <UserRound className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="truncate">{u.name}</span>
                  </span>
                  {active && <Check className="h-3.5 w-3.5 text-foreground" />}
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-border/60 p-2">
          <p className="mb-1 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            Nuevo usuario
          </p>
          <div className="flex gap-1">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nombre"
              className="h-8 text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void handleCreate();
                }
              }}
            />
            <Button
              size="sm"
              onClick={() => void handleCreate()}
              disabled={!newName.trim() || creating}
              className="h-8 bg-gradient-brand text-white"
            >
              {creating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Añadir"}
            </Button>
          </div>
        </div>

        {user && user.id !== DEFAULT_USER.id && (
          <div className="border-t border-border/60 p-1">
            <button
              onClick={handleClear}
              className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <LogOut className="h-3.5 w-3.5" />
              Restablecer a {DEFAULT_USER.name}
            </button>
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
}