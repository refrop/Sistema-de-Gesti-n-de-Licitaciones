import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { TenderStatus } from "@prisma/client";
import { app } from "../src/server/api/app";
import { db } from "../src/server/lib/db";
import { createTender } from "../src/server/services/tenders.service";
import { addProduct } from "../src/server/services/tender-products.service";
import { changeState } from "../src/server/services/tenders.service";
import { invoiceTender, registerPayment } from "../src/server/services/payment.service";

const ADMIN = { email: "test-admin@example.com", password: "TestPass123!" };
let cookie = "";
let clientId = "";
let productId = "";
let seq = 0;

const createdTenderIds: string[] = [];

async function makeTender(status?: TenderStatus, quantity = 3) {
  const tender = await createTender(
    {
      clientId,
      title: `Licitación pagos ${++seq}`,
      maxBudget: 100000,
      deadline: new Date(Date.now() + 7 * 86_400_000),
    },
    "test-actor",
  );
  createdTenderIds.push(tender.id);
  await addProduct(tender.id, productId, quantity, "test-actor"); // 100 × quantity
  if (status === "activa" || status === "finalizada") {
    await db.tender.update({ where: { id: tender.id }, data: { status: "activa" } });
  }
  if (status === "finalizada") {
    await changeState(tender.id, "finalizada", "test-actor", "manual");
  }
  if (status && !["borrador", "activa", "finalizada"].includes(status)) {
    await db.tender.update({ where: { id: tender.id }, data: { status } });
  }
  return tender.id;
}

function req(path: string, method = "GET", body?: unknown) {
  return app.request(path, {
    method,
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

beforeAll(async () => {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(ADMIN),
  });
  cookie = res.headers.get("set-cookie")!.split(";")[0];

  const client = await db.client.create({
    data: { name: "Cliente Pagos", email: `pagos-${Date.now()}@test.com` },
  });
  clientId = client.id;
  const product = await db.product.create({
    data: { name: "Prod Pagos", sku: `PAY-${Date.now()}`, basePrice: 100 },
  });
  productId = product.id;
});

afterAll(async () => {
  const tenders = await db.tender.findMany({ where: { clientId }, select: { id: true } });
  const ids = tenders.map((t) => t.id);
  await db.payment.deleteMany({ where: { tenderId: { in: ids } } });
  await db.tender.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.product.delete({ where: { id: productId } }).catch(() => undefined);
  await db.$disconnect();
});

describe("facturar (invoice)", () => {
  it("409 si la licitación no está finalizada", async () => {
    const id = await makeTender();
    await expect(invoiceTender(id, {}, "test-actor")).rejects.toMatchObject({
      code: "INVALID_STATE",
      status: 409,
    });
  });

  it("factura con el total de productos por defecto (finalizada → por_cobrar)", async () => {
    const id = await makeTender("finalizada", 3); // total 300
    const updated = await invoiceTender(id, {}, "test-actor");

    expect(updated.status).toBe("por_cobrar");
    expect(updated.invoicedAmount?.toString()).toBe("300");
    expect(updated.invoicedAt).not.toBeNull();

    const history = await db.tenderTransition.findMany({ where: { tenderId: id } });
    const last = history[history.length - 1];
    expect(last).toMatchObject({ fromStatus: "finalizada", toStatus: "por_cobrar", reason: "facturada" });
  });

  it("acepta un monto personalizado", async () => {
    const id = await makeTender("finalizada");
    const updated = await invoiceTender(id, { amount: 1234.5 }, "test-actor");
    expect(updated.invoicedAmount?.toString()).toBe("1234.5");
  });

  it("400 si el monto es 0 o negativo", async () => {
    const id = await makeTender("finalizada");
    await expect(invoiceTender(id, { amount: 0 }, "test-actor")).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
    await expect(invoiceTender(id, { amount: -10 }, "test-actor")).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
  });

  it("409 al facturar dos veces", async () => {
    const id = await makeTender("finalizada");
    await invoiceTender(id, {}, "test-actor");
    await expect(invoiceTender(id, {}, "test-actor")).rejects.toMatchObject({
      code: "INVALID_STATE",
      status: 409,
    });
  });
});

describe("pagos", () => {
  it("409 si el estado no es por_cobrar y 400 si el monto es inválido", async () => {
    const fin = await makeTender("finalizada");
    await expect(
      registerPayment(fin, { amount: 50 }, "test-actor"),
    ).rejects.toMatchObject({ code: "INVALID_STATE", status: 409 });

    const pc = await makeTender("por_cobrar", 3); // invoicedAmount no existe → INVALID_STATE
    await expect(
      registerPayment(pc, { amount: 50 }, "test-actor"),
    ).rejects.toMatchObject({ code: "INVALID_STATE", status: 409 });
  });

  it("400 si el monto es 0 o negativo", async () => {
    const id = await makeTender("finalizada");
    await invoiceTender(id, {}, "test-actor"); // invoiced 300
    await expect(
      registerPayment(id, { amount: 0 }, "test-actor"),
    ).rejects.toMatchObject({ code: "VALIDATION", status: 400 });
  });

  it("422 si el pago supera el saldo, con details.balance", async () => {
    const id = await makeTender("finalizada"); // invoiced 300
    await invoiceTender(id, {}, "test-actor");
    await expect(
      registerPayment(id, { amount: 300.01 }, "test-actor"),
    ).rejects.toMatchObject({
      code: "PAYMENT_EXCEEDS_BALANCE",
      status: 422,
      details: { balance: expect.anything() },
    });
    const payments = await db.payment.count({ where: { tenderId: id } });
    expect(payments).toBe(0);
  });

  it("pago parcial deja saldo y sigue en por_cobrar; pago total → cobrada", async () => {
    const id = await makeTender("finalizada", 3); // invoiced 300
    await invoiceTender(id, {}, "test-actor");

    const first = await registerPayment(id, { amount: 100, note: "anticipo" }, "test-actor");
    expect(first.balance.toString()).toBe("200");
    let tender = await db.tender.findUnique({ where: { id } });
    expect(tender?.status).toBe("por_cobrar");

    const second = await registerPayment(id, { amount: 200 }, "test-actor");
    expect(second.balance.toString()).toBe("0");
    tender = await db.tender.findUnique({ where: { id } });
    expect(tender?.status).toBe("cobrada");

    const history = await db.tenderTransition.findMany({
      where: { tenderId: id, toStatus: "cobrada" },
    });
    expect(history).toHaveLength(1);
    expect(history[0].reason).toBe("saldo_cero");

    await expect(
      registerPayment(id, { amount: 1 }, "test-actor"),
    ).rejects.toMatchObject({ code: "INVALID_STATE", status: 409 });
  });

  it("HTTP: 401 sin sesión y flujos /invoice + /payments", async () => {
    const noAuth = await app.request("/api/tenders/abc/invoice", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "{}",
    });
    expect(noAuth.status).toBe(401);

    const id = await makeTender("finalizada", 3);

    const inv = await req(`/api/tenders/${id}/invoice`, "POST", {});
    expect(inv.status).toBe(200);
    const invBody = await inv.json();
    expect(invBody.status).toBe("por_cobrar");
    expect(invBody.invoicedAmount).toBe("300");

    const pay = await req(`/api/tenders/${id}/payments`, "POST", { amount: 300 });
    expect(pay.status).toBe(201);
    const payBody = await pay.json();
    expect(payBody.balance).toBe("0");
    expect(payBody.payment.amount).toBe("300");

    const detail = await req(`/api/tenders/${id}`);
    const d = await detail.json();
    expect(d.status).toBe("cobrada");
    expect(d.paidTotal).toBe("300");
    expect(d.balance).toBe("0");
  });
});

describe("concurrencia de pagos", () => {
  it("dos pagos simultáneos no pueden exceder el saldo", async () => {
    const id = await makeTender("finalizada", 10); // invoiced 1000
    await invoiceTender(id, {}, "test-actor");

    const results = await Promise.allSettled([
      registerPayment(id, { amount: 600 }, "test-actor"),
      registerPayment(id, { amount: 600 }, "test-actor"),
    ]);

    const ok = results.filter((r) => r.status === "fulfilled");
    const failed = results.filter((r) => r.status === "rejected");
    expect(ok).toHaveLength(1);
    expect(failed).toHaveLength(1);
    expect((failed[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "PAYMENT_EXCEEDS_BALANCE",
      status: 422,
    });

    const payments = await db.payment.findMany({ where: { tenderId: id } });
    expect(payments).toHaveLength(1);
    const tender = await db.tender.findUnique({ where: { id } });
    expect(tender?.status).toBe("por_cobrar");
    expect(tender?.invoicedAmount?.sub(payments[0].amount).toString()).toBe("400");
  });

  it("dos pagos que suman el total → una sola transición a cobrada", async () => {
    const id = await makeTender("finalizada", 10); // invoiced 1000
    await invoiceTender(id, {}, "test-actor");

    const results = await Promise.allSettled([
      registerPayment(id, { amount: 500 }, "test-actor"),
      registerPayment(id, { amount: 500 }, "test-actor"),
    ]);
    expect(results.every((r) => r.status === "fulfilled")).toBe(true);

    const tender = await db.tender.findUnique({ where: { id } });
    expect(tender?.status).toBe("cobrada");
    const cobradas = await db.tenderTransition.count({
      where: { tenderId: id, toStatus: "cobrada" },
    });
    expect(cobradas).toBe(1);
    const payments = await db.payment.count({ where: { tenderId: id } });
    expect(payments).toBe(2);
  });
});
