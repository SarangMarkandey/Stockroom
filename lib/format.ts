const currency = new Intl.NumberFormat("en-IN", {
  style: "currency", currency: "INR", minimumFractionDigits: 2, maximumFractionDigits: 2,
});
const numerals = new Intl.NumberFormat("en-IN");
const dates = new Intl.DateTimeFormat("en-IN", {
  day: "2-digit", month: "short", year: "numeric", timeZone: "Asia/Kolkata",
});
const shortDates = new Intl.DateTimeFormat("en-IN", {
  day: "numeric", month: "short", timeZone: "Asia/Kolkata",
});
const time = new Intl.DateTimeFormat("en-IN", {
  hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata",
});
const day = new Intl.DateTimeFormat("en-CA", {
  day: "2-digit", month: "2-digit", year: "numeric", timeZone: "Asia/Kolkata",
});

export const money = (paise: number) => currency.format(paise / 100);
export const number = (value: number) => numerals.format(value);
export const date = (iso: string) => dates.format(new Date(iso));
export const shortDate = (iso: string) => shortDates.format(new Date(iso));
export const clock = (iso: string) => time.format(new Date(iso));
export const dayKey = (iso: string) => day.format(new Date(iso));
export const signed = (quantity: number) => `${quantity > 0 ? "+" : "−"}${number(Math.abs(quantity))}`;

export function parsePaise(raw: string) {
  const match = /^(\d+)(?:\.(\d{1,2}))?$/.exec(raw.trim());
  if (!match) return NaN;
  return Number(match[1]) * 100 + Number((match[2] ?? "").padEnd(2, "0"));
}

export function parseQuantity(raw: string) {
  return /^\d+$/.test(raw.trim()) ? Number(raw) : NaN;
}
