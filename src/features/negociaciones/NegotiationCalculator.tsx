import * as React from "react";
import {
  Loader2,
  Search,
  Trash2,
  X,
  Save,
  AlertTriangle,
  CheckCircle2,
  TrendingUp,
  Wallet,
  PiggyBank,
  Percent,
  Calendar,
  Upload,
  FileDown,
} from "lucide-react";
import { toast } from "sonner";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Badge } from "@/components/ui/badge";
import { MultiMonthPicker } from "@/features/calculadora/MultiMonthPicker";
import { useMonthCatalog } from "@/features/calculadora/useCalculadora";
import { formatCurrency, formatPercent, currentMonthDate, previousMonth } from "@/lib/period";
import { chunkedInsert } from "@/lib/excel";
import { cn } from "@/lib/utils";
import { useReferenceSearch } from "./useReferenceSearch";
import { ImportItemsDialog, type ImportedItem } from "./ImportItemsDialog";
import {
  NEGOTIATIONS_KEY,
  negotiationItemsKey,
  priceListsLightQueryOptions,
  type NegotiationItemRow,
} from "./queries";
import type { NegotiationRow } from "./NegociacionesPage";
import { useNegotiationLive, type LiveItem } from "./useNegotiationLive";

const NONE_LIST_VALUE = "__none__";

type EditorItem = {
  uid: string;
  referencia: string;
  descripcion: string | null;
  cantidad: string;
  precio_unitario: string;
  descuento_pct: string;
  source_price_list_id: string | null;
};

function makeUid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

function parseNum(v: string): number | null {
  if (v.trim() === "") return null;
  const n = Number(v.replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

export function NegotiationCalculator({
  negotiation,
  initialItems,
  itemsLoading,
  userId,
  userName,
  onSaved,
  onDeleted,
  onCancel,
}: {
  negotiation: NegotiationRow | null;
  initialItems: NegotiationItemRow[];
  itemsLoading: boolean;
  userId: string | null;
  userName: string;
  onSaved: (id: string) => void;
  onDeleted: () => void;
  onCancel?: () => void;
}) {
  const isEdit = !!negotiation;
  const queryClient = useQueryClient();
  const { costMonths: availCostMonths, loading: catalogLoading } = useMonthCatalog();
  const { data: priceLists = [] } = useQuery(priceListsLightQueryOptions());

  // Default cost month = previous month si está disponible.
  const defaultCostMonth = React.useMemo(() => {
    const prev = previousMonth(currentMonthDate());
    return availCostMonths.includes(prev)
      ? prev
      : availCostMonths[0] ?? prev;
  }, [availCostMonths]);

  // Estado del formulario.
  const [name, setName] = React.useState(negotiation?.name ?? "");
  const [sourceListId, setSourceListId] = React.useState<string | null>(
    negotiation?.source_price_list_id ?? null,
  );
  const [costMonths, setCostMonths] = React.useState<string[]>(
    negotiation?.cost_months && negotiation.cost_months.length > 0
      ? negotiation.cost_months
      : defaultCostMonth
        ? [defaultCostMonth]
        : [],
  );
  const [minMarginPct] = React.useState<number>(negotiation?.min_margin_pct ?? 36);
  const [items, setItems] = React.useState<EditorItem[]>([]);
  const [saving, setSaving] = React.useState(false);
  const [confirmDelete, setConfirmDelete] = React.useState(false);

  // Hidratamos items iniciales (al cambiar de negociación).
  React.useEffect(() => {
    setItems(
      initialItems.map((r) => ({
        uid: r.id,
        referencia: r.referencia,
        descripcion: r.descripcion,
        cantidad: String(r.cantidad),
        precio_unitario: String(r.precio_unitario),
        descuento_pct: String(r.descuento_pct ?? 0),
        source_price_list_id: r.source_price_list_id,
      })),
    );
  }, [initialItems]);

  // Si no hay meses seleccionados aún (negociación nueva sin defaultCostMonth resuelto),
  // setear cuando llegue el catálogo.
  React.useEffect(() => {
    if (costMonths.length === 0 && defaultCostMonth) {
      setCostMonths([defaultCostMonth]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [defaultCostMonth]);

  // Search state
  const [query, setQuery] = React.useState("");
  const [searchOpen, setSearchOpen] = React.useState(false);
  const [importOpen, setImportOpen] = React.useState(false);
  const { results, loading: searching } = useReferenceSearch(query);

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
        descuento_pct: "0",
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

  const handleImport = async (imported: ImportedItem[]) => {
    // Resolve description + suggested price from price list (if any) per reference.
    const newItems: EditorItem[] = [];
    for (const it of imported) {
      let suggested: number | null = null;
      if (sourceListId) {
        suggested = await lookupPriceFromList(it.referencia, sourceListId);
      }
      newItems.push({
        uid: makeUid(),
        referencia: it.referencia,
        descripcion: null,
        cantidad: String(it.cantidad),
        precio_unitario: String(it.precio),
        descuento_pct: "0",
        source_price_list_id: suggested != null && suggested === it.precio ? sourceListId : null,
      });
    }
    setItems((prev) => [...prev, ...newItems]);
  };

  // Items normalizados para el cálculo en vivo.
  const liveItems: LiveItem[] = React.useMemo(
    () =>
      items.map((it) => ({
        referencia: it.referencia,
        descripcion: it.descripcion,
        cantidad: parseNum(it.cantidad) ?? 0,
        precio: parseNum(it.precio_unitario) ?? 0,
        descuentoPct: parseNum(it.descuento_pct) ?? 0,
      })),
    [items],
  );

  const { data: live, loading: liveLoading, pending } = useNegotiationLive({
    items: liveItems,
    costMonths,
    opMonths: costMonths, // por simplicidad reutilizamos los mismos meses
    minMarginPct,
    topSuggestions: 0,
    sourcePriceListId: sourceListId,
    enabled: items.length > 0,
  });

  // Mapa rápido referencia -> métricas calculadas (para mostrar inline).
  const metricsByRef = React.useMemo(() => {
    const m = new Map<string, (typeof live.rows)[number]>();
    for (const r of live.rows) m.set(r.referencia, r);
    return m;
  }, [live.rows]);

  const validation = React.useMemo(() => {
    const errors: Record<string, { qty?: boolean; price?: boolean; disc?: boolean }> = {};
    let hasInvalid = false;
    items.forEach((it) => {
      const qty = parseNum(it.cantidad);
      const price = parseNum(it.precio_unitario);
      const disc = parseNum(it.descuento_pct);
      const e: { qty?: boolean; price?: boolean; disc?: boolean } = {};
      if (qty == null || qty <= 0) {
        e.qty = true;
        hasInvalid = true;
      }
      if (price == null || price < 0) {
        e.price = true;
        hasInvalid = true;
      }
      if (disc == null || disc < 0 || disc > 100) {
        e.disc = true;
        hasInvalid = true;
      }
      if (e.qty || e.price || e.disc) errors[it.uid] = e;
    });
    const nameOk = name.trim().length > 0;
    const itemsOk = items.length > 0;
    return { errors, hasInvalid, nameOk, itemsOk, canSave: nameOk && itemsOk && !hasInvalid };
  }, [items, name]);

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
        const disc = parseNum(it.descuento_pct) ?? 0;
        const sale = price * (1 - disc / 100);
        return {
          referencia: it.referencia,
          descripcion: it.descripcion,
          cantidad: qty,
          precio_unitario: price,
          descuento_pct: disc,
          precio_venta: sale,
          subtotal: qty * sale,
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
            source_price_list_id: sourceListId,
            cost_months: costMonths,
            min_margin_pct: minMarginPct,
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
            source_price_list_id: sourceListId,
            cost_months: costMonths,
            min_margin_pct: minMarginPct,
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
      void queryClient.invalidateQueries({ queryKey: NEGOTIATIONS_KEY });
      void queryClient.invalidateQueries({ queryKey: negotiationItemsKey(negotiationId) });
      onSaved(negotiationId);
    } catch (e) {
      console.error(e);
      toast.error("Error al guardar la negociación");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!negotiation) return;
    const { error } = await supabase
      .from("negotiations")
      .delete()
      .eq("id", negotiation.id);
    if (error) {
      toast.error("No se pudo eliminar");
      return;
    }
    toast.success("Negociación eliminada");
    setConfirmDelete(false);
    onDeleted();
  };

  const totals = live.totals;
  const belowMin = totals.belowMin && items.length > 0;
  const okMin = !belowMin && items.length > 0 && totals.ventasNetas > 0;

  const handleExportPdf = () => {
    if (items.length === 0) return;
    try {
      const doc = new jsPDF({ orientation: "portrait", unit: "pt", format: "letter" });
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 54; // ~0.75"
      const listName = priceLists.find((p) => p.id === sourceListId)?.name ?? "Sin lista";
      const today = new Date();
      const dateStr = today.toLocaleDateString("es-CO");

      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text(name.trim() || "Negociación", margin, margin);

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.setTextColor(110);
      doc.text(
        `Lista de precios: ${listName}   ·   Meses de costo: ${
          costMonths.length ? costMonths.join(", ") : "—"
        }   ·   Generado: ${dateStr}`,
        margin,
        margin + 16,
      );
      doc.setTextColor(0);

      const body = items.map((it) => {
        const m = metricsByRef.get(it.referencia);
        const price = parseNum(it.precio_unitario) ?? 0;
        const disc = parseNum(it.descuento_pct) ?? 0;
        const finalPrice = price * (1 - disc / 100);
        return [
          it.referencia,
          formatCurrency(finalPrice),
          m?.ctuProm == null ? "—" : formatCurrency(m.ctuProm),
          m?.margenUnit == null ? "—" : formatCurrency(m.margenUnit),
          m?.margenPct == null ? "—" : formatPercent(m.margenPct, 1),
          formatCurrency(m?.subtotal ?? 0),
        ];
      });

      autoTable(doc, {
        startY: margin + 32,
        head: [["Referencia", "Precio", "CTU", "Margen U $", "Margen %", "Subtotal"]],
        body,
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [40, 40, 40], textColor: 255, fontStyle: "bold" },
        alternateRowStyles: { fillColor: [245, 245, 245] },
        columnStyles: {
          0: { fontStyle: "bold" },
          1: { halign: "right" },
          2: { halign: "right" },
          3: { halign: "right" },
          4: { halign: "right" },
          5: { halign: "right", fontStyle: "bold" },
        },
        margin: { top: margin, right: margin, bottom: margin, left: margin },
      });

      // --- Card de resumen ---
      const finalY = (doc as unknown as { lastAutoTable: { finalY: number } }).lastAutoTable.finalY;
      const cardHeight = 150;
      const cardWidth = pageWidth - margin * 2;
      let cardY = finalY + 24;
      // Si no entra en la página, nueva página.
      if (cardY + cardHeight > pageHeight - margin) {
        doc.addPage();
        cardY = margin;
      }

      doc.setDrawColor(200);
      doc.setFillColor(250, 250, 250);
      doc.roundedRect(margin, cardY, cardWidth, cardHeight, 8, 8, "FD");

      const padX = margin + 16;
      let textY = cardY + 22;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(11);
      doc.setTextColor(30);
      doc.text("Resumen", padX, textY);
      textY += 18;

      doc.setFont("helvetica", "normal");
      doc.setFontSize(10);
      const rows: Array<[string, string]> = [
        ["Venta neta", formatCurrency(totals.ventasNetas)],
        ["Costo total", formatCurrency(totals.costoTotal)],
        ["Margen bruto $", formatCurrency(totals.margenBruto)],
        [
          "Margen bruto %",
          totals.ventasNetas === 0
            ? "—"
            : `${formatPercent(totals.margenBrutoPct, 1)}   (Meta ${formatPercent(minMarginPct, 0)})`,
        ],
      ];
      const labelX = padX;
      const valueX = margin + cardWidth - 16;
      rows.forEach(([label, value]) => {
        doc.setTextColor(110);
        doc.text(label, labelX, textY);
        doc.setTextColor(20);
        doc.text(value, valueX, textY, { align: "right" });
        textY += 16;
      });

      // Línea separadora + nota meta
      textY += 6;
      doc.setDrawColor(220);
      doc.line(padX, textY, margin + cardWidth - 16, textY);
      textY += 16;

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      const meetsMeta =
        totals.ventasNetas > 0 && totals.margenBrutoPct >= minMarginPct;
      if (meetsMeta) {
        doc.setTextColor(20, 120, 60);
        doc.text(
          `Meta del ${formatPercent(minMarginPct, 0)} cumplida.`,
          padX,
          textY,
        );
      } else {
        doc.setTextColor(170, 40, 40);
        const gap = totals.gapPct;
        doc.text(
          `Faltan ${formatPercent(gap, 1)} para llegar a la meta del ${formatPercent(minMarginPct, 0)}.`,
          padX,
          textY,
        );
      }

      // Pie de página en todas las páginas
      const totalPages = doc.getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        doc.setPage(p);
        doc.setFontSize(8);
        doc.setTextColor(140);
        doc.setFont("helvetica", "normal");
        doc.text(
          `Página ${p} de ${totalPages}`,
          pageWidth - margin,
          pageHeight - margin / 2,
          { align: "right" },
        );
      }

      const slug =
        (name.trim() || "negociacion")
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/(^-|-$)/g, "") || "negociacion";
      const ymd = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(
        today.getDate(),
      ).padStart(2, "0")}`;
      doc.save(`negociacion-${slug}-${ymd}.pdf`);
    } catch (e) {
      console.error(e);
      toast.error("No se pudo exportar el PDF");
    }
  };

  return (
    <section className="space-y-3">
      {/* KPIs en vivo (sticky con espaciado respecto al header) */}
      <div className="sticky top-14 z-10 -mx-1 bg-background/95 px-1 pb-2 pt-3 backdrop-blur-xl">
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-4 shadow-sm transition-colors",
            belowMin
              ? "border-rose-400/60 bg-rose-50/90 dark:bg-rose-500/10"
              : okMin
                ? "border-emerald-400/60 bg-emerald-50/90 dark:bg-emerald-500/10"
                : "border-border/60 bg-card/95",
          )}
        >
          {(liveLoading || pending) && (
            <div className="absolute inset-x-0 top-0 h-0.5 overflow-hidden">
              <div className="h-full w-1/3 animate-[loading-bar_1.2s_ease-in-out_infinite] bg-gradient-brand" />
            </div>
          )}
          {/* Fila: campos del formulario */}
          <div className="mb-3 grid gap-3 md:grid-cols-3">
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Nombre <span className="text-destructive">*</span>
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ej. Negociación FM"
                className={cn("h-9", !validation.nameOk && "border-destructive")}
                autoFocus={!isEdit}
              />
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Lista de precios sugerida
              </label>
              <Select
                value={sourceListId ?? NONE_LIST_VALUE}
                onValueChange={(v) => setSourceListId(v === NONE_LIST_VALUE ? null : v)}
              >
                <SelectTrigger className="h-9">
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
            </div>
            <div>
              <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                <Calendar className="mr-1 inline h-3 w-3" />
                Meses de costo (CTU promedio)
              </label>
              {catalogLoading ? (
                <div className="flex h-9 items-center text-xs text-muted-foreground">
                  <Loader2 className="mr-2 h-3 w-3 animate-spin" /> Cargando…
                </div>
              ) : (
                <MultiMonthPicker
                  available={availCostMonths}
                  selected={costMonths}
                  onChange={setCostMonths}
                  emptyLabel="Selecciona mes(es)"
                />
              )}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Kpi
            icon={Wallet}
            label="Ventas netas"
            value={formatCurrency(totals.ventasNetas)}
            hint={`Bruto ${formatCurrency(totals.ventasBrutas)}`}
          />
          <Kpi
            icon={TrendingUp}
            label="Costo total"
            value={formatCurrency(totals.costoTotal)}
            hint={
              costMonths.length === 0
                ? "Selecciona un mes"
                : `Promedio de ${costMonths.length} mes${costMonths.length > 1 ? "es" : ""}`
            }
          />
          <Kpi
            icon={PiggyBank}
            label="Margen bruto $"
            value={formatCurrency(totals.margenBruto)}
            tone={totals.margenBruto >= 0 ? "positive" : "negative"}
          />
          <Kpi
            icon={Percent}
            label="Margen bruto %"
            value={
              totals.ventasNetas === 0 ? "—" : formatPercent(totals.margenBrutoPct, 1)
            }
            tone={belowMin ? "negative" : okMin ? "positive" : "default"}
            hint={`Meta ${formatPercent(minMarginPct, 0)}`}
          />
        </div>

        {items.length > 0 && (
          <div
            className={cn(
              "mt-3 flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium",
              belowMin
                ? "bg-rose-100/80 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200"
                : okMin
                  ? "bg-emerald-100/80 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200"
                  : "bg-muted/40 text-muted-foreground",
            )}
          >
            {belowMin ? (
              <>
                <AlertTriangle className="h-4 w-4 shrink-0" />
                Negociación por debajo de la meta del {formatPercent(minMarginPct, 0)}.
                Faltan <strong>{formatPercent(totals.gapPct, 1)}</strong> para llegar.
              </>
            ) : okMin ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Margen por encima de la meta del {formatPercent(minMarginPct, 0)}.
              </>
            ) : (
              <>Añade referencias para empezar a calcular.</>
            )}
          </div>
        )}

          {/* Fila: acciones */}
          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-border/40 pt-3">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Badge variant="secondary" className="gap-1">
                {items.length} item{items.length !== 1 ? "s" : ""}
              </Badge>
              {liveLoading && (
                <span className="flex items-center gap-1">
                  <Loader2 className="h-3 w-3 animate-spin" /> Recalculando…
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!isEdit && onCancel && (
                <Button variant="ghost" size="sm" onClick={onCancel}>
                  Cancelar
                </Button>
              )}
              {isEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setConfirmDelete(true)}
                  className="text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                  <Trash2 className="mr-1 h-4 w-4" /> Eliminar
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPdf}
                disabled={items.length === 0}
                className="gap-1.5"
              >
                <FileDown className="h-4 w-4" /> Exportar PDF
              </Button>
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={!validation.canSave || saving}
                className="gap-1.5 bg-gradient-brand text-white shadow-elegant"
              >
                {saving ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {isEdit ? "Guardar cambios" : "Crear negociación"}
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="glass relative z-20 mt-4 mb-1 rounded-2xl border border-border/60 px-3 py-2">
        <div className="flex items-center gap-3">
          <label className="hidden shrink-0 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground sm:block">
            Añadir referencia
          </label>
          <div className="relative min-w-0 flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setSearchOpen(true);
              }}
              onFocus={() => setSearchOpen(true)}
              placeholder="Buscar por referencia o descripción (mín 2 caracteres)"
              className="h-9 pl-9"
            />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setImportOpen(true)}
            className="shrink-0 gap-1.5"
          >
            <Upload className="h-3.5 w-3.5" /> Importar items
          </Button>
        </div>
        <div className="relative">
          {searchOpen && query.trim().length >= 2 && (
            <div className="absolute left-0 right-0 top-full z-50 mt-1 rounded-lg border border-border bg-popover shadow-lg">
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
                      className="flex w-full items-center px-3 py-2 text-left hover:bg-accent"
                    >
                      <span className="font-sans text-sm font-bold text-foreground">
                        {r.referencia}
                      </span>
                      {r.descripcion && (
                        <span className="ml-2 truncate text-xs text-muted-foreground">
                          {r.descripcion}
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Items table */}
      <div className="glass relative z-0 rounded-2xl border border-border/60 p-1 isolate">
        {itemsLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : items.length === 0 ? (
          <div className="flex h-32 items-center justify-center text-sm text-muted-foreground">
            Aún no hay referencias. Búscalas arriba para añadirlas.
          </div>
        ) : (
          <div className="relative">
            <Table>
              <TableHeader className="bg-card/95">
                <TableRow className="hover:bg-transparent">
                  <TableHead className="w-[110px]">Ref</TableHead>
                  <TableHead className="w-[110px] text-right">Cant.</TableHead>
                  <TableHead className="w-[150px] text-right">PUV</TableHead>
                  <TableHead className="w-[100px] text-right">Desc %</TableHead>
                  <TableHead className="w-[120px] text-right">CTU prom</TableHead>
                  <TableHead className="w-[120px] text-right">Margen U</TableHead>
                  <TableHead className="w-[100px] text-right">Margen %</TableHead>
                  <TableHead className="w-[140px] text-right">Subtotal</TableHead>
                  <TableHead className="w-[1%]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((it) => {
                  const err = validation.errors[it.uid];
                  const m = metricsByRef.get(it.referencia);
                  const negM = (m?.margenPct ?? 0) < 0;
                  const lowM = m?.margenPct != null && m.margenPct < minMarginPct;
                  return (
                    <TableRow key={it.uid}>
                      <TableCell className="text-sm font-bold">{it.referencia}</TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          value={it.cantidad}
                          onChange={(e) => updateItem(it.uid, { cantidad: e.target.value })}
                          className={cn(
                            "h-8 w-full min-w-0 px-2 text-right tabular-nums",
                            err?.qty && "border-destructive",
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
                            "h-8 w-full min-w-0 px-2 text-right tabular-nums",
                            err?.price && "border-destructive",
                          )}
                        />
                      </TableCell>
                      <TableCell>
                        <Input
                          type="number"
                          inputMode="decimal"
                          min={0}
                          max={100}
                          value={it.descuento_pct}
                          onChange={(e) =>
                            updateItem(it.uid, { descuento_pct: e.target.value })
                          }
                          className={cn(
                            "h-8 w-full min-w-0 px-2 text-right tabular-nums",
                            err?.disc && "border-destructive",
                          )}
                        />
                      </TableCell>
                      <TableCell className="text-right text-xs tabular-nums text-muted-foreground">
                        {m?.ctuProm == null ? (
                          m?.sinCosto ? (
                            <span className="text-amber-600">sin costo</span>
                          ) : m?.costoCero ? (
                            <span className="text-rose-600">costo 0</span>
                          ) : (
                            "—"
                          )
                        ) : (
                          formatCurrency(m.ctuProm)
                        )}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-xs tabular-nums",
                          negM && "font-semibold text-rose-600",
                        )}
                      >
                        {m?.margenUnit == null ? "—" : formatCurrency(m.margenUnit)}
                      </TableCell>
                      <TableCell
                        className={cn(
                          "text-right text-xs tabular-nums",
                          negM
                            ? "font-semibold text-rose-600"
                            : lowM
                              ? "text-amber-600"
                              : m?.margenPct != null
                                ? "text-emerald-700 dark:text-emerald-400"
                                : "",
                        )}
                      >
                        {m?.margenPct == null ? "—" : formatPercent(m.margenPct, 1)}
                      </TableCell>
                      <TableCell className="text-right text-sm font-semibold tabular-nums">
                        {formatCurrency(m?.subtotal ?? 0)}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-muted-foreground hover:text-destructive"
                          onClick={() => removeItem(it.uid)}
                          title="Quitar"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Eliminar negociación?</AlertDialogTitle>
            <AlertDialogDescription>
              Se eliminará "{negotiation?.name}" junto con sus {negotiation?.items_count} items.
              Esta acción no se puede deshacer.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void handleDelete()}>
              Eliminar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <ImportItemsDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        existingRefs={items.map((i) => i.referencia)}
        onImport={(rows) => void handleImport(rows)}
      />
    </section>
  );
}

function Kpi({
  icon: Icon,
  label,
  value,
  hint,
  tone = "default",
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  hint?: string;
  tone?: "default" | "positive" | "negative";
}) {
  const toneClass =
    tone === "positive"
      ? "text-emerald-700 dark:text-emerald-300"
      : tone === "negative"
        ? "text-rose-600 dark:text-rose-300"
        : "text-foreground";
  return (
    <div className="min-w-0 rounded-xl border border-border/40 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="truncate text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
      </div>
      <p className={cn("mt-1 truncate text-base font-bold tabular-nums md:text-lg", toneClass)}>
        {value}
      </p>
      {hint && <p className="mt-0.5 truncate text-[10px] text-muted-foreground">{hint}</p>}
    </div>
  );
}
