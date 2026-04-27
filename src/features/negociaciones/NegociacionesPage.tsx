import * as React from "react";
import { Briefcase, ArrowLeft } from "lucide-react";
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

type Mode = { kind: "list" } | { kind: "edit"; id: string } | { kind: "new" };

export function NegociacionesPage() {
  const { user } = useCurrentUser();
  const queryClient = useQueryClient();
  const { data: rows = [], isLoading: loading } = useQuery(negotiationsQueryOptions());

  const [mode, setMode] = React.useState<Mode>({ kind: "list" });

  const selected = React.useMemo(
    () => (mode.kind === "edit" ? rows.find((r) => r.id === mode.id) ?? null : null),
    [rows, mode],
  );

  const { data: items, isFetching: itemsLoading } = useQuery(
    negotiationItemsQueryOptions(mode.kind === "edit" ? mode.id : null),
  );

  const handleNew = () => setMode({ kind: "new" });
  const handleEdit = (id: string) => setMode({ kind: "edit", id });
  const handleBack = () => setMode({ kind: "list" });

  const handleSaved = (id: string) => {
    void queryClient.invalidateQueries({ queryKey: NEGOTIATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["calc"] });
    setMode({ kind: "edit", id });
  };

  const handleDeleted = () => {
    void queryClient.invalidateQueries({ queryKey: NEGOTIATIONS_KEY });
    void queryClient.invalidateQueries({ queryKey: ["calc"] });
    setMode({ kind: "list" });
  };

  const inEditor = mode.kind !== "list";

  return (
    <div className="mx-auto max-w-[1700px] px-4 py-8 sm:px-6 lg:px-8">
      <PageHeader
        icon={Briefcase}
        eyebrow="Análisis"
        title="Negociaciones"
        description={
          inEditor
            ? "Edita la negociación: añade referencias y observa la rentabilidad en tiempo real. Meta mínima 36%."
            : "Lista de negociaciones. Haz clic en una para abrir la calculadora o crea una nueva."
        }
        actions={
          inEditor ? (
            <Button variant="outline" size="sm" onClick={handleBack}>
              <ArrowLeft className="mr-1 h-4 w-4" /> Volver a negociaciones
            </Button>
          ) : null
        }
      />

      <div className="mt-8">
        {mode.kind === "list" ? (
          <NegotiationsList
            rows={rows}
            loading={loading}
            onEdit={handleEdit}
            onNew={handleNew}
          />
        ) : mode.kind === "new" ? (
          <NegotiationCalculator
            key="new"
            negotiation={null}
            initialItems={[]}
            itemsLoading={false}
            userId={user?.id ?? null}
            userName={user?.name ?? DEFAULT_USER.name}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onCancel={handleBack}
          />
        ) : selected ? (
          <NegotiationCalculator
            key={selected.id}
            negotiation={selected}
            initialItems={items ?? []}
            itemsLoading={itemsLoading}
            userId={user?.id ?? null}
            userName={user?.name ?? DEFAULT_USER.name}
            onSaved={handleSaved}
            onDeleted={handleDeleted}
            onCancel={handleBack}
          />
        ) : (
          <div className="glass flex h-[40vh] items-center justify-center rounded-2xl border border-border/60 text-sm text-muted-foreground">
            Esta negociación ya no existe.{" "}
            <button onClick={handleBack} className="ml-2 text-primary underline">
              Volver
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
