import { Clock } from "lucide-react";
import Link from "next/link";
import { formatDateTime, hoursUntil } from "@/lib/format";
import { listExpiring } from "@/server/services/tenders.service";

export async function ExpiringPanel({ days = 3 }: { days?: number }) {
  const tenders = await listExpiring(days);
  if (tenders.length === 0) return null;

  return (
    <section className="mb-6 rounded-lg border border-nebula-violet/40 bg-nebula-violet/5 p-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-sm font-semibold">
          <Clock className="size-4" />
          {tenders.length === 1
            ? "1 licitacion activa vence en"
            : `${tenders.length} licitaciones activas vencen en`}{" "}
          {days} dias
        </h2>
        <span className="text-xs text-muted-foreground">Prioridad</span>
      </div>
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
        {tenders.slice(0, 6).map((tender) => {
          const hours = hoursUntil(tender.deadline);
          const urgent = hours <= 24;
          return (
            <li key={tender.id}>
              <Link
                href={`/tenders/${tender.id}`}
                className="block rounded-md border bg-card p-3 transition-colors hover:bg-accent"
              >
                <span className="block truncate text-sm font-medium">{tender.title}</span>
                <span className="mt-1 block text-xs text-muted-foreground">
                  {tender.client.name} ·{" "}
                  <span className={urgent ? "font-medium text-nebula-lavender" : ""}>
                    {formatDateTime(tender.deadline)}
                  </span>
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
      {tenders.length > 6 && (
        <p className="mt-2 text-xs text-muted-foreground">
          Y {tenders.length - 6} mas por vencer.
        </p>
      )}
    </section>
  );
}
