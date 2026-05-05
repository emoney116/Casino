export function formatCoins(amount: number) {
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: amount > 0 && amount < 1 ? 2 : 0,
    maximumFractionDigits: 2,
  }).format(amount);
}

export function formatDateTime(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}
