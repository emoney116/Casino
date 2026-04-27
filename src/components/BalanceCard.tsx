import { formatCoins } from "../lib/format";

export function BalanceCard({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "gold" | "bonus";
}) {
  return (
    <article className={`balance-card ${tone}`}>
      <span>{label}</span>
      <strong>{formatCoins(amount)}</strong>
      <small>No cash value</small>
    </article>
  );
}

export function BalancePill({
  label,
  amount,
  tone,
}: {
  label: string;
  amount: number;
  tone: "gold" | "bonus";
}) {
  return (
    <div className={`balance-pill ${tone}`}>
      <span>{label}</span>
      <strong>{formatCoins(amount)}</strong>
    </div>
  );
}
