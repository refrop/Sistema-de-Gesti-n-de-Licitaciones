import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from "vitest";

vi.mock("../src/server/lib/email", () => ({ sendEmail: vi.fn() }));

import { sendEmail } from "../src/server/lib/email";
import { app } from "../src/server/api/app";
import { db } from "../src/server/lib/db";
import { env } from "../src/server/lib/env";
import { createTender } from "../src/server/services/tenders.service";
import { addProduct } from "../src/server/services/tender-products.service";
import { expireTenders } from "../src/server/jobs/expire-tenders";
import { sendReminders } from "../src/server/jobs/send-reminders";
import { runTick } from "../src/server/jobs/tick";

const sendEmailMock = vi.mocked(sendEmail);

let clientId = "";
let productId = "";
let seq = 0;
const createdTenderIds: string[] = [];

async function makeActivo(deadline: Date): Promise<string> {
  const tender = await createTender(
    {
      clientId,
      title: `Licitación jobs ${++seq}`,
      maxBudget: 10000,
      deadline: new Date(Date.now() + 86_400_000),
    },
    "test-actor",
  );
  createdTenderIds.push(tender.id);
  await addProduct(tender.id, productId, 1, "test-actor");
  await db.tender.update({
    where: { id: tender.id },
    data: { status: "activa", deadline },
  });
  return tender.id;
}

async function makeBorradorPasado(): Promise<string> {
  const tender = await createTender(
    {
      clientId,
      title: `Licitación borrador vencida ${++seq}`,
      maxBudget: 10000,
      deadline: new Date(Date.now() + 86_400_000),
    },
    "test-actor",
  );
  createdTenderIds.push(tender.id);
  await db.tender.update({
    where: { id: tender.id },
    data: { deadline: new Date(Date.now() - 3_600_000) },
  });
  return tender.id;
}

const callsFor = (tenderId: string) =>
  sendEmailMock.mock.calls.filter((c) => c[0].idempotencyKey === `tender-${tenderId}-recordatorio`);

beforeEach(() => {
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue("msg-reminder-test");
});

beforeAll(async () => {
  const client = await db.client.create({
    data: { name: "Cliente Jobs", email: `jobs-${Date.now()}@test.com` },
  });
  clientId = client.id;
  const product = await db.product.create({
    data: { name: "Prod Jobs", sku: `JOB-${Date.now()}`, basePrice: 100 },
  });
  productId = product.id;
});

afterAll(async () => {
  await db.tender.deleteMany({ where: { clientId } });
  await db.client.delete({ where: { id: clientId } });
  await db.product.delete({ where: { id: productId } }).catch(() => undefined);
  await db.$disconnect();
});

describe("expireTenders (vencimiento)", () => {
  it("vence la activa con deadline pasado con reason vencimiento_automatico y userId null", async () => {
    const id = await makeActivo(new Date(Date.now() - 3_600_000));

    const res = await expireTenders();
    expect(res.count).toBeGreaterThanOrEqual(1);

    const tender = await db.tender.findUnique({ where: { id } });
    expect(tender?.status).toBe("perdida");

    const history = await db.tenderTransition.findMany({ where: { tenderId: id, toStatus: "perdida" } });
    expect(history).toHaveLength(1);
    expect(history[0].reason).toBe("vencimiento_automatico");
    expect(history[0].userId).toBeNull();
  });

  it("es idempotente: la segunda corrida no duplica la transición", async () => {
    const id = await makeActivo(new Date(Date.now() - 60_000));
    await expireTenders();
    const res = await expireTenders();
    expect(res.errors).toHaveLength(0);

    const transitions = await db.tenderTransition.count({ where: { tenderId: id, toStatus: "perdida" } });
    expect(transitions).toBe(1);
  });

  it("no toca borradores con deadline pasado", async () => {
    const id = await makeBorradorPasado();
    await expireTenders();
    const tender = await db.tender.findUnique({ where: { id } });
    expect(tender?.status).toBe("borrador");
  });
});

describe("sendReminders (recordatorio)", () => {
  it("envía el recordatorio dentro de la ventana y marca reminderSentAt", async () => {
    const id = await makeActivo(new Date(Date.now() + 47 * 3_600_000));

    const res = await sendReminders();
    expect(res.count).toBeGreaterThanOrEqual(1);
    expect(res.errors).toHaveLength(0);

    const calls = callsFor(id);
    expect(calls).toHaveLength(1);
    expect(calls[0][0].to).toBeDefined();
    expect(calls[0][0].html).toContain("vence en");

    const tender = await db.tender.findUnique({ where: { id } });
    expect(tender?.reminderSentAt).not.toBeNull();

    const logs = await db.emailLog.findMany({ where: { tenderId: id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: "recordatorio", status: "enviado", providerId: "msg-reminder-test" });
  });

  it("no duplica: la segunda corrida no vuelve a enviar", async () => {
    const id = await makeActivo(new Date(Date.now() + 47 * 3_600_000));
    await sendReminders();
    const first = await db.tender.findUnique({ where: { id }, select: { reminderSentAt: true } });

    await sendReminders();
    expect(callsFor(id)).toHaveLength(1);
    const second = await db.tender.findUnique({ where: { id }, select: { reminderSentAt: true } });
    expect(second?.reminderSentAt?.getTime()).toBe(first?.reminderSentAt?.getTime());
  });

  it("no recuerda licitaciones fuera de la ventana (> REMINDER_HOURS)", async () => {
    const id = await makeActivo(new Date(Date.now() + 72 * 3_600_000));
    await sendReminders();
    expect(callsFor(id)).toHaveLength(0);
    const tender = await db.tender.findUnique({ where: { id }, select: { reminderSentAt: true } });
    expect(tender?.reminderSentAt).toBeNull();
  });

  it("si el correo falla revierte el reclamo, loguea el error y permite reintentar", async () => {
    const id = await makeActivo(new Date(Date.now() + 47 * 3_600_000));
    sendEmailMock.mockRejectedValueOnce(new Error("resend caído"));

    const res = await sendReminders();
    expect(res.errors.length).toBeGreaterThanOrEqual(1);

    let tender = await db.tender.findUnique({ where: { id }, select: { reminderSentAt: true } });
    expect(tender?.reminderSentAt).toBeNull();
    let logs = await db.emailLog.findMany({ where: { tenderId: id } });
    expect(logs[0]).toMatchObject({ status: "fallido" });
    expect(logs[0].error).toContain("resend caído");

    const retry = await sendReminders();
    expect(retry.count).toBeGreaterThanOrEqual(1);
    tender = await db.tender.findUnique({ where: { id }, select: { reminderSentAt: true } });
    expect(tender?.reminderSentAt).not.toBeNull();
    logs = await db.emailLog.findMany({ where: { tenderId: id }, orderBy: { createdAt: "asc" } });
    expect(logs.map((l) => l.status)).toEqual(["fallido", "enviado"]);
  });

  it("reclamo concurrente: dos corridas simultáneas envían un solo correo", async () => {
    const id = await makeActivo(new Date(Date.now() + 47 * 3_600_000));

    await Promise.all([sendReminders(), sendReminders()]);
    expect(callsFor(id)).toHaveLength(1);
  });
});

describe("runTick y endpoint HTTP", () => {
  it("runTick vence antes de recordar (no se recuerda una vencida)", async () => {
    const expiring = await makeActivo(new Date(Date.now() - 60_000));
    const reminder = await makeActivo(new Date(Date.now() + 47 * 3_600_000));

    const result = await runTick();
    expect(result.expired).toBeGreaterThanOrEqual(1);
    expect(result.reminded).toBeGreaterThanOrEqual(1);
    expect(Array.isArray(result.errors)).toBe(true);
    expect(typeof result.time).toBe("string");

    const a = await db.tender.findUnique({ where: { id: expiring } });
    expect(a?.status).toBe("perdida");
    expect(a?.reminderSentAt).toBeNull();
    expect(await db.emailLog.count({ where: { tenderId: expiring } })).toBe(0);

    const b = await db.tender.findUnique({ where: { id: reminder } });
    expect(b?.status).toBe("activa");
    expect(b?.reminderSentAt).not.toBeNull();
  });

  it("401 sin header o con secret incorrecto", async () => {
    const none = await app.request("/api/cron/tick");
    expect(none.status).toBe(401);
    expect((await none.json()).error.code).toBe("UNAUTHORIZED");

    const wrong = await app.request("/api/cron/tick", {
      headers: { Authorization: "Bearer secreto-equivocado" },
    });
    expect(wrong.status).toBe(401);
  });

  it("200 con el secret correcto y resumen del tick (evidencia)", async () => {
    const res = await app.request("/api/cron/tick", {
      headers: { Authorization: `Bearer ${env.CRON_SECRET}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      expired: expect.any(Number),
      reminded: expect.any(Number),
      errors: expect.any(Array),
      time: expect.any(String),
    });
  });
});
