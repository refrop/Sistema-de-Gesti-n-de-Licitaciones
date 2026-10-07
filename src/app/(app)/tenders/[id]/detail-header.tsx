import { TenderStatusBadge } from "@/components/tender-status-badge";
import { formatDate, formatDateTime, formatMoney, hoursUntil } from "@/lib/format";
import type { SerializedTender } from "@/lib/tender-serialize";

export function DetailHeader({ tender }: { tender: SerializedTender }) {
  const hours = tender.deadline ? hoursUntil(tender.deadline) : Number.POSITIVE_INFINITY;
  const urgency =
    hours < 0 ? "Vencida" : hours <= 24 ? "Vence en menos de 24 h" : hours <= 72 ? "Vence pronto" : null;

  return (
    <div className="mb-6 rounded-lg border bg-card p-5">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-heading text-2xl font-semibold tracking-tight sm:text-3xl">
              {tender.title}
            </h1>
            <TenderStatusBadge status={tender.status} />
          </div>
          {tender.description && (
            <p className="mt-1 max-w-2xl text-sm text-muted-foreground">{tender.description}</p>
          )}
        </div>
        <div data-detail-actions />
      </div>

      <dl className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Cliente
          </dt>
          <dd className="mt-1 text-sm font-medium">{tender.client.name}</dd>
          <dd className="text-xs text-muted-foreground">{tender.client.email}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Fecha límite
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {tender.deadline ? formatDateTime(tender.deadline) : "—"}
          </dd>
          {urgency && (
            <dd className="text-xs text-amber-600 dark:text-amber-500">{urgency}</dd>
          )}
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Presupuesto máximo
          </dt>
          <dd className="mt-1 text-sm font-medium">{formatMoney(tender.maxBudget)}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
            Envío / Alta
          </dt>
          <dd className="mt-1 text-sm font-medium">
            {tender.sentAt ? formatDateTime(tender.sentAt) : "Sin enviar"}
          </dd>
          <dd className="text-xs text-muted-foreground">
            {tender.createdAt ? `Alta ${formatDate(tender.createdAt)}` : ""}
          </dd>
        </div>
      </dl>
    </div>
  );
}
