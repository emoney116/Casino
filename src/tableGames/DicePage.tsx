import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { diceConfig } from "./configs";
import { getDiceChance, getDiceReturnMultiplier, resolveDiceBet } from "./diceEngine";
import { TableBetControls } from "./TableBetControls";
import type { DiceDirection, DiceResult } from "./types";

export function DicePage() {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(diceConfig.minBet);
  const [direction, setDirection] = useState<DiceDirection>("over");
  const [target, setTarget] = useState(50);
  const [result, setResult] = useState<DiceResult | null>(null);
  const chance = useMemo(() => getDiceChance(direction, target), [direction, target]);
  const multiplier = useMemo(() => getDiceReturnMultiplier(direction, target), [direction, target]);
  if (!user) return null;
  const currentUser = user;

  function roll() {
    try {
      const next = resolveDiceBet({ userId: currentUser.id, currency, betAmount, direction, target });
      setResult(next);
      notify(next.won ? `Dice paid ${formatCoins(next.totalPaid)}.` : "Dice roll settled.", next.won ? "success" : "info");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Dice roll failed.", "error");
    }
  }

  return (
    <section className="table-play-screen dice-table">
      <div className="table-game-heading">
        <p className="eyebrow">Dice Hi-Lo</p>
        <h1>Dice</h1>
        <p className="muted">Pick over or under. Payout uses configurable probability math with demo house edge.</p>
      </div>
      <div className="table-layout">
        <article className="felt-table dice-felt">
          <div className="dice-display">{result?.roll ?? "?"}</div>
          <div className="segmented small">
            <button className={direction === "over" ? "active" : ""} onClick={() => setDirection("over")}>Over</button>
            <button className={direction === "under" ? "active" : ""} onClick={() => setDirection("under")}>Under</button>
          </div>
          <label>
            Target {target}
            <input type="range" min={diceConfig.minTarget} max={diceConfig.maxTarget} value={target} onChange={(event) => setTarget(Number(event.target.value))} />
          </label>
          <div className="grid two">
            <div className="stat-card"><span>Win chance</span><strong>{(chance * 100).toFixed(1)}%</strong></div>
            <div className="stat-card"><span>Total return</span><strong>{multiplier.toFixed(2)}x</strong></div>
          </div>
          {result && <div className={`table-result ${result.won ? "win" : "loss"}`}><strong>{result.won ? "WIN" : "LOSS"}</strong><span>Roll {result.roll}</span></div>}
        </article>
        <div className="table-side-panel">
          <TableBetControls userId={currentUser.id} config={diceConfig} currency={currency} betAmount={betAmount} maxPayoutPreview={Math.min(diceConfig.maxPayout, betAmount * multiplier)} onCurrencyChange={setCurrency} onBetChange={setBetAmount} />
          <button className="primary-button table-big-action" onClick={roll}>Roll Dice</button>
        </div>
      </div>
    </section>
  );
}
