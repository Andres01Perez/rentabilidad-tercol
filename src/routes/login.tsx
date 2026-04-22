import * as React from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Sparkles, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Tercol" },
      { name: "description", content: "Selecciona tu usuario para acceder a la plataforma de rentabilidad de Tercol." },
    ],
  }),
  component: LoginPage,
});

const OTHERS_OPTION = "__others__";

function LoginPage() {
  const { user, login, ready, appUsers, createUser } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = React.useState<string>("");
  const [newName, setNewName] = React.useState("");
  const [submitting, setSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (ready && user) navigate({ to: "/dashboard" });
  }, [ready, user, navigate]);

  const isOthers = selected === OTHERS_OPTION;
  const canSubmit = !submitting && (isOthers ? newName.trim().length > 0 : selected.length > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      if (isOthers) {
        const created = await createUser(newName);
        login(created);
      } else {
        const found = appUsers.find((u) => u.id === selected);
        if (!found) {
          toast.error("Usuario no encontrado");
          return;
        }
        login(found);
      }
      navigate({ to: "/dashboard" });
    } catch (err) {
      console.error(err);
      toast.error("No se pudo iniciar sesión");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.22_295/0.30),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 right-0 h-[24rem] w-[24rem] rounded-full bg-[radial-gradient(circle,oklch(0.72_0.18_55/0.25),transparent_70%)] blur-3xl" />

      <div className="relative z-10 flex min-h-screen items-center justify-center px-6">
        <div className="w-full max-w-md">
          <div className="mb-8 flex flex-col items-center text-center">
            <div className="mb-5 inline-flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-brand shadow-elegant">
              <Sparkles className="h-7 w-7 text-white" />
            </div>
            <h1 className="text-5xl font-bold tracking-tight">
              <span className="text-gradient-brand">Tercol</span>
            </h1>
            <p className="mt-3 text-sm text-muted-foreground">
              Plataforma de seguimiento y rentabilidad
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="glass rounded-3xl p-8"
          >
            <div className="mb-6">
              <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Usuario
              </label>
              <Select value={selected} onValueChange={(v) => { setSelected(v); setNewName(""); }}>
                <SelectTrigger className="h-12 border-border/60 bg-white/60 text-base backdrop-blur">
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {appUsers.map((u) => (
                    <SelectItem key={u.id} value={u.id} className="text-base">
                      {u.name}
                    </SelectItem>
                  ))}
                  <SelectItem value={OTHERS_OPTION} className="text-base">
                    Otros…
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {isOthers && (
              <div className="mb-6">
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Nombre completo
                </label>
                <Input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="Ej. Juan Gómez"
                  className="h-12 border-border/60 bg-white/60 text-base backdrop-blur"
                  autoFocus
                />
                <p className="mt-2 text-xs text-muted-foreground">
                  Quedará disponible en el selector para próximos ingresos.
                </p>
              </div>
            )}

            <Button
              type="submit"
              disabled={!canSubmit}
              className="group h-12 w-full bg-gradient-brand text-base font-semibold text-white shadow-elegant transition-all hover:opacity-95 hover:shadow-lg disabled:opacity-50"
            >
              {submitting ? (
                <>
                  <Loader2 className="mr-1 h-4 w-4 animate-spin" />
                  Ingresando…
                </>
              ) : (
                <>
                  Ingresar
                  <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </Button>

            <p className="mt-5 text-center text-xs text-muted-foreground">
              Acceso interno · trazabilidad por usuario
            </p>
          </form>
        </div>
      </div>
    </div>
  );
}
