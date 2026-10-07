import { Prisma } from "@prisma/client";
import type { TenderStatus } from "@prisma/client";
import { z } from "zod";
import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import { listQuerySchema, listMeta, skipTake } from "../lib/pagination";
import { transition } from "./tender.service";

export const createTenderSchema = z.object({
  clientId: z.string().min(1, "clientId obligatorio"),
  title: z.string().trim().min(1, "Título obligatorio"),
  description: z.string().trim().min(1).optional(),
  maxBudget: z.number(),
  deadline: z.coerce.date(),
});

export type CreateTenderInput = z.infer<typeof createTenderSchema>;

export const tenderListQuerySchema = listQuerySchema.extend({
  status: z
    .enum(["borrador", "activa", "finalizada", "por_cobrar", "cobrada", "perdida"])
    .optional(),
  clientId: z.string().min(1).optional(),
});

export type TenderListQuery = z.infer<typeof tenderListQuerySchema>;

export async function createTender(input: CreateTenderInput, userId: string) {
  if (Number.isNaN(input.deadline.getTime()) || input.deadline.getTime() <= Date.now()) {
    throw new DomainError("VALIDATION", "La fecha límite debe ser futura");
  }
  if (input.maxBudget <= 0) {
    throw new DomainError("VALIDATION", "El presupuesto máximo debe ser mayor a 0");
  }
  const client = await db.client.findUnique({ where: { id: input.clientId } });
  if (!client) throw new DomainError("NOT_FOUND", "Cliente no encontrado");

  return db.$transaction(async (tx) => {
    const tender = await tx.tender.create({
      data: {
        clientId: input.clientId,
        title: input.title,
        description: input.description,
        maxBudget: input.maxBudget,
        deadline: input.deadline,
        createdById: userId,
        updatedById: userId,
      },
    });
    await tx.tenderTransition.create({
      data: {
        tenderId: tender.id,
        fromStatus: null,
        toStatus: "borrador",
        userId,
        reason: "creacion",
      },
    });
    return tender;
  });
}

export async function listTenders(query: TenderListQuery) {
  const where = {
    ...(query.status ? { status: query.status } : {}),
    ...(query.clientId ? { clientId: query.clientId } : {}),
    ...(query.q
      ? {
          OR: [
            { title: { contains: query.q, mode: "insensitive" as const } },
            { description: { contains: query.q, mode: "insensitive" as const } },
          ],
        }
      : {}),
  };
  const [total, data] = await Promise.all([
    db.tender.count({ where }),
    db.tender.findMany({
      where,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
      include: { client: { select: { id: true, name: true, email: true } } },
    }),
  ]);
  return { data, ...listMeta(total, query) };
}

export async function listExpiring(days: number) {
  const limit = new Date(Date.now() + days * 86_400_000);
  return db.tender.findMany({
    where: { status: "activa", deadline: { lte: limit } },
    orderBy: { deadline: "asc" },
    take: 50,
    include: { client: { select: { id: true, name: true } } },
  });
}

export async function getTender(id: string) {
  const tender = await db.tender.findUnique({
    where: { id },
    include: {
      client: true,
      products: { include: { product: true }, orderBy: { createdAt: "asc" } },
      payments: true,
      transitions: { orderBy: { createdAt: "asc" }, take: 100 },
      emails: { orderBy: { createdAt: "asc" }, take: 100 },
    },
  });
  if (!tender) throw new DomainError("NOT_FOUND", "Licitación no encontrada");

  const totalProducts = tender.products.reduce(
    (sum, p) => sum.add(p.unitPrice.mul(p.quantity)),
    new Prisma.Decimal(0),
  );
  const paidTotal = tender.payments.reduce(
    (sum, p) => sum.add(p.amount),
    new Prisma.Decimal(0),
  );
  const balance = tender.invoicedAmount ? tender.invoicedAmount.sub(paidTotal) : null;

  const { client, products, payments, transitions, emails, ...data } = tender;
  return {
    ...data,
    client: {
      id: client.id,
      name: client.name,
      email: client.email,
      phone: client.phone,
      taxId: client.taxId,
      contactName: client.contactName,
    },
    products: products.map((p) => ({
      id: p.id,
      productId: p.productId,
      quantity: p.quantity,
      unitPrice: p.unitPrice,
      subtotal: p.unitPrice.mul(p.quantity),
      product: {
        id: p.product.id,
        name: p.product.name,
        sku: p.product.sku,
        basePrice: p.product.basePrice,
      },
    })),
    totalProducts,
    paidTotal,
    balance,
    payments,
    transitions,
    emails,
  };
}

export async function listTransitions(tenderId: string) {
  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    select: { id: true },
  });
  if (!tender) throw new DomainError("NOT_FOUND", "Licitación no encontrada");
  return db.tenderTransition.findMany({
    where: { tenderId },
    orderBy: { createdAt: "asc" },
    take: 500,
  });
}

export async function changeState(
  tenderId: string,
  to: TenderStatus,
  userId: string,
  reason: string,
) {
  return db.$transaction((tx) => transition(tx, tenderId, to, userId, reason));
}
