import { db } from "../lib/db";
import { listMeta, skipTake, type ListQuery } from "../lib/pagination";

const clientSelect = {
  id: true,
  name: true,
  email: true,
  phone: true,
  taxId: true,
  contactName: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} as const;

export async function listClients(query: ListQuery) {
  const where = query.q
    ? {
        OR: [
          { name: { contains: query.q, mode: "insensitive" as const } },
          { email: { contains: query.q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, data] = await Promise.all([
    db.client.count({ where }),
    db.client.findMany({
      where,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
      select: clientSelect,
    }),
  ]);
  return { data, ...listMeta(total, query) };
}

export async function createClient(
  input: {
    name: string;
    email: string;
    phone?: string;
    taxId?: string;
    contactName?: string;
  },
  actorId: string,
) {
  return db.client.create({
    data: {
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      phone: input.phone,
      taxId: input.taxId,
      contactName: input.contactName,
      createdById: actorId,
      updatedById: actorId,
    },
    select: clientSelect,
  });
}
