import { db } from "../src/server/lib/db";
import { env } from "../src/server/lib/env";
import { supabase, uploadPdf } from "../src/server/lib/storage";
import { createTender } from "../src/server/services/tenders.service";
import { addProduct } from "../src/server/services/tender-products.service";
import { createUploadUrl, confirmUpload } from "../src/server/services/proposal.service";
import { sendTender } from "../src/server/services/tender-send.service";

const PDF = Buffer.from(
  "%PDF-1.4\n1 0 obj\n<< /Type /Catalog >>\nendobj\ntrailer\n<< >>\n%%EOF\n",
);

async function main() {
  const admin = await db.user.findUnique({ where: { email: "admin@example.com" } });
  if (!admin) throw new Error("Falta el admin (ejecuta el seed)");

  const targetEmail = process.env.SEED_CLIENT_EMAIL?.trim();
  if (!targetEmail) throw new Error("Define SEED_CLIENT_EMAIL en .env (correo del cliente de evidencia)");
  const existingClient = await db.client.findFirst({ where: { email: targetEmail } });
  const client = existingClient
    ? await db.client.update({ where: { id: existingClient.id }, data: { name: "Cliente Evidencia" } })
    : await db.client.create({
        data: { name: "Cliente Evidencia", email: targetEmail, createdById: admin.id, updatedById: admin.id },
      });

  const product = await db.product.upsert({
    where: { sku: "EVIDENCIA-001" },
    update: { basePrice: 1500 },
    create: { name: "Servicio de evidencia", sku: "EVIDENCIA-001", basePrice: 1500, createdById: admin.id, updatedById: admin.id },
  });

  const tender = await createTender(
    {
      clientId: client.id,
      title: "Evidencia Fase 5 - envío con adjunto",
      description: "Licitación generada para evidenciar el correo real con PDF.",
      maxBudget: 5000,
      deadline: new Date(Date.now() + 7 * 86_400_000),
    },
    admin.id,
  );
  console.log("licitación creada:", tender.id);

  await addProduct(tender.id, product.id, 2, admin.id);

  const signed = await createUploadUrl(tender.id, {
    fileName: "Propuesta Evidencia Fase 5.pdf",
    size: PDF.length,
    contentType: "application/pdf",
  });
  const { error } = await supabase()
    .storage.from(env.SUPABASE_BUCKET)
    .uploadToSignedUrl(signed.path, signed.token, PDF, { contentType: "application/pdf" });
  if (error) throw new Error(`upload falló: ${error.message}`);
  await confirmUpload(tender.id, signed.path, admin.id);
  console.log("propuesta confirmada:", signed.path);

  const updated = await sendTender(tender.id, admin.id);
  console.log("estado tras envío:", updated.status, "| sentAt:", updated.sentAt);

  const logs = await db.emailLog.findMany({ where: { tenderId: tender.id } });
  console.log("EmailLog:", JSON.stringify(logs, null, 2));

  const history = await db.tenderTransition.findMany({ where: { tenderId: tender.id } });
  console.log("historial:", history.map((h) => `${h.fromStatus} → ${h.toStatus} (${h.reason})`).join(" | "));
}

main()
  .catch((err) => {
    console.error("FALLÓ:", err);
    process.exitCode = 1;
  })
  .finally(() => db.$disconnect());
