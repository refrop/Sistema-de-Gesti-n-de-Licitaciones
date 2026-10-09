import { Card, CardContent } from "@/components/ui/card";
import { formatMoney } from "@/lib/format";
import { toCents } from "@/lib/money";
import type { SerializedTender } from "@/lib/tender-serialize";

function Stat({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <Card className={highlight ? "border-nebula-violet/50 shadow-[0_0_22px_-8px_rgba(183,109,255,0.55)]" : undefined}>
      <CardContent className="pt-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={`mt-1 text-2xl font-semibold tracking-tight ${
            highlight ? "text-nebula-lavender" : ""
          }`}
        >
          {value}
        </p>
        {hint && <p className="mt-1 text-xs text-muted-foreground">{hint}</p>}
      </CardContent>
    </Card>
  );
}

export function Totals({ tender }: { tender: SerializedTender }) {
  const balanceCents = toCents(tender.balance ?? "0");
  const invoiced = tender.invoicedAmount != null;

  return (
    <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      <Stat label="Productos" value={formatMoney(tender.totalProducts)} hint="Suma de la propuesta" />
      <Stat label="Facturado" value={invoiced ? formatMoney(tender.invoicedAmount ?? "0") : "Sin facturar"} />
      <Stat label="Pagado" value={formatMoney(tender.paidTotal)} hint={`${tender.payments.length} pago(s)`} />
      <Stat
        label="Saldo"
        value={invoiced ? formatMoney(tender.balance ?? "0") : "—"}
        hint={invoiced ? undefined : "Factura primero para ver el saldo"}
        highlight={invoiced && balanceCents > 0}
      />
    </div>
  );
}
