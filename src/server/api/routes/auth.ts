import { Hono } from "hono";
import { setCookie, deleteCookie } from "hono/cookie";
import { z } from "zod";
import { db } from "../../lib/db";
import { DomainError } from "../../domain/errors";
import {
  signSessionToken,
  verifyPassword,
  SESSION_COOKIE,
  sessionCookieOptions,
} from "../../lib/auth";
import { requireAuth } from "../middleware/auth";
import { readJsonBody } from "../guard";

const loginSchema = z.object({
  email: z.email("Correo inválido"),
  password: z.string().min(1, "Contraseña obligatoria"),
});

export const authRoutes = new Hono()
  .post("/api/auth/login", async (c) => {
    const { email, password } = await readJsonBody(c, loginSchema);
    const user = await db.user.findUnique({
      where: { email: email.trim().toLowerCase() },
    });
    const valid = user ? await verifyPassword(password, user.passwordHash) : false;
    if (!user || !valid || !user.active) {
      throw new DomainError("UNAUTHORIZED", "Credenciales inválidas");
    }
    const token = await signSessionToken({ sub: user.id, role: user.role });
    setCookie(c, SESSION_COOKIE, token, sessionCookieOptions());
    return c.json({
      user: { id: user.id, email: user.email, name: user.name, role: user.role },
    });
  })
  .post("/api/auth/logout", requireAuth, (c) => {
    deleteCookie(c, SESSION_COOKIE, { path: "/" });
    return c.json({ ok: true });
  })
  .get("/api/auth/me", requireAuth, (c) => c.json({ user: c.get("user") }));
