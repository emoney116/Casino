import { CirclePlay, Minus, Plus } from "lucide-react";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";

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
  function setBet(value: number) {
    const fallback = betLimits.minBet;
    const raw = Number.isFinite(value) ? value : fallback;
    const rounded = currency === "BONUS" ? Math.round(raw * 100) / 100 : Math.round(raw);
    onBetChange(Math.max(betLimits.minBet, Math.min(betLimits.maxBet, rounded)));
  }

  function multiplyBet(multiplier: number) {
    setBet(betAmount * multiplier);
  }

  const step = currency === "BONUS" ? 0.01 : 5;
  const shouldShowDouble = showDouble ?? canDouble;
  const shouldShowSplit = showSplit ?? canSplit;

  if (active) {
    return (
      <section className="blackjack-clean-controls">
        <div className="blackjack-clean-bank">
          <span>{currencyCopy[currency].short} Balance: {formatCoins(balance)}</span>
          <strong>Bet: {formatCoins(betAmount)}</strong>
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
      <div className="blackjack-clean-bank">
        <span>{currencyCopy[currency].short} Balance: {formatCoins(balance)}</span>
        <strong>Bet: {formatCoins(betAmount)}</strong>
      </div>
      <div className="blackjack-clean-bet-row">
        <button type="button" aria-label="Decrease bet" disabled={disabled} onClick={() => setBet(betAmount - step)}><Minus size={18} /></button>
        <label>
          <span>Bet</span>
          <input
            inputMode={currency === "BONUS" ? "decimal" : "numeric"}
            type="number"
            min={betLimits.minBet}
            max={betLimits.maxBet}
            step={currency === "BONUS" ? "0.01" : "1"}
            value={betAmount}
            disabled={disabled}
            onChange={(event) => setBet(Number(event.target.value))}
          />
        </label>
        <button type="button" aria-label="Increase bet" disabled={disabled} onClick={() => setBet(betAmount + step)}><Plus size={18} /></button>
      </div>
      <div className={dealNoticeTone === "warning" ? "blackjack-clean-note warning" : "blackjack-clean-note"}>
        {dealNotice ? (
          <span>{dealNotice}</span>
        ) : (
          <>
            <span>Min {currencyCopy[currency].short}: {formatCoins(betLimits.minBet)}</span>
            <strong>Max {currencyCopy[currency].short}: {formatCoins(betLimits.maxBet)}</strong>
          </>
        )}
      </div>
      <div className="blackjack-clean-deal-row">
        <button type="button" aria-label="Halve bet" disabled={disabled} onClick={() => multiplyBet(0.5)}>1/2</button>
        <button className="blackjack-clean-deal" disabled={!canDeal || disabled} onClick={onDeal}>
          <CirclePlay size={17} /> <span>Deal</span>
        </button>
        <button type="button" aria-label="Double bet" disabled={disabled} onClick={() => multiplyBet(2)}>2x</button>
      </div>
    </section>
  );
}
