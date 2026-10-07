export const APP_TIME_ZONE = "America/Lima";

const moneyFmt = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const dateFmt = new Intl.DateTimeFormat("es-PE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
  timeZone: APP_TIME_ZONE,
});
const dayFmt = new Intl.DateTimeFormat("es-PE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  timeZone: APP_TIME_ZONE,
});

export function formatMoney(value: number | string | { toString(): string }): string {
  const n = Number(typeof value === "object" ? value.toString() : value);
  return moneyFmt.format(Number.isFinite(n) ? n : 0);
}

export function formatDateTime(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dateFmt.format(date);
}

export function formatDate(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "—";
  return dayFmt.format(date);
}

export function hoursUntil(value: string | Date): number {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return Number.POSITIVE_INFINITY;
  return (date.getTime() - Date.now()) / 3_600_000;
}

export function toDateTimeLocalValue(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  if (Number.isNaN(date.getTime())) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: APP_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";
  const hour = get("hour") === "24" ? "00" : get("hour");
  return `${get("year")}-${get("month")}-${get("day")}T${hour}:${get("minute")}`;
}
