import { formatCoins } from "../lib/format";
import type { Currency } from "../types";

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

function formatCompactCoins(amount: number) {
  const abs = Math.abs(amount);
  const sign = amount < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${trimCompact(abs / 1_000_000)}M`;
  if (abs >= 1_000) return `${sign}${trimCompact(abs / 1_000)}K`;
  return formatCoins(amount);
}

function trimCompact(value: number) {
  return value >= 100 ? Math.round(value).toString() : value.toFixed(value >= 10 ? 1 : 2).replace(/\.?0+$/, "");
}

export function BalanceToggle({
  balances,
  selected,
  expanded,
  onSelect,
  onToggleExpanded,
}: {
  balances: Record<Currency, number>;
  selected: Currency;
  expanded: boolean;
  onSelect: (currency: Currency) => void;
  onToggleExpanded: () => void;
}) {
  function clickCurrency(currency: Currency) {
    if (currency === selected) onToggleExpanded();
    else onSelect(currency);
  }

  function optionText(currency: Currency) {
    const label = currency === "GOLD" ? "GC" : "BC";
    if (currency !== selected) return label;
    return `${label} ${expanded ? formatCoins(balances[currency]) : formatCompactCoins(balances[currency])}`;
  }

  return (
    <div className={`balance-toggle ${selected === "GOLD" ? "gold-selected" : "bonus-selected"}${expanded ? " expanded" : ""}`}>
      <div className="balance-toggle-options" role="tablist" aria-label="Virtual coin balance">
        <button
          type="button"
          className={selected === "GOLD" ? "active gold" : "gold"}
          title={`Gold Coins: ${formatCoins(balances.GOLD)}`}
          aria-pressed={selected === "GOLD"}
          onClick={() => clickCurrency("GOLD")}
        >
          <strong>{optionText("GOLD")}</strong>
        </button>
        <button
          type="button"
          className={selected === "BONUS" ? "active bonus" : "bonus"}
          title={`Bonus Coins: ${formatCoins(balances.BONUS)}`}
          aria-pressed={selected === "BONUS"}
          onClick={() => clickCurrency("BONUS")}
        >
          <strong>{optionText("BONUS")}</strong>
        </button>
      </div>
    </div>
  );
}
