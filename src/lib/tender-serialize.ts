import { TENDER_STATUSES, type TenderStatusValue } from "@/lib/tender-status";

type DecimalLike = { toString(): string };
type DateLike = Date | string | number | null | undefined;

export type TenderLike = {
  id: string;
  clientId?: string;
  title: string;
  description?: string | null;
  status: string;
  maxBudget: DecimalLike;
  deadline: DateLike;
  createdAt: DateLike;
  updatedAt: DateLike;
  sentAt?: DateLike;
  invoicedAt?: DateLike;
  reminderSentAt?: DateLike;
  invoicedAmount?: DecimalLike | null;
  proposalPath?: string | null;
  proposalUrl?: string | null;
  proposalName?: string | null;
  proposalSize?: number | null;
  client: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    taxId?: string | null;
    contactName?: string | null;
  };
  products: Array<{
    id: string;
    productId: string;
    quantity: number;
    unitPrice: DecimalLike;
    subtotal: DecimalLike;
    product: { id: string; name: string; sku: string; basePrice: DecimalLike };
  }>;
  totalProducts: DecimalLike;
  paidTotal: DecimalLike;
  balance?: DecimalLike | null;
  payments: Array<{
    id: string;
    amount: DecimalLike;
    paidAt: DateLike;
    note?: string | null;
  }>;
  transitions: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    userId: string | null;
    reason: string | null;
    createdAt: DateLike;
  }>;
  emails: Array<{
    id: string;
    type: string;
    toEmail: string;
    providerId: string | null;
    status: string;
    error: string | null;
    createdAt: DateLike;
  }>;
};

export type SerializedTender = {
  id: string;
  title: string;
  description: string | null;
  status: TenderStatusValue;
  maxBudget: string;
  deadline: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  sentAt: string | null;
  invoicedAt: string | null;
  reminderSentAt: string | null;
  invoicedAmount: string | null;
  proposal: { url: string; name: string; size: number } | null;
  client: {
    id: string;
    name: string;
    email: string;
    phone: string | null;
    taxId: string | null;
    contactName: string | null;
  };
  products: Array<{
    id: string;
    productId: string;
    name: string;
    sku: string;
    quantity: number;
    unitPrice: string;
    subtotal: string;
  }>;
  totalProducts: string;
  paidTotal: string;
  balance: string | null;
  payments: Array<{ id: string; amount: string; paidAt: string | null; note: string | null }>;
  transitions: Array<{
    id: string;
    fromStatus: string | null;
    toStatus: string;
    userId: string | null;
    reason: string | null;
    createdAt: string | null;
  }>;
  emails: Array<{
    id: string;
    type: string;
    toEmail: string;
    providerId: string | null;
    status: string;
    error: string | null;
    createdAt: string | null;
  }>;
};

function money(value: DecimalLike | null | undefined): string {
  if (value === null || value === undefined) return "";
  return String(value);
}

function iso(value: DateLike): string | null {
  if (value === null || value === undefined || value === "") return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function status(value: string): TenderStatusValue {
  return (TENDER_STATUSES as readonly string[]).includes(value)
    ? (value as TenderStatusValue)
    : "borrador";
}

export function serializeTender(input: TenderLike): SerializedTender {
  return {
    id: input.id,
    title: input.title,
    description: input.description ?? null,
    status: status(input.status),
    maxBudget: money(input.maxBudget),
    deadline: iso(input.deadline),
    createdAt: iso(input.createdAt),
    updatedAt: iso(input.updatedAt),
    sentAt: iso(input.sentAt),
    invoicedAt: iso(input.invoicedAt),
    reminderSentAt: iso(input.reminderSentAt),
    invoicedAmount: input.invoicedAmount == null ? null : money(input.invoicedAmount),
    proposal:
      input.proposalUrl && input.proposalName
        ? {
            url: input.proposalUrl,
            name: input.proposalName,
            size: input.proposalSize ?? 0,
          }
        : null,
    client: {
      id: input.client.id,
      name: input.client.name,
      email: input.client.email,
      phone: input.client.phone ?? null,
      taxId: input.client.taxId ?? null,
      contactName: input.client.contactName ?? null,
    },
    products: input.products.map((line) => ({
      id: line.id,
      productId: line.productId,
      name: line.product.name,
      sku: line.product.sku,
      quantity: line.quantity,
      unitPrice: money(line.unitPrice),
      subtotal: money(line.subtotal),
    })),
    totalProducts: money(input.totalProducts),
    paidTotal: money(input.paidTotal),
    balance: input.balance === null || input.balance === undefined ? null : money(input.balance),
    payments: input.payments.map((payment) => ({
      id: payment.id,
      amount: money(payment.amount),
      paidAt: iso(payment.paidAt),
      note: payment.note ?? null,
    })),
    transitions: input.transitions.map((row) => ({
      id: row.id,
      fromStatus: row.fromStatus,
      toStatus: row.toStatus,
      userId: row.userId,
      reason: row.reason,
      createdAt: iso(row.createdAt),
    })),
    emails: input.emails.map((row) => ({
      id: row.id,
      type: row.type,
      toEmail: row.toEmail,
      providerId: row.providerId,
      status: row.status,
      error: row.error,
      createdAt: iso(row.createdAt),
    })),
  };
}
