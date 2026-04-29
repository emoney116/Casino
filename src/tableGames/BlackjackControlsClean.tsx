import type { Currency } from "../types";
import { blackjackConfig } from "./configs";

const quickBets = [10, 25, 50, 100, 500];

export function BlackjackControlsClean({
  active,
  betAmount,
  canDeal,
  canDouble,
  canSplit,
  currency,
  onBetChange,
  onDeal,
  onHit,
  onStand,
  onDouble,
  onSplit,
}: {
  active: boolean;
  betAmount: number;
  canDeal: boolean;
  canDouble: boolean;
  canSplit: boolean;
  currency: Currency;
  onBetChange: (amount: number) => void;
  onDeal: () => void;
  onHit: () => void;
  onStand: () => void;
  onDouble: () => void;
  onSplit: () => void;
}) {
  function setBet(value: number) {
    onBetChange(Math.max(0, Math.min(blackjackConfig.maxBet, Math.round(value))));
  }

  if (active) {
    return (
      <section className="blackjack-clean-controls">
        <div className="blackjack-clean-actions">
          <button onClick={onHit}>Hit</button>
          <button onClick={onStand}>Stand</button>
          {canDouble && <button onClick={onDouble}>Double</button>}
          {canSplit && <button onClick={onSplit}>Split</button>}
        </div>
      </section>
    );
  }

  return (
    <section className="blackjack-clean-controls">
      <div className="blackjack-clean-bet-row">
        <button onClick={() => setBet(betAmount - 5)}>-</button>
        <label>
          <span>Bet</span>
          <input
            inputMode="numeric"
            type="number"
            min={0}
            max={blackjackConfig.maxBet}
            value={betAmount}
            onChange={(event) => setBet(Number(event.target.value))}
          />
        </label>
        <button onClick={() => setBet(betAmount + 5)}>+</button>
      </div>
      <div className="blackjack-clean-quick-bets">
        {quickBets.map((value) => (
          <button key={value} className={betAmount === value ? "active" : ""} onClick={() => setBet(value)}>
            {value}
          </button>
        ))}
      </div>
      <button className="blackjack-clean-deal" disabled={!canDeal} onClick={onDeal}>
        Deal {currency}
      </button>
    </section>
  );
}
