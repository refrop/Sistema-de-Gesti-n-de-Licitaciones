import { Prisma } from "@prisma/client";
import { escapeHtml } from "./html";

function money(value: Prisma.Decimal): string {
  return `$${value.toFixed(2)}`;
}

function formatDate(date: Date): string {
  return `${date.toISOString().replace("T", " ").slice(0, 19)} UTC`;
}

export type MailProduct = {
  quantity: number;
  unitPrice: Prisma.Decimal;
  product: { name: string; sku: string };
};

export type MailTender = {
  title: string;
  description: string | null;
  maxBudget: Prisma.Decimal;
  deadline: Date;
  client: { name: string; email: string };
  products: MailProduct[];
};

function totalOf(products: MailProduct[]): Prisma.Decimal {
  return products.reduce((sum, p) => sum.add(p.unitPrice.mul(p.quantity)), new Prisma.Decimal(0));
}

function rowsHtml(products: MailProduct[]): string {
  return products
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
}

function summaryHtml(tender: MailTender): string {
  return `
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
      <tbody>${rowsHtml(tender.products)}</tbody>
    </table>
    <p><strong>Total:</strong> ${money(totalOf(tender.products))}</p>
    <p><strong>Presupuesto máximo:</strong> ${money(tender.maxBudget)}</p>
    <p><strong>Fecha límite:</strong> ${formatDate(tender.deadline)}</p>`;
}

export function buildSendHtml(tender: MailTender): string {
  return `
  <div style="font-family:Arial,sans-serif;color:#222;">
    <h2>Licitación: ${escapeHtml(tender.title)}</h2>
    ${summaryHtml(tender)}
    <p>La propuesta completa se adjunta en este correo.</p>
  </div>`;
}

export function buildReminderHtml(tender: MailTender, hoursLeft: number): string {
  return `
  <div style="font-family:Arial,sans-serif;color:#222;">
    <h2>Recordatorio: la licitación vence pronto</h2>
    <p style="background:#fff3cd;border:1px solid #ffe69c;padding:10px;">
      <strong>La licitación "${escapeHtml(tender.title)}" vence en aproximadamente ${hoursLeft} hora${hoursLeft === 1 ? "" : "s"}.</strong>
    </p>
    <h3>${escapeHtml(tender.title)}</h3>
    ${summaryHtml(tender)}
  </div>`;
}
