import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import { hashPassword } from "../lib/auth";
import { listMeta, skipTake, type ListQuery } from "../lib/pagination";

const userSelect = {
  id: true,
  email: true,
  name: true,
  role: true,
  active: true,
  createdAt: true,
  updatedAt: true,
  createdById: true,
  updatedById: true,
} as const;

export async function listUsers(query: ListQuery) {
  const where = query.q
    ? {
        OR: [
          { email: { contains: query.q, mode: "insensitive" as const } },
          { name: { contains: query.q, mode: "insensitive" as const } },
        ],
      }
    : {};
  const [total, data] = await Promise.all([
    db.user.count({ where }),
    db.user.findMany({
      where,
      ...skipTake(query),
      orderBy: { createdAt: "desc" },
      select: userSelect,
    }),
  ]);
  return { data, ...listMeta(total, query) };
}

export async function listUsersBrief() {
  return db.user.findMany({
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });
}

export async function createUser(
  input: { email: string; name: string; password: string; role: "admin" | "user" },
  actorId: string,
) {
  const email = input.email.trim().toLowerCase();
  const existing = await db.user.findUnique({ where: { email } });
  if (existing) throw new DomainError("CONFLICT", `El usuario ${email} ya existe`);
  const passwordHash = await hashPassword(input.password);
  return db.user.create({
    data: {
      email,
      name: input.name.trim(),
      passwordHash,
      role: input.role,
      createdById: actorId,
      updatedById: actorId,
    },
    select: userSelect,
  });
}
