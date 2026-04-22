import * as React from "react";
import { createFileRoute, useNavigate, redirect } from "@tanstack/react-router";
import { useAuth, TERCOL_USERS, type TercolUser } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Iniciar sesión — Tercol" },
      { name: "description", content: "Selecciona tu usuario para acceder a la plataforma de rentabilidad de Tercol." },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, login, ready } = useAuth();
  const navigate = useNavigate();
  const [selected, setSelected] = React.useState<TercolUser | "">("");

  React.useEffect(() => {
    if (ready && user) navigate({ to: "/dashboard" });
  }, [ready, user, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selected) return;
    login(selected as TercolUser);
    navigate({ to: "/dashboard" });
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-background">
      {/* Decorative gradient orbs */}
      <div className="pointer-events-none absolute -top-40 -left-40 h-[36rem] w-[36rem] rounded-full bg-[radial-gradient(circle,oklch(0.55_0.22_295/0.35),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute top-1/3 -right-40 h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(circle,oklch(0.62_0.18_250/0.30),transparent_70%)] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 left-1/3 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle,oklch(0.72_0.18_55/0.28),transparent_70%)] blur-3xl" />

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
              <Select value={selected} onValueChange={(v) => setSelected(v as TercolUser)}>
                <SelectTrigger className="h-12 border-border/60 bg-white/60 text-base backdrop-blur">
                  <SelectValue placeholder="Selecciona un usuario" />
                </SelectTrigger>
                <SelectContent>
                  {TERCOL_USERS.map((u) => (
                    <SelectItem key={u} value={u} className="text-base">
                      {u}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Button
              type="submit"
              disabled={!selected}
              className="group h-12 w-full bg-gradient-brand text-base font-semibold text-white shadow-elegant transition-all hover:opacity-95 hover:shadow-lg disabled:opacity-50"
            >
              Ingresar
              <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-0.5" />
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
