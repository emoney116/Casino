import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, CirclePlay, Info, Minus, Plus, X, Zap } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, GameResultBanner, ScreenShake, SoundToggle, WinOverlay } from "../feedback/components";
import {
  playBet,
  playCrashBigWin,
  playCrashCashOut,
  playCrashRisingLoop,
  playCrashSound,
  playCrashTakeoff,
  playCrashTick,
  playError,
} from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { cashOutCrashRound, crashCrashRound, getCrashMultiplier, startCrashRound } from "./crashEngine";
import { crashConfig } from "./configs";
import type { CrashRound } from "./types";
import { COMPLIANCE_COPY } from "../lib/compliance";

const crashVehicleAsset = new URL("../assets/crash/crash_vehicle.png", import.meta.url).href;
const crashExplosionAsset = new URL("../assets/crash/crash_explosion.png", import.meta.url).href;
const cashoutBurstAsset = new URL("../assets/crash/cashout_burst.png", import.meta.url).href;
const CRASH_GRAPH_START_X = 14;
const CRASH_GRAPH_END_X = 86;
const CRASH_GRAPH_START_Y = 84;
const CRASH_GRAPH_TOP_Y = 12;
const CRASH_GRAPH_MARKERS = [2, 10, 50, 100] as const;

const currencyCopy: Record<Currency, { short: string; className: string }> = {
  GOLD: { short: "GC", className: "currency-gc" },
  BONUS: { short: "SC", className: "currency-sc" },
};

const crashBetLimits = {
  GOLD: { minBet: 1, maxBet: 1000000, step: 1 },
  BONUS: { minBet: 0.01, maxBet: 500, step: 0.01 },
} satisfies Record<Currency, { minBet: number; maxBet: number; step: number }>;

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
  playheaterHeader: true,
  rasterCrashVehicle: true,
  rasterCrashExplosion: true,
  rasterCashoutBurst: true,
  currencySpecificLimits: true,
  premiumCrashStage: true,
  bigWinOverlay: true,
  infoBesideGameName: true,
  rulesInfoModal: true,
  noPresetBetChips: true,
  balanceInBottomControls: true,
  crashPointMarker: true,
  hundredXGraphScale: true,
  autoCashoutAtMaxWin: true,
};

export function CrashPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(crashBetLimits.GOLD.minBet);
  const [betInput, setBetInput] = useState(formatBetInput(crashBetLimits.GOLD.minBet, "GOLD"));
  const [round, setRound] = useState<CrashRound | null>(null);
  const [multiplier, setMultiplier] = useState(1);
  const [graphPoints, setGraphPoints] = useState<Array<{ x: number; y: number }>>([{ x: CRASH_GRAPH_START_X, y: CRASH_GRAPH_START_Y }]);
  const [recentRounds, setRecentRounds] = useState<Array<{ multiplier: number; won: boolean; paid: number }>>([]);
  const [popKey, setPopKey] = useState(0);
  const [flashing, setFlashing] = useState(false);
  const [bigWinDismissed, setBigWinDismissed] = useState(false);
  const [rulesOpen, setRulesOpen] = useState(false);
  const frameRef = useRef<number | null>(null);
  const lastTickRef = useRef(0);
  const lastLoopRef = useRef(0);
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

  if (!user) return null;
  const currentUser = user;
  const betLimits = crashBetLimits[currency];
  const currencyLabel = currencyCopy[currency].short;
  const activeCrashConfig = { ...crashConfig, minBet: betLimits.minBet, maxBet: betLimits.maxBet };
  const graphMaxMultiplier = activeCrashConfig.maxCrashPoint;
  const balance = getBalance(currentUser.id, currency);
  const status = round?.status ?? "IDLE";
  const running = status === "RUNNING";
  const canStart = Boolean(
    !running &&
    Number.isFinite(betAmount) &&
    betAmount >= betLimits.minBet &&
    betAmount <= betLimits.maxBet &&
    balance >= betAmount,
  );
  const multiplierTone = multiplier >= 5 ? "hot" : multiplier >= 2 ? "warm" : "cool";
  const mainButtonLabel = running ? "Cash Out" : status === "CRASHED" || status === "CASHED_OUT" ? "Play Again" : "Start";
  const isBigCashout = Boolean(round?.status === "CASHED_OUT" && (round.totalPaid ?? 0) >= Math.max(round.betAmount * 5, 25));
  const shakeActive = Boolean((status === "CRASHED" && multiplier >= 2) || (status === "CASHED_OUT" && isBigCashout));
  const path = useMemo(() => makeCurvePath(graphPoints), [graphPoints]);
  const vehiclePoint = graphPoints.at(-1) ?? getGraphPointForMultiplier(1, graphMaxMultiplier);
  const previousPoint = graphPoints.at(-2) ?? { x: CRASH_GRAPH_START_X - 1, y: CRASH_GRAPH_START_Y };
  const vehicleAngle = status === "CRASHED"
    ? 76
    : Math.max(-8, Math.min(24, Math.atan2(previousPoint.y - vehiclePoint.y, vehiclePoint.x - previousPoint.x) * (180 / Math.PI)));
  const vehicleStyle = {
    left: `${vehiclePoint.x}%`,
    top: `${vehiclePoint.y}%`,
    "--vehicle-angle": `${vehicleAngle}deg`,
  } as CSSProperties;
  const pageClass = [
    "crash-page",
    currencyCopy[currency].className,
    flashing ? "flash" : "",
    running ? "is-running" : "",
    status === "CASHED_OUT" ? "is-cashed-out" : "",
    status === "CRASHED" ? "is-crashed" : "",
  ].filter(Boolean).join(" ");

  function clampBet(value: number, nextCurrency = currency) {
    const limits = crashBetLimits[nextCurrency];
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
    if (running || nextCurrency === currency) return;
    setCurrency(nextCurrency);
    setBet(clampBet(betAmount, nextCurrency), nextCurrency);
  }

  function resetVisuals() {
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    setMultiplier(1);
    setGraphPoints([getGraphPointForMultiplier(1, graphMaxMultiplier)]);
    setFlashing(false);
    setBigWinDismissed(false);
    lastTickRef.current = 0;
    lastLoopRef.current = 0;
    lastPopRef.current = 1;
  }

  function start() {
    if (running) return;
    try {
      resetVisuals();
      const next = startCrashRound({ userId: currentUser.id, currency, betAmount, now: performance.now(), config: activeCrashConfig });
      roundRef.current = next;
      setRound(next);
      playBet();
      playCrashTakeoff();
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
    const visibleMultiplier = Math.min(nextMultiplier, liveRound.crashPoint, activeCrashConfig.maxCrashPoint);
    setMultiplier(visibleMultiplier);
    setGraphPoints((points) => {
      return [...points.slice(-34), getGraphPointForMultiplier(visibleMultiplier, activeCrashConfig.maxCrashPoint)];
    });
    if (visibleMultiplier >= lastPopRef.current + 0.5 || [2, 5, 10].some((mark) => lastPopRef.current < mark && visibleMultiplier >= mark)) {
      lastPopRef.current = visibleMultiplier;
      setPopKey((key) => key + 1);
    }
    if (now - lastTickRef.current > Math.max(100, 330 - visibleMultiplier * 22)) {
      playCrashTick(visibleMultiplier);
      lastTickRef.current = now;
    }
    if (now - lastLoopRef.current > Math.max(460, 860 - visibleMultiplier * 32)) {
      playCrashRisingLoop(visibleMultiplier);
      lastLoopRef.current = now;
    }
    if (visibleMultiplier >= activeCrashConfig.maxCrashPoint && liveRound.crashPoint >= activeCrashConfig.maxCrashPoint) {
      const next = cashOutCrashRound({ round: liveRound, userId: currentUser.id, multiplier: activeCrashConfig.maxCrashPoint, now, config: activeCrashConfig });
      roundRef.current = next;
      setRound(next);
      setMultiplier(next.cashOutMultiplier ?? activeCrashConfig.maxCrashPoint);
      setGraphPoints((points) => [...points.slice(-34), getGraphPointForMultiplier(next.cashOutMultiplier ?? activeCrashConfig.maxCrashPoint, activeCrashConfig.maxCrashPoint)]);
      const totalPaid = next.totalPaid ?? 0;
      playCrashCashOut();
      if (totalPaid >= Math.max(next.betAmount * 5, 25)) playCrashBigWin();
      setRecentRounds((current) => [
        { multiplier: next.cashOutMultiplier ?? activeCrashConfig.maxCrashPoint, won: true, paid: totalPaid },
        ...current,
      ].slice(0, 5));
      recordCrashRetention(next.betAmount, totalPaid, next.cashOutMultiplier ?? activeCrashConfig.maxCrashPoint);
      frameRef.current = null;
      return;
    }
    if (nextMultiplier >= liveRound.crashPoint) {
      const crashed = crashCrashRound({ round: liveRound, userId: currentUser.id, multiplier: liveRound.crashPoint, now, config: activeCrashConfig });
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
      frameRef.current = null;
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
    const next = cashOutCrashRound({ round: liveRound, userId: currentUser.id, multiplier: liveMultiplier, now, config: activeCrashConfig });
    roundRef.current = next;
    setRound(next);
    const shownMultiplier = Math.min(next.cashOutMultiplier ?? liveMultiplier, activeCrashConfig.maxCrashPoint);
    setMultiplier(shownMultiplier);
    setGraphPoints((points) => [...points.slice(-34), getGraphPointForMultiplier(shownMultiplier, activeCrashConfig.maxCrashPoint)]);
    if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
    frameRef.current = null;
    if (next.status === "CASHED_OUT") {
      const totalPaid = next.totalPaid ?? 0;
      playCrashCashOut();
      if (totalPaid >= Math.max(next.betAmount * 5, 25)) playCrashBigWin();
      setRecentRounds((current) => [
        { multiplier: next.cashOutMultiplier ?? liveMultiplier, won: true, paid: totalPaid },
        ...current,
      ].slice(0, 5));
      recordCrashRetention(next.betAmount, totalPaid, next.cashOutMultiplier ?? liveMultiplier);
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
    <section className={pageClass}>
      <header className="crash-header">
        <button className="crash-icon-button crash-back" type="button" onClick={onExit} aria-label="Back to table games">
          <ChevronLeft size={18} />
        </button>
        <div className="crash-title">
          <span className="crash-logo" aria-hidden="true"><img src={crashVehicleAsset} alt="" /></span>
          <h1>Crash</h1>
          <button className="crash-info-button" type="button" aria-label="Crash rules" onClick={() => setRulesOpen(true)}>
            <Info size={14} />
          </button>
        </div>
        <div className="crash-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={running} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={running} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="crash-icon-button" compact />
      </header>

      <ScreenShake active={shakeActive}>
        <main className="crash-table">
          <section className={`crash-stage ${status.toLowerCase()} ${multiplierTone}`}>
            <div className="crash-stage-light" aria-hidden="true" />
            <LastCrashResults values={recentRounds} />
            <section className="crash-multiplier-zone" aria-live="polite">
              <strong key={popKey} className="crash-multiplier">{multiplier.toFixed(2)}x</strong>
              {status === "CASHED_OUT" && <CoinBurst count={12} />}
            </section>

            <div className="crash-graph" aria-hidden="true">
              <svg viewBox="0 0 100 100" preserveAspectRatio="none">
                <defs>
                  <linearGradient id="crash-line-gradient-premium" x1="0" x2="1" y1="1" y2="0">
                    <stop offset="0%" stopColor="#22d3ee" />
                    <stop offset="58%" stopColor="#facc15" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                  <linearGradient id="crash-area-gradient-premium" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#facc15" stopOpacity="0.24" />
                    <stop offset="48%" stopColor="#22d3ee" stopOpacity="0.12" />
                    <stop offset="100%" stopColor="#020617" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path className="crash-graph-area" d={`${path} L ${vehiclePoint.x.toFixed(1)} 96 L ${CRASH_GRAPH_START_X} 96 Z`} />
                <path className="crash-graph-line" d={path} />
                {CRASH_GRAPH_MARKERS.map((mark) => {
                  const markerY = getGraphYForMultiplier(mark, graphMaxMultiplier);
                  return (
                    <g key={mark} className="crash-graph-marker">
                      <line x1="6" x2="96" y1={markerY} y2={markerY} />
                      <text x="8" y={Math.min(88, Math.max(10, markerY - 2))}>{mark}x</text>
                    </g>
                  );
                })}
              </svg>
              <div className="crash-vehicle" style={vehicleStyle}>
                <img src={crashVehicleAsset} alt="" draggable={false} />
              </div>
              {status === "CRASHED" && <div className="crash-crash-marker" style={vehicleStyle}><X size={28} /></div>}
              {status === "CRASHED" && <img className="crash-burst crash-explosion" src={crashExplosionAsset} alt="" style={vehicleStyle} draggable={false} />}
              {status === "CASHED_OUT" && <img className="crash-burst crash-cashout-burst" src={cashoutBurstAsset} alt="" style={vehicleStyle} draggable={false} />}
            </div>

            {(status === "CASHED_OUT" || status === "CRASHED") && (
              <GameResultBanner
                tone={status === "CASHED_OUT" ? "win" : "loss"}
                title={status === "CASHED_OUT" ? "Cashed Out" : "Crashed"}
                amount={status === "CASHED_OUT" ? round?.totalPaid : undefined}
                message={status === "CASHED_OUT" ? `Secured ${round?.cashOutMultiplier?.toFixed(2)}x - Max was ${round?.crashPoint.toFixed(2)}x` : `Stopped at ${round?.crashPoint.toFixed(2)}x`}
                compact
              />
            )}
          </section>
        </main>
      </ScreenShake>

      <section className="crash-controls">
        <div className={balance < betAmount ? "crash-bet-bank warning" : "crash-bet-bank"}>
          <div className="crash-bet-row">
            <button type="button" aria-label="Decrease bet" disabled={running} onClick={() => setBet(betAmount - betLimits.step)}><Minus size={18} /></button>
            <label>
              <span>Bet</span>
              <input
                aria-label="Bet amount"
                inputMode={currency === "BONUS" ? "decimal" : "numeric"}
                type="text"
                value={betInput}
                disabled={running}
                onChange={(event) => updateBetInput(event.target.value)}
                onBlur={(event) => setBet(Number(event.target.value))}
              />
            </label>
            <button type="button" aria-label="Increase bet" disabled={running} onClick={() => setBet(betAmount + betLimits.step)}><Plus size={18} /></button>
          </div>
          <div className="crash-balance-summary">
            <span>{currencyLabel} Balance</span>
            <strong>{formatCoins(balance)}</strong>
          </div>
        </div>
        <div className={balance < betAmount ? "crash-note warning" : "crash-note"}>
          <span>Min {currencyLabel}: {formatCoins(betLimits.minBet)}</span>
          <strong>Max {currencyLabel}: {formatCoins(betLimits.maxBet)}</strong>
        </div>
        <button className={running ? "crash-main-action cashout" : "crash-main-action"} type="button" disabled={!running && !canStart} onClick={mainAction}>
          {running ? <Zap size={18} /> : <CirclePlay size={18} />}
          <span>{mainButtonLabel}</span>
        </button>
      </section>

      <p className="crash-compliance-copy">{COMPLIANCE_COPY}</p>
      <WinOverlay
        show={isBigCashout && !bigWinDismissed}
        title="Big Cashout"
        amount={round?.totalPaid ?? 0}
        big
        onDismiss={() => setBigWinDismissed(true)}
      >
        Locked at {round?.cashOutMultiplier?.toFixed(2)}x
      </WinOverlay>
      {rulesOpen && (
        <div className="crash-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="crash-rules" role="dialog" aria-modal="true" aria-labelledby="crash-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="crash-rules-title">Crash Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              <li>Start the round and watch the multiplier climb.</li>
              <li>Cash out before the crash to secure the current multiplier.</li>
              <li>The round auto pays at 100x if the craft reaches the ceiling before crashing.</li>
              <li>If the craft crashes first, the round ends with no payout.</li>
              <li>Last 5 shows recent crash and cashout multipliers.</li>
              <li>Prototype mode. Redemptions are not currently enabled. Gold Coins have no cash value.</li>
            </ul>
          </section>
        </div>
      )}
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

function makeCurvePath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) return `M ${CRASH_GRAPH_START_X} ${CRASH_GRAPH_START_Y}`;
  if (points.length === 1) return `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  let path = `M ${points[0].x.toFixed(1)} ${points[0].y.toFixed(1)}`;
  for (let index = 1; index < points.length; index += 1) {
    const previous = points[index - 1];
    const point = points[index];
    const midX = (previous.x + point.x) / 2;
    const midY = (previous.y + point.y) / 2;
    path += ` Q ${previous.x.toFixed(1)} ${previous.y.toFixed(1)} ${midX.toFixed(1)} ${midY.toFixed(1)}`;
  }
  const last = points[points.length - 1];
  return `${path} T ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
}

function getGraphPointForMultiplier(value: number, maxMultiplier = crashConfig.maxCrashPoint) {
  return {
    x: getGraphXForMultiplier(value, maxMultiplier),
    y: getGraphYForMultiplier(value, maxMultiplier),
  };
}

function getGraphXForMultiplier(value: number, maxMultiplier = crashConfig.maxCrashPoint) {
  const normalized = getCrashGraphProgress(value, maxMultiplier);
  return CRASH_GRAPH_START_X + (CRASH_GRAPH_END_X - CRASH_GRAPH_START_X) * normalized;
}

function getGraphYForMultiplier(value: number, maxMultiplier = crashConfig.maxCrashPoint) {
  const normalized = getCrashGraphProgress(value, maxMultiplier);
  const eased = Math.pow(normalized, 1.35);
  return CRASH_GRAPH_START_Y - (CRASH_GRAPH_START_Y - CRASH_GRAPH_TOP_Y) * eased;
}

function getCrashGraphProgress(value: number, maxMultiplier = crashConfig.maxCrashPoint) {
  const normalized = Math.max(1, Math.min(maxMultiplier, value));
  const max = Math.max(2, maxMultiplier);
  return Math.max(0, Math.min(1, Math.log(normalized) / Math.log(max)));
}

function formatBetInput(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return "0";
  return currency === "BONUS" ? Number(amount.toFixed(2)).toString() : Math.round(amount).toString();
}
