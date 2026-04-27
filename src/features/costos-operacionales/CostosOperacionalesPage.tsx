import * as React from "react";
import { Building2, Plus, Pencil, Loader2, Power } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, getRouteApi } from "@tanstack/react-router";
import { useSuspenseQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { MonthSelect } from "@/components/period/MonthSelect";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatMonth, previousMonth, formatPercent } from "@/lib/period";
import { cn } from "@/lib/utils";
import {
  COST_CENTERS_KEY,
  costCentersQueryOptions,
  operationalCostsKey,
  operationalCostsQueryOptions,
  type AssignmentRow,
  type CostCenterRow,
} from "./queries";

const routeApi = getRouteApi("/_app/costos-operacionales");

type CostCenter = CostCenterRow;
type Assignment = AssignmentRow;

export function CostosOperacionalesPage() {
  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <PageHeader
        icon={Building2}
        eyebrow="Operación"
        title="Costos operacionales"
        description="Asigna el % de costo operacional por centro de costos y por mes."
      />
      <Tabs defaultValue="asignaciones" className="mt-8">
        <TabsList>
          <TabsTrigger value="asignaciones">Asignaciones</TabsTrigger>
          <TabsTrigger value="centros">Centros de costos</TabsTrigger>
        </TabsList>
        <TabsContent value="asignaciones" className="mt-6">
          <AssignmentsTab />
        </TabsContent>
        <TabsContent value="centros" className="mt-6">
          <CentersTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function AssignmentsTab() {
  const { user } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { month } = routeApi.useSearch();
  const setMonth = React.useCallback(
    (m: string) => {
      void navigate({
        to: "/costos-operacionales",
        search: (prev: Record<string, unknown>) => ({ ...prev, month: m }),
      });
    },
    [navigate],
  );
  const { data: centers } = useSuspenseQuery(costCentersQueryOptions());
  const { data: assignments, isFetching: loading } = useSuspenseQuery(
    operationalCostsQueryOptions(month),
  );
  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: operationalCostsKey(month) });
  }, [queryClient, month]);
  const [editing, setEditing] = React.useState<Assignment | null>(null);
  const [creating, setCreating] = React.useState(false);

  const total = assignments.reduce((acc, a) => acc + a.percentage, 0);
  const availableCenters = centers.filter(
    (c) => c.is_active && !assignments.some((a) => a.cost_center_id === c.id),
  );

  return (
    <>
      <div className="flex flex-wrap items-center gap-3">
        <MonthSelect value={month} onValueChange={setMonth} className="h-10 w-44" />
        <Button
          onClick={() => setCreating(true)}
          disabled={availableCenters.length === 0}
          className="bg-gradient-brand text-white shadow-elegant"
        >
          <Plus className="mr-1 h-4 w-4" />
          Asignar centro
        </Button>
        <p className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
          {loading && assignments.length > 0 && <Loader2 className="h-3 w-3 animate-spin" />}
          {formatMonth(month)} · Total asignado: <span className="font-semibold text-foreground">{formatPercent(total)}</span>
        </p>
      </div>

      <div className={cn("mt-4 glass rounded-2xl p-1 transition-opacity", loading && assignments.length > 0 && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Centro de costos</TableHead>
              <TableHead className="text-right">% del mes</TableHead>
              <TableHead>Última actualización</TableHead>
              <TableHead>Actualizado por</TableHead>
              <TableHead className="w-[1%] text-right">Acción</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : assignments.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Sin asignaciones para {formatMonth(month)}.
                </TableCell>
              </TableRow>
            ) : (
              assignments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell className="font-medium">{a.cost_center_name}</TableCell>
                  <TableCell className="text-right tabular-nums">{formatPercent(a.percentage)}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(a.updated_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {a.updated_by_name ?? a.created_by_name}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button variant="ghost" size="icon" onClick={() => setEditing(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <AssignmentDialog
          mode={editing ? "edit" : "create"}
          editing={editing}
          centers={availableCenters}
          month={month}
          userId={user?.id ?? null}
          userName={user?.name ?? "Sistema"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
                refresh();
          }}
        />
      )}
    </>
  );
}

function AssignmentDialog({
  mode,
  editing,
  centers,
  month,
  userId,
  userName,
  onClose,
  onDone,
}: {
  mode: "create" | "edit";
  editing: Assignment | null;
  centers: CostCenter[];
  month: string;
  userId: string | null;
  userName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [centerId, setCenterId] = React.useState(editing?.cost_center_id ?? "");
  const [percentage, setPercentage] = React.useState<string>(editing?.percentage.toString() ?? "");
  const [submitting, setSubmitting] = React.useState(false);
  const [suggesting, setSuggesting] = React.useState(false);

  // Sugerencia: % del mes anterior para el centro elegido (solo en create).
  React.useEffect(() => {
    if (mode !== "create" || !centerId) return;
    setSuggesting(true);
    const prev = previousMonth(month);
    void supabase
      .from("operational_costs")
      .select("percentage")
      .eq("cost_center_id", centerId)
      .eq("period_month", prev)
      .maybeSingle()
      .then(({ data }) => {
        if (data && !percentage) setPercentage(String(data.percentage));
        setSuggesting(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [centerId, mode, month]);

  const handleSubmit = async () => {
    const pct = Number(percentage);
    if (!Number.isFinite(pct) || pct < 0) {
      toast.error("Porcentaje inválido");
      return;
    }
    setSubmitting(true);
    try {
      if (mode === "create") {
        if (!centerId) {
          toast.error("Selecciona un centro");
          return;
        }
        const { error } = await supabase.from("operational_costs").insert({
          cost_center_id: centerId,
          period_month: month,
          percentage: pct,
          created_by_id: userId,
          created_by_name: userName,
        });
        if (error) throw error;
        toast.success("Centro asignado");
      } else if (editing) {
        const { error } = await supabase
          .from("operational_costs")
          .update({
            percentage: pct,
            updated_by_id: userId,
            updated_by_name: userName,
            updated_at: new Date().toISOString(),
          })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Porcentaje actualizado");
      }
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Asignar centro" : `Editar ${editing?.cost_center_name}`}
          </DialogTitle>
          <DialogDescription>{formatMonth(month)}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {mode === "create" && (
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Centro de costos
              </label>
              <Select value={centerId} onValueChange={setCenterId}>
                <SelectTrigger>
                  <SelectValue placeholder="Selecciona un centro" />
                </SelectTrigger>
                <SelectContent>
                  {centers.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Porcentaje
            </label>
            <div className="relative">
              <Input
                type="number"
                step="0.01"
                value={percentage}
                onChange={(e) => setPercentage(e.target.value)}
                placeholder="0.00"
                className="pr-8"
              />
              <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                %
              </span>
            </div>
            {suggesting && (
              <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" /> Buscando mes anterior…
              </p>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={submitting} className="bg-gradient-brand text-white">
            {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CentersTab() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: centers, isFetching: loading } = useSuspenseQuery(
    costCentersQueryOptions(),
  );
  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: COST_CENTERS_KEY });
  }, [queryClient]);
  const [creating, setCreating] = React.useState(false);
  const [editing, setEditing] = React.useState<CostCenter | null>(null);

  const toggleActive = async (c: CostCenter) => {
    const { error } = await supabase
      .from("cost_centers")
      .update({ is_active: !c.is_active })
      .eq("id", c.id);
    if (error) {
      toast.error("No se pudo cambiar el estado");
      return;
    }
    toast.success(c.is_active ? "Desactivado" : "Activado");
    refresh();
  };

  return (
    <>
      <div className="flex items-center justify-between">
        <p className="text-xs text-muted-foreground">
          {centers.filter((c) => c.is_active).length} activos · {centers.length} totales
        </p>
        <Button onClick={() => setCreating(true)} className="bg-gradient-brand text-white shadow-elegant">
          <Plus className="mr-1 h-4 w-4" />
          Nuevo centro
        </Button>
      </div>

      <div className="mt-4 glass rounded-2xl p-1">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nombre</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead>Creado por</TableHead>
              <TableHead>Creado</TableHead>
              <TableHead className="w-[1%] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin text-muted-foreground" />
                </TableCell>
              </TableRow>
            ) : centers.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="h-32 text-center text-muted-foreground">
                  Aún no hay centros de costos.
                </TableCell>
              </TableRow>
            ) : (
              centers.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={c.is_active ? "default" : "secondary"}>
                      {c.is_active ? "Activo" : "Inactivo"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{c.created_by_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(c.created_at).toLocaleDateString("es-CO", { dateStyle: "medium" })}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Renombrar" onClick={() => setEditing(c)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title={c.is_active ? "Desactivar" : "Activar"}
                        onClick={() => toggleActive(c)}
                      >
                        <Power className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {(creating || editing) && (
        <CenterDialog
          editing={editing}
          userId={user?.id ?? null}
          userName={user?.name ?? "Sistema"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onDone={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}
    </>
  );
}

function CenterDialog({
  editing,
  userId,
  userName,
  onClose,
  onDone,
}: {
  editing: CostCenter | null;
  userId: string | null;
  userName: string;
  onClose: () => void;
  onDone: () => void;
}) {
  const [name, setName] = React.useState(editing?.name ?? "");
  const [submitting, setSubmitting] = React.useState(false);

  const handleSubmit = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setSubmitting(true);
    try {
      if (editing) {
        const { error } = await supabase
          .from("cost_centers")
          .update({ name: trimmed })
          .eq("id", editing.id);
        if (error) throw error;
        toast.success("Centro renombrado");
      } else {
        const { error } = await supabase.from("cost_centers").insert({
          name: trimmed,
          created_by_id: userId,
          created_by_name: userName,
        });
        if (error) throw error;
        toast.success("Centro creado");
      }
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{editing ? "Renombrar centro" : "Nuevo centro de costos"}</DialogTitle>
          <DialogDescription>
            El nombre se usará en las asignaciones mensuales.
          </DialogDescription>
        </DialogHeader>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Ej. Administración, Logística…"
          autoFocus
        />
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button onClick={handleSubmit} disabled={!name.trim() || submitting} className="bg-gradient-brand text-white">
            {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
            Guardar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}