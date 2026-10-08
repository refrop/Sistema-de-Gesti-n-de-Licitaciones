import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/server/api/app";
import { db } from "../src/server/lib/db";
import { hashPassword } from "../src/server/lib/auth";

const ADMIN = { email: "test-admin@example.com", password: "TestPass123!" };
const USER = { email: "test-user@example.com", password: "TestPass123!" };

type Session = { status: number; cookie: string | null };

// Usuarios creados por los tests: se borran en afterAll para no acumular
// residuo en la BD compartida (ver db-report.js).
const createdEmails: string[] = [];

async function login(email: string, password: string): Promise<Session> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const setCookie = res.headers.get("set-cookie");
  return { status: res.status, cookie: setCookie ? setCookie.split(";")[0] : null };
}

function jsonRequest(path: string, method: string, cookie?: string | null, body?: unknown) {
  return app.request(path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  const adminHash = await hashPassword(ADMIN.password);
  await db.user.upsert({
    where: { email: ADMIN.email },
    update: { role: "admin", active: true, passwordHash: adminHash },
    create: { email: ADMIN.email, name: "Test Admin", passwordHash: adminHash, role: "admin" },
  });
  const userHash = await hashPassword(USER.password);
  await db.user.upsert({
    where: { email: USER.email },
    update: { role: "user", active: true, passwordHash: userHash },
    create: { email: USER.email, name: "Test User", passwordHash: userHash, role: "user" },
  });
});

afterAll(async () => {
  if (createdEmails.length > 0) {
    await db.user.deleteMany({ where: { email: { in: createdEmails } } });
  }
  await db.$disconnect();
});

describe("auth", () => {
  it("401 sin sesión en /api/auth/me", async () => {
    const res = await app.request("/api/auth/me");
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("401 sin sesión en un recurso protegido", async () => {
    const res = await app.request("/api/clients");
    expect(res.status).toBe(401);
  });

  it("401 con credenciales inválidas", async () => {
    const { status } = await login(ADMIN.email, "Password-equivocada");
    expect(status).toBe(401);
  });

  it("login OK devuelve cookie y /me identifica al admin", async () => {
    const session = await login(ADMIN.email, ADMIN.password);
    expect(session.status).toBe(200);
    expect(session.cookie).toMatch(/^session=/);
    const res = await app.request("/api/auth/me", { headers: { Cookie: session.cookie! } });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.user.email).toBe(ADMIN.email);
    expect(body.user.role).toBe("admin");
    expect(body.user).not.toHaveProperty("passwordHash");
  });

  it("login del usuario demo del seed (rol user)", async () => {
    const session = await login(
      process.env.SEED_USER_EMAIL ?? "user@example.com",
      process.env.SEED_USER_PASSWORD ?? "CambiaEstaClave123!",
    );
    expect(session.status).toBe(200);
  });

  it("logout borra la cookie", async () => {
    const session = await login(ADMIN.email, ADMIN.password);
    const res = await jsonRequest("/api/auth/logout", "POST", session.cookie);
    expect(res.status).toBe(200);
    expect(res.headers.get("set-cookie")).toContain("session=;");
  });
});

describe("autorización por rol", () => {
  it("401 al crear usuarios sin sesión", async () => {
    const res = await jsonRequest("/api/users", "POST", null, {
      email: "nobody@example.com",
      name: "Nadie",
      password: "Password123!",
    });
    expect(res.status).toBe(401);
  });

  it("403 al crear usuarios con rol user", async () => {
    const session = await login(USER.email, USER.password);
    const res = await jsonRequest("/api/users", "POST", session.cookie, {
      email: `forbidden-${Date.now()}@example.com`,
      name: "No Puede",
      password: "Password123!",
    });
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("403 al listar usuarios con rol user", async () => {
    const session = await login(USER.email, USER.password);
    const res = await app.request("/api/users", { headers: { Cookie: session.cookie! } });
    expect(res.status).toBe(403);
  });

  it("201 al crear usuarios con rol admin (sin passwordHash en la respuesta)", async () => {
    const session = await login(ADMIN.email, ADMIN.password);
    const email = `created-${Date.now()}@example.com`;
    const res = await jsonRequest("/api/users", "POST", session.cookie, {
      email,
      name: "Creado Por Test",
      password: "Password123!",
      role: "user",
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    createdEmails.push(email);
    expect(body.email).toBe(email);
    expect(body).not.toHaveProperty("passwordHash");
    expect(body.createdById).toBeTruthy();
  });
});

describe("mutaciones requieren JSON (CSRF)", () => {
  it("400 si falta Content-Type: application/json", async () => {
    const session = await login(ADMIN.email, ADMIN.password);
    const res = await app.request("/api/clients", {
      method: "POST",
      headers: { Cookie: session.cookie! },
      body: JSON.stringify({ name: "X", email: "x@example.com" }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION");
  });
});
