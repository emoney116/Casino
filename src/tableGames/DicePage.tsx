import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowUpDown } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { diceConfig } from "./configs";
import { getDiceChance, getDiceReturnMultiplier, resolveDiceBet } from "./diceEngine";
import type { DiceDirection, DiceResult } from "./types";

const quickBets = [10, 25, 50, 100, 500];

export const overUnderUiMarkers = {
  gameName: "Over/Under",
  blackjackStyleHeader: true,
  noBottomCurrencyDropdown: true,
  compactBottomBetControls: true,
  targetSlider: true,
  possibleReturn: true,
  resultAnimation: true,
  mobileOneScreenLayout: true,
};

export function DicePage({ onExit }: { onExit?: () => void }) {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(diceConfig.minBet);
  const [direction, setDirection] = useState<DiceDirection>("over");
  const [target, setTarget] = useState(50);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);
  const [rolling, setRolling] = useState(false);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const chance = useMemo(() => getDiceChance(direction, target), [direction, target]);
  const multiplier = useMemo(() => getDiceReturnMultiplier(direction, target), [direction, target]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const possibleReturn = Math.min(diceConfig.maxPayout, Math.round(betAmount * multiplier));
  const canRoll = !rolling && betAmount >= diceConfig.minBet && betAmount <= diceConfig.maxBet && balance >= betAmount;
  const comparison = result ? (result.roll > target ? "over" : result.roll < target ? "under" : "on target") : null;

  function clampBet(value: number) {
    return Math.max(diceConfig.minBet, Math.min(diceConfig.maxBet, Math.round(value)));
  }

  function setBet(value: number) {
    setBetAmount(clampBet(value));
  }

  function roll() {
    if (rolling) return;
    try {
      const next = resolveDiceBet({ userId: currentUser.id, currency, betAmount, direction, target });
      setRolling(true);
      setResult(null);
      setDisplayRoll(Math.floor(Math.random() * 100) + 1);
      intervalRef.current = window.setInterval(() => {
        setDisplayRoll(Math.floor(Math.random() * 100) + 1);
      }, 54);
      timeoutRef.current = window.setTimeout(() => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        setDisplayRoll(next.roll);
        setResult(next);
        setRolling(false);
        notify(next.won ? `Over/Under paid ${formatCoins(next.totalPaid)}.` : "Over/Under settled.", next.won ? "success" : "info");
      }, 520);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Over/Under roll failed.", "error");
    }
  }

  return (
    <section className="over-under-page">
      <header className="over-under-header">
        <button className="over-under-back" onClick={onExit} aria-label="Back to table games">&lt;</button>
        <div className="over-under-title">
          <h1>Over/Under <span className="over-under-logo" aria-hidden="true"><ArrowUpDown size={14} /></span></h1>
          <p>Pick over or under. Virtual coins only.</p>
        </div>
        <div className="over-under-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={rolling} onClick={() => setCurrency("GOLD")}>Gold</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={rolling} onClick={() => setCurrency("BONUS")}>Bonus</button>
        </div>
      </header>

      <div className="over-under-balance">
        <span>Balance: {formatCoins(balance)}</span>
        <strong>{currency === "GOLD" ? "Gold" : "Bonus"} Bet: {formatCoins(betAmount)}</strong>
      </div>

      <main className="over-under-table">
        <section className="over-under-result-zone" aria-live="polite">
          <div className={rolling ? "over-under-number rolling" : result ? `over-under-number ${result.won ? "win" : "loss"}` : "over-under-number"}>
            {displayRoll ?? "--"}
          </div>
          <div className="over-under-prompt">
            <strong>{result ? `Rolled ${result.roll}` : "Choose Over or Under"}</strong>
            <span>{result && comparison ? `It landed ${comparison} ${target}.` : `Target number ${target}`}</span>
          </div>
        </section>

        <div className="over-under-picks" role="group" aria-label="Pick over or under">
          <button type="button" className={direction === "over" ? "active" : ""} disabled={rolling} onClick={() => setDirection("over")}>Over</button>
          <button type="button" className={direction === "under" ? "active" : ""} disabled={rolling} onClick={() => setDirection("under")}>Under</button>
        </div>

        <label className="over-under-slider">
          <span>Target <strong>{target}</strong></span>
          <input
            type="range"
            min={diceConfig.minTarget}
            max={diceConfig.maxTarget}
            value={target}
            disabled={rolling}
            onChange={(event) => setTarget(Number(event.target.value))}
          />
        </label>

        <div className="over-under-stats">
          <div><span>Win chance</span><strong>{(chance * 100).toFixed(1)}%</strong></div>
          <div><span>Payout</span><strong>{multiplier.toFixed(2)}x</strong></div>
          <div><span>Return</span><strong>{formatCoins(possibleReturn)}</strong></div>
        </div>

        {result && (
          <div className={`over-under-banner ${result.won ? "win" : "loss"}`}>
            <strong>{result.won ? "WIN" : "LOSS"}</strong>
            <span>{result.won ? `Paid ${formatCoins(result.totalPaid)}` : "No payout"}</span>
          </div>
        )}
      </main>

      <section className="over-under-controls">
        <div className="over-under-bet-row">
          <button type="button" disabled={rolling} onClick={() => setBet(betAmount - diceConfig.minBet)}>-</button>
          <div><span>Bet</span><strong>{formatCoins(betAmount)}</strong></div>
          <button type="button" disabled={rolling} onClick={() => setBet(betAmount + diceConfig.minBet)}>+</button>
        </div>
        <div className="over-under-quick-bets">
          {quickBets.map((value) => (
            <button key={value} type="button" className={betAmount === value ? "active" : ""} disabled={rolling} onClick={() => setBet(value)}>
              {value}
            </button>
          ))}
        </div>
        <div className={balance < betAmount ? "over-under-note warning" : "over-under-note"}>
          <span>Min {formatCoins(diceConfig.minBet)} / Max {formatCoins(diceConfig.maxBet)}</span>
          <strong>Possible return {formatCoins(possibleReturn)}</strong>
        </div>
        <button className="over-under-roll" disabled={!canRoll} onClick={roll}>
          {rolling ? "Rolling" : "Roll"}
        </button>
      </section>
    </section>
  );
}
