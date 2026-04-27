import * as React from "react";
import { Briefcase, Plus, Pencil, Trash2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { formatCurrency } from "@/lib/period";
import { cn } from "@/lib/utils";
import { NegotiationEditor } from "./NegotiationEditor";
import { NEGOTIATIONS_KEY, negotiationsQueryOptions } from "./queries";

export type NegotiationRow = {
  id: string;
  name: string;
  notes: string | null;
  total: number;
  items_count: number;
  source_price_list_id: string | null;
  created_by_name: string;
  updated_by_name: string | null;
  created_at: string;
  updated_at: string;
};

export function NegociacionesPage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading: loading, isFetching } = useQuery(
    negotiationsQueryOptions(),
  );
  const [editing, setEditing] = React.useState<NegotiationRow | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<NegotiationRow | null>(null);

  const refresh = React.useCallback(() => {
    void queryClient.invalidateQueries({ queryKey: NEGOTIATIONS_KEY });
  }, [queryClient]);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("negotiations").delete().eq("id", deleting.id);
    if (error) {
      toast.error("No se pudo eliminar la negociación");
      return;
    }
    toast.success("Negociación eliminada");
    setDeleting(null);
    refresh();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <PageHeader
        icon={Briefcase}
        eyebrow="Análisis"
        title="Negociaciones"
        description="Crea cotizaciones combinando referencias del catálogo con cantidades y precios. Cada negociación queda guardada con autoría."
        actions={
          <Button
            onClick={() => setCreating(true)}
            className="bg-gradient-brand text-white shadow-elegant"
          >
            <Plus className="mr-1 h-4 w-4" />
            Nueva negociación
          </Button>
        }
      />

      <div
        className={cn(
          "mt-8 glass rounded-2xl p-1 transition-opacity",
          isFetching && rows.length > 0 && "opacity-60",
        )}
      >
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Creada por</TableHead>
              <TableHead>Última actualización</TableHead>
              <TableHead>Actualizada por</TableHead>
              <TableHead className="w-[1%] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : rows.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                  Aún no hay negociaciones. Crea la primera con el botón de arriba.
                </TableCell>
              </TableRow>
            ) : (
              rows.map((r) => (
                <TableRow key={r.id}>
                  <TableCell className="font-medium">{r.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{r.items_count}</TableCell>
                  <TableCell className="text-right tabular-nums font-semibold">
                    {formatCurrency(r.total)}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{r.created_by_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(r.updated_at).toLocaleString("es-CO", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {r.updated_by_name ?? "—"}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Editar"
                        onClick={() => setEditing(r)}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        title="Eliminar"
                        onClick={() => setDeleting(r)}
                      >
                        <Trash2 className="h-4 w-4" />
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
        <NegotiationEditor
          negotiation={editing}
          userId={user?.id ?? null}
          userName={user?.name ?? "Sistema"}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
          onSaved={() => {
            setCreating(false);
            setEditing(null);
            refresh();
          }}
        />
      )}

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar negociación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleting?.name}" junto con sus {deleting?.items_count} items. Esta
              acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete}>Eliminar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}