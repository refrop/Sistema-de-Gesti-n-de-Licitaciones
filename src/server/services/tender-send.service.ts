import { Prisma } from "@prisma/client";
import { db } from "../lib/db";
import { DomainError } from "../domain/errors";
import { sendEmail } from "../lib/email";
import { downloadFile } from "../lib/storage";
import { escapeHtml } from "../lib/html";
import { transition } from "./tender.service";

function money(value: Prisma.Decimal): string {
  return `S/ ${value.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

function buildSendHtml(tender: {
  title: string;
  description: string | null;
  maxBudget: Prisma.Decimal;
  deadline: Date;
  client: { name: string; email: string };
  products: { quantity: number; unitPrice: Prisma.Decimal; product: { name: string; sku: string } }[];
}): string {
  const rows = tender.products
    .map(
      (p) => `
      <tr>
        <td style="padding:6px 10px;border:1px solid #ddd;">${escapeHtml(p.product.name)} (${escapeHtml(p.product.sku)})</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${p.quantity}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${money(p.unitPrice)}</td>
        <td style="padding:6px 10px;border:1px solid #ddd;text-align:right;">${money(p.unitPrice.mul(p.quantity))}</td>
      </tr>`,
    )
    .join("");
  const total = tender.products.reduce(
    (sum, p) => sum.add(p.unitPrice.mul(p.quantity)),
    new Prisma.Decimal(0),
  );

  return `
  <div style="font-family:Arial,sans-serif;color:#222;">
    <h2>Licitación: ${escapeHtml(tender.title)}</h2>
    <p><strong>Cliente:</strong> ${escapeHtml(tender.client.name)} (${escapeHtml(tender.client.email)})</p>
    ${tender.description ? `<p>${escapeHtml(tender.description)}</p>` : ""}
    <table style="border-collapse:collapse;">
      <thead>
        <tr style="background:#f5f5f5;">
          <th style="padding:6px 10px;border:1px solid #ddd;text-align:left;">Producto</th>
          <th style="padding:6px 10px;border:1px solid #ddd;">Cant.</th>
          <th style="padding:6px 10px;border:1px solid #ddd;">P. unitario</th>
          <th style="padding:6px 10px;border:1px solid #ddd;">Subtotal</th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
    <p><strong>Total:</strong> ${money(total)}</p>
    <p><strong>Presupuesto máximo:</strong> ${money(tender.maxBudget)}</p>
    <p><strong>Fecha límite:</strong> ${formatDate(tender.deadline)}</p>
    <p>La propuesta completa se adjunta en este correo.</p>
  </div>`;
}

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
    throw new DomainError("EMAIL_FAILED", `No se pudo enviar el correo: ${message}`);
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
