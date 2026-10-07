import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { app } from "../src/server/api/app";
import { db } from "../src/server/lib/db";
import { changeState } from "../src/server/services/tenders.service";

const ADMIN = { email: "test-admin@example.com", password: "TestPass123!" };
let cookie = "";
let clientId = "";
let productId = "";

async function login(): Promise<string> {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  return res.headers.get("set-cookie")!.split(";")[0];
}

function req(path: string, method = "GET", body?: unknown) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  cookie = await login();
  const client = await db.client.create({
    data: { name: "Cliente HTTP", email: `http-${Date.now()}@test.com` },
  });
  clientId = client.id;
  const product = await db.product.create({
    data: { name: "Prod HTTP", sku: `HTTP-${Date.now()}`, basePrice: 100 },
  });
  productId = product.id;
});

afterAll(async () => {
  await db.tender.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.product.delete({ where: { id: productId } }).catch(() => undefined);
  await db.$disconnect();
});

const futureIso = () => new Date(Date.now() + 86_400_000).toISOString();
const createBody = (overrides: Record<string, unknown> = {}) => ({
  clientId,
  title: "Licitación HTTP",
  maxBudget: 5000,
  deadline: futureIso(),
  ...overrides,
});

describe("POST /api/tenders", () => {
  it("401 sin sesión", async () => {
    const res = await app.request("/api/tenders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createBody()),
    });
    expect(res.status).toBe(401);
  });

  it("201 crea en borrador con historial", async () => {
    const res = await req("/api/tenders", "POST", createBody());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.status).toBe("borrador");
    const history = await db.tenderTransition.findMany({ where: { tenderId: body.id } });
    expect(history).toHaveLength(1);
  });

  it("400 con fecha pasada o presupuesto inválido", async () => {
    const past = await req("/api/tenders", "POST", createBody({ deadline: "2020-01-01T00:00:00.000Z" }));
    expect(past.status).toBe(400);
    const budget = await req("/api/tenders", "POST", createBody({ maxBudget: -5 }));
    expect(budget.status).toBe(400);
  });
});

describe("GET /api/tenders (lista y filtros)", () => {
  it("lista con paginación y filtra por status", async () => {
    const res = await req("/api/tenders?page=1&pageSize=5");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.data)).toBe(true);
    expect(body).toHaveProperty("totalPages");

    const filtered = await req("/api/tenders?status=cobrada");
    expect(filtered.status).toBe(200);
    const fb = await filtered.json();
    expect(fb.data.every((t: { status: string }) => t.status === "cobrada")).toBe(true);
  });
});

describe("detalle y productos por HTTP", () => {
  let tenderId = "";

  it("detalle 200 con cliente, productos, totales e historial", async () => {
    const created = await req("/api/tenders", "POST", createBody({ title: "Detalle HTTP" }));
    tenderId = (await created.json()).id;

    const add = await req(`/api/tenders/${tenderId}/products`, "POST", { productId, quantity: 3 });
    expect(add.status).toBe(201);

    const res = await req(`/api/tenders/${tenderId}`);
    expect(res.status).toBe(200);
    const detail = await res.json();
    expect(detail.client.name).toBe("Cliente HTTP");
    expect(detail.products).toHaveLength(1);
    expect(detail.totalProducts).toBe("300");
    expect(detail.transitions).toHaveLength(1);
  });

  it("404 en detalle inexistente", async () => {
    const res = await req("/api/tenders/00000000-0000-0000-0000-000000000000");
    expect(res.status).toBe(404);
  });

  it("422 al exceder el presupuesto por HTTP", async () => {
    const created = await req("/api/tenders", "POST", createBody({ maxBudget: 150, title: "Presupuesto HTTP" }));
    const id = (await created.json()).id;
    const res = await req(`/api/tenders/${id}/products`, "POST", { productId, quantity: 2 });
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("BUDGET_EXCEEDED");
  });

  it("DELETE quita el producto; segundo intento 404", async () => {
    const del = await req(`/api/tenders/${tenderId}/products/${productId}`, "DELETE");
    expect(del.status).toBe(200);
    const again = await req(`/api/tenders/${tenderId}/products/${productId}`, "DELETE");
    expect(again.status).toBe(404);
  });

  it("historial por endpoint GET /transitions", async () => {
    const res = await req(`/api/tenders/${tenderId}/transitions`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.length).toBeGreaterThanOrEqual(1);
    expect(body[0].toStatus).toBe("borrador");
  });
});

describe("finalize / lose", () => {
  it("409 si el estado no lo permite; 200 cuando corresponde", async () => {
    const created = await req("/api/tenders", "POST", createBody({ title: "Flujo estados" }));
    const id = (await created.json()).id;

    const tooEarly = await req(`/api/tenders/${id}/finalize`, "POST", {});
    expect(tooEarly.status).toBe(409); // borrador → finalizada no existe

    await changeState(id, "activa", "test-actor", "manual");

    const fin = await req(`/api/tenders/${id}/finalize`, "POST", {});
    expect(fin.status).toBe(200);
    expect((await fin.json()).status).toBe("finalizada");

    const lose = await req(`/api/tenders/${id}/lose`, "POST", {});
    expect(lose.status).toBe(409); // finalizada → perdida no existe
  });

  it("panel /expiring lista activas próximas a vencer", async () => {
    const created = await req("/api/tenders", "POST", createBody({ title: "Por vencer" }));
    const id = (await created.json()).id;
    await db.tender.update({
      where: { id },
      data: { deadline: new Date(Date.now() + 3_600_000) },
    });
    await changeState(id, "activa", "test-actor", "manual");

    const res = await req("/api/tenders/expiring?days=3");
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.some((t: { id: string }) => t.id === id)).toBe(true);
  });
});
