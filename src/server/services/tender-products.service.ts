import { Prisma } from "@prisma/client";
import type { TenderStatus } from "@prisma/client";
import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import { isProductEditable } from "../domain/state-machine";

type Tx = Prisma.TransactionClient;

async function lockTender(tx: Tx, tenderId: string) {
  const rows = await tx.$queryRaw<{ status: TenderStatus; max_budget: unknown }[]>`
    SELECT status, max_budget FROM tenders WHERE id = ${tenderId} FOR UPDATE`;
  if (rows.length === 0) throw new DomainError("NOT_FOUND", "Licitación no encontrada");
  return {
    status: rows[0].status,
    maxBudget: new Prisma.Decimal(String(rows[0].max_budget)),
  };
}

export async function addProduct(
  tenderId: string,
  productId: string,
  quantity: number,
  userId: string,
) {
  return db.$transaction(async (tx) => {
    const tender = await lockTender(tx, tenderId);
    if (!isProductEditable(tender.status)) {
      throw new DomainError(
        "NOT_EDITABLE",
        `No se pueden modificar productos en estado ${tender.status}`,
      );
    }
    const product = await tx.product.findUnique({ where: { id: productId } });
    if (!product) throw new DomainError("NOT_FOUND", "Producto no encontrado");

    const existing = await tx.tenderProduct.findMany({ where: { tenderId } });
    const current = existing
      .filter((p) => p.productId !== productId)
      .reduce((sum, p) => sum.add(p.unitPrice.mul(p.quantity)), new Prisma.Decimal(0));
    const newTotal = current.add(product.basePrice.mul(quantity));

    if (newTotal.gt(tender.maxBudget)) {
      throw new DomainError(
        "BUDGET_EXCEEDED",
        "El total de productos supera el presupuesto máximo",
        { maxBudget: tender.maxBudget, attemptedTotal: newTotal },
      );
    }

    return tx.tenderProduct.upsert({
      where: { tenderId_productId: { tenderId, productId } },
      create: {
        tenderId,
        productId,
        quantity,
        unitPrice: product.basePrice,
        createdById: userId,
        updatedById: userId,
      },
      update: { quantity, unitPrice: product.basePrice, updatedById: userId },
    });
  });
}

export async function removeProduct(tenderId: string, productId: string) {
  return db.$transaction(async (tx) => {
    const tender = await lockTender(tx, tenderId);
    if (!isProductEditable(tender.status)) {
      throw new DomainError(
        "NOT_EDITABLE",
        `No se pueden modificar productos en estado ${tender.status}`,
      );
    }
    const row = await tx.tenderProduct.findUnique({
      where: { tenderId_productId: { tenderId, productId } },
    });
    if (!row) {
      throw new DomainError("NOT_FOUND", "El producto no está en la licitación");
    }
    await tx.tenderProduct.delete({ where: { id: row.id } });
    return { ok: true as const };
  });
}
