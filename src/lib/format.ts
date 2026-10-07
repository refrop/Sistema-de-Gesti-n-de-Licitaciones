const moneyFmt = new Intl.NumberFormat("es-PE", { style: "currency", currency: "PEN" });
const dateFmt = new Intl.DateTimeFormat("es-PE", {
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  timeZoneName: "short",
});
const dayFmt = new Intl.DateTimeFormat("es-PE", { year: "numeric", month: "short", day: "2-digit" });

export function formatMoney(value: number | string): string {
  const n = typeof value === "string" ? Number(value) : value;
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
