import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, Info, Repeat2, RotateCcw, Trash2 } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { GameResultBanner, ScreenShake, SoundToggle, WinOverlay } from "../feedback/components";
import {
  playError,
  playLose,
  playRouletteBounce,
  playRouletteChipPlace,
  playRoulettePayout,
  playRouletteReveal,
  playRouletteSpinStart,
  playRouletteTick,
  playWin,
} from "../feedback/feedbackService";
import { rouletteConfig } from "./configs";
import { COMPLIANCE_COPY } from "../lib/compliance";
import {
  americanWheel,
  getRouletteColor,
  getRouletteWinningZones,
  resolveRouletteBets,
  rouletteBetKey,
  rouletteBetLabel,
  rouletteBoardRows,
  type PlacedRouletteBet,
} from "./rouletteEngine";
import type { RouletteBet, RouletteResult } from "./types";

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const boardRows = rouletteBoardRows;
const streetStarts = Array.from({ length: 12 }, (_, index) => index * 3 + 1);
const numberCells = boardRows.flatMap((row, rowIndex) => (
  row.map((number) => ({
    number,
    rowIndex,
    streetIndex: Math.floor((number - 1) / 3),
  }))
));
const rouletteWheelAsset = new URL("../assets/roulette-premium/premium-wheel-source.png", import.meta.url).href;
const rouletteBallAsset = new URL("../assets/roulette-premium/roulette-ball.png", import.meta.url).href;
const rouletteChipSetAsset = new URL("../assets/roulette-premium/chip-set.png", import.meta.url).href;
const rouletteChipSingleAsset = new URL("../assets/roulette-premium/chip-clean-base.png", import.meta.url).href;
const rouletteWinFxAsset = new URL("../assets/roulette-premium/winning-number-fx.png", import.meta.url).href;
const rouletteChipFxAsset = new URL("../assets/roulette-premium/chip-stack-fx.png", import.meta.url).href;
const goldChips = [1, 5, 25, 100, 500, 1000, 5000];
const bonusChips = [0.01, 0.05, 0.25, 1, 5, 25, 100];
const rouletteTableLimits = {
  GOLD: { label: "GC", min: 1, max: 1000000 },
  BONUS: { label: "SC", min: 0.01, max: 500 },
} satisfies Record<Currency, { label: string; min: number; max: number }>;
const defaultChipByCurrency = { GOLD: 25, BONUS: 0.25 } satisfies Record<Currency, number>;
const ROULETTE_SPIN_MS = 5800;
const roulettePocketAngle = 360 / americanWheel.length;
const rouletteBallSettleAngle = -90;
const rouletteOuterTrack = { x: 41.8, y: 41.8 };
const rouletteMiddleTrack = { x: 38.4, y: 38.4 };
const roulettePocketTrack = { x: 35.4, y: 35.4 };
type RouletteSpinPhase = "idle" | "accelerating" | "sustained" | "slowdown" | "bounce" | "settle";

export const rouletteSpinLifecycleStates = ["idle", "betting", "spinning", "ballSettling", "resultReveal", "chipResolution", "readyNextSpin"] as const;
export type RouletteSpinLifecycle = (typeof rouletteSpinLifecycleStates)[number];

export const rouletteResultTiming = {
  numberHighlightMs: 800,
  winningZoneHighlightMs: 1200,
  winningChipPulseMs: 1200,
  resultOverlayMs: 1900,
  chipResolutionMs: 1350,
};

const ROULETTE_CHIP_RESOLUTION_DELAY_MS = rouletteResultTiming.numberHighlightMs + Math.max(rouletteResultTiming.winningZoneHighlightMs, rouletteResultTiming.winningChipPulseMs);
const ROULETTE_READY_NEXT_SPIN_DELAY_MS = ROULETTE_CHIP_RESOLUTION_DELAY_MS + rouletteResultTiming.chipResolutionMs;

export function isRouletteInteractionLocked(lifecycle: RouletteSpinLifecycle) {
  return lifecycle === "spinning" || lifecycle === "ballSettling" || lifecycle === "resultReveal" || lifecycle === "chipResolution";
}

export function shouldShowRouletteSettledBets(lifecycle: RouletteSpinLifecycle) {
  return lifecycle === "ballSettling" || lifecycle === "resultReveal" || lifecycle === "chipResolution";
}

export function shouldShowRouletteWinningZones(lifecycle: RouletteSpinLifecycle) {
  return lifecycle === "resultReveal" || lifecycle === "chipResolution";
}

export function shouldShowRouletteResultOverlay(lifecycle: RouletteSpinLifecycle) {
  return lifecycle === "resultReveal" || lifecycle === "chipResolution";
}

export function shouldShowRouletteBetFlash(_lifecycle: RouletteSpinLifecycle, _label: string | null) {
  return false;
}

export function getNextRouletteHistory(current: Array<"0" | "00" | number>, outcome: "0" | "00" | number) {
  return [outcome, ...current].slice(0, 5);
}

export function getRouletteBoardBetsForLifecycle(activeBets: PlacedRouletteBet[], settledBets: PlacedRouletteBet[], lifecycle: RouletteSpinLifecycle) {
  if (activeBets.length > 0) return activeBets;
  return shouldShowRouletteSettledBets(lifecycle) ? settledBets : [];
}

export function getRouletteResultOverlayCopy(result: RouletteResult) {
  const won = result.totalPaid > 0;
  return {
    heading: `${result.outcome} ${formatRouletteColorLabel(result.color)}`,
    status: won ? `Won ${formatCoins(result.totalPaid)}` : "No win",
    totalBet: `Total Bet ${formatCoins(result.totalWagered ?? 0)}`,
    net: `Net ${(result.net ?? 0) >= 0 ? "+" : ""}${formatCoins(result.net ?? 0)}`,
    totalWon: `Total Won ${formatCoins(result.totalPaid)}`,
  };
}

export function getRouletteLastWinAmount(result: RouletteResult | null) {
  if (!result) return 0;
  const net = result.net ?? result.totalPaid - (result.totalWagered ?? 0);
  return Math.max(0, net);
}

function formatRouletteColorLabel(color: RouletteResult["color"]) {
  return color[0].toUpperCase() + color.slice(1);
}

export interface RouletteWheelMotion {
  ringRotation: number;
  ballX: number;
  ballY: number;
  ballScale: number;
  ballLift: number;
  ballBlur: number;
}

export function getRouletteWheelPocketIndex(outcome: RouletteResult["outcome"] | null) {
  if (outcome == null) return 0;
  const index = americanWheel.findIndex((value) => value === outcome);
  return index >= 0 ? index : 0;
}

export function getRouletteWheelPocketAngle(outcome: RouletteResult["outcome"] | null) {
  return rouletteBallSettleAngle + getRouletteWheelPocketIndex(outcome) * roulettePocketAngle;
}

export function getRouletteWheelTargetRotation(outcome: RouletteResult["outcome"] | null) {
  return -getRouletteWheelPocketIndex(outcome) * roulettePocketAngle;
}

export function getRouletteWheelMotion(outcome: RouletteResult["outcome"] | null, progress = 1): RouletteWheelMotion {
  const p = clamp01(progress);
  const targetRotation = getRouletteWheelTargetRotation(outcome);
  if (outcome == null) {
    const idlePoint = ellipsePointPercent(-58, rouletteOuterTrack.x, rouletteOuterTrack.y);
    return { ringRotation: 0, ballX: idlePoint.x, ballY: idlePoint.y, ballScale: 1, ballLift: 0, ballBlur: 0 };
  }

  const wheelEase = easeOutCubic(p);
  const ringRotation = targetRotation - (1 - wheelEase) * 1440;
  let ballAngle = rouletteBallSettleAngle;
  let radiusX = rouletteOuterTrack.x;
  let radiusY = rouletteOuterTrack.y;
  let ballScale = 1;
  let ballLift = 0;
  let ballBlur = 0;
  const bounceLeadAngle = roulettePocketAngle * 7;

  if (p < 0.68) {
    const spinProgress = easeOutCubic(p / 0.68);
    const shrinkProgress = easeInOutCubic(clamp01((p - 0.42) / 0.26));
    ballAngle = rouletteBallSettleAngle + bounceLeadAngle + (1 - spinProgress) * 5280;
    radiusX = lerp(rouletteOuterTrack.x, rouletteMiddleTrack.x, shrinkProgress);
    radiusY = lerp(rouletteOuterTrack.y, rouletteMiddleTrack.y, shrinkProgress);
    ballScale = lerp(1.02, 0.96, shrinkProgress);
    ballBlur = p < 0.46 ? 0.8 : 0.25;
  } else {
    const bounceProgress = clamp01((p - 0.68) / 0.32);
    const bounceEase = easeOutCubic(bounceProgress);
    ballAngle = rouletteBallSettleAngle + bounceLeadAngle * (1 - bounceEase);
    radiusX = lerp(rouletteMiddleTrack.x, roulettePocketTrack.x, easeInOutCubic(bounceProgress));
    radiusY = lerp(rouletteMiddleTrack.y, roulettePocketTrack.y, easeInOutCubic(bounceProgress));
    ballLift = Math.abs(Math.sin(bounceProgress * Math.PI * 8)) * 8 * (1 - bounceProgress);
    ballScale = 0.96 + Math.abs(Math.sin(bounceProgress * Math.PI * 8)) * 0.12 * (1 - bounceProgress);
    ballBlur = 0.08 * (1 - bounceProgress);
  }

  const ballPoint = ellipsePointPercent(ballAngle, radiusX, radiusY);
  return {
    ringRotation,
    ballX: ballPoint.x,
    ballY: ballPoint.y,
    ballScale,
    ballLift,
    ballBlur,
  };
}

function ellipsePointPercent(angleDegrees: number, radiusX: number, radiusY: number) {
  const radians = (angleDegrees * Math.PI) / 180;
  return {
    x: 50 + Math.cos(radians) * radiusX,
    y: 50 + Math.sin(radians) * radiusY,
  };
}

function clamp01(value: number) {
  return Math.min(1, Math.max(0, value));
}

function lerp(start: number, end: number, progress: number) {
  return start + (end - start) * progress;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - clamp01(value), 3);
}

function easeInOutCubic(value: number) {
  const t = clamp01(value);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export const rouletteUiMarkers = {
  americanBoard: true,
  multipleActiveBets: true,
  cssChips: true,
  animatedWheel: true,
  advancedInsideBets: true,
  landscapeTable: true,
  compactChipRow: true,
  insideHelperRowRemoved: true,
  zeroDoubleZeroBalanced: true,
  doubleBetsAction: true,
  sequencedAmericanWheel: true,
  selectedChipPopover: true,
  lastFiveResults: true,
  streetBetSidePanel: true,
  wheelInBottomDeck: true,
  sharedResultBanner: true,
  sharedSoundToggle: true,
  winningBetGlow: true,
  premiumWheelFirstLayout: true,
  portraitSpinCollapse: false,
  generatedRasterAssets: true,
  synchronizedWheelOutcome: true,
  mobileStateMachine: true,
  layeredWheelRenderer: true,
  noNormalPlayVerticalScroll: true,
  streetBetActiveRail: true,
  fullBoardInsideHitLayer: true,
  fanChipSelector: true,
  singleRasterChipSelector: true,
  boardFirstWheelOverlay: true,
  currencySpecificTableLimits: true,
  landscapeOnlyForced: true,
  orientationGuardPrompt: true,
  horizontalChipTray: true,
  explicitSpinLifecycle: true,
  delayedChipResolution: true,
  lastFiveLandedNumbersOnly: true,
  temporaryBetLabelsOnly: true,
  premiumCssChips: true,
  resultOverlayBreakdown: true,
  measuredBetAnchors: true,
  currentBetsSeparated: true,
  cleanRasterChipBase: true,
  subtleWheelLightingOnly: true,
  lastWinStat: true,
  cssTableGameSpinButton: true,
  clean2dWheelPresentation: true,
  persistentLastResultHighlights: true,
  noBetSpinError: true,
};

export function RoulettePage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [selectedChip, setSelectedChip] = useState(25);
  const [bets, setBets] = useState<PlacedRouletteBet[]>([]);
  const [settledBets, setSettledBets] = useState<PlacedRouletteBet[]>([]);
  const [lastBets, setLastBets] = useState<PlacedRouletteBet[]>([]);
  const [advancedSelection, setAdvancedSelection] = useState<Array<"0" | "00" | number>>([]);
  const [advancedMode, setAdvancedMode] = useState(false);
  const [infoOpen, setInfoOpen] = useState(false);
  const [result, setResult] = useState<RouletteResult | null>(null);
  const [recentResults, setRecentResults] = useState<Array<"0" | "00" | number>>([]);
  const [spinning, setSpinning] = useState(false);
  const [wheelFocus, setWheelFocus] = useState(false);
  const [spinOutcome, setSpinOutcome] = useState<RouletteResult["outcome"] | null>(null);
  const [spinPhase, setSpinPhase] = useState<RouletteSpinPhase>("idle");
  const [lifecycle, setLifecycle] = useState<RouletteSpinLifecycle>("betting");
  const [largeWinDismissed, setLargeWinDismissed] = useState(false);
  const [, setLastBetFlash] = useState<string | null>(null);
  const [displayBalanceOverride, setDisplayBalanceOverride] = useState<number | null>(null);
  const tickTimers = useRef<number[]>([]);
  const resolutionTimers = useRef<number[]>([]);
  const betFlashTimer = useRef<number | null>(null);
  useEffect(() => () => {
    clearRouletteTickTimers();
    clearRouletteResolutionTimers();
  }, []);
  useEffect(() => () => {
    if (betFlashTimer.current) window.clearTimeout(betFlashTimer.current);
  }, []);
  if (!user) return null;
  const currentUser = user;

  const chips = currency === "GOLD" ? goldChips : bonusChips;
  const tableLimits = rouletteTableLimits[currency];
  const balance = getBalance(currentUser.id, currency);
  const displayedBalance = displayBalanceOverride ?? balance;
  const totalBet = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const interactionLocked = isRouletteInteractionLocked(lifecycle);
  const spinButtonDisabled = interactionLocked;
  const winningIds = new Set(result?.winningBetIds ?? []);
  const winningZoneKeys = new Set(result ? getRouletteWinningZones(result.outcome).map(rouletteBetKey) : []);
  const boardBets = getRouletteBoardBetsForLifecycle(bets, settledBets, lifecycle);
  const visibleBetTotal = boardBets.reduce((sum, bet) => sum + bet.amount, 0);
  const coveragePercent = Math.round((getCoveredOutcomes(boardBets).size / americanWheel.length) * 100);
  const visibleOutcome = interactionLocked ? spinOutcome ?? result?.outcome ?? null : result?.outcome ?? spinOutcome;
  const playState = interactionLocked ? lifecycle : wheelFocus ? "readyNextSpin" : "betting";
  const spinMode = playState !== "betting";
  const largeWin = result && result.totalPaid > 0 && result.totalPaid >= Math.max(result.totalWagered ?? totalBet, 1) * 35 && result.totalPaid >= 5000;
  const resultOutcomeOnBoard = result ? result.outcome : null;
  const showResultOverlay = Boolean(result && shouldShowRouletteResultOverlay(lifecycle));
  const lastWinAmount = getRouletteLastWinAmount(result);
  const rouletteAssetStyle = {
    "--roulette-wheel-art": `url("${rouletteWheelAsset}")`,
    "--roulette-ball-art": `url("${rouletteBallAsset}")`,
    "--roulette-chip-sheet": `url("${rouletteChipSetAsset}")`,
    "--roulette-chip-single": `url("${rouletteChipSingleAsset}")`,
    "--roulette-win-fx": `url("${rouletteWinFxAsset}")`,
    "--roulette-chip-fx": `url("${rouletteChipFxAsset}")`,
    "--roulette-spin-duration": `${ROULETTE_SPIN_MS}ms`,
  } as CSSProperties;

  function placeBet(bet: RouletteBet) {
    if (interactionLocked) return;
    const projected = totalBet + selectedChip;
    if (selectedChip < tableLimits.min) {
      notify(`Minimum ${tableLimits.label} bet is ${formatLimitAmount(tableLimits.min)}.`, "error");
      playError();
      return;
    }
    if (projected > balance) {
      notify("Insufficient balance for that roulette bet.", "error");
      playError();
      return;
    }
    if (projected > tableLimits.max) {
      notify(`Maximum ${tableLimits.label} table bet is ${formatLimitAmount(tableLimits.max)}.`, "error");
      playError();
      return;
    }
    const label = rouletteBetLabel(bet);
    const placedBet = { id: crypto.randomUUID(), bet, amount: selectedChip, label };
    playRouletteChipPlace();
    clearRouletteResolutionTimers();
    setBets((current) => [...current, placedBet]);
    setSettledBets([]);
    setResult(null);
    setSpinOutcome(null);
    setLifecycle("betting");
    setDisplayBalanceOverride(null);
    setLargeWinDismissed(false);
    setLastBetFlash(label);
    if (betFlashTimer.current) window.clearTimeout(betFlashTimer.current);
    betFlashTimer.current = window.setTimeout(() => setLastBetFlash(null), 1150);
  }

  function undoLastBet() {
    if (!interactionLocked) {
      const removedId = bets[bets.length - 1]?.id;
      setBets((current) => current.slice(0, -1));
      if (removedId && lastBets.some((bet) => bet.id === removedId)) {
        setLastBets((current) => current.filter((bet) => bet.id !== removedId));
      }
    }
  }

  function clearBets() {
    if (!interactionLocked) {
      clearRouletteResolutionTimers();
      setBets([]);
      setSettledBets([]);
      setLastBetFlash(null);
    }
  }

  function rebet() {
    if (interactionLocked || lastBets.length === 0) return;
    const total = lastBets.reduce((sum, bet) => sum + bet.amount, 0);
    if (total > balance) {
      notify("Insufficient balance to rebet.", "error");
      return;
    }
    if (total > tableLimits.max) {
      notify(`Maximum ${tableLimits.label} table bet is ${formatLimitAmount(tableLimits.max)}.`, "error");
      return;
    }
    const repeatedBets = lastBets.map((bet) => ({ ...bet, id: crypto.randomUUID() }));
    clearRouletteResolutionTimers();
    setBets(repeatedBets);
    setSettledBets([]);
    setResult(null);
    setSpinOutcome(null);
    setLifecycle("betting");
    setDisplayBalanceOverride(null);
    setLargeWinDismissed(false);
  }

  function doubleBets() {
    if (interactionLocked || bets.length === 0) return;
    const doubledTotal = totalBet * 2;
    if (doubledTotal > balance) {
      notify("Insufficient balance to double all roulette bets.", "error");
      return;
    }
    if (doubledTotal > tableLimits.max) {
      notify(`Maximum ${tableLimits.label} table bet is ${formatLimitAmount(tableLimits.max)}.`, "error");
      return;
    }
    const doubledBets = bets.map((bet) => ({ ...bet, amount: bet.amount * 2 }));
    setBets(doubledBets);
    setSettledBets([]);
    setResult(null);
    setDisplayBalanceOverride(null);
  }

  function clearRouletteTickTimers() {
    tickTimers.current.forEach((timer) => window.clearTimeout(timer));
    tickTimers.current = [];
  }

  function clearRouletteResolutionTimers() {
    resolutionTimers.current.forEach((timer) => window.clearTimeout(timer));
    resolutionTimers.current = [];
  }

  function scheduleRouletteTicks() {
    clearRouletteTickTimers();
    const tickPattern = [45, 90, 136, 182, 230, 280, 332, 386, 444, 506, 572, 642, 718, 800, 888, 984, 1088, 1200, 1322, 1454, 1596, 1748, 1910, 2084, 2270, 2470, 2686, 2920, 3172, 3440, 3715, 3995, 4270, 4520, 4760, 5000, 5230, 5440];
    tickPattern.forEach((delay, index) => {
      tickTimers.current.push(window.setTimeout(() => playRouletteTick(index + 1), delay));
    });
    [4300, 4560, 4820, 5060, 5290, 5500, 5650].forEach((delay, index) => {
      tickTimers.current.push(window.setTimeout(() => playRouletteBounce(index + 1), delay));
    });
    [
      ["accelerating", 0],
      ["sustained", 900],
      ["slowdown", 3200],
      ["bounce", 4300],
      ["settle", 5480],
    ].forEach(([phase, delay]) => {
      tickTimers.current.push(window.setTimeout(() => setSpinPhase(phase as RouletteSpinPhase), delay as number));
    });
  }

  function toggleAdvanced(number: "0" | "00" | number) {
    if (!advancedMode) {
      placeBet({ kind: "straight", value: number });
      return;
    }
    setAdvancedSelection((current) => (
      current.includes(number) ? current.filter((value) => value !== number) : [...current, number].slice(-6)
    ));
  }

  function advancedBet(): RouletteBet | null {
    const sorted = [...advancedSelection].sort((a, b) => {
      const av = a === "0" ? 0 : a === "00" ? -1 : a;
      const bv = b === "0" ? 0 : b === "00" ? -1 : b;
      return av - bv;
    });
    if (sorted.length === 1) return { kind: "straight", value: sorted[0] };
    if (sorted.length === 2 && isValidSplit(sorted)) return { kind: "split", numbers: sorted };
    if (sorted.length === 3 && isValidStreet(sorted)) return { kind: "street", numbers: sorted as number[] };
    if (sorted.length === 4 && isValidCorner(sorted)) return { kind: "corner", numbers: sorted as number[] };
    if (sorted.length === 5 && sorted.includes("0") && sorted.includes("00")) return { kind: "basket", numbers: sorted };
    if (sorted.length === 6 && isValidSixLine(sorted)) return { kind: "sixLine", numbers: sorted as number[] };
    return null;
  }

  function confirmAdvancedBet() {
    const built = advancedBet();
    if (!built) {
      notify("Select a valid split, street, corner, six-line, or basket group.", "error");
      return;
    }
    placeBet(built);
    setAdvancedSelection([]);
  }

  function switchCurrency(nextCurrency: Currency) {
    if (interactionLocked || nextCurrency === currency) return;
    clearRouletteResolutionTimers();
    setCurrency(nextCurrency);
    setSelectedChip(defaultChipByCurrency[nextCurrency]);
    setBets([]);
    setSettledBets([]);
    setResult(null);
    setSpinOutcome(null);
    setLastBetFlash(null);
    setLifecycle("betting");
    setDisplayBalanceOverride(null);
    setInfoOpen(false);
  }

  function spin() {
    if (interactionLocked) return;
    if (bets.length === 0) {
      notify("Place a bet before spinning.", "error");
      playError();
      return;
    }
    if (totalBet < tableLimits.min) {
      notify(`Minimum ${tableLimits.label} bet is ${formatLimitAmount(tableLimits.min)}.`, "error");
      playError();
      return;
    }
    if (totalBet > balance) {
      notify("Insufficient balance for this spin.", "error");
      playError();
      return;
    }
    if (totalBet > tableLimits.max) {
      notify(`Maximum ${tableLimits.label} table bet is ${formatLimitAmount(tableLimits.max)}.`, "error");
      playError();
      return;
    }
    const outcome = americanWheel[Math.floor(Math.random() * americanWheel.length)];
    const spinBets = bets;
    clearRouletteResolutionTimers();
    if (betFlashTimer.current) window.clearTimeout(betFlashTimer.current);
    setLastBetFlash(null);
    setDisplayBalanceOverride(balance);
    playRouletteSpinStart();
    scheduleRouletteTicks();
    setSpinning(true);
    setWheelFocus(true);
    setLifecycle("spinning");
    setSpinPhase("accelerating");
    setSpinOutcome(outcome);
    setLargeWinDismissed(false);
    window.setTimeout(() => {
      try {
        const next = resolveRouletteBets({ userId: currentUser.id, currency, bets: spinBets, outcome });
        setResult(next);
        setRecentResults((current) => getNextRouletteHistory(current, outcome));
        setLastBets(spinBets);
        setSettledBets(spinBets);
        setBets([]);
        setLifecycle("ballSettling");
        recordRetentionRound({
          userId: currentUser.id,
          gameId: "roulette",
          wager: next.totalWagered ?? totalBet,
          won: next.totalPaid,
          multiplier: (next.totalWagered ?? totalBet) > 0 ? next.totalPaid / (next.totalWagered ?? totalBet) : 0,
        });
        playRouletteReveal();
        resolutionTimers.current.push(window.setTimeout(() => {
          setLifecycle("resultReveal");
        }, rouletteResultTiming.numberHighlightMs));
        resolutionTimers.current.push(window.setTimeout(() => {
          setLifecycle("chipResolution");
          setDisplayBalanceOverride(null);
          refreshUser();
          if (next.totalPaid > 0) {
            playRoulettePayout();
            playWin();
          } else playLose();
        }, ROULETTE_CHIP_RESOLUTION_DELAY_MS));
        resolutionTimers.current.push(window.setTimeout(() => {
          setSettledBets([]);
          setWheelFocus(false);
          setSpinOutcome(null);
          setSpinPhase("idle");
          setLifecycle("readyNextSpin");
        }, ROULETTE_READY_NEXT_SPIN_DELAY_MS));
      } catch (caught) {
        notify(caught instanceof Error ? caught.message : "Roulette spin failed.", "error");
        playError();
        setLifecycle("betting");
        setDisplayBalanceOverride(null);
        setWheelFocus(false);
        setSpinOutcome(null);
        setSpinPhase("idle");
      } finally {
        setSpinning(false);
        clearRouletteTickTimers();
      }
    }, ROULETTE_SPIN_MS);
  }

  return (
    <section
      className={`roulette-clean-page roulette-premium-page roulette-landscape-only ${spinMode ? "spin-mode" : "betting-mode"} ${spinning ? "is-spinning" : ""} ${result ? "has-result" : ""}`.trim()}
      style={rouletteAssetStyle}
      data-play-state={playState}
      data-lifecycle={lifecycle}
      data-spin-phase={spinPhase}
    >
      <div className="roulette-rotate-prompt">
        <button className="roulette-rotate-back" onClick={onExit} aria-label="Back to table games">&lt; Home</button>
        <strong>Rotate device to play Roulette</strong>
        <span>This table is built for landscape so the wheel, chips, and full board stay spacious.</span>
        <span>{COMPLIANCE_COPY}</span>
      </div>

      <header className="roulette-clean-header">
        <button className="roulette-back" onClick={onExit} aria-label="Back to table games"><ChevronLeft size={22} /></button>
        <div className="roulette-title">
          <strong>Roulette</strong>
          <button
            type="button"
            aria-label="Roulette rules and table limits"
            aria-controls="roulette-info-popover"
            aria-expanded={infoOpen}
            title={`Min ${tableLimits.label} ${formatLimitAmount(tableLimits.min)} / Max ${tableLimits.label} ${formatLimitAmount(tableLimits.max)}`}
            onClick={() => setInfoOpen((open) => !open)}
          >
            <Info size={15} />
          </button>
          {infoOpen && (
            <div id="roulette-info-popover" className="roulette-info-popover" role="dialog" aria-label="Roulette information">
              <strong>American Double Zero</strong>
              <span>Min {tableLimits.label}: {formatLimitAmount(tableLimits.min)}</span>
              <span>Max {tableLimits.label}: {formatLimitAmount(tableLimits.max)}</span>
              <small>Place straights, splits, streets, corners, six-lines, dozens, columns, and outside bets directly on the table. Virtual coins only.</small>
            </div>
          )}
        </div>
        <div className="roulette-header-balance">
          <span>Balance</span>
          <strong>{formatBalanceCompact(displayedBalance)}</strong>
        </div>
        <div className="roulette-currency-tabs">
          <button className={currency === "GOLD" ? "active" : ""} disabled={interactionLocked} onClick={() => switchCurrency("GOLD")}>GC</button>
          <button className={currency === "BONUS" ? "active" : ""} disabled={interactionLocked} onClick={() => switchCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="roulette-sound-button ghost-button icon-only" compact />
      </header>

      <ScreenShake active={Boolean(result && (result.net ?? 0) >= Math.max(result.totalWagered ?? 1, 1) * 8)}>
      <section className="roulette-layout">
        <section className="roulette-wheel-theater" aria-live="polite">
          <div className="roulette-theater-copy">
            <span>{spinning ? "Ball in motion" : result ? "Winning number" : "Place your bets"}</span>
            <strong className={visibleOutcome ? getRouletteColor(visibleOutcome) : ""}>
              {spinning ? "..." : visibleOutcome ?? "Ready"}
            </strong>
            <small>
              {spinning
                ? spinPhase === "bounce" || spinPhase === "settle" ? "Final bounce" : spinPhase === "slowdown" ? "Ball slowing" : "Wheel building heat"
                : result
                  ? `Won ${formatCoins(result.totalPaid)} - Net ${(result.net ?? 0) >= 0 ? "+" : ""}${formatCoins(result.net ?? 0)}`
                  : `${bets.length} bets - ${formatCoins(totalBet)} on felt`}
            </small>
          </div>
          <div className="roulette-wheel-shell">
            <RouletteWheel outcome={visibleOutcome} spinning={spinning} showLabel={false} />
          </div>
          <LastResults values={recentResults} />
        </section>
        <div className="roulette-board-wrap">
          <FullRouletteBoard
            bets={boardBets}
            winningIds={winningIds}
            winningZoneKeys={winningZoneKeys}
            resultOutcome={resultOutcomeOnBoard}
            resolutionState={lifecycle}
            currency={currency}
            disabled={interactionLocked}
            onBet={placeBet}
          />
        </div>

        <aside className="roulette-bets-panel">
          <div className="roulette-side-actions">
            <button onClick={undoLastBet} disabled={interactionLocked || bets.length === 0} aria-label="Undo last bet" title="Undo"><RotateCcw size={16} /></button>
            <button onClick={clearBets} disabled={interactionLocked || (bets.length === 0 && settledBets.length === 0)} aria-label="Clear bets" title="Clear"><Trash2 size={16} /></button>
            <button onClick={rebet} disabled={interactionLocked || lastBets.length === 0} aria-label="Repeat last bets" title="Repeat"><Repeat2 size={16} /></button>
            <button onClick={doubleBets} disabled={interactionLocked || bets.length === 0} aria-label="Double all bets" title="Double all bets">2x</button>
          </div>
          <div className="roulette-stats">
            <span>Total Bet <strong>{formatCoins(visibleBetTotal)}</strong></span>
            <span>Last Win <strong>{formatCoins(lastWinAmount)}</strong></span>
            <span>Min {tableLimits.label} <strong>{formatLimitAmount(tableLimits.min)}</strong></span>
            <span>Max {tableLimits.label} <strong>{formatLimitAmount(tableLimits.max)}</strong></span>
          </div>
          <div className="roulette-chip-tray" aria-label="Select chip value">
            <span>Chips</span>
            <ChipSelector
              chips={chips}
              selectedChip={selectedChip}
              currency={currency}
              disabled={interactionLocked}
              onSelect={(chip) => {
                setSelectedChip(chip);
              }}
            />
          </div>
          <div className="roulette-history-panel">
            <div className="roulette-history-block">
              <span>Last 5</span>
              <RouletteLastFiveNumbers values={recentResults} />
            </div>
            <CurrentBetsSummary bets={boardBets} />
          </div>
          <div className="roulette-coverage" style={{ "--coverage": coveragePercent } as CSSProperties} aria-label={`Board coverage ${coveragePercent}%`}>
            <strong>{coveragePercent}%</strong>
            <span>Cover</span>
          </div>
          <div className="roulette-bottom-wheel">
            <button className={spinning ? "roulette-spin-cta spinning" : "roulette-spin-cta"} disabled={spinButtonDisabled} onClick={spin} aria-label={spinning ? "Roulette spinning" : bets.length === 0 ? "Place a bet before spinning" : "Spin roulette wheel"}>
              <span className="roulette-spin-text">{spinning ? "Spinning" : "Spin"}</span>
            </button>
          </div>
          {result && (
            <GameResultBanner
              tone={result.totalPaid > 0 ? ((result.net ?? 0) >= 0 ? "win" : "loss") : "loss"}
              title={result.totalPaid > 0 ? "Roulette Win" : "No Hit"}
              amount={result.totalPaid > 0 ? result.totalPaid : undefined}
              message={`Landed ${result.outcome} ${result.color}. Net ${(result.net ?? 0) >= 0 ? "+" : ""}${formatCoins(result.net ?? 0)}`}
              compact
            />
          )}
          <div className="demo-copy game-compliance-copy">{COMPLIANCE_COPY}</div>
        </aside>

      </section>
      </ScreenShake>
      {result && showResultOverlay && (
        <div className={`roulette-result-popover ${result.totalPaid > 0 ? "win" : "loss"}`} role="status" aria-live="polite">
          <span>Winning Number</span>
          <strong>{getRouletteResultOverlayCopy(result).heading}</strong>
          <small>{getRouletteResultOverlayCopy(result).status}</small>
          <small>{getRouletteResultOverlayCopy(result).totalBet}</small>
          <small>{getRouletteResultOverlayCopy(result).net}</small>
        </div>
      )}
      <WinOverlay
        show={Boolean(largeWin && lifecycle === "chipResolution" && !largeWinDismissed)}
        title="Roulette Heat"
        amount={result?.totalPaid ?? 0}
        big
        onDismiss={() => setLargeWinDismissed(true)}
      >
        Winning number {result?.outcome}
      </WinOverlay>
    </section>
  );
}

const outsideBets: Array<{ label: string; bet: RouletteBet; className?: string }> = [
  { label: "1-18", bet: { kind: "range", value: "low" } },
  { label: "Even", bet: { kind: "parity", value: "even" } },
  { label: "Red", bet: { kind: "color", value: "red" }, className: "red" },
  { label: "Black", bet: { kind: "color", value: "black" }, className: "black" },
  { label: "Odd", bet: { kind: "parity", value: "odd" } },
  { label: "19-36", bet: { kind: "range", value: "high" } },
];

type BetAnchorMode = "buttonCenter" | "straightCenter" | "splitMidpoint" | "streetEdge" | "sixStreetEdge" | "cornerIntersection";

export interface RouletteBetAnchor {
  key: string;
  mode: BetAnchorMode;
  measurement: "domRect";
  logical?: { left: number; top: number };
}

export function getBetAnchor(bet: RouletteBet): RouletteBetAnchor {
  const key = rouletteBetKey(bet);
  if (bet.kind === "straight" && typeof bet.value === "number") {
    return { key, mode: "straightCenter", measurement: "domRect", logical: numberAnchorPoint(bet.value) };
  }
  if (bet.kind === "split" || bet.kind === "corner") {
    const numericNumbers = bet.numbers.filter(isRouletteBoardNumber) as number[];
    if (numericNumbers.length > 0) {
      const points = numericNumbers.map(numberAnchorPoint);
      return {
        key,
        mode: bet.kind === "corner" ? "cornerIntersection" : "splitMidpoint",
        measurement: "domRect",
        logical: {
          left: average(points.map((point) => point.left)),
          top: average(points.map((point) => point.top)),
        },
      };
    }
  }
  if (bet.kind === "street" || bet.kind === "sixLine") {
    const numericNumbers = bet.numbers.filter(isRouletteBoardNumber) as number[];
    if (numericNumbers.length > 0) {
      const start = numberStreetStart(Math.min(...numericNumbers));
      const streetIndex = Math.floor((start - 1) / 3);
      return {
        key,
        mode: bet.kind === "sixLine" ? "sixStreetEdge" : "streetEdge",
        measurement: "domRect",
        logical: {
          left: (streetIndex + (bet.kind === "sixLine" ? 1 : 0.5)) * (100 / 12),
          top: 100,
        },
      };
    }
  }
  return { key, mode: "buttonCenter", measurement: "domRect" };
}

function numberAnchorPoint(number: number) {
  const streetIndex = Math.floor((number - 1) / 3);
  const rowIndex = boardRows.findIndex((row) => row.includes(number));
  return {
    left: (streetIndex + 0.5) * (100 / 12),
    top: (rowIndex + 0.5) * (100 / 3),
  };
}

function FullRouletteBoard({
  bets,
  winningIds,
  winningZoneKeys,
  resultOutcome,
  resolutionState,
  currency,
  disabled,
  onBet,
}: {
  bets: PlacedRouletteBet[];
  winningIds: Set<string>;
  winningZoneKeys: Set<string>;
  resultOutcome: RouletteResult["outcome"] | null;
  resolutionState: RouletteSpinLifecycle;
  currency: Currency;
  disabled: boolean;
  onBet: (bet: RouletteBet) => void;
}) {
  const grouped = useMemo(() => groupRouletteBets(bets), [bets]);
  const boardRef = useRef<HTMLDivElement | null>(null);
  const anchorRefs = useRef(new Map<string, HTMLElement>());
  const [anchorPoints, setAnchorPoints] = useState<Record<string, { left: number; top: number }>>({});
  const stackFor = (bet: RouletteBet) => grouped.get(rouletteBetKey(bet)) ?? [];
  const zoneClass = (bet: RouletteBet, extra = "") => {
    const key = rouletteBetKey(bet);
    return `${extra} ${stackFor(bet).length ? "active" : ""} ${winningZoneKeys.has(key) ? "winner" : ""}`.trim();
  };
  const registerBetAnchor = useCallback((bet: RouletteBet) => {
    const key = rouletteBetKey(bet);
    return (element: HTMLElement | null) => {
      if (element) anchorRefs.current.set(key, element);
      else anchorRefs.current.delete(key);
    };
  }, []);
  const measureBetAnchors = useCallback(() => {
    const boardElement = boardRef.current;
    if (!boardElement) return;
    const boardRect = boardElement.getBoundingClientRect();
    if (boardRect.width === 0 || boardRect.height === 0) return;
    const next: Record<string, { left: number; top: number }> = {};
    anchorRefs.current.forEach((element, key) => {
      const rect = element.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      next[key] = {
        left: ((rect.left + rect.width / 2 - boardRect.left) / boardRect.width) * 100,
        top: ((rect.top + rect.height / 2 - boardRect.top) / boardRect.height) * 100,
      };
    });
    setAnchorPoints((current) => areAnchorPointsEqual(current, next) ? current : next);
  }, []);

  useLayoutEffect(() => {
    if (typeof window === "undefined") return;
    let frame = 0;
    const scheduleMeasure = () => {
      window.cancelAnimationFrame(frame);
      frame = window.requestAnimationFrame(measureBetAnchors);
    };
    scheduleMeasure();
    const resizeObserver = typeof window.ResizeObserver === "function" ? new window.ResizeObserver(scheduleMeasure) : null;
    if (resizeObserver && boardRef.current) {
      resizeObserver.observe(boardRef.current);
      anchorRefs.current.forEach((element) => resizeObserver.observe(element));
    }
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", scheduleMeasure);
    return () => {
      window.cancelAnimationFrame(frame);
      resizeObserver?.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", scheduleMeasure);
    };
  }, [measureBetAnchors, bets.length, resolutionState]);

  return (
    <div ref={boardRef} className={`roulette-board roulette-full-board lifecycle-${resolutionState}`.trim()} aria-label="Full American roulette betting board">
      <div className="roulette-zero-zone">
        <button
          className={zoneClass({ kind: "straight", value: "0" }, `zero ${resultOutcome === "0" ? "winner" : ""}`)}
          ref={registerBetAnchor({ kind: "straight", value: "0" })}
          data-bet-anchor={rouletteBetKey({ kind: "straight", value: "0" })}
          disabled={disabled}
          onClick={() => onBet({ kind: "straight", value: "0" })}
          aria-label="Straight 0"
        >
          0
        </button>
        <button
          className={zoneClass({ kind: "straight", value: "00" }, `double-zero ${resultOutcome === "00" ? "winner" : ""}`)}
          ref={registerBetAnchor({ kind: "straight", value: "00" })}
          data-bet-anchor={rouletteBetKey({ kind: "straight", value: "00" })}
          disabled={disabled}
          onClick={() => onBet({ kind: "straight", value: "00" })}
          aria-label="Straight 00"
        >
          00
        </button>
        <button
          className={zoneClass({ kind: "split", numbers: ["0", "00"] }, "zero-mid-split")}
          ref={registerBetAnchor({ kind: "split", numbers: ["0", "00"] })}
          data-bet-anchor={rouletteBetKey({ kind: "split", numbers: ["0", "00"] })}
          disabled={disabled}
          onClick={() => onBet({ kind: "split", numbers: ["0", "00"] })}
          aria-label="Split 0 and 00"
        />
      </div>

      <div className="roulette-number-field">
        {numberCells.map(({ number, rowIndex, streetIndex }) => {
          const bet = { kind: "straight", value: number } satisfies RouletteBet;
          return (
            <button
              key={number}
              className={zoneClass(bet, `${redNumbers.has(number) ? "red" : "black"} ${resultOutcome === number ? "winner" : ""}`)}
              ref={registerBetAnchor(bet)}
              data-bet-anchor={rouletteBetKey(bet)}
              disabled={disabled}
              style={{ "--street-index": streetIndex + 1, "--row-index": rowIndex + 1 } as CSSProperties}
              onClick={() => onBet(bet)}
              aria-label={`Straight ${number}`}
            >
              <span>{number}</span>
            </button>
          );
        })}
        <InsideHitAreas bets={bets} winningZoneKeys={winningZoneKeys} disabled={disabled} onBet={onBet} registerBetAnchor={registerBetAnchor} />
      </div>

      <div className="column-bets">
        {[3, 2, 1].map((column) => {
          const bet = { kind: "column", value: column as 1 | 2 | 3 } satisfies RouletteBet;
          return (
            <button key={column} ref={registerBetAnchor(bet)} data-bet-anchor={rouletteBetKey(bet)} className={zoneClass(bet)} disabled={disabled} aria-label={rouletteBetLabel(bet)} onClick={() => onBet(bet)}>
              2:1
            </button>
          );
        })}
      </div>

      <div className="dozen-bets">
        {[1, 2, 3].map((dozen) => {
          const bet = { kind: "dozen", value: dozen as 1 | 2 | 3 } satisfies RouletteBet;
          return (
            <button key={dozen} ref={registerBetAnchor(bet)} data-bet-anchor={rouletteBetKey(bet)} className={zoneClass(bet)} disabled={disabled} aria-label={rouletteBetLabel(bet)} onClick={() => onBet(bet)}>
              {dozen === 1 ? "1st" : dozen === 2 ? "2nd" : "3rd"} 12
            </button>
          );
        })}
      </div>

      <div className="outside-bets">
        {outsideBets.map(({ label, bet, className }) => (
          <button key={label} ref={registerBetAnchor(bet)} data-bet-anchor={rouletteBetKey(bet)} className={zoneClass(bet, className ?? "")} disabled={disabled} aria-label={rouletteBetLabel(bet)} onClick={() => onBet(bet)}>
            {label}
          </button>
        ))}
      </div>

      <BoardChipLayer groupedBets={grouped} anchorPoints={anchorPoints} winningIds={winningIds} resolutionState={resolutionState} currency={currency} />
    </div>
  );
}

function groupRouletteBets(bets: PlacedRouletteBet[]) {
  const grouped = new Map<string, PlacedRouletteBet[]>();
  bets.forEach((bet) => {
    const key = rouletteBetKey(bet.bet);
    grouped.set(key, [...(grouped.get(key) ?? []), bet]);
  });
  return grouped;
}

function BoardChipLayer({
  groupedBets,
  anchorPoints,
  winningIds,
  resolutionState,
  currency,
}: {
  groupedBets: Map<string, PlacedRouletteBet[]>;
  anchorPoints: Record<string, { left: number; top: number }>;
  winningIds: Set<string>;
  resolutionState: RouletteSpinLifecycle;
  currency: Currency;
}) {
  return (
    <div className="roulette-board-chip-layer" aria-hidden="true">
      {[...groupedBets.entries()].map(([key, stack]) => {
        const anchor = anchorPoints[key];
        if (!anchor) return null;
        return (
          <ChipStack
            key={key}
            bets={stack}
            winningIds={winningIds}
            resolutionState={resolutionState}
            currency={currency}
            className={`anchored ${getBetAnchor(stack[0].bet).mode}`}
            style={chipAnchorStyle(anchor)}
          />
        );
      })}
    </div>
  );
}

function chipAnchorStyle(anchor: { left: number; top: number }) {
  return {
    "--anchor-chip-left": `${anchor.left}%`,
    "--anchor-chip-top": `${anchor.top}%`,
  } as CSSProperties;
}

function areAnchorPointsEqual(current: Record<string, { left: number; top: number }>, next: Record<string, { left: number; top: number }>) {
  const currentKeys = Object.keys(current);
  const nextKeys = Object.keys(next);
  if (currentKeys.length !== nextKeys.length) return false;
  return nextKeys.every((key) => {
    const a = current[key];
    const b = next[key];
    return Boolean(a && Math.abs(a.left - b.left) < 0.05 && Math.abs(a.top - b.top) < 0.05);
  });
}

function chipTier(value: number, currency: Currency = "GOLD") {
  if (currency === "BONUS") {
    if (value >= 100) return "aurum";
    if (value >= 25) return "platinum";
    if (value >= 5) return "violet";
    if (value >= 1) return "onyx";
    if (value >= 0.25) return "emerald";
    if (value >= 0.05) return "ruby";
    return "ivory";
  }
  if (value >= 5000) return "aurum";
  if (value >= 1000) return "platinum";
  if (value >= 500) return "violet";
  if (value >= 100) return "onyx";
  if (value >= 25) return "emerald";
  if (value >= 5) return "ruby";
  return "ivory";
}

function chipSpriteIndex(value: number) {
  if (value >= 1000) return 5;
  if (value >= 500) return 4;
  if (value >= 100) return 3;
  if (value >= 25) return 2;
  if (value >= 5) return 1;
  return 0;
}

function chipSpriteStyle(value: number) {
  return { "--chip-position": `${chipSpriteIndex(value) * 20}%` } as CSSProperties;
}

export function ChipSelector({
  chips,
  selectedChip,
  currency,
  disabled,
  onSelect,
}: {
  chips: number[];
  selectedChip: number;
  currency: Currency;
  disabled: boolean;
  onSelect: (chip: number) => void;
}) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (disabled) setOpen(false);
  }, [disabled]);
  return (
    <div className={open ? "roulette-chip-selector open" : "roulette-chip-selector"}>
      <button
        className={`roulette-chip chip-${chipTier(selectedChip, currency)} active`.trim()}
        style={chipSpriteStyle(selectedChip)}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        aria-expanded={open}
        aria-label={`Selected chip ${formatChipValue(selectedChip)}`}
      >
        <span>{formatChipValue(selectedChip)}</span>
      </button>
      {open && (
        <div className="roulette-chip-fan" role="menu" aria-label="Chip values">
          {chips.filter((chip) => chip !== selectedChip).map((chip, index) => (
            <ChipButton
              key={chip}
              value={chip}
              currency={currency}
              selected={false}
              disabled={disabled}
              fanIndex={index}
              fanCount={chips.length - 1}
              onSelect={() => {
                onSelect(chip);
                setOpen(false);
              }}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ChipButton({
  value,
  currency,
  selected,
  disabled,
  fanIndex,
  fanCount,
  onSelect,
}: {
  value: number;
  currency: Currency;
  selected: boolean;
  disabled: boolean;
  fanIndex: number;
  fanCount: number;
  onSelect: () => void;
}) {
  const offset = fanIndex - (fanCount - 1) / 2;
  return (
    <button
      className={`roulette-chip chip-${chipTier(value, currency)} ${selected ? "active" : ""}`.trim()}
      style={{ ...chipSpriteStyle(value), "--fan-x": `${offset * 82}%`, "--fan-y": `${-118 - Math.abs(offset) * 8}%` } as CSSProperties}
      disabled={disabled}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span>{formatChipValue(value)}</span>
    </button>
  );
}

function formatChipValue(value: number) {
  if (value >= 1000000) return `${formatCompactChipNumber(value / 1000000)}M`;
  if (value >= 1000) return `${formatCompactChipNumber(value / 1000)}K`;
  return formatCoins(value);
}

function formatCompactChipNumber(value: number) {
  return Number.isInteger(value) ? `${value}` : value.toFixed(1).replace(/\.0$/, "");
}

function formatLimitAmount(value: number) {
  return value >= 1000 ? formatCoins(value) : formatCoins(value);
}

function formatBalanceCompact(value: number) {
  if (value >= 1000000) return `${formatCoins(value / 1000000)}M`;
  if (value >= 10000) return `${formatCoins(value / 1000)}K`;
  return formatCoins(value);
}

export function ChipStack({
  bets,
  winningIds,
  resolutionState = "betting",
  currency = "GOLD",
  className = "",
  style,
}: {
  bets: PlacedRouletteBet[];
  winningIds: Set<string>;
  resolutionState?: RouletteSpinLifecycle;
  currency?: Currency;
  className?: string;
  style?: CSSProperties;
}) {
  if (bets.length === 0) return null;
  const total = bets.reduce((sum, bet) => sum + bet.amount, 0);
  const chipsToShow = Array.from({ length: Math.min(4, bets.length) }, (_, index) => index);
  const tier = chipTier(total, currency);
  const winning = bets.some((bet) => winningIds.has(bet.id));
  const resolving = resolutionState === "chipResolution";
  return (
    <span
      className={`board-chip chip-${tier} ${winning ? "win" : ""} ${resolving && winning ? "payout" : ""} ${resolving && !winning ? "lose" : ""} ${className}`.trim()}
      data-resolution={resolutionState}
      style={{ ...chipSpriteStyle(total), ...style } as CSSProperties}
    >
      {chipsToShow.map((chip) => <i key={chip} style={{ "--stack-index": chip } as CSSProperties} />)}
      <b>{formatChipValue(total)}</b>
      {bets.length > 1 && <small>x{bets.length}</small>}
    </span>
  );
}

export function RouletteWheel({ outcome, spinning, showLabel = true }: { outcome: RouletteResult["outcome"] | null; spinning: boolean; showLabel?: boolean }) {
  const [motion, setMotion] = useState<RouletteWheelMotion>(() => getRouletteWheelMotion(outcome, 1));
  const outcomeIndex = getRouletteWheelPocketIndex(outcome);
  const winningPoint = getRouletteWheelMotion(outcome, 1);

  useEffect(() => {
    if (!spinning || outcome == null) {
      setMotion(getRouletteWheelMotion(outcome, 1));
      return;
    }

    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const duration = reducedMotion ? 1800 : ROULETTE_SPIN_MS;
    const start = performance.now();
    let frame = 0;

    const animate = (now: number) => {
      const progress = clamp01((now - start) / duration);
      setMotion(getRouletteWheelMotion(outcome, progress));
      if (progress < 1) frame = window.requestAnimationFrame(animate);
    };

    setMotion(getRouletteWheelMotion(outcome, 0));
    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, [outcome, spinning]);

  const wheelStyle = {
    "--wheel-rotation": `${motion.ringRotation}deg`,
    "--ball-x": `${motion.ballX}%`,
    "--ball-y": `${motion.ballY}%`,
    "--ball-scale": motion.ballScale,
    "--ball-lift": `${motion.ballLift}px`,
    "--ball-blur": `${motion.ballBlur}px`,
    "--win-x": `${winningPoint.ballX}%`,
    "--win-y": `${winningPoint.ballY}%`,
  } as CSSProperties;

  return (
    <div
      className={`${spinning ? "roulette-wheel-visual realistic is-spinning" : "roulette-wheel-visual realistic"} ${outcome && !spinning ? "is-settled" : ""}`.trim()}
      style={wheelStyle}
      data-pocket-index={outcomeIndex}
      data-result={outcome ?? ""}
    >
      <span className="roulette-wheel-shadow-layer" aria-hidden="true" />
      <span className="roulette-wheel-base-layer" aria-hidden="true" />
      <span className="roulette-wheel-bowl" aria-hidden="true" />
      <span className="roulette-ball-track" aria-hidden="true" />
      <div className="roulette-number-ring-perspective">
        <div className="roulette-number-ring-layer">
          <svg className="roulette-wheel-svg" viewBox="0 0 200 200" aria-hidden="true">
            <defs>
              <radialGradient id="rouletteWood" cx="50%" cy="50%" r="56%">
                <stop offset="0%" stopColor="#f59e0b" />
                <stop offset="44%" stopColor="#7c2d12" />
                <stop offset="100%" stopColor="#2b1206" />
              </radialGradient>
              <radialGradient id="rouletteHub" cx="38%" cy="34%" r="66%">
                <stop offset="0%" stopColor="#cbd5e1" />
                <stop offset="26%" stopColor="#64748b" />
                <stop offset="100%" stopColor="#111827" />
              </radialGradient>
              <radialGradient id="rouletteRedPocket" cx="35%" cy="25%" r="78%">
                <stop offset="0%" stopColor="#ff7a5f" />
                <stop offset="42%" stopColor="#e92f25" />
                <stop offset="100%" stopColor="#8f1414" />
              </radialGradient>
              <radialGradient id="rouletteBlackPocket" cx="35%" cy="25%" r="78%">
                <stop offset="0%" stopColor="#4d6380" />
                <stop offset="44%" stopColor="#17263a" />
                <stop offset="100%" stopColor="#050b14" />
              </radialGradient>
              <radialGradient id="rouletteGreenPocket" cx="35%" cy="25%" r="78%">
                <stop offset="0%" stopColor="#4ade80" />
                <stop offset="40%" stopColor="#10a86b" />
                <stop offset="100%" stopColor="#056041" />
              </radialGradient>
            </defs>
            <circle cx="100" cy="100" r="96" fill="rgba(22, 10, 4, 0.92)" stroke="#f59e0b" strokeWidth="4" />
            <circle cx="100" cy="100" r="88" fill="#130b05" stroke="#7c2d12" strokeWidth="4" />
            <g className="roulette-wheel-disc">
              {americanWheel.map((value, index) => {
                const color = getRouletteColor(value);
                const midAngle = -90 + index * roulettePocketAngle;
                return (
                  <g key={value}>
                    <path
                      className={`roulette-pocket-slice ${color} ${outcome === value ? "target" : ""} ${outcome === value && !spinning ? "winning" : ""}`.trim()}
                      fill={`url(#roulette${color[0].toUpperCase()}${color.slice(1)}Pocket)`}
                      d={describeWheelSlice(100, 100, 53, 86, -90 + (index - 0.5) * roulettePocketAngle, -90 + (index + 0.5) * roulettePocketAngle)}
                    />
                    <text
                      className="roulette-pocket-label"
                      x={100 + 70 * Math.cos((midAngle * Math.PI) / 180)}
                      y={100 + 70 * Math.sin((midAngle * Math.PI) / 180)}
                      transform={`rotate(${midAngle + 90} ${100 + 70 * Math.cos((midAngle * Math.PI) / 180)} ${100 + 70 * Math.sin((midAngle * Math.PI) / 180)})`}
                    >
                      {value}
                    </text>
                  </g>
                );
              })}
            </g>
            <circle cx="100" cy="100" r="52" fill="rgba(38, 18, 7, 0.96)" stroke="#d97706" strokeWidth="3" />
          </svg>
        </div>
      </div>
      <span className="roulette-inner-rotor" aria-hidden="true" />
      <span className="roulette-center-cap-layer" aria-hidden="true" />
      <div className="roulette-ball-layer">
        <span className="roulette-ball-shadow" />
        <span className="roulette-ball" />
      </div>
      {outcome && !spinning && <span className="roulette-winning-pocket-glow" aria-hidden="true" />}
      {outcome && !spinning && <span className="roulette-winning-fx" aria-hidden="true" />}
      <span className="roulette-lighting-overlay" aria-hidden="true" />
      <span className="roulette-wheel-pointer" aria-hidden="true" />
      {showLabel && <strong>{spinning ? "..." : outcome ?? "Spin"}</strong>}
    </div>
  );
}

function describeWheelSlice(cx: number, cy: number, innerRadius: number, outerRadius: number, startAngle: number, endAngle: number) {
  const outerStart = polarPoint(cx, cy, outerRadius, startAngle);
  const outerEnd = polarPoint(cx, cy, outerRadius, endAngle);
  const innerEnd = polarPoint(cx, cy, innerRadius, endAngle);
  const innerStart = polarPoint(cx, cy, innerRadius, startAngle);
  const largeArcFlag = endAngle - startAngle <= 180 ? 0 : 1;
  return [
    `M ${outerStart.x} ${outerStart.y}`,
    `A ${outerRadius} ${outerRadius} 0 ${largeArcFlag} 1 ${outerEnd.x} ${outerEnd.y}`,
    `L ${innerEnd.x} ${innerEnd.y}`,
    `A ${innerRadius} ${innerRadius} 0 ${largeArcFlag} 0 ${innerStart.x} ${innerStart.y}`,
    "Z",
  ].join(" ");
}

function polarPoint(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + radius * Math.cos(angle),
    y: cy + radius * Math.sin(angle),
  };
}

function LastResults({ values }: { values: Array<"0" | "00" | number> }) {
  return (
    <div className="roulette-last-results" aria-label="Last five roulette results">
      <span>Last 5</span>
      <RouletteLastFiveNumbers values={values} />
    </div>
  );
}

export function RouletteLastFiveNumbers({ values }: { values: Array<"0" | "00" | number> }) {
  return (
    <div className="roulette-last-five-numbers" aria-label="Last five landed roulette numbers">
      {values.length === 0 ? <em>No spins yet</em> : values.map((value, index) => (
        <strong key={`${value}-${index}`} className={getRouletteColor(value)} data-result-value={value}>{value}</strong>
      ))}
    </div>
  );
}

export function CurrentBetsSummary({ bets }: { bets: PlacedRouletteBet[] }) {
  const grouped = useMemo(() => groupRouletteBets(bets), [bets]);
  const rows = [...grouped.entries()].map(([key, stack]) => ({
    key,
    label: stack[0]?.label ?? "Bet",
    amount: stack.reduce((sum, bet) => sum + bet.amount, 0),
  }));

  return (
    <div className="roulette-current-bets" aria-label="Current roulette bets">
      <span>Current Bets</span>
      <div className="roulette-current-bets-scroll">
        {rows.length === 0 ? <em>No active bets.</em> : rows.map((row) => (
          <div key={row.key}>
            <small>{row.label}</small>
            <strong>{formatCoins(row.amount)}</strong>
          </div>
        ))}
      </div>
    </div>
  );
}

function StreetBetPanel({ onBet, bets, winningZoneKeys }: { onBet: (bet: RouletteBet) => void; bets: PlacedRouletteBet[]; winningZoneKeys: Set<string> }) {
  const streets = Array.from({ length: 12 }, (_, index) => index * 3 + 1);
  return (
    <div className="roulette-street-selector">
      <div>
        <strong>3 Street</strong>
        <span>Pays 11:1</span>
      </div>
      <div className="roulette-street-grid">
        {streets.map((street) => (
          (() => {
            const bet = { kind: "street", numbers: [street, street + 1, street + 2] } satisfies RouletteBet;
            const key = rouletteBetKey(bet);
            const placed = bets.filter((placedBet) => rouletteBetKey(placedBet.bet) === key);
            return (
          <button
            key={`street-panel-${street}`}
            className={`${placed.length ? "active" : ""} ${winningZoneKeys.has(key) ? "winner" : ""}`.trim()}
            onClick={() => onBet(bet)}
          >
            {street}-{street + 2}
          </button>
            );
          })()
        ))}
      </div>
      <div>
        <strong>6 Street</strong>
        <span>Pays 5:1</span>
      </div>
      <div className="roulette-street-grid six">
        {streets.slice(0, -1).map((street) => (
          (() => {
            const bet = { kind: "sixLine", numbers: [street, street + 1, street + 2, street + 3, street + 4, street + 5] } satisfies RouletteBet;
            const key = rouletteBetKey(bet);
            const placed = bets.filter((placedBet) => rouletteBetKey(placedBet.bet) === key);
            return (
          <button
            key={`six-panel-${street}`}
            className={`${placed.length ? "active" : ""} ${winningZoneKeys.has(key) ? "winner" : ""}`.trim()}
            onClick={() => onBet(bet)}
          >
            {street}-{street + 5}
          </button>
            );
          })()
        ))}
      </div>
    </div>
  );
}

function InsideHitAreas({
  bets,
  winningZoneKeys,
  disabled,
  onBet,
  registerBetAnchor,
}: {
  bets: PlacedRouletteBet[];
  winningZoneKeys: Set<string>;
  disabled: boolean;
  onBet: (bet: RouletteBet) => void;
  registerBetAnchor: (bet: RouletteBet) => (element: HTMLElement | null) => void;
}) {
  const grouped = useMemo(() => groupRouletteBets(bets), [bets]);
  return (
    <div className="roulette-hit-layer">
      {buildInsideHitAreas().map((area) => {
        const key = rouletteBetKey(area.bet);
        const active = Boolean(grouped.get(key)?.length);
        return (
          <button
            key={area.key}
            ref={registerBetAnchor(area.bet)}
            className={`${active ? "active" : ""} ${winningZoneKeys.has(key) ? "winner" : ""}`.trim()}
            style={area.style}
            data-bet-kind={area.bet.kind}
            data-bet-anchor={key}
            disabled={disabled}
            aria-label={rouletteBetLabel(area.bet)}
            onClick={() => onBet(area.bet)}
          />
        );
      })}
    </div>
  );
}

function buildInsideHitAreas() {
  const areas: Array<{ key: string; bet: RouletteBet; style: CSSProperties }> = [];
  for (let column = 0; column < 12; column += 1) {
    const streetStart = column * 3 + 1;
    const streetBet = { kind: "street", numbers: [streetStart, streetStart + 1, streetStart + 2] } satisfies RouletteBet;
    areas.push({
      key: `street-${streetStart}`,
      bet: streetBet,
        style: hitAreaStyle({
          landLeft: column * (100 / 12) + 0.7,
          landTop: 93.2,
          landWidth: (100 / 12) - 1.4,
          landHeight: 8.6,
          portLeft: 85.8,
          portTop: column * (100 / 12) + 0.7,
          portWidth: 16.5,
        portHeight: (100 / 12) - 1.4,
      }),
    });
    if (column < 11) {
      const sixBet = { kind: "sixLine", numbers: [streetStart, streetStart + 1, streetStart + 2, streetStart + 3, streetStart + 4, streetStart + 5] } satisfies RouletteBet;
      areas.push({
        key: `six-${streetStart}`,
        bet: sixBet,
        style: hitAreaStyle({
          landLeft: (column + 1) * (100 / 12) - 2.7,
          landTop: 93.2,
          landWidth: 5.4,
          landHeight: 8.6,
          portLeft: 85.8,
          portTop: (column + 1) * (100 / 12) - 2.7,
          portWidth: 16.5,
          portHeight: 5.4,
        }),
      });
    }

    for (let row = 0; row < 3; row += 1) {
      const number = boardRows[row][column];
      if (column < 11) areas.push({
        key: `split-street-${number}`,
        bet: { kind: "split", numbers: [number, boardRows[row][column + 1]] },
        style: hitAreaStyle({
          landLeft: (column + 1) * (100 / 12) - 2.5,
          landTop: row * (100 / 3),
          landWidth: 5,
          landHeight: 100 / 3,
          portLeft: row * (100 / 3),
          portTop: (column + 1) * (100 / 12) - 2.7,
          portWidth: 100 / 3,
          portHeight: 5.4,
        }),
      });
      if (row < 2) areas.push({
        key: `split-row-${number}`,
        bet: { kind: "split", numbers: [number, boardRows[row + 1][column]] },
        style: hitAreaStyle({
          landLeft: column * (100 / 12),
          landTop: (row + 1) * (100 / 3) - 4.2,
          landWidth: 100 / 12,
          landHeight: 8.4,
          portLeft: (row + 1) * (100 / 3) - 5.4,
          portTop: column * (100 / 12),
          portWidth: 10.8,
          portHeight: 100 / 12,
        }),
      });
      if (column < 11 && row < 2) areas.push({
        key: `corner-${number}`,
        bet: { kind: "corner", numbers: [number, boardRows[row][column + 1], boardRows[row + 1][column], boardRows[row + 1][column + 1]] },
        style: hitAreaStyle({
          landLeft: (column + 1) * (100 / 12) - 2.9,
          landTop: (row + 1) * (100 / 3) - 4.6,
          landWidth: 5.8,
          landHeight: 9.2,
          portLeft: (row + 1) * (100 / 3) - 5.7,
          portTop: (column + 1) * (100 / 12) - 2.9,
          portWidth: 11.4,
          portHeight: 5.8,
        }),
      });
    }
  }
  return areas;
}

function hitAreaStyle(values: {
  landLeft: number;
  landTop: number;
  landWidth: number;
  landHeight: number;
  portLeft: number;
  portTop: number;
  portWidth: number;
  portHeight: number;
}) {
  return {
    "--land-left": `${values.landLeft}%`,
    "--land-top": `${values.landTop}%`,
    "--land-width": `${values.landWidth}%`,
    "--land-height": `${values.landHeight}%`,
    "--port-left": `${values.portLeft}%`,
    "--port-top": `${values.portTop}%`,
    "--port-width": `${values.portWidth}%`,
    "--port-height": `${values.portHeight}%`,
  } as CSSProperties;
}

function isRouletteBoardNumber(value: "0" | "00" | number): value is number {
  return typeof value === "number";
}

function average(values: number[]) {
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function getCoveredOutcomes(bets: PlacedRouletteBet[]) {
  const covered = new Set<"0" | "00" | number>();
  bets.forEach(({ bet }) => {
    if (bet.kind === "straight") covered.add(bet.value);
    else if (bet.kind === "split" || bet.kind === "street" || bet.kind === "corner" || bet.kind === "sixLine" || bet.kind === "basket") bet.numbers.forEach((number) => covered.add(number));
    else if (bet.kind === "color") americanWheel.forEach((number) => { if (getRouletteColor(number) === bet.value) covered.add(number); });
    else if (bet.kind === "parity") americanWheel.forEach((number) => { if (typeof number === "number" && (bet.value === "odd" ? number % 2 === 1 : number % 2 === 0)) covered.add(number); });
    else if (bet.kind === "range") americanWheel.forEach((number) => { if (typeof number === "number" && (bet.value === "low" ? number <= 18 : number >= 19)) covered.add(number); });
    else if (bet.kind === "dozen") americanWheel.forEach((number) => { if (typeof number === "number" && Math.ceil(number / 12) === bet.value) covered.add(number); });
    else if (bet.kind === "column") americanWheel.forEach((number) => { if (typeof number === "number" && (((number - 1) % 3) + 1) === bet.value) covered.add(number); });
  });
  return covered;
}

function numberColumn(number: number) {
  return ((number - 1) % 3) + 1;
}

function numberStreetStart(number: number) {
  return number - ((number - 1) % 3);
}

function isValidSplit(numbers: Array<"0" | "00" | number>) {
  if (numbers.includes("0") && numbers.includes("00")) return true;
  if (!numbers.every((number) => typeof number === "number")) return false;
  const [a, b] = numbers as number[];
  return Math.abs(a - b) === 3 || (Math.abs(a - b) === 1 && numberStreetStart(a) === numberStreetStart(b));
}

function isValidStreet(numbers: Array<"0" | "00" | number>) {
  if (!numbers.every((number) => typeof number === "number")) return false;
  const nums = numbers as number[];
  const start = numberStreetStart(nums[0]);
  return nums.length === 3 && nums.every((number) => numberStreetStart(number) === start);
}

function isValidCorner(numbers: Array<"0" | "00" | number>) {
  if (!numbers.every((number) => typeof number === "number")) return false;
  const nums = numbers as number[];
  const min = Math.min(...nums);
  const candidates = [min, min + 1, min + 3, min + 4].sort((a, b) => a - b);
  return numberColumn(min) < 3 && JSON.stringify(nums) === JSON.stringify(candidates);
}

function isValidSixLine(numbers: Array<"0" | "00" | number>) {
  if (!numbers.every((number) => typeof number === "number")) return false;
  const nums = numbers as number[];
  const start = numberStreetStart(Math.min(...nums));
  const candidates = [start, start + 1, start + 2, start + 3, start + 4, start + 5].sort((a, b) => a - b);
  return start <= 31 && JSON.stringify(nums) === JSON.stringify(candidates);
}
