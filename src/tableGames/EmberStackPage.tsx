import { useEffect, useMemo, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { BadgeDollarSign, ChevronLeft, Info, Minus, Play, Plus, RotateCcw, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { ScreenShake, SoundToggle } from "../feedback/components";
import {
  playEmberStackBust,
  playEmberStackCashout,
  playEmberStackCombo,
  playEmberStackCut,
  playEmberStackFall,
  playEmberStackMove,
  playEmberStackMultiplier,
  playEmberStackPerfect,
  playEmberStackLock,
  playError,
} from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import {
  attemptEmberStackCpuStack,
  cashOutEmberStackRound,
  canCashOutEmberStackRound,
  continueEmberStackRound,
  emberStackConfig,
  emberStackRiskOrder,
  getEmberStackBetLimits,
  getEmberStackBaseMultiplier,
  getEmberStackCameraOffset,
  getEmberStackNextMultiplier,
  getEmberStackPlatformX,
  startEmberStackRound,
  type EmberStackCutPiece,
  type EmberStackParticle,
  type EmberStackPlatform,
  type EmberStackRisk,
  type EmberStackRound,
  type EmberStackStackQuality,
} from "./emberStackEngine";

export const emberStackAssetManifest = {
  movingPlatform: new URL("../assets/ember-stack/platform-moving.png", import.meta.url).href,
  lockedPlatform: new URL("../assets/ember-stack/platform-locked.png", import.meta.url).href,
  perfectPlatform: new URL("../assets/ember-stack/platform-perfect.png", import.meta.url).href,
  cutPiece: new URL("../assets/ember-stack/platform-cut.png", import.meta.url).href,
  basePlatform: new URL("../assets/ember-stack/platform-base.png", import.meta.url).href,
  greenPlatform: new URL("../assets/ember-stack/platform-green.png", import.meta.url).href,
  bluePlatform: new URL("../assets/ember-stack/platform-blue.png", import.meta.url).href,
  redPlatform: new URL("../assets/ember-stack/platform-red.png", import.meta.url).href,
  towerBase: new URL("../assets/ember-stack/tower-base.png", import.meta.url).href,
  towerBackdrop: new URL("../assets/ember-stack/tower-backdrop.png", import.meta.url).href,
  multiplierBurst: new URL("../assets/ember-stack/multiplier-burst.png", import.meta.url).href,
  logo: new URL("../assets/ember-stack/ember-stack-logo.png", import.meta.url).href,
} as const;

const currencyCopy: Record<Currency, { short: string; label: string }> = {
  GOLD: { short: "GC", label: "GC" },
  BONUS: { short: "SC", label: "SC" },
};

type EmberStackActionState = "idle" | "stacking" | "locking" | "cutting" | "cashout" | "bust";
type EmberStackRecentRound = { paid: number; multiplier: number; height: number; result: "cashout" | "bust" };
type EmberStackMotionPlan = { platformId: string; fromX: number; toX: number; startedAt: number; durationMs: number };

export const emberStackAnimationTimings = {
  cutMs: 620,
  cpuAttemptMs: 820,
  lockMs: 170,
  perfectMs: 720,
  cashoutMs: 1000,
  bustMs: 1500,
  multiplierPulseMs: 520,
};

export const emberStackUiMarkers = {
  gameName: "Ember Stack",
  playheaterBranding: true,
  goldBonusToggle: true,
  riskSelector: true,
  movingPlatformLoop: true,
  noStopButton: true,
  cpuRunStacking: true,
  cashoutContinueDecision: true,
  cleanSliceAnimation: true,
  fallingCutPiece: true,
  impactParticles: true,
  perfectStackBonus: true,
  perfectComboCounter: true,
  widthRestoreOnPerfect: true,
  shortStarterBlocks: true,
  riskBasedCpuSuccessChances: true,
  cpuOutcomePerfectGoodBadMiss: true,
  premiumRasterAssets: true,
  outcomeMatchedLockAnimation: true,
  cutLineAnimation: true,
  cameraRiseVisual: false,
  multiplierMilestones: true,
  cashoutPayoutSequence: true,
  bustShakeSequence: true,
  multiplierCurve: true,
  speedScalingByRiskAndProgression: true,
  cpuSuccessChanceMath: true,
  cpuSimulationReportsEv: true,
  cpuRiskSimulations: true,
  cpuRtpUnder95: true,
  mobileFirstBoardDominant: true,
  noHeaderPlayheaterText: true,
  noHeaderGemIcon: true,
  infoBesideGameName: true,
  balanceInBottomControls: true,
  noStandaloneMeterBoxes: true,
  boardIntegratedMultiplierHud: true,
  rowMultiplierMarkers: true,
  fullMultiplierLadder: true,
  noBoardCashoutHeightStats: true,
  noDecisionStatusPanel: true,
  noResolvedResultStrip: true,
  boardResolvedResultOverlay: true,
  boardClickContinue: true,
  simplifiedMultiplierHud: true,
  readableNextBlockMultiplier: false,
  noBoardWideComboGlow: true,
  rasterPlatformSprites: true,
  singleBottomPlatform: true,
  noInBlockMultiplierLabels: true,
  nextMultiplierInTopHud: true,
  fixedBoardNoCameraScroll: true,
  tieredPlatformColors: true,
  cleanArcadeStackerBackdrop: true,
  noBackgroundBurstOnBust: true,
  slowMissFallAnimation: true,
  singleBustMessage: true,
  cpuLockTimingMatchesOutcome: true,
  nextBlockMovesDuringDecision: true,
  nextMultiplierOnMovingBlock: false,
  sharedSoundToggle: true,
  audioHooks: true,
  stackerMechanicsOnly: true,
  nonPhysicsTimingModel: true,
};

export function formatEmberStackMultiplier(multiplier: number) {
  if (!Number.isFinite(multiplier)) return "0x";
  if (Math.abs(multiplier) < 10) return `${multiplier.toFixed(2)}x`;
  return `${multiplier.toLocaleString(undefined, { maximumFractionDigits: multiplier >= 100 ? 1 : 2 })}x`;
}

export function getEmberStackBoardMood(round: EmberStackRound | null) {
  const multiplier = round?.currentMultiplier ?? 1;
  const stackCount = round?.stackCount ?? 0;
  return {
    intensity: Math.min(1, stackCount / 8 + Math.max(0, multiplier - 1) / 120),
    tier: multiplier >= 100 ? "inferno" : multiplier >= 25 ? "surge" : multiplier >= 10 ? "hot" : "base",
  };
}

export function getEmberStackMultiplierMilestone(multiplier: number) {
  if (multiplier >= 250) return "two-fifty";
  if (multiplier >= 100) return "hundred";
  if (multiplier >= 50) return "fifty";
  if (multiplier >= 25) return "twenty-five";
  if (multiplier >= 10) return "ten";
  return "base";
}

export function getEmberStackPlatformStyle(platform: EmberStackPlatform, cameraOffset = 0): CSSProperties {
  void cameraOffset;
  const bottom = platform.level * (emberStackConfig.board.platformHeight + emberStackConfig.board.platformGap);
  return {
    "--ember-platform-left": `${(platform.x / emberStackConfig.board.width) * 100}%`,
    "--ember-platform-width": `${(platform.width / emberStackConfig.board.width) * 100}%`,
    "--ember-platform-bottom": `${bottom}px`,
    "--ember-platform-level": platform.level,
  } as CSSProperties;
}

export function getEmberStackPlatformTier(level: number, risk: EmberStackRisk) {
  if (level <= 0) return "bottom";
  const maxLevel = emberStackConfig.multiplierCurves[risk].length - 1;
  const bottomEnd = Math.ceil(maxLevel / 3);
  const middleEnd = Math.ceil((maxLevel * 2) / 3);
  if (level <= bottomEnd) return "bottom";
  if (level <= middleEnd) return "middle";
  return "top";
}

export function getEmberStackPlatformClass(platform: EmberStackPlatform, round: EmberStackRound | null) {
  const isTopLocked = Boolean(round && platform.id === round.tower[round.tower.length - 1]?.id && platform.kind !== "base" && round.stackCount > 0);
  const tier = getEmberStackPlatformTier(platform.level, round?.risk ?? "medium");
  return [
    "ember-stack-platform",
    platform.kind,
    `tier-${tier}`,
    isTopLocked ? "top-lock" : "",
    isTopLocked ? `quality-${round?.lastQuality ?? "good"}` : "",
  ].filter(Boolean).join(" ");
}

export function getEmberStackCutStyle(cut: EmberStackCutPiece, cameraOffset = 0): CSSProperties {
  void cameraOffset;
  const bottom = cut.level * (emberStackConfig.board.platformHeight + emberStackConfig.board.platformGap);
  return {
    "--ember-cut-left": `${(cut.x / emberStackConfig.board.width) * 100}%`,
    "--ember-cut-width": `${(cut.width / emberStackConfig.board.width) * 100}%`,
    "--ember-cut-bottom": `${bottom}px`,
  } as CSSProperties;
}

export function getEmberStackCutLineStyle(cut: EmberStackCutPiece, cameraOffset = 0): CSSProperties {
  const lineX = cut.side === "left" ? cut.x + cut.width : cut.side === "right" ? cut.x : cut.x + cut.width / 2;
  void cameraOffset;
  const bottom = cut.level * (emberStackConfig.board.platformHeight + emberStackConfig.board.platformGap);
  return {
    "--ember-cut-line-left": `${(lineX / emberStackConfig.board.width) * 100}%`,
    "--ember-cut-line-bottom": `${bottom}px`,
  } as CSSProperties;
}

export function getEmberStackParticleStyle(particle: EmberStackParticle, cameraOffset = 0): CSSProperties {
  void cameraOffset;
  const bottom = particle.level * (emberStackConfig.board.platformHeight + emberStackConfig.board.platformGap);
  return {
    "--ember-particle-left": `${(particle.x / emberStackConfig.board.width) * 100}%`,
    "--ember-particle-bottom": `${bottom}px`,
    "--ember-particle-delay": `${particle.delayMs}ms`,
  } as CSSProperties;
}

export function getEmberStackOutcomeVisualState(round: EmberStackRound | null) {
  if (!round) return { quality: "ready", hasCut: false, hasChoice: false, cameraOffset: 0, milestone: "base" };
  return {
    quality: round.lastQuality,
    hasCut: Boolean(round.lastCut),
    hasChoice: round.choiceAvailable,
    cameraOffset: 0,
    milestone: getEmberStackMultiplierMilestone(round.currentMultiplier),
  };
}

export function getEmberStackBoardHudRows(round: EmberStackRound | null, nextMultiplier: number, rowCount?: number, riskOverride?: EmberStackRisk) {
  const risk = riskOverride ?? round?.risk ?? "medium";
  const stackCount = round?.stackCount ?? 0;
  const levelCount = rowCount ?? emberStackConfig.multiplierCurves[risk].length - 1;
  return Array.from({ length: levelCount }, (_, index) => {
    const level = index + 1;
    const state = level === stackCount && stackCount > 0 ? "current" : level === stackCount + 1 ? "next" : "future";
    const multiplier = state === "current" && round
      ? round.currentMultiplier
      : state === "next"
        ? nextMultiplier
        : getEmberStackBaseMultiplier(level, risk);
    return { level, state, multiplier };
  });
}

export function getEmberStackRowMarkerStyle(row: { level: number }, cameraOffset = 0): CSSProperties {
  void cameraOffset;
  const bottom = row.level * (emberStackConfig.board.platformHeight + emberStackConfig.board.platformGap) + emberStackConfig.board.platformHeight / 2;
  return { "--ember-row-marker-bottom": `${bottom}px` } as CSSProperties;
}

export function getEmberStackQualityCopy(quality: EmberStackStackQuality) {
  if (quality === "perfect") return "PERFECT";
  if (quality === "good") return "Good Stack";
  if (quality === "bad") return "Thin Stack";
  if (quality === "miss") return "BUST";
  return "Good Stack";
}

export function getEmberStackRoundStatusCopy(round: EmberStackRound | null) {
  if (!round) return "Ready";
  if (round.status === "CASHED_OUT") return "Cashed out";
  if (round.status === "BUST") return "BUST";
  if (round.lastOutcome === "perfect") return "PERFECT";
  if (round.lastOutcome === "good") return "Good stack";
  if (round.lastOutcome === "bad") return "Thin stack";
  return round.choiceAvailable ? "Choose" : round.stackCount > 0 ? "Stacked" : "Ready";
}

function easeEmberStackCpuPlan(progress: number) {
  return 1 - Math.pow(1 - progress, 3);
}

function roundEmberStackVisualX(value: number) {
  return Math.round(value * 100) / 100;
}

export function EmberStackPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(getEmberStackBetLimits("GOLD").minBet);
  const [betInput, setBetInput] = useState(formatBetInput(getEmberStackBetLimits("GOLD").minBet, "GOLD"));
  const [risk, setRisk] = useState<EmberStackRisk>("medium");
  const [round, setRound] = useState<EmberStackRound | null>(null);
  const [actionState, setActionState] = useState<EmberStackActionState>("idle");
  const [activeX, setActiveX] = useState(0);
  const [multiplierPulse, setMultiplierPulse] = useState(false);
  const [displayMultiplier, setDisplayMultiplier] = useState(1);
  const [recentRounds, setRecentRounds] = useState<EmberStackRecentRound[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const timersRef = useRef<number[]>([]);
  const activeMotionRef = useRef<{ platformId: string; startedAt: number } | null>(null);
  const cpuMotionPlanRef = useRef<EmberStackMotionPlan | null>(null);
  const pendingCpuRoundRef = useRef<EmberStackRound | null>(null);
  const previousMultiplierRef = useRef(1);

  useEffect(() => () => clearTimers(), []);

  useEffect(() => {
    const active = round?.activePlatform;
    const shouldAnimate = Boolean(active && round?.status === "RUNNING" && actionState !== "locking" && actionState !== "cashout" && actionState !== "bust");
    if (!active || !shouldAnimate) return;
    let frame = 0;
    const startedAt = typeof window !== "undefined" ? window.performance.now() : 0;
    if (activeMotionRef.current?.platformId !== active.id) {
      activeMotionRef.current = { platformId: active.id, startedAt };
      setActiveX(getEmberStackPlatformX(active, 0));
    }
    if (actionState === "stacking") playEmberStackMove();
    const tick = (now: number) => {
      const plan = cpuMotionPlanRef.current?.platformId === active.id ? cpuMotionPlanRef.current : null;
      const nextX = plan
        ? roundEmberStackVisualX(plan.fromX + (plan.toX - plan.fromX) * easeEmberStackCpuPlan(Math.min(1, (now - plan.startedAt) / plan.durationMs)))
        : getEmberStackPlatformX(active, now - (activeMotionRef.current?.startedAt ?? now));
      setActiveX(nextX);
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [round?.activePlatform?.id, round?.status, actionState]);

  const currentMultiplier = round?.status === "BUST" ? 0 : round?.currentMultiplier ?? 1;

  useEffect(() => {
    const previous = previousMultiplierRef.current;
    previousMultiplierRef.current = currentMultiplier;
    if (typeof window === "undefined" || previous === currentMultiplier) {
      setDisplayMultiplier(currentMultiplier);
      return;
    }
    const startedAt = window.performance.now();
    const duration = emberStackAnimationTimings.multiplierPulseMs;
    let frame = 0;
    const tick = (now: number) => {
      const progress = Math.min(1, (now - startedAt) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayMultiplier(Math.round((previous + (currentMultiplier - previous) * eased) * 100) / 100);
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [currentMultiplier]);

  const boardMood = useMemo(() => getEmberStackBoardMood(round), [round]);
  const currentMilestone = getEmberStackMultiplierMilestone(currentMultiplier);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const betLimits = getEmberStackBetLimits(currency);
  const active = round?.status === "RUNNING";
  const resolved = round?.status === "BUST" || round?.status === "CASHED_OUT";
  const setupLocked = Boolean(active || resolved || actionState !== "idle");
  const resolvingLocked = actionState !== "idle";
  const displayedRisk = round && (active || resolved) ? round.risk : risk;
  const betExceedsBalance = betAmount > balance;
  const canStart = !active && !resolved && actionState === "idle" && betAmount >= betLimits.minBet && betAmount <= betLimits.maxBet && balance >= betAmount;
  const canCashOut = Boolean(active && round && actionState === "idle" && canCashOutEmberStackRound(round));
  const canContinue = Boolean(active && round?.choiceAvailable && round?.activePlatform && actionState === "idle");
  const nextMultiplier = active ? getEmberStackNextMultiplier(round) : getEmberStackNextMultiplier(null);
  const cameraOffset = getEmberStackCameraOffset(round?.stackCount ?? 0);
  const cameraRise = 0;
  const activePlatform = round?.activePlatform ? { ...round.activePlatform, x: activeX } : null;
  const showActivePlatform = Boolean(active && activePlatform && actionState !== "cashout" && actionState !== "bust");
  const tower = round?.tower ?? [];
  const visibleTower = tower;
  const boardHudRows = getEmberStackBoardHudRows(round, nextMultiplier, undefined, displayedRisk);
  const visibleRecentRounds = recentRounds.filter((item) => item.result === "cashout");

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
    cpuMotionPlanRef.current = null;
    pendingCpuRoundRef.current = null;
  }

  function schedule(callback: () => void, ms: number) {
    const timer = window.setTimeout(callback, ms);
    timersRef.current.push(timer);
  }

  function clampBet(value: number, nextCurrency = currency) {
    const limits = getEmberStackBetLimits(nextCurrency);
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
    if (Number.isFinite(parsed)) setBetAmount(Math.max(0, Math.min(betLimits.maxBet, parsed)));
  }

  function selectCurrency(nextCurrency: Currency) {
    if (setupLocked) return;
    const nextBet = clampBet(betAmount, nextCurrency);
    setCurrency(nextCurrency);
    setBet(nextBet, nextCurrency);
  }

  function start() {
    if (!canStart) return;
    try {
      clearTimers();
      const nextRound = startEmberStackRound({ userId: currentUser.id, currency, betAmount, risk });
      setRound(nextRound);
      setDisplayMultiplier(nextRound.currentMultiplier);
      previousMultiplierRef.current = nextRound.currentMultiplier;
      refreshUser();
      beginCpuAttempt(nextRound);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to start Ember Stack.", "error");
      playError();
    }
  }

  function getLiveActiveX(platform: EmberStackPlatform) {
    if (typeof window === "undefined") return getEmberStackPlatformX(platform, 0);
    const now = window.performance.now();
    const motion = activeMotionRef.current?.platformId === platform.id ? activeMotionRef.current : null;
    if (!motion) return getEmberStackPlatformX(platform, 0);
    return getEmberStackPlatformX(platform, now - motion.startedAt);
  }

  function planCpuLockMotion(currentRound: EmberStackRound, plannedRound: EmberStackRound) {
    const platform = currentRound.activePlatform;
    if (!platform || typeof plannedRound.lastLockX !== "number" || typeof window === "undefined") return;
    const now = window.performance.now();
    const fromX = roundEmberStackVisualX(getLiveActiveX(platform));
    activeMotionRef.current = activeMotionRef.current?.platformId === platform.id
      ? activeMotionRef.current
      : { platformId: platform.id, startedAt: now };
    cpuMotionPlanRef.current = {
      platformId: platform.id,
      fromX,
      toX: plannedRound.lastLockX,
      startedAt: now,
      durationMs: emberStackAnimationTimings.cpuAttemptMs,
    };
    setActiveX(fromX);
  }

  function beginCpuAttempt(currentRound: EmberStackRound) {
    try {
      clearTimers();
      const plannedRound = attemptEmberStackCpuStack({ round: currentRound });
      pendingCpuRoundRef.current = plannedRound;
      planCpuLockMotion(currentRound, plannedRound);
      setActionState("stacking");
      schedule(() => resolveCpuAttempt(plannedRound), emberStackAnimationTimings.cpuAttemptMs);
    } catch (caught) {
      setActionState("idle");
      notify(caught instanceof Error ? caught.message : "Unable to resolve CPU stack.", "error");
      playError();
    }
  }

  function resolveCpuAttempt(nextRound: EmberStackRound) {
    try {
      if (pendingCpuRoundRef.current && pendingCpuRoundRef.current.id !== nextRound.id) return;
      setActionState("locking");
      cpuMotionPlanRef.current = null;
      if (typeof nextRound.lastLockX === "number") setActiveX(nextRound.lastLockX);
      playEmberStackLock();
      schedule(() => finishCpuAttempt(nextRound), emberStackAnimationTimings.lockMs);
    } catch (caught) {
      setActionState("idle");
      notify(caught instanceof Error ? caught.message : "Unable to resolve CPU stack.", "error");
      playError();
    }
  }

  function finishCpuAttempt(nextRound: EmberStackRound) {
    try {
      pendingCpuRoundRef.current = null;
      cpuMotionPlanRef.current = null;
      setRound(nextRound);
      setMultiplierPulse(nextRound.status !== "BUST");
      if (nextRound.status !== "BUST") playEmberStackMultiplier();
      if (nextRound.lastCut) playEmberStackCut();
      if (nextRound.status === "BUST") {
        setActionState("bust");
        setRecentRounds((current) => [{ paid: 0, multiplier: 0, height: nextRound.stackCount, result: "bust" as const }, ...current].slice(0, 5));
        recordEmberRetention(nextRound.betAmount, 0, 0);
        playEmberStackFall();
        playEmberStackBust();
        setMultiplierPulse(false);
        schedule(() => setActionState("idle"), emberStackAnimationTimings.bustMs);
        return;
      }
      setActionState("cutting");
      if (nextRound.lastQuality === "perfect") playEmberStackPerfect();
      if (nextRound.perfectCombo > 1) playEmberStackCombo();
      schedule(() => setActionState("idle"), emberStackAnimationTimings.cutMs);
      schedule(() => setMultiplierPulse(false), emberStackAnimationTimings.multiplierPulseMs);
    } catch (caught) {
      setActionState("idle");
      notify(caught instanceof Error ? caught.message : "Unable to resolve CPU stack.", "error");
      playError();
    }
  }

  function continueStack() {
    if (!round || !canContinue) return;
    const nextRound = continueEmberStackRound(round);
    setRound(nextRound);
    setMultiplierPulse(false);
    beginCpuAttempt(nextRound);
  }

  function continueFromBoard() {
    if (canContinue) continueStack();
  }

  function handleBoardKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (!canContinue || (event.key !== "Enter" && event.key !== " ")) return;
    event.preventDefault();
    continueStack();
  }

  function cashOut() {
    if (!round || !canCashOut) return;
    try {
      cpuMotionPlanRef.current = null;
      pendingCpuRoundRef.current = null;
      setActionState("cashout");
      const completed = cashOutEmberStackRound({ round, userId: currentUser.id });
      setRound(completed);
      setRecentRounds((current) => [{ paid: completed.totalPaid, multiplier: completed.currentMultiplier, height: completed.stackCount, result: "cashout" as const }, ...current].slice(0, 5));
      recordEmberRetention(completed.betAmount, completed.totalPaid, completed.currentMultiplier);
      playEmberStackCashout();
      refreshUser();
      schedule(() => setActionState("idle"), emberStackAnimationTimings.cashoutMs);
    } catch (caught) {
      setActionState("idle");
      notify(caught instanceof Error ? caught.message : "Unable to cash out Ember Stack.", "error");
      playError();
    }
  }

  function resetRound() {
    clearTimers();
    setRound(null);
    setActionState("idle");
    setMultiplierPulse(false);
    setDisplayMultiplier(1);
    setActiveX(0);
    activeMotionRef.current = null;
    previousMultiplierRef.current = 1;
  }

  function recordEmberRetention(wager: number, won: number, multiplier: number) {
    recordRetentionRound({
      userId: currentUser.id,
      gameId: "emberStack",
      wager,
      won,
      bonusTriggered: multiplier >= 25,
      multiplier,
    });
  }

  return (
    <section
      className={`ember-stack-page currency-${currency === "BONUS" ? "sc" : "gc"} risk-${displayedRisk} mood-${boardMood.tier} action-${actionState} ${active ? "round-active" : ""}`}
      style={{ "--ember-intensity": boardMood.intensity, "--ember-camera-rise": `${cameraRise}px`, "--ember-cpu-attempt-ms": `${emberStackAnimationTimings.cpuAttemptMs}ms` } as CSSProperties}
    >
      <header className="ember-stack-header">
        <button className="ember-stack-icon-button" type="button" onClick={onExit} aria-label="Back to games"><ChevronLeft size={18} /></button>
        <div className="ember-stack-title">
          <h1>Ember Stack</h1>
          <button className="ember-stack-info-button" type="button" aria-label="Ember Stack rules" onClick={() => setRulesOpen(true)}><Info size={14} /></button>
        </div>
        <div className="ember-stack-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={setupLocked} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={setupLocked} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="ember-stack-icon-button" compact />
      </header>

      <ScreenShake active={round?.status === "BUST" || round?.lastOutcome === "perfect" || boardMood.tier === "inferno"}>
        <main className="ember-stack-stage">
          <div className="ember-stack-board-shell" role="application" aria-label="Ember Stack board">
            <div
              className={canContinue ? "ember-stack-void can-continue" : "ember-stack-void"}
              role={canContinue ? "button" : undefined}
              tabIndex={canContinue ? 0 : undefined}
              aria-label={canContinue ? "Continue stacking" : undefined}
              onClick={continueFromBoard}
              onKeyDown={handleBoardKeyDown}
            >
              <div className="ember-stack-atmosphere" aria-hidden="true" />
              <div className="ember-stack-depth-lines" aria-hidden="true" />
              <div className="ember-stack-reflection" aria-hidden="true" />
              <div className={`ember-stack-board-hud milestone-${currentMilestone} ${multiplierPulse ? "pulse" : ""}`} aria-live="polite">
                <strong>{formatEmberStackMultiplier(displayMultiplier)}</strong>
                {active && <span className="ember-stack-board-next">Next {formatEmberStackMultiplier(nextMultiplier)}</span>}
              </div>
              <div className="ember-stack-row-markers" aria-hidden="true">
                {boardHudRows.map((row) => (
                  <span key={`${row.level}-${row.state}`} className={`ember-stack-row-marker ${row.state}`} style={getEmberStackRowMarkerStyle(row, cameraOffset)}>
                    <b>{formatEmberStackMultiplier(row.multiplier)}</b>
                  </span>
                ))}
              </div>
              {visibleTower.map((platform) => (
                <span
                  key={platform.id}
                  className={getEmberStackPlatformClass(platform, round)}
                  style={getEmberStackPlatformStyle(platform, cameraOffset)}
                />
              ))}
              {showActivePlatform && activePlatform && (
                <span
                  className={`${getEmberStackPlatformClass(activePlatform, round)} ${actionState === "locking" ? "locking" : ""} ${round?.choiceAvailable ? "next-preview" : ""}`}
                  style={getEmberStackPlatformStyle(activePlatform, cameraOffset)}
                />
              )}
              {round?.lastCut && (
                <>
                  <span className={`ember-stack-cut-line side-${round.lastCut.side}`} style={getEmberStackCutLineStyle(round.lastCut, cameraOffset)} aria-hidden="true" />
                  <span
                    className={`ember-stack-cut-piece side-${round.lastCut.side} tier-${getEmberStackPlatformTier(round.lastCut.level, round.risk)}`}
                    style={getEmberStackCutStyle(round.lastCut, cameraOffset)}
                    aria-hidden="true"
                  />
                </>
              )}
              {round?.lastParticles.map((particle) => (
                <i key={particle.id} className="ember-stack-spark" style={getEmberStackParticleStyle(particle, cameraOffset)} aria-hidden="true" />
              ))}
              {round?.lastOutcome === "perfect" && actionState !== "idle" && (
                <div className="ember-stack-perfect-badge">
                  <strong>PERFECT</strong>
                  {round.perfectCombo > 1 && <span>{round.perfectCombo} COMBO</span>}
                </div>
              )}
              {round?.status === "BUST" && <div className="ember-stack-shatter" aria-hidden="true" />}
              {round?.status === "CASHED_OUT" && <div className="ember-stack-lock-burst" aria-hidden="true" />}
              {round?.status === "BUST" && (
                <div className="ember-stack-board-result loss" role="status" aria-live="assertive">
                  <strong>BUST</strong>
                  <span>CPU missed stack {round.stackCount}</span>
                </div>
              )}
              {round?.status === "CASHED_OUT" && (
                <div className="ember-stack-board-result win" role="status" aria-live="polite">
                  <strong>CASHED OUT</strong>
                  <span>{formatCoins(round.totalPaid)} at {formatEmberStackMultiplier(round.currentMultiplier)}</span>
                </div>
              )}
            </div>
          </div>
        </main>
      </ScreenShake>

      <section className="ember-stack-controls">
        <div className="ember-stack-risk" role="radiogroup" aria-label="Risk">
          {emberStackRiskOrder.map((riskId) => (
            <button key={riskId} type="button" className={risk === riskId ? "active" : ""} disabled={setupLocked} onClick={() => setRisk(riskId)}>
              {emberStackConfig.riskProfiles[riskId].label}
            </button>
          ))}
        </div>
        <div className="ember-stack-bet-row">
          <button type="button" disabled={setupLocked} onClick={() => setBet(betAmount - betLimits.minBet)} aria-label="Decrease bet"><Minus size={16} /></button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode={currency === "BONUS" ? "decimal" : "numeric"}
              type="text"
              value={betInput}
              disabled={setupLocked}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={setupLocked} onClick={() => setBet(betAmount + betLimits.minBet)} aria-label="Increase bet"><Plus size={16} /></button>
        </div>
        <div className={betExceedsBalance ? "ember-stack-bottom-balance warning" : "ember-stack-bottom-balance"}>
          <span>{currencyCopy[currency].short} Balance</span>
          <strong>{formatCoins(balance)}</strong>
        </div>
        {!active && !resolved && (
          <button className="ember-stack-main-action start" type="button" disabled={!canStart} onClick={start}>
            {betExceedsBalance ? `Bet exceeds ${currencyCopy[currency].short}` : "Start"}
          </button>
        )}
        {active && round?.choiceAvailable && (
          <div className="ember-stack-action-pair">
            <button className="ember-stack-main-action cashout" type="button" disabled={!canCashOut || resolvingLocked} onClick={cashOut}>
              <BadgeDollarSign size={18} />
              Cash Out
            </button>
            <button className="ember-stack-main-action continue" type="button" disabled={!canContinue || resolvingLocked} onClick={continueStack}>
              <Play size={17} />
              Continue
            </button>
          </div>
        )}
        {active && !round?.choiceAvailable && (
          <button className="ember-stack-main-action cpu" type="button" disabled>
            CPU Stacking
          </button>
        )}
        {resolved && (
          <button className="ember-stack-main-action reset" type="button" onClick={resetRound}>
            <RotateCcw size={17} />
            Play Again
          </button>
        )}
        {visibleRecentRounds.length > 0 && (
          <div className="ember-stack-recent" aria-label="Recent Ember Stack rounds">
            {visibleRecentRounds.map((item, index) => (
              <strong key={`${item.result}-${item.paid}-${index}`} className={item.result === "cashout" ? "win" : "loss"}>
                {item.result === "cashout" ? `${formatEmberStackMultiplier(item.multiplier)} / ${item.height}` : "BUST"}
              </strong>
            ))}
          </div>
        )}
      </section>

      {rulesOpen && (
        <div className="ember-stack-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="ember-stack-rules" role="dialog" aria-modal="true" aria-labelledby="ember-stack-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="ember-stack-rules-title">Ember Stack Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              <li>Press Start and the CPU attempts each stack automatically.</li>
              <li>Perfect, good, and thin stacks keep the round alive; a miss busts.</li>
              <li>After every successful stack, choose Cash Out or Continue.</li>
              <li>Higher risk lowers CPU success chance and raises multiplier jumps.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function formatBetInput(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return "0";
  return currency === "BONUS" ? Number(amount.toFixed(2)).toString() : Math.round(amount).toString();
}
