import { db } from "../lib/db";
import { env } from "../lib/env";
import { DomainError } from "../domain/errors";
import { sendEmail } from "../lib/email";
import { downloadFile } from "../lib/storage";
import { buildSendHtml } from "../lib/mail-templates";
import { transition } from "./tender.service";

export async function sendTender(tenderId: string, userId: string) {
  const tender = await db.tender.findUnique({
    where: { id: tenderId },
    include: { client: true, products: { include: { product: true } } },
  });
  if (!tender) throw new DomainError("NOT_FOUND", "Licitación no encontrada");
  if (tender.status !== "borrador") {
    throw new DomainError(
      "INVALID_STATE",
      `Solo se puede enviar desde borrador (estado actual: ${tender.status})`,
    );
  }
  if (!tender.proposalPath) {
    throw new DomainError("MISSING_PROPOSAL", "Falta el documento de propuesta");
  }
  if (tender.deadline.getTime() <= Date.now()) {
    throw new DomainError("DEADLINE_PASSED", "La fecha límite ya pasó");
  }
  if (tender.products.length === 0) {
    throw new DomainError("VALIDATION", "Debe incluir al menos un producto");
  }

  const pdf = await downloadFile(tender.proposalPath);
  const attachmentName = tender.proposalName ?? tender.proposalPath.split("/").pop() ?? "propuesta.pdf";
  const html = buildSendHtml(tender);

  let providerId: string;
  try {
    providerId = await sendEmail({
      to: tender.client.email,
      subject: `Licitación: ${tender.title}`,
      html,
      attachments: [{ filename: attachmentName, content: pdf }],
      idempotencyKey: `tender-${tenderId}-envio`,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await db.emailLog.create({
      data: {
        tenderId,
        type: "envio",
        toEmail: tender.client.email,
        status: "fallido",
        error: message.slice(0, 1000),
      },
    });
    // Solo con Resend (sin dominio verificado) el fallo suele ser de dominio:
    // el hint viaja en el mensaje para que el toast del cliente lo muestre
    // únicamente cuando el proveedor activo es Resend.
    const hint =
      env.EMAIL_PROVIDER === "resend"
        ? " (el remitente sin dominio verificado solo puede entregar al titular de la cuenta)"
        : "";
    throw new DomainError("EMAIL_FAILED", `No se pudo enviar el correo: ${message}${hint}`);
  }

  // transition() re-verifica el estado bajo FOR UPDATE: si otra petición
  // ya transicionó (doble clic), lanza 409 y esta transacción se revierte.
  return db.$transaction(async (tx) => {
    const updated = await transition(tx, tenderId, "activa", userId, "envio", {
      sentAt: new Date(),
    });
    await tx.emailLog.create({
      data: {
        tenderId,
        type: "envio",
        toEmail: tender.client.email,
        providerId,
        status: "enviado",
      },
    });
    return updated;
  });
}
