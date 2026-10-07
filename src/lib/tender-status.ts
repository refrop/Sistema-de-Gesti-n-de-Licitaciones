export const TENDER_STATUSES = [
  "borrador",
  "activa",
  "finalizada",
  "por_cobrar",
  "cobrada",
  "perdida",
] as const;

export type TenderStatusValue = (typeof TENDER_STATUSES)[number];

export const TENDER_STATUS_LABELS: Record<TenderStatusValue, string> = {
  borrador: "Borrador",
  activa: "Activa",
  finalizada: "Finalizada",
  por_cobrar: "Por cobrar",
  cobrada: "Cobrada",
  perdida: "Perdida",
};

export function isTenderStatus(value: string | undefined): value is TenderStatusValue {
  return Boolean(value) && (TENDER_STATUSES as readonly string[]).includes(value as string);
}
