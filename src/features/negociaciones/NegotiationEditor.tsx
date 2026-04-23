import * as React from "react";
import { Loader2, Search, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import { formatCurrency } from "@/lib/period";
import { chunkedInsert } from "@/lib/excel";
import { cn } from "@/lib/utils";
import { useReferenceSearch } from "./useReferenceSearch";
import type { NegotiationRow } from "./NegociacionesPage";

const NONE_LIST_VALUE = "__none__";

type EditorItem = {
  // Local id for React keys
  uid: string;
  referencia: string;
  descripcion: string | null;
  cantidad: string;
  precio_unitario: string;
  source_price_list_id: string | null;
};

type PriceListOption = { id: string; name: string };

function makeUid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function NegotiationEditor({
  negotiation,
  userId,
  userName,
  onClose,
  onSaved,
}: {
  negotiation: NegotiationRow | null;
  userId: string;
  userName: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const isEdit = !!negotiation;
  const [name, setName] = React.useState(negotiation?.name ?? "");
  const [notes, setNotes] = React.useState(negotiation?.notes ?? "");
  const [sourceListId, setSourceListId] = React.useState<string | null>(
    negotiation?.source_price_list_id ?? null,
  );
  const [items, setItems] = React.useState<EditorItem[]>([]);
  const [priceLists, setPriceLists] = React.useState<PriceListOption[]>([]);
  const [loadingItems, setLoadingItems] = React.useState(isEdit);
  const [saving, setSaving] = React.useState(false);

  // Search state
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const { results, loading: searching } = useReferenceSearch(query);

  // Cargar listas de precios
  React.useEffect(() => {
    void supabase
      .from("price_lists")
      .select("id, name")
      .order("name", { ascending: true })
      .then(({ data }) => {
        setPriceLists((data as PriceListOption[]) ?? []);
      });
  }, []);

  // Cargar items si edita
  React.useEffect(() => {
    if (!negotiation) return;
    setLoadingItems(true);
    void supabase
      .from("negotiation_items")
      .select("id, referencia, descripcion, cantidad, precio_unitario, source_price_list_id")
      .eq("negotiation_id", negotiation.id)
      .order("created_at", { ascending: true })
      .then(({ data, error }) => {
        if (error) {
          toast.error("Error cargando items");
          setLoadingItems(false);
          return;
        }
        setItems(
          (data ?? []).map((r) => ({
            uid: r.id,
            referencia: r.referencia,
            descripcion: r.descripcion,
            cantidad: String(r.cantidad),
            precio_unitario: String(r.precio_unitario),
            source_price_list_id: r.source_price_list_id,
          })),
        );
        setLoadingItems(false);
      });
  }, [negotiation]);

  const lookupPriceFromList = async (
    referencia: string,
    listId: string,
  ): Promise<number | null> => {
    const { data } = await supabase
      .from("price_list_items")
      .select("precio")
      .eq("price_list_id", listId)
      .eq("referencia", referencia)
      .maybeSingle();
    return data?.precio != null ? Number(data.precio) : null;
  };

  const addReference = async (ref: { referencia: string; descripcion: string | null }) => {
    if (items.some((i) => i.referencia === ref.referencia)) {
      toast.info(`"${ref.referencia}" ya está añadida`);
      return;
    }
    let suggested: number | null = null;
    if (sourceListId) {
      suggested = await lookupPriceFromList(ref.referencia, sourceListId);
    }
    setItems((prev) => [
      ...prev,
      {
        uid: makeUid(),
        referencia: ref.referencia,
        descripcion: ref.descripcion,
        cantidad: "1",
        precio_unitario: suggested != null ? String(suggested) : "",
        source_price_list_id: suggested != null ? sourceListId : null,
      },
    ]);
    setQuery("");
    setSearchOpen(false);
  };

  const updateItem = (uid: string, patch: Partial<EditorItem>) => {
    setItems((prev) => prev.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  };

  const removeItem = (uid: string) => {
    setItems((prev) => prev.filter((i) => i.uid !== uid));
  };

  const validation = React.useMemo(() => {
    const errors: Record<string, { qty?: boolean; price?: boolean }> = {};
    let hasInvalid = false;
    items.forEach((it) => {
      const qty = parseNum(it.cantidad);
      const price = parseNum(it.precio_unitario);
      const e: { qty?: boolean; price?: boolean } = {};
      if (qty == null || qty <= 0) {
        e.qty = true;
        hasInvalid = true;
      }
      if (price == null || price < 0) {
        e.price = true;
        hasInvalid = true;
      }
      if (e.qty || e.price) errors[it.uid] = e;
    });
    const nameOk = name.trim().length > 0;
    const itemsOk = items.length > 0;
    return { errors, hasInvalid, nameOk, itemsOk, canSave: nameOk && itemsOk && !hasInvalid };
  }, [items, name]);

  const total = React.useMemo(() => {
    return items.reduce((acc, it) => {
      const qty = parseNum(it.cantidad) ?? 0;
      const price = parseNum(it.precio_unitario) ?? 0;
      return acc + qty * price;
    }, 0);
  }, [items]);

  const handleSave = async () => {
    if (!validation.canSave) {
      if (!validation.nameOk) toast.error("Asigna un nombre a la negociación");
      else if (!validation.itemsOk) toast.error("Añade al menos una referencia");
      else toast.error("Revisa los campos en rojo");
      return;
    }
    setSaving(true);
    try {
      const itemRows = items.map((it) => {
        const qty = parseNum(it.cantidad)!;
        const price = parseNum(it.precio_unitario)!;
        return {
          referencia: it.referencia,
          descripcion: it.descripcion,
          cantidad: qty,
          precio_unitario: price,
          subtotal: qty * price,
          source_price_list_id: it.source_price_list_id,
        };
      });
      const computedTotal = itemRows.reduce((s, r) => s + r.subtotal, 0);

      let negotiationId: string;
      if (isEdit && negotiation) {
        const { error: updErr } = await supabase
          .from("negotiations")
          .update({
            name: name.trim(),
            notes: notes.trim() || null,
            source_price_list_id: sourceListId,
            total: computedTotal,
            items_count: itemRows.length,
            updated_by_id: userId,
            updated_by_name: userName,
          })
          .eq("id", negotiation.id);
        if (updErr) throw updErr;
        negotiationId = negotiation.id;
        const { error: delErr } = await supabase
          .from("negotiation_items")
          .delete()
          .eq("negotiation_id", negotiationId);
        if (delErr) throw delErr;
      } else {
        const { data, error: insErr } = await supabase
          .from("negotiations")
          .insert({
            name: name.trim(),
            notes: notes.trim() || null,
            source_price_list_id: sourceListId,
            total: computedTotal,
            items_count: itemRows.length,
            created_by_id: userId,
            created_by_name: userName,
          })
          .select("id")
          .single();
        if (insErr || !data) throw insErr ?? new Error("No se pudo crear la negociación");
        negotiationId = data.id;
      }

      const payload = itemRows.map((r) => ({ ...r, negotiation_id: negotiationId }));
      await chunkedInsert(payload, 500, async (batch) => {
        const { error } = await supabase.from("negotiation_items").insert(batch);
        if (error) throw error;
      });

      toast.success(isEdit ? "Negociación actualizada" : "Negociación creada");
      onSaved();
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar la negociación");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-3xl">
        <SheetHeader>
          <SheetTitle>{isEdit ? "Editar negociación" : "Nueva negociación"}</SheetTitle>
          <SheetDescription>
            Define un nombre, opcionalmente una lista de precios base, y añade las referencias con
            cantidad y precio.
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-5 px-4 pb-32 pt-4">
          {/* Header form */}
          <div className="grid gap-4 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Negociación FM"
                className={cn(!validation.nameOk && "border-destructive")}
                autoFocus
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Lista de precios sugerida
              </label>
              <Select
                value={sourceListId ?? NONE_LIST_VALUE}
                onValueChange={(v) => setSourceListId(v === NONE_LIST_VALUE ? null : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Sin lista (precio manual)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE_LIST_VALUE}>Sin lista (precio manual)</SelectItem>
                  {priceLists.map((pl) => (
                    <SelectItem key={pl.id} value={pl.id}>
                      {pl.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="mt-1 text-[11px] text-muted-foreground">
                Solo afecta el precio sugerido al añadir nuevas referencias.
              </p>
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Notas / observaciones
              </label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Detalles, vigencia, condiciones…"
                rows={3}
              />
            </div>
          </div>

          {/* Search + suggestions */}
          <div>
            <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Añadir referencia
            </label>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSearchOpen(true);
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Buscar por referencia o descripción (mín 2 caracteres)"
                className="pl-9"
              />
              {searchOpen && query.trim().length >= 2 && (
                <div className="absolute z-30 mt-1 w-full rounded-lg border border-border bg-popover shadow-lg">
                  <div className="flex items-center justify-between border-b border-border/60 px-2 py-1">
                    <span className="text-[11px] text-muted-foreground">
                      {searching ? "Buscando…" : `${results.length} resultado(s)`}
                    </span>
                    <button
                      onClick={() => setSearchOpen(false)}
                      className="text-muted-foreground hover:text-foreground"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {searching ? (
                      <div className="flex h-16 items-center justify-center">
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      </div>
                    ) : results.length === 0 ? (
                      <div className="px-3 py-4 text-center text-xs text-muted-foreground">
                        Sin resultados
                      </div>
                    ) : (
                      results.map((r) => (
                        <button
                          key={r.referencia}
                          onClick={() => void addReference(r)}
                          className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-accent"
                        >
                          <span className="font-mono text-xs text-muted-foreground">
                            {r.referencia}
                          </span>
                          <span className="flex-1 truncate text-xs">
                            {r.descripcion ?? "—"}
                          </span>
                        </button>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Items table */}
          <div className="rounded-xl border border-border/60 bg-card/40">
            {loadingItems ? (
              <div className="flex h-32 items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
                Aún no hay referencias. Búscalas arriba para añadirlas.
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow className="hover:bg-transparent">
                    <TableHead className="w-[18%]">Ref</TableHead>
                    <TableHead>Descripción</TableHead>
                    <TableHead className="w-[100px] text-right">Cantidad</TableHead>
                    <TableHead className="w-[130px] text-right">Precio unit.</TableHead>
                    <TableHead className="w-[120px] text-right">Subtotal</TableHead>
                    <TableHead className="w-[1%]"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((it) => {
                    const err = validation.errors[it.uid];
                    const qty = parseNum(it.cantidad) ?? 0;
                    const price = parseNum(it.precio_unitario) ?? 0;
                    return (
                      <TableRow key={it.uid}>
                        <TableCell className="font-mono text-xs">{it.referencia}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">
                          {it.descripcion ?? "—"}
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={it.cantidad}
                            onChange={(e) => updateItem(it.uid, { cantidad: e.target.value })}
                            className={cn(
                              "h-8 text-right tabular-nums",
                              err?.qty && "border-destructive focus-visible:ring-destructive",
                            )}
                          />
                        </TableCell>
                        <TableCell>
                          <Input
                            type="number"
                            inputMode="decimal"
                            min={0}
                            value={it.precio_unitario}
                            onChange={(e) =>
                              updateItem(it.uid, { precio_unitario: e.target.value })
                            }
                            className={cn(
                              "h-8 text-right tabular-nums",
                              err?.price && "border-destructive focus-visible:ring-destructive",
                            )}
                          />
                        </TableCell>
                        <TableCell className="text-right text-xs tabular-nums font-medium">
                          {formatCurrency(qty * price)}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => removeItem(it.uid)}
                            title="Quitar"
                            className="h-7 w-7"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            )}
          </div>
        </div>

        {/* Sticky footer */}
        <div className="absolute inset-x-0 bottom-0 border-t border-border/60 bg-background/95 px-6 py-3 backdrop-blur">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                Total
              </p>
              <p className="text-2xl font-bold tabular-nums">{formatCurrency(total)}</p>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="ghost" onClick={onClose} disabled={saving}>
                Cancelar
              </Button>
              <Button
                onClick={() => void handleSave()}
                disabled={!validation.canSave || saving}
                className="bg-gradient-brand text-white shadow-elegant"
              >
                {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {isEdit ? "Guardar cambios" : "Crear negociación"}
              </Button>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}