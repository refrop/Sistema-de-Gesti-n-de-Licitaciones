import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/server/lib/db";
import { createTender, getTender } from "../src/server/services/tenders.service";
import { addProduct, removeProduct } from "../src/server/services/tender-products.service";

let clientId = "";
let pA = "";
let pB = "";
let pC = "";
let pD = "";

const future = () => new Date(Date.now() + 86_400_000);

beforeAll(async () => {
  const client = await db.client.create({
    data: { name: "Cliente Budget", email: `budget-${Date.now()}@test.com` },
  });
  clientId = client.id;
  const mk = async (name: string, price: number) =>
    (
      await db.product.create({
        data: { name, sku: `BG-${name}-${Date.now()}-${Math.floor(Math.random() * 1e6)}`, basePrice: price },
      })
    ).id;
  pA = await mk("ProdA", 400);
  pB = await mk("ProdB", 200);
  pC = await mk("ProdC", 999.99);
  pD = await mk("ProDD", 0.02);
});

afterAll(async () => {
  await db.tender.deleteMany({ where: { clientId } });
  await db.product.deleteMany({ where: { id: { in: [pA, pB, pC, pD] } } });
  await db.client.delete({ where: { id: clientId } });
  await db.$disconnect();
});

const newTender = (maxBudget: number) =>
  createTender(
    { clientId, title: "Licitación budget", maxBudget, deadline: future() },
    "test-actor",
  );

describe("createTender", () => {
  it("rechaza una fecha límite en el pasado", async () => {
    await expect(
      createTender(
        { clientId, title: "Vencida", maxBudget: 100, deadline: new Date(Date.now() - 1000) },
        "test-actor",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION", status: 400 });
  });

  it("rechaza una fecha límite inválida", async () => {
    await expect(
      createTender(
        { clientId, title: "Inválida", maxBudget: 100, deadline: new Date("no-fecha") },
        "test-actor",
      ),
    ).rejects.toMatchObject({ code: "VALIDATION", status: 400 });
  });

  it("rechaza presupuesto <= 0 y cliente inexistente", async () => {
    await expect(
      createTender({ clientId, title: "Sin budget", maxBudget: 0, deadline: future() }, "test-actor"),
    ).rejects.toMatchObject({ code: "VALIDATION", status: 400 });
    await expect(
      createTender(
        { clientId: "00000000-0000-0000-0000-000000000000", title: "X", maxBudget: 10, deadline: future() },
        "test-actor",
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("crea en borrador y registra la transición inicial null → borrador", async () => {
    const tender = await newTender(1000);
    expect(tender.status).toBe("borrador");
    const history = await db.tenderTransition.findMany({ where: { tenderId: tender.id } });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({ fromStatus: null, toStatus: "borrador", reason: "creacion" });
  });
});

describe("regla de presupuesto (addProduct)", () => {
  it("acepta hasta el límite exacto", async () => {
    const tender = await newTender(1000);
    await addProduct(tender.id, pA, 2, "test-actor"); // 800
    const row = await addProduct(tender.id, pB, 1, "test-actor"); // +200 = 1000 exacto
    expect(row.quantity).toBe(1);
  });

  it("rechaza un centavo más con BUDGET_EXCEEDED (422)", async () => {
    const tender = await newTender(1000);
    await addProduct(tender.id, pC, 1, "test-actor"); // 999.99
    await expect(addProduct(tender.id, pD, 1, "test-actor")).rejects.toMatchObject({
      code: "BUDGET_EXCEEDED",
      status: 422,
    });
    expect(await db.tenderProduct.count({ where: { tenderId: tender.id } })).toBe(1);
  });

  it("al reemplazar cantidad descuenta el subtotal anterior (upsert en el límite)", async () => {
    const tender = await newTender(1000);
    await addProduct(tender.id, pA, 2, "test-actor"); // 800
    await addProduct(tender.id, pB, 1, "test-actor"); // 1000 exacto
    // Reemplazar A por cantidad 1: si no descontara el anterior (800), daría 1400 y rechazaría
    const row = await addProduct(tender.id, pA, 1, "test-actor"); // 400 + 200 = 600
    expect(row.quantity).toBe(1);
    expect(await db.tenderProduct.count({ where: { tenderId: tender.id } })).toBe(2);
    // y ahora sí cabe subir A a 3 (1200 + 200 > 1000) → rechazado
    await expect(addProduct(tender.id, pA, 3, "test-actor")).rejects.toMatchObject({
      code: "BUDGET_EXCEEDED",
    });
  });

  it("NOT_EDITABLE (409) en estado finalizada", async () => {
    const tender = await newTender(1000);
    await addProduct(tender.id, pA, 1, "test-actor");
    await db.tender.update({ where: { id: tender.id }, data: { status: "finalizada" } });
    await expect(addProduct(tender.id, pB, 1, "test-actor")).rejects.toMatchObject({
      code: "NOT_EDITABLE",
      status: 409,
    });
    await expect(removeProduct(tender.id, pA)).rejects.toMatchObject({
      code: "NOT_EDITABLE",
      status: 409,
    });
  });

  it("404 para licitación o producto inexistente", async () => {
    await expect(
      addProduct("00000000-0000-0000-0000-000000000000", pA, 1, "test-actor"),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
    const tender = await newTender(1000);
    await expect(
      addProduct(tender.id, "00000000-0000-0000-0000-000000000000", 1, "test-actor"),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });
});

describe("removeProduct", () => {
  it("quita el producto y el segundo intento da 404", async () => {
    const tender = await newTender(1000);
    await addProduct(tender.id, pA, 1, "test-actor");
    await removeProduct(tender.id, pA);
    expect(await db.tenderProduct.count({ where: { tenderId: tender.id } })).toBe(0);
    await expect(removeProduct(tender.id, pA)).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});

describe("getTender (detalle)", () => {
  it("devuelve cliente, productos con subtotal, totales en Decimal e historial", async () => {
    const tender = await newTender(1000);
    await addProduct(tender.id, pA, 2, "test-actor"); // 800
    const detail = await getTender(tender.id);
    expect(detail.client.name).toBe("Cliente Budget");
    expect(detail.products).toHaveLength(1);
    expect(detail.products[0].subtotal.toString()).toBe("800");
    expect(detail.totalProducts.toString()).toBe("800");
    expect(detail.paidTotal.toString()).toBe("0");
    expect(detail.balance).toBeNull(); // sin facturar
    expect(detail.transitions).toHaveLength(1);
    expect(detail).not.toHaveProperty("passwordHash");
  });

  it("404 si no existe", async () => {
    await expect(getTender("00000000-0000-0000-0000-000000000000")).rejects.toMatchObject({
      code: "NOT_FOUND",
      status: 404,
    });
  });
});
