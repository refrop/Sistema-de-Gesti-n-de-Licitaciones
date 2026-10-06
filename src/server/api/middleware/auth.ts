import type { Context, MiddlewareHandler } from "hono";
import { getCookie } from "hono/cookie";
import { db } from "../../lib/db";
import { verifySessionToken, SESSION_COOKIE } from "../../lib/auth";
import { DomainError } from "../../domain/errors";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  active: boolean;
};

declare module "hono" {
  interface ContextVariableMap {
    user: AuthUser;
  }
}

async function resolveUser(c: Context): Promise<AuthUser | null> {
  let token = getCookie(c, SESSION_COOKIE);
  if (!token) {
    const authorization = c.req.header("authorization");
    if (authorization?.startsWith("Bearer ")) token = authorization.slice(7);
  }
  if (!token) return null;
  const claims = await verifySessionToken(token);
  if (!claims) return null;
  const user = await db.user.findUnique({
    where: { id: claims.sub },
    select: { id: true, email: true, name: true, role: true, active: true },
  });
  if (!user || !user.active) return null;
  return user;
}

export const requireAuth: MiddlewareHandler = async (c, next) => {
  const user = await resolveUser(c);
  if (!user) throw new DomainError("UNAUTHORIZED", "Sesión requerida");
  c.set("user", user);
  await next();
};

export function requireRole(role: "admin"): MiddlewareHandler {
  return async (c, next) => {
    const user = c.get("user");
    if (!user) throw new DomainError("UNAUTHORIZED", "Sesión requerida");
    if (user.role !== role) throw new DomainError("FORBIDDEN", "Se requiere rol admin");
    await next();
  };
}
