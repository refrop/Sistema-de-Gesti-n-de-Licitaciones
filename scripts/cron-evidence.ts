import { db } from "../src/server/lib/db";
import { createTender } from "../src/server/services/tenders.service";
import { addProduct } from "../src/server/services/tender-products.service";

// Crea las dos licitaciones de evidencia del cron (fase 7):
//   A: activa con deadline +3 min  → el tick la pasa a perdida
//   B: activa con deadline +47 h   → el tick le envía el recordatorio real
// Uso: node --env-file=.env --import tsx scripts/cron-evidence.ts

async function main() {
  const admin = await db.user.findUnique({ where: { email: "admin@example.com" } });
  if (!admin) throw new Error("Falta el admin (ejecuta el seed)");

  const targetEmail = process.env.SEED_CLIENT_EMAIL?.trim();
  if (!targetEmail) throw new Error("Define SEED_CLIENT_EMAIL en .env (correo del cliente de evidencia)");
  const existingClient = await db.client.findFirst({ where: { email: targetEmail } });
  const client = existingClient ?? (await db.client.create({
    data: { name: "Cliente Evidencia", email: targetEmail, createdById: admin.id, updatedById: admin.id },
  }));

  const product = await db.product.upsert({
    where: { sku: "EVIDENCIA-001" },
    update: {},
    create: { name: "Servicio de evidencia", sku: "EVIDENCIA-001", basePrice: 1500, createdById: admin.id, updatedById: admin.id },
  });

  const created: Record<string, string> = {};

  const a = await createTender(
    {
      clientId: client.id,
      title: "Evidencia cron A - vencimiento",
      maxBudget: 5000,
      deadline: new Date(Date.now() + 3 * 60_000),
    },
    admin.id,
  );
  await addProduct(a.id, product.id, 1, admin.id);
  await db.tender.update({ where: { id: a.id }, data: { status: "activa" } });
  created.A = a.id;

  const b = await createTender(
    {
      clientId: client.id,
      title: "Evidencia cron B - recordatorio",
      maxBudget: 5000,
      deadline: new Date(Date.now() + 47 * 3_600_000),
    },
    admin.id,
  );
  await addProduct(b.id, product.id, 1, admin.id);
  await db.tender.update({ where: { id: b.id }, data: { status: "activa" } });
  created.B = b.id;

  console.log(JSON.stringify(created, null, 2));
}

main()
  .catch((err) => {
    console.error("FALLÓ:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
