import { CirclePlay } from "lucide-react";
import { getDisplayBalance } from "../lib/displayBalanceStress";
import { formatCoins, formatCurrencyDisplay } from "../lib/format";
import type { Currency } from "../types";
import { BetControls } from "./BetControls";

const currencyCopy: Record<Currency, { short: string }> = {
  GOLD: { short: "GC" },
  BONUS: { short: "SC" },
};

type BetLimits = { minBet: number; maxBet: number };

export function BlackjackControlsClean({
  active,
  balance,
  betAmount,
  canDeal,
  canDouble,
  canSplit,
  currency,
  betLimits,
  dealNotice,
  dealNoticeTone = "default",
  actionNotice,
  showDouble,
  showSplit,
  doubleBlockedReason,
  splitBlockedReason,
  disabled,
  onBetChange,
  onDeal,
  onHit,
  onStand,
  onDouble,
  onSplit,
}: {
  active: boolean;
  balance: number;
  betAmount: number;
  canDeal: boolean;
  canDouble: boolean;
  canSplit: boolean;
  currency: Currency;
  betLimits: BetLimits;
  dealNotice?: string;
  dealNoticeTone?: "default" | "warning";
  actionNotice?: string;
  showDouble?: boolean;
  showSplit?: boolean;
  doubleBlockedReason?: string;
  splitBlockedReason?: string;
  disabled?: boolean;
  onBetChange: (amount: number) => void;
  onDeal: () => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
}) {
  const step = currency === "BONUS" ? 0.01 : 5;
  const shouldShowDouble = showDouble ?? canDouble;
  const shouldShowSplit = showSplit ?? canSplit;
  const displayBalance = getDisplayBalance(balance, currency);

  if (active) {
    return (
      <section className="blackjack-clean-controls">
        <div className="blackjack-clean-bank">
          <span title={`${currencyCopy[currency].short} Balance: ${formatCoins(balance)}`}>{currencyCopy[currency].short} Balance: {formatCurrencyDisplay(displayBalance, currency)}</span>
          <strong title={`Bet: ${formatCoins(betAmount)}`}>Bet: {formatCurrencyDisplay(betAmount, currency)}</strong>
        </div>
        <div className="blackjack-clean-actions">
          <button disabled={disabled} onClick={onHit}><span>Hit</span></button>
          <button disabled={disabled} onClick={onStand}><span>Stand</span></button>
          {shouldShowDouble && (
            <button
              disabled={disabled || !canDouble}
              aria-label={!canDouble && doubleBlockedReason ? `Double unavailable. ${doubleBlockedReason}` : "Double"}
              title={!canDouble ? doubleBlockedReason : undefined}
              onClick={onDouble}
            >
              <span>Double</span>
            </button>
          )}
          {shouldShowSplit && (
            <button
              disabled={disabled || !canSplit}
              aria-label={!canSplit && splitBlockedReason ? `Split unavailable. ${splitBlockedReason}` : "Split"}
              title={!canSplit ? splitBlockedReason : undefined}
              onClick={onSplit}
            >
              <span>Split</span>
            </button>
          )}
        </div>
        {actionNotice && <div className="blackjack-clean-note warning compact"><span>{actionNotice}</span></div>}
      </section>
    );
  }

  return (
    <section className="blackjack-clean-controls">
      <BetControls
        currentBet={betAmount}
        minBet={betLimits.minBet}
        maxBet={betLimits.maxBet}
        balance={balance}
        currency={currency}
        increment={step}
        allowDecimals={currency === "BONUS"}
        disabled={disabled}
        notice={dealNotice}
        noticeTone={dealNoticeTone}
        onBetChange={onBetChange}
      />
      <div className="blackjack-clean-deal-row single">
        <button className="blackjack-clean-deal" disabled={!canDeal || disabled} onClick={onDeal}>
          <CirclePlay size={17} /> <span>Deal</span>
        </button>
      </div>
    </section>
  );
}
