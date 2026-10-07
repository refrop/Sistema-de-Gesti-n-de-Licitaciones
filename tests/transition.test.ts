import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/server/lib/db";
import { transition } from "../src/server/services/tender.service";

let clientId = "";
let demoTenderId = "";
const suffix = Date.now();

beforeAll(async () => {
  const client = await db.client.create({
    data: { name: "Cliente State Test", email: `state-${suffix}@test.com` },
  });
  clientId = client.id;
});

afterAll(async () => {
  await db.tender.deleteMany({ where: { clientId, id: { not: demoTenderId } } });
  await db.$disconnect();
});

async function newTender(title = "Licitación state test") {
  return db.tender.create({
    data: {
      clientId,
      title,
      maxBudget: 10000,
      deadline: new Date(Date.now() + 86_400_000),
    },
  });
}

describe("transition()", () => {
  it("transición válida cambia el estado y registra el historial", async () => {
    const tender = await newTender();
    const updated = await db.$transaction((tx) =>
      transition(tx, tender.id, "activa", null, "envio_prueba"),
    );
    expect(updated.status).toBe("activa");

    const history = await db.tenderTransition.findMany({
      where: { tenderId: tender.id },
    });
    expect(history).toHaveLength(1);
    expect(history[0]).toMatchObject({
      fromStatus: "borrador",
      toStatus: "activa",
      userId: null,
      reason: "envio_prueba",
    });
  });

  it("transición inválida lanza 409 INVALID_TRANSITION sin tocar nada", async () => {
    const tender = await newTender();
    await expect(
      db.$transaction((tx) => transition(tx, tender.id, "cobrada", null, "salto")),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });

    const after = await db.tender.findUnique({ where: { id: tender.id } });
    expect(after?.status).toBe("borrador");
    expect(
      await db.tenderTransition.count({ where: { tenderId: tender.id } }),
    ).toBe(0);
  });

  it("licitación inexistente lanza 404 NOT_FOUND", async () => {
    await expect(
      db.$transaction((tx) =>
        transition(tx, "00000000-0000-0000-0000-000000000000", "activa", null, "x"),
      ),
    ).rejects.toMatchObject({ code: "NOT_FOUND", status: 404 });
  });

  it("camino completo deja el historial ordenado", async () => {
    const tender = await newTender("Licitación camino completo");
    demoTenderId = tender.id;
    await db.$transaction((tx) => transition(tx, tender.id, "activa", null, "manual"));
    await db.$transaction((tx) =>
      transition(tx, tender.id, "finalizada", null, "manual"),
    );
    await db.$transaction((tx) =>
      transition(tx, tender.id, "por_cobrar", null, "facturada"),
    );

    const history = await db.tenderTransition.findMany({
      where: { tenderId: tender.id },
      orderBy: { createdAt: "asc" },
    });
    expect(history.map((h) => h.toStatus)).toEqual([
      "activa",
      "finalizada",
      "por_cobrar",
    ]);
    expect(history.map((h) => h.fromStatus)).toEqual([
      "borrador",
      "activa",
      "finalizada",
    ]);
    const final = await db.tender.findUnique({ where: { id: tender.id } });
    expect(final?.status).toBe("por_cobrar");
  });

  it("los estados finales rechazan cualquier transición", async () => {
    const tender = await newTender("Licitación ya cobrada");
    await db.tender.update({ where: { id: tender.id }, data: { status: "cobrada" } });
    await expect(
      db.$transaction((tx) => transition(tx, tender.id, "activa", null, "reabrir")),
    ).rejects.toMatchObject({ code: "INVALID_TRANSITION", status: 409 });
  });
});
