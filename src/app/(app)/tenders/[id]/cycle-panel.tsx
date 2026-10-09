"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { canTransition } from "@/server/domain/state-machine";
import { api, errorMessage } from "@/lib/api";
import { formatMoney } from "@/lib/format";
import { centsToAmount, toCents } from "@/lib/money";
import type { TenderStatusValue } from "@/lib/tender-status";
import type { SerializedTender } from "@/lib/tender-serialize";

export function CyclePanel({ tender }: { tender: SerializedTender }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [invoiceAmount, setInvoiceAmount] = useState("");
  const [payAmount, setPayAmount] = useState("");
  const [payNote, setPayNote] = useState("");
  const [error, setError] = useState<string | null>(null);

  const can = (to: TenderStatusValue) => canTransition(tender.status, to);
  const totalCents = toCents(tender.totalProducts);
  const balanceCents = toCents(tender.balance ?? "0");
  const invoiced = tender.invoicedAmount !== null;
  const terminal = !can("finalizada") && !can("perdida") && !can("por_cobrar") && !can("cobrada");

  async function run(key: string, path: string, body?: unknown, okMessage?: string) {
    if (busy) return;
    setBusy(key);
    setError(null);
    try {
      await api.post(path, body);
      toast.success(okMessage ?? "Actualizado");
      setInvoiceAmount("");
      setPayAmount("");
      setPayNote("");
      router.refresh();
    } catch (err) {
      const message = errorMessage(err);
      setError(message);
      toast.error(message);
    } finally {
      setBusy(null);
    }
  }

  function submitInvoice(event: React.FormEvent) {
    event.preventDefault();
    const raw = invoiceAmount.trim();
    const cents = raw ? toCents(raw) : totalCents;
    if (cents <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    void run(
      "invoice",
      `/api/tenders/${tender.id}/invoice`,
      raw ? { amount: centsToAmount(cents) } : {},
      "Factura registrada",
    );
  }

  function submitPayment(event: React.FormEvent) {
    event.preventDefault();
    const cents = toCents(payAmount);
    if (cents <= 0) {
      setError("El monto debe ser mayor a 0");
      return;
    }
    if (invoiced && cents > balanceCents) {
      setError(
        `El pago supera el saldo pendiente (${formatMoney(centsToAmount(balanceCents))})`,
      );
      return;
    }
    void run(
      "payment",
      `/api/tenders/${tender.id}/payments`,
      { amount: centsToAmount(cents), ...(payNote.trim() ? { note: payNote.trim() } : {}) },
      "Pago registrado",
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Ciclo de la licitacion</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {can("finalizada") && can("perdida") && (
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="vv-shine-btn flex-1"
              disabled={busy !== null}
              onClick={() =>
                void run("finalize", `/api/tenders/${tender.id}/finalize`, undefined, "Marcada como ganada")
              }
            >
              {busy === "finalize" ? "Guardando…" : "Marcar ganada"}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              disabled={busy !== null}
              onClick={() =>
                void run("lose", `/api/tenders/${tender.id}/lose`, undefined, "Marcada como perdida")
              }
            >
              {busy === "lose" ? "Guardando…" : "Marcar perdida"}
            </Button>
          </div>
        )}

        {can("por_cobrar") && (
          <form className="space-y-3" onSubmit={submitInvoice}>
            <div className="space-y-1.5">
              <Label htmlFor="invoice-amount">Monto a facturar</Label>
              <Input
                id="invoice-amount"
                inputMode="decimal"
                placeholder={formatMoney(centsToAmount(totalCents))}
                value={invoiceAmount}
                onChange={(event) => setInvoiceAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Vacio = total de productos ({formatMoney(tender.totalProducts)}).
              </p>
            </div>
            <Button type="submit" className="w-full" disabled={busy !== null}>
              {busy === "invoice" ? "Registrando…" : "Facturar"}
            </Button>
          </form>
        )}

        {can("cobrada") && (
          <form className="space-y-3" onSubmit={submitPayment}>
            <div className="space-y-1.5">
              <Label htmlFor="pay-amount">Monto del pago</Label>
              <Input
                id="pay-amount"
                inputMode="decimal"
                placeholder="0.00"
                value={payAmount}
                onChange={(event) => setPayAmount(event.target.value)}
              />
              <p className="text-xs text-muted-foreground">
                Saldo pendiente {formatMoney(centsToAmount(balanceCents))}.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pay-note">Nota (opcional)</Label>
              <Input
                id="pay-note"
                maxLength={500}
                placeholder="Referencia del pago"
                value={payNote}
                onChange={(event) => setPayNote(event.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={busy !== null}>
              {busy === "payment" ? "Registrando…" : "Registrar pago"}
            </Button>
          </form>
        )}

        {terminal && (
          <p className="text-sm text-muted-foreground">
            Estado final: no hay mas acciones disponibles.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}
      </CardContent>
    </Card>
  );
}
