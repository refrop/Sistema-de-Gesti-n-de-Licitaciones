import type { TenderStatus } from "@prisma/client";

export type { TenderStatus };

export const TRANSITIONS: Record<TenderStatus, readonly TenderStatus[]> = {
  borrador: ["activa"],
  activa: ["finalizada", "perdida"],
  finalizada: ["por_cobrar"],
  por_cobrar: ["cobrada"],
  cobrada: [],
  perdida: [],
};

export const PRODUCT_EDITABLE: readonly TenderStatus[] = ["borrador", "activa"];

export function canTransition(from: TenderStatus, to: TenderStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function isProductEditable(status: TenderStatus): boolean {
  return PRODUCT_EDITABLE.includes(status);
}
