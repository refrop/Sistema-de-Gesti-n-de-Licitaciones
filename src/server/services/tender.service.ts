import type { Prisma, TenderStatus } from "@prisma/client";
import { canTransition } from "../domain/state-machine";
import { DomainError } from "../domain/errors";

type Tx = Prisma.TransactionClient;

export async function transition(
  tx: Tx,
  tenderId: string,
  to: TenderStatus,
  userId: string | null,
  reason: string,
  extra: Prisma.TenderUpdateInput = {},
) {
  const rows = await tx.$queryRaw<{ status: TenderStatus }[]>`
    SELECT status FROM tenders WHERE id = ${tenderId} FOR UPDATE`;
  if (rows.length === 0) {
    throw new DomainError("NOT_FOUND", "Licitación no encontrada");
  }

  const from = rows[0].status;
  if (!canTransition(from, to)) {
    throw new DomainError(
      "INVALID_TRANSITION",
      `Transición no permitida: ${from} → ${to}`,
      { from, to },
    );
  }

  const updated = await tx.tender.update({
    where: { id: tenderId },
    data: { ...extra, status: to, updatedById: userId },
  });

  await tx.tenderTransition.create({
    data: { tenderId, fromStatus: from, toStatus: to, userId, reason },
  });

  return updated;
}
