// Display formatters. Null-safe.

const usd0 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});
const usd2 = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 2,
});
const int = new Intl.NumberFormat("en-US");

export function money(v: number | null | undefined, cents = false): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return cents ? usd2.format(v) : usd0.format(v);
}

export function count(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return int.format(v);
}

export function pct(v: number | null | undefined, fromFraction = true): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  const n = fromFraction ? v * 100 : v;
  return `${n.toFixed(1)}%`;
}

export function num1(v: number | null | undefined): string {
  if (v === null || v === undefined || Number.isNaN(v)) return "—";
  return v.toFixed(1);
}

export function text(v: string | null | undefined): string {
  return v && v.length ? v : "—";
}
