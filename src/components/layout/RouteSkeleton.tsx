import { Skeleton } from "@/components/ui/skeleton";

/**
 * Skeleton genérico para `pendingComponent` mientras se descarga el chunk
 * de una ruta o se carga su loader. Da feedback visual inmediato al clic.
 */
export function RouteSkeleton() {
  return (
    <div className="space-y-4 p-4 sm:p-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-7 w-48" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24 rounded-2xl" />
        ))}
      </div>
      <Skeleton className="h-10 w-full rounded-xl" />
      <div className="space-y-2">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-10 w-full rounded-lg" />
        ))}
      </div>
    </div>
  );
}