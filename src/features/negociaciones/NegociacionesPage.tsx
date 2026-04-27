import * as React from "react";
import { Briefcase, Plus, Loader2 } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/layout/PageHeader";
import { Button } from "@/components/ui/button";
import { useCurrentUser } from "@/hooks/useCurrentUser";
import {
  NEGOTIATIONS_KEY,
  negotiationsQueryOptions,
  negotiationItemsQueryOptions,
  type NegotiationRow,
} from "./queries";
import { NegotiationsList } from "./NegotiationsList";
import { NegotiationCalculator } from "./NegotiationCalculator";

export type { NegotiationRow };

export function NegociacionesPage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading: loading } = useQuery(negotiationsQueryOptions());

  // Selección actual: id real, null = sin selección, "new" = borrador en memoria.
  const [selectedId, setSelectedId] = React.useState<string | null>(null);
  // Cuando es borrador local sin guardar:
  const [isNew, setIsNew] = React.useState(false);

  // Auto-seleccionar la primera negociación al cargar.
  React.useEffect(() => {
    if (selectedId === null && !isNew && rows.length > 0) {
      setSelectedId(rows[0].id);
    }
  }, [rows, selectedId, isNew]);

  const selected = React.useMemo(
    () => rows.find((r) => r.id === selectedId) ?? null,
    [rows, selectedId],
  );

  // Pre-cargar items de la negociación seleccionada (para que el editor los tenga al toque).
  const { data: items, isFetching: itemsLoading } = useQuery(
    negotiationItemsQueryOptions(isNew ? null : selectedId),
  );

  const handleNew = () => {
    setIsNew(true);
    setSelectedId(null);
  };

  const handleSelect = (id: string) => {
    setIsNew(false);
    setSelectedId(id);
  };

  const handleSaved = (id: string) => {
    setIsNew(false);
    setSelectedId(id);
    void queryClient.invalidateQueries({ queryKey: NEGOTIATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["calc"] });
  };

  const handleDeleted = () => {
    setSelectedId(null);
    setIsNew(false);
    void queryClient.invalidateQueries({ queryKey: NEGOTIATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["calc"] });
  };

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Briefcase}
        eyebrow="Análisis"
        title="Negociaciones"
        description="Cotiza en tiempo real: añade referencias y observa cómo cambia la rentabilidad. La meta mínima de margen es del 36%."
        actions={
          <Button
            onClick={handleNew}
            className="bg-gradient-brand text-white shadow-elegant"
          >
            <Plus className="mr-1 h-4 w-4" />
            Nueva negociación
          </Button>
        }
      />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
        <NegotiationsList
          rows={rows}
          loading={loading}
          selectedId={isNew ? "__new__" : selectedId}
          isNew={isNew}
          onSelect={handleSelect}
          onNew={handleNew}
        />

        {isNew ? (
          <NegotiationCalculator
            key="new"
            negotiation={null}
            initialItems={[]}
            itemsLoading={false}
            userId={user?.id ?? null}
            userName={user?.name ?? "Sistema"}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onCancel={() => setIsNew(false)}
          />
        ) : selected ? (
          <NegotiationCalculator
            key={selected.id}
            negotiation={selected}
            initialItems={items ?? []}
            itemsLoading={itemsLoading}
            userId={user?.id ?? null}
            userName={user?.name ?? "Sistema"}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
          />
        ) : (
          <div className="glass flex h-[60vh] items-center justify-center rounded-2xl border border-border/60 text-sm text-muted-foreground">
            {loading ? (
              <div className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" /> Cargando negociaciones…
              </div>
            ) : (
              "Selecciona una negociación o crea una nueva."
            )}
          </div>
        )}
      </div>
    </div>
  );
}
