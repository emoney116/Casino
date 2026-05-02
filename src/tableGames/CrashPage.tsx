import { useEffect, useMemo, useRef, useState } from "react";
import { Rocket } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import { playBet, playCrashCashOut, playCrashSound, playCrashTick, playError } from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { cashOutCrashRound, crashCrashRound, getCrashMultiplier, startCrashRound } from "./crashEngine";
import { crashConfig } from "./configs";
import type { CrashRound } from "./types";

const quickBets = [10, 25, 50, 100, 500];

export const crashUiMarkers = {
  gameName: "Crash",
  goldBonusToggle: true,
  liveMultiplier: true,
  risingGraph: true,
  multiplierPopThresholds: true,
  crashShakeFlash: true,
  cashOutAnytime: true,
  lastFiveResults: true,
  sharedResultBanner: true,
  sharedSoundToggle: true,
  compactBottomBetControls: true,
};

export function CrashPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(crashConfig.minBet);
  const [betInput, setBetInput] = useState(String(crashConfig.minBet));
  const [round, setRound] = useState<CrashRound | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [graphPoints, setGraphPoints] = useState<Array<{ x: number; y: number }>>([{ x: 0, y: 92 }]);
  const [recentRounds, setRecentRounds] = useState<Array<{ multiplier: number; won: boolean; paid: number }>>([]);
  const [popKey, setPopKey] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const lastPopRef = useRef(1);
  const roundRef = useRef<CrashRound | null>(null);

  useEffect(() => {
    roundRef.current = round;
  }, [round]);

  useEffect(() => {
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    };
  }, []);

  const balance = user ? getBalance(user.id, currency) : 0;
  const status = round?.status ?? "IDLE";
  const running = status === "RUNNING";
  const canStart = Boolean(user && !running && betAmount >= crashConfig.minBet && betAmount <= crashConfig.maxBet && balance >= betAmount);
  const projectedWin = Math.min(crashConfig.maxPayout, Math.round(betAmount * multiplier));
  const multiplierTone = multiplier >= 5 ? "hot" : multiplier >= 2 ? "warm" : "cool";
  const mainButtonLabel = running ? "Cash Out" : status === "CRASHED" || status === "CASHED_OUT" ? "Play Again" : "Start";
  const maxRoundWin = round ? Math.min(crashConfig.maxPayout, Math.round(round.betAmount * round.crashPoint)) : 0;
  const path = useMemo(() => {
    if (graphPoints.length === 0) return "M 0 92";
    return graphPoints.map((point, index) => `${index === 0 ? "M" : "L"} ${point.x.toFixed(1)} ${point.y.toFixed(1)}`).join(" ");
  }, [graphPoints]);

  if (!user) return null;
  const currentUser = user;

  function clampBet(value: number) {
    return Math.max(crashConfig.minBet, Math.min(crashConfig.maxBet, Math.round(value)));
  }

  function setBet(value: number) {
    const next = clampBet(value);
    setBetAmount(next);
    setBetInput(String(next));
  }

  function updateBetInput(value: string) {
    setBetInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setBetAmount(Math.max(0, Math.min(crashConfig.maxBet, Math.round(parsed))));
  }

  function resetVisuals() {
    setMultiplier(1);
    setGraphPoints([{ x: 0, y: 92 }]);
    setFlashing(false);
    lastTickRef.current = 0;
    lastPopRef.current = 1;
  }

  function start() {
    if (running) return;
    try {
      resetVisuals();
      const next = startCrashRound({ userId: currentUser.id, currency, betAmount, now: performance.now() });
      roundRef.current = next;
      setRound(next);
      playBet();
      frameRef.current = window.requestAnimationFrame(tick);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to start Crash.", "error");
      playError();
    }
  }

  function tick(now: number) {
    const liveRound = roundRef.current;
    if (!liveRound || liveRound.status !== "RUNNING") return;
    const elapsed = now - liveRound.startedAt;
    const nextMultiplier = getCrashMultiplier(elapsed);
    const visibleMultiplier = Math.min(nextMultiplier, liveRound.crashPoint);
    setMultiplier(visibleMultiplier);
    setGraphPoints((points) => {
      const x = Math.min(96, elapsed / 90);
      const y = Math.max(8, 92 - Math.log2(visibleMultiplier) * 28);
      return [...points.slice(-28), { x, y }];
    });
    if (visibleMultiplier >= lastPopRef.current + 0.5 || [2, 5, 10].some((mark) => lastPopRef.current < mark && visibleMultiplier >= mark)) {
      lastPopRef.current = visibleMultiplier;
      setPopKey((key) => key + 1);
    }
    if (now - lastTickRef.current > Math.max(110, 340 - visibleMultiplier * 24)) {
      playCrashTick(visibleMultiplier);
      lastTickRef.current = now;
    }
    if (nextMultiplier >= liveRound.crashPoint) {
      const crashed = crashCrashRound({ round: liveRound, userId: currentUser.id, multiplier: liveRound.crashPoint, now });
      roundRef.current = crashed;
      setRound(crashed);
      setMultiplier(liveRound.crashPoint);
      setFlashing(true);
      setRecentRounds((current) => [
        { multiplier: liveRound.crashPoint, won: false, paid: 0 },
        ...current,
      ].slice(0, 5));
      recordCrashRetention(liveRound.betAmount, 0, liveRound.crashPoint);
      playCrashSound();
      window.setTimeout(() => setFlashing(false), 520);
      return;
    }
    frameRef.current = window.requestAnimationFrame(tick);
  }

  function cashOut() {
    const liveRound = roundRef.current;
    if (!liveRound || liveRound.status !== "RUNNING") return;
    const now = performance.now();
    const liveMultiplier = getCrashMultiplier(now - liveRound.startedAt);
    const next = cashOutCrashRound({ round: liveRound, userId: currentUser.id, multiplier: liveMultiplier, now });
    roundRef.current = next;
    setRound(next);
    setMultiplier(next.cashOutMultiplier ?? liveMultiplier);
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    if (next.status === "CASHED_OUT") {
      playCrashCashOut();
      setRecentRounds((current) => [
        { multiplier: next.cashOutMultiplier ?? liveMultiplier, won: true, paid: next.totalPaid ?? 0 },
        ...current,
      ].slice(0, 5));
      recordCrashRetention(next.betAmount, next.totalPaid ?? 0, next.cashOutMultiplier ?? liveMultiplier);
    } else {
      setFlashing(true);
      playCrashSound();
      setRecentRounds((current) => [
        { multiplier: next.cashOutMultiplier ?? liveMultiplier, won: false, paid: 0 },
        ...current,
      ].slice(0, 5));
      recordCrashRetention(next.betAmount, 0, next.cashOutMultiplier ?? liveMultiplier);
      window.setTimeout(() => setFlashing(false), 520);
    }
  }

  function recordCrashRetention(wager: number, won: number, liveMultiplier: number) {
    recordRetentionRound({
      userId: currentUser.id,
      gameId: "crash",
      wager,
      won,
      multiplier: liveMultiplier,
    });
    refreshUser();
  }

  function mainAction() {
    if (running) cashOut();
    else start();
  }

  return (
    <section className={`crash-page ${flashing ? "flash" : ""}`}>
      <header className="crash-header">
        <button className="crash-back" onClick={onExit} aria-label="Back to table games">&lt;</button>
        <div className="crash-title">
          <h1>Crash <span className="crash-logo" aria-hidden="true"><Rocket size={14} /></span></h1>
        </div>
        <div className="crash-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={running} onClick={() => setCurrency("GOLD")}>Gold</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={running} onClick={() => setCurrency("BONUS")}>Bonus</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <div className="crash-balance">
        <span>Balance: {formatCoins(balance)}</span>
        <strong>{currency === "GOLD" ? "Gold" : "Bonus"} Bet: {formatCoins(betAmount)}</strong>
      </div>

      <ScreenShake active={status === "CRASHED"}>
        <main className={`crash-stage ${status.toLowerCase()} ${multiplierTone}`}>
          <LastCrashResults values={recentRounds} />
          <section className="crash-multiplier-zone" aria-live="polite">
            <strong key={popKey} className="crash-multiplier">{multiplier.toFixed(2)}x</strong>
            <span>{running ? `Cash out for ${formatCoins(projectedWin)}` : status === "CASHED_OUT" ? `Locked at ${round?.cashOutMultiplier?.toFixed(2)}x` : status === "CRASHED" ? `Crashed at ${round?.crashPoint.toFixed(2)}x` : "Ready for takeoff"}</span>
            {status === "CASHED_OUT" && <CoinBurst count={12} />}
          </section>

          <div className="crash-graph" aria-hidden="true">
            <svg viewBox="0 0 100 100" preserveAspectRatio="none">
              <defs>
                <linearGradient id="crash-line-gradient" x1="0" x2="1" y1="1" y2="0">
                  <stop offset="0%" stopColor="#38bdf8" />
                  <stop offset="55%" stopColor="#22c55e" />
                  <stop offset="100%" stopColor="#facc15" />
                </linearGradient>
              </defs>
              <path className="crash-graph-shadow" d={`${path} L 100 100 L 0 100 Z`} />
              <path className="crash-graph-line" d={status === "CRASHED" ? `${path} L 98 96` : path} />
            </svg>
            <div className="crash-rocket" style={{ left: `${Math.min(88, Math.max(8, graphPoints.at(-1)?.x ?? 8))}%`, top: `${Math.min(88, Math.max(12, graphPoints.at(-1)?.y ?? 88))}%` }}>
              <Rocket size={22} />
            </div>
          </div>

          {(status === "CASHED_OUT" || status === "CRASHED") && (
            <GameResultBanner
              tone={status === "CASHED_OUT" ? "win" : "loss"}
              title={status === "CASHED_OUT" ? "Cashed Out" : "Crashed"}
              amount={status === "CASHED_OUT" ? round?.totalPaid : undefined}
              message={status === "CASHED_OUT" ? `Max this round: ${formatCoins(maxRoundWin)} at ${round?.crashPoint.toFixed(2)}x` : "The multiplier dropped before cash out."}
              compact
            />
          )}
        </main>
      </ScreenShake>

      <section className="crash-controls">
        <div className="crash-bet-row">
          <button type="button" disabled={running} onClick={() => setBet(betAmount - crashConfig.minBet)}>-</button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode="numeric"
              type="number"
              min={crashConfig.minBet}
              max={crashConfig.maxBet}
              value={betInput}
              disabled={running}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={running} onClick={() => setBet(betAmount + crashConfig.minBet)}>+</button>
        </div>
        <div className="crash-quick-bets">
          {quickBets.map((value) => (
            <button key={value} type="button" className={betAmount === value ? "active" : ""} disabled={running} onClick={() => setBet(value)}>
              {value}
            </button>
          ))}
        </div>
        <div className={balance < betAmount ? "crash-note warning" : "crash-note"}>
          <span>Min {formatCoins(crashConfig.minBet)} / Max {formatCoins(crashConfig.maxBet)}</span>
          <strong>{running ? `Live ${multiplier.toFixed(2)}x` : "Cash out before the drop"}</strong>
        </div>
        <button className={running ? "crash-main-action cashout" : "crash-main-action"} disabled={!running && !canStart} onClick={mainAction}>
          {mainButtonLabel}
        </button>
      </section>
    </section>
  );
}

function LastCrashResults({ values }: { values: Array<{ multiplier: number; won: boolean; paid: number }> }) {
  return (
    <aside className="crash-last-results" aria-label="Last five Crash results">
      <span>Last 5</span>
      <div>
        {values.length === 0 ? <em>--</em> : values.map((value, index) => (
          <strong key={`${value.multiplier}-${value.paid}-${index}`} className={value.won ? "win" : "loss"}>
            {value.multiplier.toFixed(2)}x
          </strong>
        ))}
      </div>
    </aside>
  );
}
