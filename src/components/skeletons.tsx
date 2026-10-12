import { Skeleton } from "@/components/ui/skeleton";

export function PageHeaderSkeleton({ actionWidth = "w-40" }: { actionWidth?: string }) {
  return (
    <div className="mb-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Skeleton className="h-8 w-52" />
          <Skeleton className="mt-2 h-4 w-72 max-w-full" />
        </div>
        <Skeleton className={`h-8 ${actionWidth}`} />
      </div>
      <Skeleton className="mt-5 h-px w-full" />
    </div>
  );
}

export function TableSkeleton({ rows = 6, columns = 6 }: { rows?: number; columns?: number }) {
  const widths = ["w-40", "w-28", "w-20", "w-20", "w-32", "w-32"];
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center gap-4 border-b bg-muted/50 px-4 py-3">
        {Array.from({ length: columns }).map((_, col) => (
          <Skeleton key={col} className={`h-3 ${widths[col % widths.length]}`} />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4 border-b px-4 py-3.5 last:border-b-0">
          {Array.from({ length: columns }).map((_, col) => (
            <Skeleton key={col} className={`h-4 ${widths[col % widths.length]}`} />
          ))}
        </div>
      ))}
    </div>
  );
}

export function ListPageSkeleton({ expiring = false }: { expiring?: boolean }) {
  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      <PageHeaderSkeleton />
      {expiring && <Skeleton className="mb-6 h-32 w-full rounded-xl" />}
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Skeleton className="h-9 w-72 max-w-full" />
        <Skeleton className="h-9 w-44" />
        <Skeleton className="h-9 w-48" />
      </div>
      <TableSkeleton />
      <div className="mt-4 flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-4 w-32" />
      </div>
    </div>
  );
}
