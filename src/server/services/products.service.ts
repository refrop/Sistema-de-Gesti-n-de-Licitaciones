import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import { listMeta, skipTake, type ListQuery } from "../lib/pagination";

const productSelect = {
  id: true,
  name: true,
  sku: true,
  description: true,
  basePrice: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} as const;

export async function listProducts(query: ListQuery) {
  const where = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" as const } },
          { sku: { contains: query.q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, data] = await Promise.all([
    db.product.count({ where }),
    db.product.findMany({
      where,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
      select: productSelect,
    }),
  ]);
  return { data, ...listMeta(total, query) };
}

export async function createProduct(
  input: { name: string; sku: string; description?: string; basePrice: number },
  actorId: string,
) {
  const sku = input.sku.trim().toUpperCase();
  const existing = await db.product.findUnique({ where: { sku } });
  if (existing) throw new DomainError("CONFLICT", `El SKU ${sku} ya existe`);
  return db.product.create({
    data: {
      name: input.name.trim(),
      sku,
      description: input.description,
      basePrice: input.basePrice,
      createdById: actorId,
      updatedById: actorId,
    },
    select: productSelect,
  });
}
