import { formatCoins, formatCurrencyDisplay, formatCurrencyDisplayWithCode } from "../lib/format";
import type { Currency } from "../types";
import { getCurrencyBrandedDisplayName, getCurrencyMeta, getCurrencyShortName } from "../config/currencyConfig";

export function BalanceCard({
  label,
  amount,
  tone,
  currency,
}: {
  label: string;
  amount: number;
  tone: "gold" | "bonus";
  currency?: Currency;
}) {
  const meta = currency ? getCurrencyMeta(currency) : null;
  return (
    <article className={`balance-card ${tone}`}>
      <span>{label}</span>
      <strong title={formatCoins(amount)}>{formatCurrencyDisplay(amount, currency)}</strong>
      <small>{meta?.displayDisclaimer ?? "Gold Coins have no cash value."}</small>
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
      <strong title={formatCoins(amount)}>{formatCurrencyDisplay(amount)}</strong>
    </div>
  );
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
    if (currency !== selected) return getCurrencyShortName(currency);
    return formatCurrencyDisplayWithCode(balances[currency], currency);
  }

  return (
    <div className={`balance-toggle ${selected === "GOLD" ? "gold-selected" : "bonus-selected"}${expanded ? " expanded" : ""}`}>
      <div className="balance-toggle-options" role="tablist" aria-label="Virtual coin balance">
        <button
          type="button"
          className={selected === "GOLD" ? "active gold" : "gold"}
          title={`${getCurrencyBrandedDisplayName("GOLD")}: ${formatCoins(balances.GOLD)}`}
          aria-pressed={selected === "GOLD"}
          onClick={() => clickCurrency("GOLD")}
        >
          <strong>{optionText("GOLD")}</strong>
        </button>
        <button
          type="button"
          className={selected === "BONUS" ? "active bonus" : "bonus"}
          title={`${getCurrencyBrandedDisplayName("BONUS")}: ${formatCoins(balances.BONUS)}`}
          aria-pressed={selected === "BONUS"}
          onClick={() => clickCurrency("BONUS")}
        >
          <strong>{optionText("BONUS")}</strong>
        </button>
      </div>
    </div>
  );
}
