import { useEffect, useMemo, useRef, useState, type PointerEvent } from "react";
import { ArrowUpDown, ChevronLeft, CirclePlay, Info, Minus, Plus, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { CoinBurst, GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import { playBet, playError, playLose, playWin } from "../feedback/feedbackService";
import { diceConfig } from "./configs";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { getDiceReturnMultiplier, resolveDiceBet } from "./diceEngine";
import type { DiceDirection, DiceResult } from "./types";

const currencyCopy: Record<Currency, { short: string; className: string }> = {
  GOLD: { short: "GC", className: "currency-gc" },
  BONUS: { short: "SC", className: "currency-sc" },
};

const overUnderBetLimits = {
  GOLD: { minBet: 1, maxBet: 1000000, step: 1 },
  BONUS: { minBet: 0.01, maxBet: 500, step: 0.01 },
} satisfies Record<Currency, { minBet: number; maxBet: number; step: number }>;

export const overUnderUiMarkers = {
  gameName: "Over/Under",
  blackjackStyleHeader: true,
  noBottomCurrencyDropdown: true,
  compactBottomBetControls: true,
  targetSlider: true,
  possibleReturn: false,
  lastWinStat: true,
  noWinChanceStat: true,
  resultAnimation: true,
  mobileOneScreenLayout: true,
  manualBetInput: true,
  lastFiveResults: true,
  sharedResultBanner: true,
  sharedSoundToggle: true,
  rollingNumberFlip: true,
  premiumDiceStage: true,
  compactCompliance: true,
  selectedOptionGlow: true,
  payoutCountUp: true,
  balanceInBottomControls: true,
  noPresetBetChips: true,
  currencySpecificLimits: true,
  noDiceSpecificMaxPayout: true,
  exactTargetPick: true,
  noPickComparisonSymbols: true,
  infoBesideGameName: true,
  rulesInfoModal: true,
};

export function DicePage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(overUnderBetLimits.GOLD.minBet);
  const [betInput, setBetInput] = useState(formatBetInput(overUnderBetLimits.GOLD.minBet, "GOLD"));
  const [direction, setDirection] = useState<DiceDirection>("over");
  const [target, setTarget] = useState(50);
  const [result, setResult] = useState<DiceResult | null>(null);
  const [displayRoll, setDisplayRoll] = useState<number | null>(null);
  const [recentRolls, setRecentRolls] = useState<DiceResult[]>([]);
  const [rolling, setRolling] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const [flipKey, setFlipKey] = useState(0);
  const intervalRef = useRef<number | null>(null);
  const timeoutRef = useRef<number | null>(null);
  const multiplier = useMemo(() => getDiceReturnMultiplier(direction, target), [direction, target]);

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    };
  }, []);

  if (!user) return null;
  const currentUser = user;
  const betLimits = overUnderBetLimits[currency];
  const activeDiceConfig = { ...diceConfig, minBet: betLimits.minBet, maxBet: betLimits.maxBet, maxPayout: Number.MAX_SAFE_INTEGER };
  const balance = getBalance(currentUser.id, currency);
  const lastWinAmount = recentRolls.find((value) => value.won)?.totalPaid ?? 0;
  const canRoll = !rolling && Number.isFinite(betAmount) && betAmount >= betLimits.minBet && betAmount <= betLimits.maxBet && balance >= betAmount;
  const comparison = result ? (result.roll > target ? "over" : result.roll < target ? "under" : "on target") : null;
  const currencyLabel = currencyCopy[currency].short;
  const rollValue = displayRoll ?? target;
  const statusCopy = rolling ? "Rolling" : result ? result.won ? "Win" : "Miss" : "Ready";
  const resultMessage = result
    ? result.won
      ? direction === "exact" ? `Hit exact ${target}` : `Rolled ${result.roll} ${direction} ${target}`
      : `Rolled ${result.roll}; needed ${formatDicePickLabel(direction, target)}`
    : formatDicePickLabel(direction, target);
  const pageClass = [
    "over-under-page",
    currencyCopy[currency].className,
    rolling ? "is-rolling" : "",
    result ? result.won ? "last-win" : "last-loss" : "",
  ].filter(Boolean).join(" ");
  const diceClass = [
    "over-under-die",
    rolling ? "rolling" : "",
    result ? result.won ? "win" : "loss" : "",
    !rolling && !result ? "idle" : "",
  ].filter(Boolean).join(" ");
  const shakeActive = Boolean(result && (!result.won || result.totalPaid >= betAmount * 5));

  function clampBet(value: number, nextCurrency = currency) {
    const limits = overUnderBetLimits[nextCurrency];
    if (!Number.isFinite(value)) return limits.minBet;
    const normalized = nextCurrency === "BONUS" ? Math.round(value * 100) / 100 : Math.round(value);
    return Math.max(limits.minBet, Math.min(limits.maxBet, normalized));
  }

  function setBet(value: number, nextCurrency = currency) {
    const next = clampBet(value, nextCurrency);
    setBetAmount(next);
    setBetInput(formatBetInput(next, nextCurrency));
  }

  function updateBetInput(value: string) {
    setBetInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const normalized = currency === "BONUS" ? Math.round(parsed * 100) / 100 : Math.round(parsed);
      setBetAmount(Math.max(0, Math.min(betLimits.maxBet, normalized)));
    }
  }

  function selectCurrency(nextCurrency: Currency) {
    if (rolling || nextCurrency === currency) return;
    setCurrency(nextCurrency);
    setBet(clampBet(betAmount, nextCurrency), nextCurrency);
  }

  function setTargetFromPointer(event: PointerEvent<HTMLInputElement>) {
    if (rolling) return;
    const rect = event.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(1, (event.clientX - rect.left) / rect.width));
    const nextTarget = Math.round(diceConfig.minTarget + ratio * (diceConfig.maxTarget - diceConfig.minTarget));
    setTarget(nextTarget);
  }

  function handleTargetPointerDown(event: PointerEvent<HTMLInputElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    setTargetFromPointer(event);
  }

  function handleTargetPointerMove(event: PointerEvent<HTMLInputElement>) {
    if (event.buttons === 1) setTargetFromPointer(event);
  }

  function roll() {
    if (rolling) return;
    try {
      const next = resolveDiceBet({ userId: currentUser.id, currency, betAmount, direction, target, config: activeDiceConfig });
      playBet();
      setRolling(true);
      setResult(null);
      setFlipKey((key) => key + 1);
      setDisplayRoll(Math.floor(Math.random() * 100) + 1);
      intervalRef.current = window.setInterval(() => {
        setFlipKey((key) => key + 1);
        setDisplayRoll(Math.floor(Math.random() * 100) + 1);
      }, 54);
      timeoutRef.current = window.setTimeout(() => {
        if (intervalRef.current) window.clearInterval(intervalRef.current);
        intervalRef.current = null;
        setDisplayRoll(next.roll);
        setResult(next);
        setFlipKey((key) => key + 1);
        setRecentRolls((current) => [next, ...current].slice(0, 5));
        setRolling(false);
        recordRetentionRound({
          userId: currentUser.id,
          gameId: "dice",
          wager: betAmount,
          won: next.totalPaid,
          multiplier: next.totalReturnMultiplier,
        });
        refreshUser();
        if (next.won) {
          playWin();
        } else {
          playLose();
        }
      }, 560);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Over/Under roll failed.", "error");
      playError();
    }
  }

  return (
    <section className={pageClass}>
      <header className="over-under-header">
        <button className="over-under-icon-button over-under-back" type="button" onClick={onExit} aria-label="Back to table games">
          <ChevronLeft size={18} />
        </button>
        <div className="over-under-title">
          <span className="over-under-logo" aria-hidden="true"><ArrowUpDown size={16} /></span>
          <h1>Over/Under</h1>
          <button className="over-under-info-button" type="button" aria-label="Over/Under rules" onClick={() => setRulesOpen(true)}>
            <Info size={14} />
          </button>
        </div>
        <div className="over-under-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={rolling} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={rolling} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="over-under-icon-button" compact />
      </header>

      <ScreenShake active={shakeActive}>
        <main className="over-under-table">
          <section className="over-under-stage" aria-live="polite">
            <div className="over-under-stage-light" aria-hidden="true" />
            <div key={flipKey} className={diceClass}>
              <span className="over-under-die-face">
                <span>{statusCopy}</span>
                <strong>{rollValue}</strong>
              </span>
              <i className="over-under-die-edge top" aria-hidden="true" />
              <i className="over-under-die-edge side" aria-hidden="true" />
            </div>
            {result?.won && <CoinBurst count={12} />}
            <div className={result ? `over-under-result-chip ${result.won ? "win" : "loss"}` : "over-under-result-chip"}>
              <strong>{result ? result.won ? "Paid" : "No payout" : resultMessage}</strong>
              <span>{result ? result.won ? formatCoins(result.totalPaid) : direction === "exact" ? `needed exact ${target}` : `${comparison} ${target}` : "Last 5 below"}</span>
            </div>
            <LastOverUnderResults values={recentRolls} />
            {result && (
              <GameResultBanner
                tone={result.won ? "win" : "loss"}
                title={result.won ? "Over/Under Win" : "No Payout"}
                amount={result.won ? result.totalPaid : undefined}
                message={resultMessage}
                compact
              />
            )}
          </section>

          <div className="over-under-picks" role="group" aria-label="Pick Over, Exact, or Under">
            <button type="button" className={direction === "over" ? "active" : ""} disabled={rolling} onClick={() => setDirection("over")}>
              <span>{formatDicePickLabel("over", target)}</span>
            </button>
            <button type="button" className={direction === "exact" ? "active exact" : "exact"} disabled={rolling} onClick={() => setDirection("exact")}>
              <span>{formatDicePickLabel("exact", target)}</span>
            </button>
            <button type="button" className={direction === "under" ? "active" : ""} disabled={rolling} onClick={() => setDirection("under")}>
              <span>{formatDicePickLabel("under", target)}</span>
            </button>
          </div>

          <section className="over-under-target-panel">
            <div className="over-under-target-row">
              <span>Target</span>
              <strong>{target}</strong>
            </div>
            <input
              aria-label="Target"
              type="range"
              min={diceConfig.minTarget}
              max={diceConfig.maxTarget}
              value={target}
              disabled={rolling}
              onChange={(event) => setTarget(Number(event.target.value))}
              onPointerDown={handleTargetPointerDown}
              onPointerMove={handleTargetPointerMove}
            />
          </section>

          <div className="over-under-stats">
            <div><span>Payout</span><strong>{multiplier.toFixed(2)}x</strong></div>
            <div><span>Last Win</span><strong>{formatCoins(lastWinAmount)}</strong></div>
          </div>

        </main>
      </ScreenShake>

      <section className="over-under-controls">
        <div className={balance < betAmount ? "over-under-bank warning" : "over-under-bank"}>
          <span>{currencyLabel} Balance: {formatCoins(balance)}</span>
          <strong>Bet: {formatCoins(betAmount)}</strong>
        </div>
        <div className="over-under-bet-row">
          <button type="button" aria-label="Decrease bet" disabled={rolling} onClick={() => setBet(betAmount - betLimits.step)}><Minus size={18} /></button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode={currency === "BONUS" ? "decimal" : "numeric"}
              type="text"
              min={betLimits.minBet}
              max={betLimits.maxBet}
              value={betInput}
              disabled={rolling}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.target.value))}
            />
          </label>
          <button type="button" aria-label="Increase bet" disabled={rolling} onClick={() => setBet(betAmount + betLimits.step)}><Plus size={18} /></button>
        </div>
        <div className={balance < betAmount ? "over-under-note warning" : "over-under-note"}>
          <span>Min {currencyLabel}: {formatCoins(betLimits.minBet)}</span>
          <strong>Max {currencyLabel}: {formatCoins(betLimits.maxBet)}</strong>
        </div>
        <button className="over-under-roll" type="button" disabled={!canRoll} onClick={roll}>
          <CirclePlay size={18} />
          <span>{rolling ? "Rolling" : "Roll"}</span>
        </button>
      </section>

      <p className="over-under-compliance-copy">{COMPLIANCE_COPY}</p>
      {rulesOpen && (
        <div className="over-under-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="over-under-rules" role="dialog" aria-modal="true" aria-labelledby="over-under-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="over-under-rules-title">Over/Under Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              <li>Choose Over, Exact, or Under for the target number.</li>
              <li>Over wins when the roll is higher than the target. Under wins when it is lower.</li>
              <li>Exact wins only when the roll matches the target and pays 93.00x.</li>
              <li>The target slider updates the payout before each roll. Last Win shows your most recent winning payout.</li>
              <li>Prototype mode. Redemptions are not currently enabled. Gold Coins have no cash value.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function LastOverUnderResults({ values }: { values: DiceResult[] }) {
  return (
    <aside className="over-under-last-results" aria-label="Last five Over/Under results">
      <span>Last 5</span>
      <div>
        {values.length === 0 ? <em>--</em> : values.map((value, index) => (
          <strong key={`${value.roll}-${index}`} className={value.won ? "win" : "loss"}>
            {value.roll}
          </strong>
        ))}
      </div>
    </aside>
  );
}

function formatBetInput(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return "0";
  return currency === "BONUS" ? Number(amount.toFixed(2)).toString() : Math.round(amount).toString();
}

function formatDicePickLabel(direction: DiceDirection, target: number) {
  return `${direction.charAt(0).toUpperCase()}${direction.slice(1)} ${target}`;
}
