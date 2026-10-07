export function toCents(value: string | number | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const raw = String(value).trim().replace(/[^\d.,-]/g, "");
  if (!raw) return 0;
  const negative = raw.startsWith("-");
  const text = negative ? raw.slice(1) : raw;
  const decimalPos = Math.max(text.lastIndexOf("."), text.lastIndexOf(","));
  const whole = (decimalPos >= 0 ? text.slice(0, decimalPos) : text).replace(/[.,]/g, "");
  const fraction = decimalPos >= 0 ? text.slice(decimalPos + 1) : "";
  const fractionCents = Math.round(Number(`0.${fraction || "0"}`) * 100);
  const cents = Number(whole || 0) * 100 + (Number.isFinite(fractionCents) ? fractionCents : 0);
  return negative ? -cents : cents;
}

export function addCents(base: number, unitCents: number, quantity: number): number {
  return base + unitCents * quantity;
}

export function centsToAmount(cents: number): number {
  return Number((cents / 100).toFixed(2));
}
