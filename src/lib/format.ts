export function formatCoins(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: amount > 0 && amount < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export type CurrencyDisplayCode = "GC" | "SC" | "GOLD" | "BONUS";

export function formatCurrencyDisplay(amount: number, currency?: CurrencyDisplayCode) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const abs = Math.abs(safeAmount);
  const sign = safeAmount < 0 ? "-" : "";

  if (abs >= 1_000_000_000) return `${sign}${trimCurrencyCompact(abs / 1_000_000_000)}B`;
  if (abs >= 1_000_000) return `${sign}${trimCurrencyCompact(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trimCurrencyCompact(abs / 1_000)}K`;

  return formatCurrencyExact(safeAmount, currency);
}

export function formatCurrencyDisplayWithCode(amount: number, currency: CurrencyDisplayCode) {
  return `${formatCurrencyDisplay(amount, currency)} ${currency === "BONUS" ? "SC" : currency === "GOLD" ? "GC" : currency}`;
}

export function formatCurrencyFullDisplay(amount: number, currency?: CurrencyDisplayCode) {
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return formatCurrencyExact(safeAmount, currency);
}

export function getCurrencyAmountFitClass(displayValue: string) {
  const length = displayValue.length;
  if (length >= 17) return "currency-fit-xlong";
  if (length >= 14) return "currency-fit-long";
  if (length >= 11) return "currency-fit-medium";
  return "currency-fit-default";
}

function formatCurrencyExact(amount: number, currency?: CurrencyDisplayCode) {
  const maxDecimals = currency === "GC" || currency === "GOLD" ? 2 : 2;
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: amount > 0 && amount < 1 ? 2 : 0,
    maximumFractionDigits: maxDecimals,
  }).format(amount);
}

function trimCurrencyCompact(value: number) {
  if (value >= 100) return formatCompactDecimal(value, 1);
  if (value >= 10) return formatCompactDecimal(value, 2);
  return formatCompactDecimal(value, 2);
}

function formatCompactDecimal(value: number, maxDecimals: number) {
  let rounded = Number(value.toFixed(maxDecimals));
  if (rounded >= 1000) {
    const factor = 10 ** maxDecimals;
    rounded = Math.floor(value * factor) / factor;
  }
  const fixed = rounded.toFixed(maxDecimals);
  return fixed.replace(/(\.\d*?[1-9])0+$/, "$1").replace(/\.0+$/, "");
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
