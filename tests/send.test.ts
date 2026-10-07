import { describe, it, expect, vi, beforeAll, beforeEach, afterAll } from "vitest";

vi.mock("../src/server/lib/email", () => ({ sendEmail: vi.fn() }));

import { sendEmail } from "../src/server/lib/email";
import { db } from "../src/server/lib/db";
import { supabase, uploadPdf } from "../src/server/lib/storage";
import { env } from "../src/server/lib/env";
import { createTender } from "../src/server/services/tenders.service";
import { addProduct } from "../src/server/services/tender-products.service";
import { sendTender } from "../src/server/services/tender-send.service";

const sendEmailMock = vi.mocked(sendEmail);
const PDF = Buffer.from("%PDF-1.4\n1 0 obj\n<<>>\nendobj\ntrailer\n<<>>\n%%EOF\n");

let clientId = "";
let productId = "";
let setupPdfPath = "";
const createdTenderIds: string[] = [];

async function readyTender(opts: { proposal?: boolean; deadline?: Date } = {}) {
  const tender = await createTender(
    {
      clientId,
      title: "Licitación send",
      maxBudget: 10000,
      deadline: opts.deadline ?? new Date(Date.now() + 86_400_000),
    },
    "test-actor",
  );
  createdTenderIds.push(tender.id);
  await addProduct(tender.id, productId, 1, "test-actor");
  if (opts.proposal !== false) {
    await db.tender.update({
      where: { id: tender.id },
      data: {
        proposalPath: setupPdfPath,
        proposalUrl: `https://example.supabase.co/storage/v1/object/public/${env.SUPABASE_BUCKET}/${setupPdfPath}`,
        proposalName: "propuesta.pdf",
        proposalSize: PDF.length,
      },
    });
  }
  return tender;
}

beforeAll(async () => {
  const client = await db.client.create({
    data: { name: "Cliente Send", email: `send-${Date.now()}@test.com` },
  });
  clientId = client.id;
  const product = await db.product.create({
    data: { name: "Prod Send", sku: `SEND-${Date.now()}`, basePrice: 100 },
  });
  productId = product.id;
  setupPdfPath = `tenders/setup/setup-${Date.now()}.pdf`;
  await uploadPdf(setupPdfPath, PDF);
});

afterAll(async () => {
  await supabase()
    .storage.from(env.SUPABASE_BUCKET)
    .remove([setupPdfPath]);
  await db.tender.deleteMany({ where: { clientId } });
  await db.product.delete({ where: { id: productId } }).catch(() => undefined);
  await db.client.delete({ where: { id: clientId } });
  await db.$disconnect();
});

beforeEach(() => {
  sendEmailMock.mockReset();
  sendEmailMock.mockResolvedValue("msg-test-123");
});

describe("sendTender (validaciones)", () => {
  it("MISSING_PROPOSAL (422) sin documento", async () => {
    const tender = await readyTender({ proposal: false });
    await expect(sendTender(tender.id, "test-actor")).rejects.toMatchObject({
      code: "MISSING_PROPOSAL",
      status: 422,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("DEADLINE_PASSED (422) con fecha límite vencida", async () => {
    const tender = await readyTender();
    await db.tender.update({
      where: { id: tender.id },
      data: { deadline: new Date(Date.now() - 60_000) },
    });
    await expect(sendTender(tender.id, "test-actor")).rejects.toMatchObject({
      code: "DEADLINE_PASSED",
      status: 422,
    });
    expect(sendEmailMock).not.toHaveBeenCalled();
  });

  it("VALIDATION (400) sin productos", async () => {
    const tender = await createTender(
      {
        clientId,
        title: "Sin productos",
        maxBudget: 5000,
        deadline: new Date(Date.now() + 86_400_000),
      },
      "test-actor",
    );
    createdTenderIds.push(tender.id);
    await db.tender.update({
      where: { id: tender.id },
      data: { proposalPath: setupPdfPath },
    });
    await expect(sendTender(tender.id, "test-actor")).rejects.toMatchObject({
      code: "VALIDATION",
      status: 400,
    });
  });

  it("INVALID_STATE (409) si no está en borrador", async () => {
    const tender = await readyTender();
    await db.tender.update({ where: { id: tender.id }, data: { status: "activa" } });
    await expect(sendTender(tender.id, "test-actor")).rejects.toMatchObject({
      code: "INVALID_STATE",
      status: 409,
    });
  });
});

describe("sendTender (flujo)", () => {
  it("envía con adjunto e idempotency key, transiciona a activa y registra EmailLog", async () => {
    const tender = await readyTender();
    const updated = await sendTender(tender.id, "test-actor");

    expect(updated.status).toBe("activa");
    expect(updated.sentAt).not.toBeNull();

    expect(sendEmailMock).toHaveBeenCalledTimes(1);
    const call = sendEmailMock.mock.calls[0][0];
    expect(call.idempotencyKey).toBe(`tender-${tender.id}-envio`);
    expect(call.attachments).toHaveLength(1);
    expect(call.attachments![0].filename).toMatch(/\.pdf$/);
    expect(call.html).toContain("Licitación send");

    const logs = await db.emailLog.findMany({ where: { tenderId: tender.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ type: "envio", status: "enviado", providerId: "msg-test-123" });

    const history = await db.tenderTransition.findMany({ where: { tenderId: tender.id } });
    expect(history.map((h) => h.toStatus)).toContain("activa");
    const last = history[history.length - 1];
    expect(last).toMatchObject({ fromStatus: "borrador", toStatus: "activa", reason: "envio" });
  });

  it("EMAIL_FAILED (502) sin transicionar y con EmailLog fallido", async () => {
    sendEmailMock.mockRejectedValueOnce(new Error("resend caído"));
    const tender = await readyTender();

    await expect(sendTender(tender.id, "test-actor")).rejects.toMatchObject({
      code: "EMAIL_FAILED",
      status: 502,
    });

    const after = await db.tender.findUnique({ where: { id: tender.id } });
    expect(after?.status).toBe("borrador");
    expect(after?.sentAt).toBeNull();

    const logs = await db.emailLog.findMany({ where: { tenderId: tender.id } });
    expect(logs).toHaveLength(1);
    expect(logs[0]).toMatchObject({ status: "fallido" });
    expect(logs[0].error).toContain("resend caído");

    const history = await db.tenderTransition.findMany({ where: { tenderId: tender.id } });
    expect(history.every((h) => h.toStatus !== "activa")).toBe(true);
  });

  it("doble envío concurrente: solo uno transiciona (409 para el otro)", async () => {
    const tender = await readyTender();
    const results = await Promise.allSettled([
      sendTender(tender.id, "test-actor"),
      sendTender(tender.id, "test-actor"),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({
      code: "INVALID_TRANSITION",
      status: 409,
    });

    const after = await db.tender.findUnique({ where: { id: tender.id } });
    expect(after?.status).toBe("activa");
    const logs = await db.emailLog.findMany({ where: { tenderId: tender.id } });
    expect(logs.filter((l) => l.status === "enviado")).toHaveLength(1);
    const history = await db.tenderTransition.findMany({
      where: { tenderId: tender.id, toStatus: "activa" },
    });
    expect(history).toHaveLength(1);
  });
});
