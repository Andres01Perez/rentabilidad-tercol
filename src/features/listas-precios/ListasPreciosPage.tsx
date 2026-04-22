import * as React from "react";
import { Tags, Plus, Eye, RefreshCw, Trash2, Loader2, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { Dropzone } from "@/components/excel/Dropzone";
import { parseExcel, chunkedInsert } from "@/lib/excel";
import { formatCurrency } from "@/lib/period";
import { cn } from "@/lib/utils";

type PriceList = {
  id: string;
  name: string;
  created_by_name: string;
  created_at: string;
  updated_at: string;
  updated_by_name: string | null;
  items_count: number;
};

type PriceItem = {
  id: string;
  referencia: string;
  descripcion: string | null;
  unidad_empaque: string | null;
  precio: number | null;
};

const COLUMN_MAP = {
  referencia: ["REFERENCIA", "REF", "Referencia"],
  descripcion: ["DESCRIPCION", "DESCRIPCIÓN", "Descripción", "Descripcion"],
  unidad_empaque: ["UNIDAD DE EMPAQUE", "UNIDAD EMPAQUE", "Unidad de empaque", "UND"],
  precio: ["LISTA DE PRECIOS", "PRECIO", "Precio", "Lista de precios"],
} as const;

type ColKey = keyof typeof COLUMN_MAP;

export function ListasPreciosPage() {
  const { user } = useAuth();
  const [lists, setLists] = React.useState<PriceList[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [createOpen, setCreateOpen] = React.useState(false);
  const [viewing, setViewing] = React.useState<PriceList | null>(null);
  const [replacing, setReplacing] = React.useState<PriceList | null>(null);
  const [deleting, setDeleting] = React.useState<PriceList | null>(null);

  const loadLists = React.useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("price_lists")
      .select("id, name, created_by_name, created_at, updated_at, updated_by_name, price_list_items(count)")
      .order("updated_at", { ascending: false });
    if (error) {
      console.error(error);
      toast.error("No se pudieron cargar las listas");
      setLoading(false);
      return;
    }
    const mapped: PriceList[] = (data ?? []).map((r: typeof data extends (infer U)[] ? U : never) => ({
      id: r.id,
      name: r.name,
      created_by_name: r.created_by_name,
      created_at: r.created_at,
      updated_at: r.updated_at,
      updated_by_name: r.updated_by_name,
      items_count:
        Array.isArray(r.price_list_items) && r.price_list_items[0]
          ? (r.price_list_items[0] as { count: number }).count
          : 0,
    }));
    setLists(mapped);
    setLoading(false);
  }, []);

  React.useEffect(() => {
    void loadLists();
  }, [loadLists]);

  const handleDelete = async () => {
    if (!deleting) return;
    const { error } = await supabase.from("price_lists").delete().eq("id", deleting.id);
    if (error) {
      toast.error("No se pudo eliminar la lista");
      return;
    }
    // Items se borran por cascada si está configurada; si no, los borramos primero.
    await supabase.from("price_list_items").delete().eq("price_list_id", deleting.id);
    toast.success("Lista eliminada");
    setDeleting(null);
    void loadLists();
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10 lg:px-10">
      <PageHeader
        icon={Tags}
        eyebrow="Operación"
        title="Listas de precios"
        description="Administra precios unitarios y listas completas. Cada lista queda versionada con autoría."
        actions={
          <Button onClick={() => setCreateOpen(true)} className="bg-gradient-brand text-white shadow-elegant">
            <Plus className="mr-1 h-4 w-4" />
            Nueva lista
          </Button>
        }
      />

      <div className={cn("mt-8 glass rounded-2xl p-1 transition-opacity", loading && lists.length > 0 && "opacity-60")}>
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead>Nombre</TableHead>
              <TableHead className="text-right">Items</TableHead>
              <TableHead>Creada por</TableHead>
              <TableHead>Última actualización</TableHead>
              <TableHead>Actualizada por</TableHead>
              <TableHead className="w-[1%] text-right">Acciones</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading && lists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  <Loader2 className="mx-auto h-5 w-5 animate-spin" />
                </TableCell>
              </TableRow>
            ) : lists.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="h-32 text-center text-muted-foreground">
                  Aún no hay listas. Crea la primera con el botón de arriba.
                </TableCell>
              </TableRow>
            ) : (
              lists.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-medium">{l.name}</TableCell>
                  <TableCell className="text-right tabular-nums">{l.items_count}</TableCell>
                  <TableCell className="text-muted-foreground">{l.created_by_name}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {new Date(l.updated_at).toLocaleString("es-CO", { dateStyle: "medium", timeStyle: "short" })}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{l.updated_by_name ?? "—"}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button variant="ghost" size="icon" title="Ver items" onClick={() => setViewing(l)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Reemplazar Excel" onClick={() => setReplacing(l)}>
                        <RefreshCw className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="Eliminar" onClick={() => setDeleting(l)}>
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

      {createOpen && user && (
        <CreateListDialog
          onClose={() => setCreateOpen(false)}
          onCreated={() => {
            setCreateOpen(false);
            void loadLists();
          }}
          userId={user.id}
          userName={user.name}
        />
      )}

      {replacing && user && (
        <ReplaceListDialog
          list={replacing}
          onClose={() => setReplacing(null)}
          onDone={() => {
            setReplacing(null);
            void loadLists();
          }}
          userId={user.id}
          userName={user.name}
        />
      )}

      <ItemsSheet list={viewing} onClose={() => setViewing(null)} />

      <AlertDialog open={!!deleting} onOpenChange={(o) => !o && setDeleting(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar lista?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{deleting?.name}" junto con sus {deleting?.items_count} items. Esta acción no se puede deshacer.
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

function CreateListDialog({
  onClose,
  onCreated,
  userId,
  userName,
}: {
  onClose: () => void;
  onCreated: () => void;
  userId: string;
  userName: string;
}) {
  const [name, setName] = React.useState("");
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    rows: Record<ColKey, string | number | null>[];
    warnings: string[];
  } | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    setParsing(true);
    parseExcel(file, COLUMN_MAP, {
      requiredKeys: ["referencia"],
      numericKeys: ["precio"],
    })
      .then((res) => setPreview({ rows: res.rows as Record<ColKey, string | number | null>[], warnings: res.warnings }))
      .catch((e: Error) => {
        toast.error(e.message);
        setFile(null);
      })
      .finally(() => setParsing(false));
  }, [file]);

  const handleSubmit = async () => {
    if (!name.trim() || !preview || preview.rows.length === 0) return;
    setSubmitting(true);
    try {
      const { data: list, error: listErr } = await supabase
        .from("price_lists")
        .insert({ name: name.trim(), created_by_id: userId, created_by_name: userName })
        .select("id")
        .single();
      if (listErr || !list) throw listErr ?? new Error("No se pudo crear la lista");
      const items = preview.rows.map((r) => ({
        price_list_id: list.id,
        referencia: String(r.referencia),
        descripcion: r.descripcion ? String(r.descripcion) : null,
        unidad_empaque: r.unidad_empaque ? String(r.unidad_empaque) : null,
        precio: typeof r.precio === "number" ? r.precio : null,
      }));
      await chunkedInsert(items, 500, async (batch) => {
        const { error } = await supabase.from("price_list_items").insert(batch);
        if (error) throw error;
      });
      toast.success(`Lista "${name.trim()}" creada con ${items.length} items`);
      onCreated();
    } catch (e) {
      console.error(e);
      toast.error("Error al crear la lista");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Nueva lista de precios</DialogTitle>
          <DialogDescription>
            Asigna un nombre y sube el Excel con las columnas REFERENCIA, DESCRIPCIÓN, UNIDAD DE EMPAQUE, LISTA DE PRECIOS.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Nombre de la lista
            </label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ej. Mayoristas Q2 2026"
              autoFocus
            />
          </div>
          <Dropzone file={file} onFile={setFile} />
          {parsing && (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Procesando Excel…
            </p>
          )}
          {preview && <PreviewTable preview={preview} />}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={!name.trim() || !preview || preview.rows.length === 0 || submitting}
            className="bg-gradient-brand text-white"
          >
            {submitting ? <Loader2 className="mr-1 h-4 w-4 animate-spin" /> : null}
            Crear lista
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ReplaceListDialog({
  list,
  onClose,
  onDone,
  userId,
  userName,
}: {
  list: PriceList;
  onClose: () => void;
  onDone: () => void;
  userId: string;
  userName: string;
}) {
  const [file, setFile] = React.useState<File | null>(null);
  const [parsing, setParsing] = React.useState(false);
  const [submitting, setSubmitting] = React.useState(false);
  const [confirm, setConfirm] = React.useState(false);
  const [preview, setPreview] = React.useState<{
    rows: Record<ColKey, string | number | null>[];
    warnings: string[];
  } | null>(null);

  React.useEffect(() => {
    if (!file) {
      setPreview(null);
      return;
    }
    setParsing(true);
    parseExcel(file, COLUMN_MAP, {
      requiredKeys: ["referencia"],
      numericKeys: ["precio"],
    })
      .then((res) => setPreview({ rows: res.rows as Record<ColKey, string | number | null>[], warnings: res.warnings }))
      .catch((e: Error) => {
        toast.error(e.message);
        setFile(null);
      })
      .finally(() => setParsing(false));
  }, [file]);

  const handleReplace = async () => {
    if (!preview) return;
    setSubmitting(true);
    try {
      const { error: delErr } = await supabase
        .from("price_list_items")
        .delete()
        .eq("price_list_id", list.id);
      if (delErr) throw delErr;
      const items = preview.rows.map((r) => ({
        price_list_id: list.id,
        referencia: String(r.referencia),
        descripcion: r.descripcion ? String(r.descripcion) : null,
        unidad_empaque: r.unidad_empaque ? String(r.unidad_empaque) : null,
        precio: typeof r.precio === "number" ? r.precio : null,
      }));
      await chunkedInsert(items, 500, async (batch) => {
        const { error } = await supabase.from("price_list_items").insert(batch);
        if (error) throw error;
      });
      const { error: updErr } = await supabase
        .from("price_lists")
        .update({ updated_by_id: userId, updated_by_name: userName, updated_at: new Date().toISOString() })
        .eq("id", list.id);
      if (updErr) throw updErr;
      toast.success(`Lista actualizada con ${items.length} items`);
      onDone();
    } catch (e) {
      console.error(e);
      toast.error("Error al reemplazar la lista");
    } finally {
      setSubmitting(false);
      setConfirm(false);
    }
  };

  return (
    <>
      <Dialog open onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Reemplazar Excel — {list.name}</DialogTitle>
            <DialogDescription>
              Las {list.items_count} filas actuales se reemplazarán por las del nuevo archivo.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <Dropzone file={file} onFile={setFile} />
            {parsing && (
              <p className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" /> Procesando Excel…
              </p>
            )}
            {preview && <PreviewTable preview={preview} />}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={onClose}>
              Cancelar
            </Button>
            <Button
              onClick={() => setConfirm(true)}
              disabled={!preview || preview.rows.length === 0 || submitting}
              className="bg-gradient-brand text-white"
            >
              Reemplazar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar reemplazo</AlertDialogTitle>
            <AlertDialogDescription>
              Esto borrará las {list.items_count} filas actuales e insertará {preview?.rows.length ?? 0} nuevas. ¿Continuar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleReplace} disabled={submitting}>
              {submitting && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
              Sí, reemplazar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function PreviewTable({
  preview,
}: {
  preview: { rows: Record<ColKey, string | number | null>[]; warnings: string[] };
}) {
  const sample = preview.rows.slice(0, 5);
  return (
    <div className="rounded-xl border border-border/60 bg-white/60 p-3 backdrop-blur">
      <div className="mb-2 flex items-center justify-between text-xs">
        <span className="font-semibold">Vista previa · {preview.rows.length} filas detectadas</span>
      </div>
      {preview.warnings.map((w, i) => (
        <p key={i} className="mb-1 text-xs text-muted-foreground">⚠ {w}</p>
      ))}
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="text-xs">Referencia</TableHead>
              <TableHead className="text-xs">Descripción</TableHead>
              <TableHead className="text-xs">Unidad</TableHead>
              <TableHead className="text-right text-xs">Precio</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sample.map((r, i) => (
              <TableRow key={i}>
                <TableCell className="text-xs">{r.referencia}</TableCell>
                <TableCell className="text-xs">{r.descripcion ?? "—"}</TableCell>
                <TableCell className="text-xs">{r.unidad_empaque ?? "—"}</TableCell>
                <TableCell className="text-right text-xs tabular-nums">
                  {typeof r.precio === "number" ? formatCurrency(r.precio) : "—"}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function ItemsSheet({ list, onClose }: { list: PriceList | null; onClose: () => void }) {
  const [items, setItems] = React.useState<PriceItem[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [search, setSearch] = React.useState("");

  React.useEffect(() => {
    if (!list) return;
    setLoading(true);
    setSearch("");
    void supabase
      .from("price_list_items")
      .select("id, referencia, descripcion, unidad_empaque, precio")
      .eq("price_list_id", list.id)
      .order("referencia", { ascending: true })
      .limit(5000)
      .then(({ data, error }) => {
        if (error) toast.error("Error cargando items");
        setItems(data ?? []);
        setLoading(false);
      });
  }, [list]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.referencia.toLowerCase().includes(q) ||
        (i.descripcion?.toLowerCase().includes(q) ?? false),
    );
  }, [items, search]);

  return (
    <Sheet open={!!list} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-2xl">
        <SheetHeader>
          <SheetTitle>{list?.name}</SheetTitle>
          <SheetDescription>{items.length} items</SheetDescription>
        </SheetHeader>
        <div className="mt-4 px-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar por referencia o descripción"
              className="pl-9"
            />
          </div>
        </div>
        <div className="mt-4 max-h-[calc(100vh-200px)] overflow-y-auto px-4 pb-6">
          {loading ? (
            <div className="flex h-32 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <Table>
              <TableHeader className="sticky top-0 bg-background">
                <TableRow>
                  <TableHead>Ref</TableHead>
                  <TableHead>Descripción</TableHead>
                  <TableHead>Und</TableHead>
                  <TableHead className="text-right">Precio</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((i) => (
                  <TableRow key={i.id}>
                    <TableCell className="font-mono text-xs">{i.referencia}</TableCell>
                    <TableCell className="text-xs">{i.descripcion ?? "—"}</TableCell>
                    <TableCell className="text-xs">{i.unidad_empaque ?? "—"}</TableCell>
                    <TableCell className="text-right text-xs tabular-nums">
                      {i.precio !== null ? formatCurrency(Number(i.precio)) : "—"}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}