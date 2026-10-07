import { Prisma } from "@prisma/client";
import { z } from "zod";
import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import { transition } from "./tender.service";

export const invoiceSchema = z.object({
  amount: z.number().optional(),
});

export const paymentSchema = z.object({
  amount: z.number(),
  note: z.string().trim().min(1).max(500).optional(),
});

export type InvoiceInput = z.infer<typeof invoiceSchema>;
export type PaymentInput = z.infer<typeof paymentSchema>;

export async function invoiceTender(
  tenderId: string,
  input: InvoiceInput,
  userId: string,
) {
  return db.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenders WHERE id = ${tenderId} FOR UPDATE`;
    if (lock.length === 0) {
      throw new DomainError("NOT_FOUND", "Licitación no encontrada");
    }

    const tender = await tx.tender.findUnique({
      where: { id: tenderId },
      include: { products: { select: { unitPrice: true, quantity: true } } },
    });
    if (!tender) throw new DomainError("NOT_FOUND", "Licitación no encontrada");
    if (tender.status !== "finalizada") {
      throw new DomainError(
        "INVALID_STATE",
        `Solo se facturan licitaciones finalizadas (estado actual: ${tender.status})`,
      );
    }

    const total = tender.products.reduce(
      (sum, p) => sum.add(p.unitPrice.mul(p.quantity)),
      new Prisma.Decimal(0),
    );
    const amount =
      input.amount !== undefined ? new Prisma.Decimal(input.amount) : total;
    if (amount.lte(0)) {
      throw new DomainError("VALIDATION", "El monto debe ser mayor a 0");
    }

    return transition(tx, tenderId, "por_cobrar", userId, "facturada", {
      invoicedAmount: amount,
      invoicedAt: new Date(),
    });
  });
}

export async function registerPayment(
  tenderId: string,
  input: PaymentInput,
  userId: string,
) {
  const amount = new Prisma.Decimal(input.amount);

  return db.$transaction(async (tx) => {
    const lock = await tx.$queryRaw<{ id: string }[]>`
      SELECT id FROM tenders WHERE id = ${tenderId} FOR UPDATE`;
    if (lock.length === 0) {
      throw new DomainError("NOT_FOUND", "Licitación no encontrada");
    }

    const tender = await tx.tender.findUnique({
      where: { id: tenderId },
      select: { status: true, invoicedAmount: true },
    });
    if (!tender) throw new DomainError("NOT_FOUND", "Licitación no encontrada");
    if (tender.status !== "por_cobrar") {
      throw new DomainError(
        "INVALID_STATE",
        `Solo se registran pagos en estado por_cobrar (estado actual: ${tender.status})`,
      );
    }
    if (amount.lte(0)) {
      throw new DomainError("VALIDATION", "El monto debe ser mayor a 0");
    }
    if (!tender.invoicedAmount) {
      throw new DomainError("INVALID_STATE", "La licitación no tiene factura registrada");
    }

    const agg = await tx.payment.aggregate({
      where: { tenderId },
      _sum: { amount: true },
    });
    const paid = agg._sum.amount ?? new Prisma.Decimal(0);
    const balance = tender.invoicedAmount.sub(paid);

    if (amount.gt(balance)) {
      throw new DomainError(
        "PAYMENT_EXCEEDS_BALANCE",
        "El pago supera el saldo pendiente",
        { balance },
      );
    }

    const payment = await tx.payment.create({
      data: {
        tenderId,
        amount,
        note: input.note,
        createdById: userId,
        updatedById: userId,
      },
    });

    const newBalance = balance.sub(amount);
    if (newBalance.isZero()) {
      await transition(tx, tenderId, "cobrada", userId, "saldo_cero");
    }

    return { payment, balance: newBalance };
  });
}
