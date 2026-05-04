import type { Currency } from "../types";
import { formatCoins } from "../lib/format";
import { getBalance } from "../wallet/walletService";
import type { TableGameConfig } from "./types";
import { getCurrencyDisplayName } from "../config/currencyConfig";

export function TableBetControls({
  userId,
  config,
  currency,
  betAmount,
  disabled,
  maxPayoutPreview,
  onCurrencyChange,
  onBetChange,
}: {
  userId: string;
  config: TableGameConfig;
  currency: Currency;
  betAmount: number;
  disabled?: boolean;
  maxPayoutPreview?: number;
  onCurrencyChange: (currency: Currency) => void;
  onBetChange: (amount: number) => void;
}) {
  const balance = getBalance(userId, currency);
  const quickBets = [config.minBet, 25, 50, 100, config.maxBet].filter((value, index, values) => (
    value >= config.minBet && value <= config.maxBet && values.indexOf(value) === index
  ));

  function clamp(value: number) {
    return Math.max(config.minBet, Math.min(config.maxBet, Math.round(value)));
  }

  return (
    <article className="table-bet-panel">
      <div className="table-bet-top">
        <label>
          Currency
          <select value={currency} disabled={disabled} onChange={(event) => onCurrencyChange(event.target.value as Currency)}>
            <option value="GOLD">{getCurrencyDisplayName("GOLD")}</option>
            <option value="BONUS">{getCurrencyDisplayName("BONUS")}</option>
          </select>
        </label>
        <div className="table-balance-chip">
          <span>Balance</span>
          <strong>{formatCoins(balance)}</strong>
        </div>
      </div>
      <div className="table-bet-row">
        <button disabled={disabled} onClick={() => onBetChange(clamp(betAmount - config.minBet))}>-</button>
        <div>
          <span>Bet</span>
          <strong>{formatCoins(betAmount)}</strong>
        </div>
        <button disabled={disabled} onClick={() => onBetChange(clamp(betAmount + config.minBet))}>+</button>
      </div>
      <div className="table-quick-bets">
        {quickBets.map((bet) => (
          <button key={bet} className={betAmount === bet ? "active" : ""} disabled={disabled} onClick={() => onBetChange(bet)}>
            {formatCoins(bet)}
          </button>
        ))}
      </div>
      <div className={balance < betAmount ? "table-warning" : "table-note"}>
        {balance < betAmount
          ? "Insufficient virtual coin balance."
          : `Min ${formatCoins(config.minBet)} / Max ${formatCoins(config.maxBet)}${maxPayoutPreview ? ` / Max paid ${formatCoins(maxPayoutPreview)}` : ""}`}
      </div>
    </article>
  );
}
