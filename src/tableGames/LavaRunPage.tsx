import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, Info, RotateCcw, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, ScreenShake, SoundToggle, WinOverlay } from "../feedback/components";
import {
  playError,
  playLavaRunBigWin,
  playLavaRunBust,
  playLavaRunCashout,
  playLavaRunMultiplier,
  playLavaRunSafe,
  playLavaRunSelect,
  playLavaRunStart,
} from "../feedback/feedbackService";
import { formatCurrencyDisplay } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { BetControls, clampBetAmount } from "./BetControls";
import {
  cashOutLavaRunRound,
  getLavaRunBetLimits,
  getLavaRunMultiplierCurve,
  lavaRunConfig,
  pickLavaRunTile,
  startLavaRunRound,
  type LavaRunRevealResult,
  type LavaRunRisk,
  type LavaRunRound,
  type LavaRunRoundStatus,
  type LavaRunStep,
} from "./lavaRunEngine";

const cashoutBurstAsset = new URL("../assets/lava-run/cashout-burst.png", import.meta.url).href;
const emberAvatarAsset = new URL("../assets/lava-run/ember-avatar.png", import.meta.url).href;
const hiddenPlatformAsset = new URL("../assets/lava-run/hidden-platform.png", import.meta.url).href;
const lavaBurstAsset = new URL("../assets/lava-run/lava-burst.png", import.meta.url).href;
const lavaCanyonLevelAsset = new URL("../assets/lava-run/lava-canyon-level.png", import.meta.url).href;
const lavaPlatformAsset = new URL("../assets/lava-run/lava-platform.png", import.meta.url).href;
const lavaRunIconAsset = new URL("../assets/lava-run/lava-run-icon.png", import.meta.url).href;
const safePlatformAsset = new URL("../assets/lava-run/safe-platform.png", import.meta.url).href;
const selectedPlatformAsset = new URL("../assets/lava-run/selected-platform.png", import.meta.url).href;

const currencyCopy: Record<Currency, { short: string; label: string }> = {
  GOLD: { short: "GC", label: "GC" },
  BONUS: { short: "SC", label: "SC" },
};

const riskOrder: LavaRunRisk[] = ["low", "medium", "high"];
type LavaRunPendingPick = { stepIndex: number; choiceIndex: number };
type LavaRunAvatarState = "pending" | "safe" | "bust" | "escaped";
type LavaRunAvatarTarget = LavaRunPendingPick & { state: LavaRunAvatarState };
type LavaRunEnvironmentZone = "early" | "mid" | "late";
type LavaRunMultiplierTier = "base" | "tier-10" | "tier-25" | "tier-50";

export const lavaRunAnimationTimings = {
  suspenseMs: 340,
  safeRevealMs: 380,
  jumpMs: 420,
  bustMs: 760,
  cashoutMs: 1120,
  multiplierPulseMs: 520,
};

export const lavaRunUiMarkers = {
  gameName: "Lava Run",
  goldBonusToggle: true,
  deterministicStepReveal: true,
  exactOneSafeLanePerRow: true,
  jumpRightToContinue: true,
  continueButtonRemoved: true,
  visibleStageRevealAfterRound: true,
  resetAfterResolvedRound: true,
  noPickTextOnTiles: true,
  sideScrollingCamera: true,
  completedStepsLeaveScreen: true,
  futureStepsSpawnRight: true,
  futureMultipliersVisible: true,
  currentAndNextStepsOnly: true,
  suspenseBeforeReveal: true,
  platformTapLocksChoice: true,
  inactiveFuturePlatformsDisabled: true,
  singleAvatarPosition: true,
  cashoutEscapedState: true,
  resultBlocksPlatformClicks: true,
  animationPacingTargets: true,
  floatingPlatformScene: true,
  organicPlatformStagger: true,
  cameraPushOnAdvance: true,
  visualOnlyEscalation: true,
  highMultiplierIntensity: true,
  emberParticleLayer: true,
  cashoutPayoutCountUp: true,
  environmentEscalatesByStep: true,
  riskSelector: true,
  currentMultiplierMeter: true,
  nextMultiplierMeter: true,
  cashOutAnytimeAfterSafeStep: true,
  noPhysicsEngine: true,
  platformRevealGlow: true,
  lavaBustBurst: true,
  avatarHop: true,
  rasterPlatformAssets: true,
  maxWinCapRespected: true,
  rtpUnder95Warning: true,
  sharedSoundToggle: true,
  compactBottomBetControls: true,
  balanceBesideBetControls: true,
  compactStatusMetersRemoved: true,
  topStatRailRemoved: true,
  rasterCanyonBackdrop: true,
  smallPhonePlatformSpacing: true,
  circularHeaderButtons: true,
  ovalCurrencyToggle: true,
  seamlessRasterCanyonLoop: true,
  activeStepGlowHierarchy: true,
  recentRoundsHidden: true,
  currencyTintedBetBalance: true,
  plainNoteRow: true,
  ledgerMetadataIncludesPath: true,
};

export function formatLavaRunMultiplier(multiplier: number) {
  if (!Number.isFinite(multiplier)) return "0x";
  if (Math.abs(multiplier) < 10) return `${multiplier.toFixed(2)}x`;
  const formatterOptions = Math.abs(multiplier) >= 100
    ? { maximumFractionDigits: 1 }
    : { maximumFractionDigits: 2 };
  return `${multiplier.toLocaleString(undefined, formatterOptions)}x`;
}

export function getLavaRunCameraWindow({
  currentStep,
  maxSteps,
  finalStep,
  resolved = false,
  windowSize = 3,
}: {
  currentStep: number;
  maxSteps: number;
  finalStep?: number;
  resolved?: boolean;
  windowSize?: number;
}) {
  const visibleCount = Math.max(1, Math.min(windowSize, maxSteps));
  const focusStep = Math.max(0, Math.min(maxSteps - 1, resolved && finalStep !== undefined ? finalStep : currentStep));
  const maxStart = Math.max(0, maxSteps - visibleCount);
  const start = Math.max(0, Math.min(focusStep <= 1 ? 0 : focusStep - 1, maxStart));
  return {
    start,
    end: start + visibleCount - 1,
    steps: Array.from({ length: visibleCount }, (_, index) => start + index),
  };
}

export function isLavaRunPlatformClickable({
  stepIndex,
  activeStep,
  status,
  pendingReveal = false,
}: {
  stepIndex: number;
  activeStep: number;
  status?: LavaRunRoundStatus;
  pendingReveal?: boolean;
}) {
  return status === "RUNNING" && !pendingReveal && stepIndex === activeStep;
}

export function shouldRevealLavaRunBoardState(status?: LavaRunRoundStatus) {
  return status === "BUST" || status === "CASHED_OUT";
}

export function getLavaRunAvatarTarget(round: LavaRunRound | null, pendingPick: LavaRunPendingPick | null = null): LavaRunAvatarTarget | null {
  if (pendingPick) return { ...pendingPick, state: "pending" };
  const latestStep = round?.steps.at(-1);
  if (!round || !latestStep) return null;
  if (round.status === "BUST" && latestStep.result === "lava") return { stepIndex: latestStep.stepIndex, choiceIndex: latestStep.choiceIndex, state: "bust" };
  if (round.status === "CASHED_OUT") return { stepIndex: latestStep.stepIndex, choiceIndex: latestStep.choiceIndex, state: "escaped" };
  return { stepIndex: latestStep.stepIndex, choiceIndex: latestStep.choiceIndex, state: "safe" };
}

function getLavaRunEnvironmentZone(stepIndex: number, maxSteps: number): LavaRunEnvironmentZone {
  const progress = maxSteps <= 1 ? 0 : stepIndex / (maxSteps - 1);
  if (progress >= 0.75) return "late";
  if (progress >= 0.45) return "mid";
  return "early";
}

export function getLavaRunMultiplierTier(multiplier = 1): LavaRunMultiplierTier {
  if (multiplier >= 50) return "tier-50";
  if (multiplier >= 25) return "tier-25";
  if (multiplier >= 10) return "tier-10";
  return "base";
}

export function getLavaRunVisualIntensity({
  stepIndex,
  maxSteps,
  multiplier = 1,
}: {
  stepIndex: number;
  maxSteps: number;
  multiplier?: number;
}) {
  const progress = maxSteps <= 1 ? 0 : Math.max(0, Math.min(1, stepIndex / (maxSteps - 1)));
  return {
    zone: getLavaRunEnvironmentZone(stepIndex, maxSteps),
    heat: Number((0.42 + progress * 0.58).toFixed(2)),
    progress,
    multiplierTier: getLavaRunMultiplierTier(multiplier),
  };
}

export function getLavaRunPlatformVisual({
  risk,
  stepIndex,
  choiceIndex,
}: {
  risk: LavaRunRisk;
  stepIndex: number;
  choiceIndex: number;
}) {
  const choices = lavaRunConfig.riskProfiles[risk].choicesPerRow;
  const centeredLane = choiceIndex - (choices - 1) / 2;
  const jitterSeed = ((stepIndex + 1) * 17 + (choiceIndex + 3) * 11) % 9;
  const wave = jitterSeed - 4;
  const riskTightness = risk === "high" ? 0.68 : risk === "medium" ? 0.84 : 1;
  const verticalTightness = risk === "high" ? 0.56 : risk === "medium" ? 0.72 : 0.86;
  const lowRiskScale = risk === "low" ? 1.04 : risk === "medium" ? 1 : 0.92;
  return {
    offsetX: Math.round((centeredLane * 4 + wave * 1.4) * riskTightness),
    offsetY: Math.round(((stepIndex + choiceIndex) % 2 === 0 ? -1 : 1) * (4 + Math.abs(wave) * 0.8) * verticalTightness),
    tilt: Math.round((wave * 0.85 + centeredLane * 0.9) * 10) / 10,
    scale: Number((lowRiskScale + (wave % 3) * 0.012).toFixed(3)),
    floatDelayMs: (stepIndex * 90 + choiceIndex * 140) % 720,
  };
}

export function LavaRunPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(getLavaRunBetLimits("GOLD").minBet);
  const [risk, setRisk] = useState<LavaRunRisk>("medium");
  const [round, setRound] = useState<LavaRunRound | null>(null);
  const [pendingPick, setPendingPick] = useState<LavaRunPendingPick | null>(null);
  const [cashoutPending, setCashoutPending] = useState(false);
  const [multiplierPulse, setMultiplierPulse] = useState(false);
  const [animatedPayout, setAnimatedPayout] = useState(0);
  const [cashoutOverlay, setCashoutOverlay] = useState<{ amount: number; multiplier: number; key: number } | null>(null);
  const [rulesOpen, setRulesOpen] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  const active = round?.status === "RUNNING";
  const resolved = round?.status === "BUST" || round?.status === "CASHED_OUT";
  const pendingReveal = Boolean(pendingPick);
  const controlsLocked = active || resolved || pendingReveal || cashoutPending;
  const displayedRisk = round && (active || resolved) ? round.risk : risk;
  const riskProfile = lavaRunConfig.riskProfiles[displayedRisk];
  const finalStepIndex = round?.status === "BUST" ? round.steps.at(-1)?.stepIndex : round?.stepsCompleted;
  const cameraWindow = getLavaRunCameraWindow({
    currentStep: round?.stepsCompleted ?? 0,
    finalStep: finalStepIndex,
    maxSteps: riskProfile.maxSteps,
    resolved,
  });
  const visibleSteps = cameraWindow.steps;
  const previewMultipliers = useMemo(() => getLavaRunMultiplierCurve(displayedRisk, betAmount), [betAmount, displayedRisk]);
  const displayMultipliers = round?.multipliers ?? previewMultipliers;
  const avatarTarget = getLavaRunAvatarTarget(round, pendingPick);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const betLimits = getLavaRunBetLimits(currency);
  const currentMultiplier = round?.status === "BUST" ? 0 : round?.currentMultiplier ?? 1;
  const nextMultiplier = active && round ? round.multipliers[round.stepsCompleted] : displayMultipliers[0];
  const betExceedsBalance = betAmount > balance;
  const canStart = !active && !resolved && betAmount >= betLimits.minBet && betAmount <= betLimits.maxBet && balance >= betAmount;
  const canChoose = Boolean(active && round && !pendingReveal && !cashoutPending && round.stepsCompleted < round.maxSteps);
  const canCashOut = Boolean(active && round && !pendingReveal && !cashoutPending && round.stepsCompleted > 0);
  const activeCashOutAmount = active && round && round.stepsCompleted > 0 ? Math.round(round.betAmount * currentMultiplier * 100) / 100 : 0;
  const availableCashOutAmount = activeCashOutAmount > 0 ? activeCashOutAmount : round?.status === "CASHED_OUT" ? round.totalPaid : 0;
  const bigWin = Boolean(cashoutOverlay && cashoutOverlay.multiplier >= 10);
  const visualIntensity = getLavaRunVisualIntensity({
    stepIndex: Math.min(riskProfile.maxSteps - 1, round?.stepsCompleted ?? 0),
    maxSteps: riskProfile.maxSteps,
    multiplier: nextMultiplier ?? currentMultiplier,
  });

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function clampBet(value: number, nextCurrency = currency) {
    const limits = getLavaRunBetLimits(nextCurrency);
    return clampBetAmount(value, {
      minBet: limits.minBet,
      maxBet: limits.maxBet,
      balance: getBalance(currentUser.id, nextCurrency),
      allowDecimals: nextCurrency === "BONUS",
    });
  }

  function setBet(value: number, nextCurrency = currency) {
    const next = clampBet(value, nextCurrency);
    setBetAmount(next);
  }

  function selectCurrency(nextCurrency: Currency) {
    if (controlsLocked) return;
    const nextBet = clampBet(betAmount, nextCurrency);
    setCurrency(nextCurrency);
    setBet(nextBet, nextCurrency);
  }

  function start() {
    if (active || resolved) return;
    try {
      clearTimers();
      setPendingPick(null);
      setCashoutPending(false);
      const nextRound = startLavaRunRound({ userId: currentUser.id, currency, betAmount, risk });
      setRound(nextRound);
      setAnimatedPayout(0);
      setCashoutOverlay(null);
      playLavaRunStart();
      refreshUser();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to start Lava Run.", "error");
      playError();
    }
  }

  function resetRound() {
    clearTimers();
    setRound(null);
    setPendingPick(null);
    setCashoutPending(false);
    setCashoutOverlay(null);
    setMultiplierPulse(false);
    setAnimatedPayout(0);
  }

  function animateCashoutPayout(amount: number) {
    setAnimatedPayout(0);
    const startedAt = window.performance.now();
    const duration = 720;
    const tick = () => {
      const elapsed = window.performance.now() - startedAt;
      const progress = Math.min(1, elapsed / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setAnimatedPayout(Math.round(amount * eased * 100) / 100);
      if (progress < 1) {
        const payoutTimer = window.setTimeout(tick, 34);
        timersRef.current.push(payoutTimer);
      }
    };
    tick();
  }

  function choosePlatform(choiceIndex: number) {
    if (!round || !canChoose) return;
    try {
      playLavaRunSelect();
      const pending: LavaRunPendingPick = { stepIndex: round.stepsCompleted, choiceIndex };
      setPendingPick(pending);
      const revealTimer = window.setTimeout(() => {
        try {
          const nextRound = pickLavaRunTile({ round, userId: currentUser.id, choiceIndex });
          setRound(nextRound);
          setPendingPick(null);
          if (nextRound.status === "BUST") {
            recordLavaRetention(nextRound.betAmount, 0, 0);
            playLavaRunBust();
            refreshUser();
            return;
          }
          setMultiplierPulse(true);
          playLavaRunSafe();
          playLavaRunMultiplier();
          if (nextRound.currentMultiplier >= 10) playLavaRunBigWin();
          const pulseTimer = window.setTimeout(() => setMultiplierPulse(false), lavaRunAnimationTimings.multiplierPulseMs);
          timersRef.current.push(pulseTimer);
        } catch (caught) {
          setPendingPick(null);
          notify(caught instanceof Error ? caught.message : "That platform is not available.", "error");
          playError();
        }
      }, lavaRunAnimationTimings.suspenseMs);
      timersRef.current.push(revealTimer);
    } catch (caught) {
      setPendingPick(null);
      notify(caught instanceof Error ? caught.message : "That platform is not available.", "error");
      playError();
    }
  }

  function cashOut() {
    if (!round || !canCashOut) return;
    try {
      setCashoutPending(true);
      playLavaRunSelect();
      const cashoutTimer = window.setTimeout(() => {
        try {
          const completed = cashOutLavaRunRound({ round, userId: currentUser.id });
          setRound(completed);
          setCashoutPending(false);
          setCashoutOverlay({ amount: completed.totalPaid, multiplier: completed.finalMultiplier ?? completed.currentMultiplier, key: Date.now() });
          animateCashoutPayout(completed.totalPaid);
          recordLavaRetention(completed.betAmount, completed.totalPaid, completed.finalMultiplier ?? completed.currentMultiplier);
          playLavaRunCashout();
          if ((completed.finalMultiplier ?? 0) >= 10) playLavaRunBigWin();
          refreshUser();
          const overlayTimer = window.setTimeout(() => setCashoutOverlay(null), 2200);
          timersRef.current.push(overlayTimer);
        } catch (caught) {
          setCashoutPending(false);
          notify(caught instanceof Error ? caught.message : "Unable to cash out Lava Run.", "error");
          playError();
        }
      }, lavaRunAnimationTimings.cashoutMs);
      timersRef.current.push(cashoutTimer);
    } catch (caught) {
      setCashoutPending(false);
      notify(caught instanceof Error ? caught.message : "Unable to cash out Lava Run.", "error");
      playError();
    }
  }

  function recordLavaRetention(wager: number, won: number, multiplier: number) {
    recordRetentionRound({
      userId: currentUser.id,
      gameId: "lavaRun",
      wager,
      won,
      multiplier,
    });
  }

  function getStep(stepIndex: number, choiceIndex: number) {
    return round?.steps.find((step) => step.stepIndex === stepIndex && step.choiceIndex === choiceIndex);
  }

  function getTileResult(stepIndex: number, choiceIndex: number, step?: LavaRunStep): LavaRunRevealResult | undefined {
    if (round && round.status !== "RUNNING") return round.board[stepIndex]?.tiles[choiceIndex];
    return step?.result;
  }

  function getTileImage(result: LavaRunRevealResult | undefined, chosen: boolean) {
    if (result === "lava") return lavaPlatformAsset;
    if (result === "safe") return chosen ? selectedPlatformAsset : safePlatformAsset;
    return hiddenPlatformAsset;
  }

  function tileClass(stepIndex: number, choiceIndex: number, step?: LavaRunStep) {
    const current = active && stepIndex === round?.stepsCompleted;
    const clickable = isLavaRunPlatformClickable({ stepIndex, activeStep: round?.stepsCompleted ?? 0, status: round?.status, pendingReveal: pendingReveal || cashoutPending });
    const fullReveal = shouldRevealLavaRunBoardState(round?.status);
    const result = getTileResult(stepIndex, choiceIndex, step);
    const chosen = Boolean(step);
    const cashoutChoice = round?.status === "CASHED_OUT" && chosen && step?.stepIndex === round.stepsCompleted - 1;
    const pendingChoice = pendingPick?.stepIndex === stepIndex && pendingPick.choiceIndex === choiceIndex;
    return [
      "lava-run-tile",
      current ? "current" : "",
      clickable ? "clickable" : "",
      fullReveal ? "revealed" : "",
      !current && !chosen && !fullReveal ? "dimmed" : "",
      chosen ? "path-chosen" : "",
      pendingChoice ? "pending-choice" : "",
      cashoutChoice ? "cashout-choice" : "",
      step?.result === "lava" ? "bust-choice" : "",
      result === "safe" ? "safe" : "",
      result === "lava" ? "lava" : "",
    ].filter(Boolean).join(" ");
  }

  function stageClass(stepIndex: number) {
    const current = active && stepIndex === round?.stepsCompleted;
    const complete = round ? stepIndex < round.stepsCompleted : false;
    const future = round ? stepIndex > round.stepsCompleted : true;
    const next = active && stepIndex === (round?.stepsCompleted ?? 0) + 1;
    const previewCurrent = !round && stepIndex === 0;
    const previewNext = !round && stepIndex === 1;
    const fullReveal = shouldRevealLavaRunBoardState(round?.status);
    const pendingStage = pendingPick?.stepIndex === stepIndex;
    return [
      "lava-run-stage",
      `zone-${getLavaRunEnvironmentZone(stepIndex, riskProfile.maxSteps)}`,
      current ? "current-stage" : "",
      next ? "next-stage" : "",
      previewCurrent ? "preview-current-stage" : "",
      previewNext ? "preview-next-stage" : "",
      complete ? "completed-stage" : "",
      future && !fullReveal ? "future-stage" : "",
      fullReveal ? "revealed-stage" : "",
      pendingStage ? "pending-stage" : "",
    ].filter(Boolean).join(" ");
  }

  return (
    <section
      className={`lava-run-page currency-${currency === "BONUS" ? "sc" : "gc"} risk-${displayedRisk} zone-${visualIntensity.zone} ${visualIntensity.multiplierTier} ${bigWin ? "big-win" : ""} ${pendingReveal ? "pending-reveal" : ""} ${cashoutPending ? "cashout-pending" : ""} ${multiplierPulse ? "multiplier-pulse" : ""}`}
      style={{ "--lava-run-heat": visualIntensity.heat, "--lava-run-canyon-bg": `url("${lavaCanyonLevelAsset}")` } as CSSProperties}
    >
      <header className="lava-run-header">
        <button className="lava-run-back" type="button" onClick={onExit} aria-label="Back to games"><ChevronLeft size={18} /></button>
        <div className="lava-run-title">
          <span className="lava-run-logo">
            <img src={lavaRunIconAsset} alt="" />
          </span>
          <div>
            <h1>Lava Run</h1>
          </div>
          <button className="lava-run-info-button" type="button" aria-label="Lava Run rules" onClick={() => setRulesOpen(true)}><Info size={14} /></button>
        </div>
        <div className="lava-run-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={controlsLocked} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={controlsLocked} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <ScreenShake active={round?.status === "BUST" || bigWin}>
        <main className={`lava-run-board ${cashoutPending ? "escaping" : round?.status?.toLowerCase() ?? "idle"}`}>
          <div className="lava-run-canyon" aria-label="Lava Run platform path" style={{ "--canyon-offset": `${cameraWindow.start * -132}px` } as CSSProperties}>
            <div className={`lava-run-canyon-depth risk-${displayedRisk} zone-${getLavaRunEnvironmentZone(Math.min(riskProfile.maxSteps - 1, round?.stepsCompleted ?? 0), riskProfile.maxSteps)}`} aria-hidden="true" />
            <div className="lava-run-embers" aria-hidden="true">
              {Array.from({ length: 12 }, (_, index) => <i key={index} style={{ "--ember-delay": `${index * -170}ms` } as CSSProperties} />)}
            </div>
            {active && round?.stepsCompleted === 0 && !pendingPick && (
              <span className="lava-run-runner-start" aria-hidden="true">
                <img src={emberAvatarAsset} alt="" />
              </span>
            )}
            <div
              className="lava-run-side-track"
              style={{ "--visible-steps": visibleSteps.length, "--lava-run-lanes": riskProfile.choicesPerRow, "--camera-step": cameraWindow.start } as CSSProperties}
            >
              {visibleSteps.map((stepIndex) => (
                <div
                  className={stageClass(stepIndex)}
                  key={stepIndex}
                  style={{ "--stage-index": stepIndex, "--reveal-index": stepIndex, "--stage-offset": `${-(stepIndex - (round?.stepsCompleted ?? 0))}px` } as CSSProperties}
                >
                  <div className="lava-run-stage-header">
                    <span>Step {stepIndex + 1}</span>
                    <strong>{formatLavaRunMultiplier(displayMultipliers[stepIndex] ?? 1)}</strong>
                  </div>
                  <div className="lava-run-platform-stack">
                    {Array.from({ length: riskProfile.choicesPerRow }, (_, choiceIndex) => {
                    const step = getStep(stepIndex, choiceIndex);
                    const result = getTileResult(stepIndex, choiceIndex, step);
                    const chosen = Boolean(step);
                    const disabled = !isLavaRunPlatformClickable({ stepIndex, activeStep: round?.stepsCompleted ?? 0, status: round?.status, pendingReveal: pendingReveal || cashoutPending });
                    const activeChoice = !disabled;
                    const cashoutChoice = Boolean(round && (round.status === "CASHED_OUT" || cashoutPending) && chosen && step?.stepIndex === round.stepsCompleted - 1);
                    const avatarState = avatarTarget?.stepIndex === stepIndex && avatarTarget.choiceIndex === choiceIndex ? avatarTarget.state : null;
                    const platformVisual = getLavaRunPlatformVisual({ risk: displayedRisk, stepIndex, choiceIndex });
                    return (
                      <button
                        key={`${stepIndex}-${choiceIndex}`}
                        type="button"
                        className={tileClass(stepIndex, choiceIndex, step)}
                        disabled={disabled}
                        onClick={() => choosePlatform(choiceIndex)}
                        aria-label={`Step ${stepIndex + 1} path ${choiceIndex + 1}${activeChoice ? ", clickable" : ""}${result ? `, ${result}` : ""}`}
                        style={{
                          "--platform-x": `${platformVisual.offsetX}px`,
                          "--platform-y": `${platformVisual.offsetY}px`,
                          "--platform-tilt": `${platformVisual.tilt}deg`,
                          "--platform-counter-tilt": `${-platformVisual.tilt}deg`,
                          "--platform-soft-tilt": `${Math.round(-platformVisual.tilt * 0.45 * 10) / 10}deg`,
                          "--platform-half-tilt": `${Math.round(platformVisual.tilt * 0.5 * 10) / 10}deg`,
                          "--platform-scale": platformVisual.scale,
                          "--platform-float-delay": `${platformVisual.floatDelayMs}ms`,
                        } as CSSProperties}
                      >
                        <img className="lava-run-tile-art" src={getTileImage(result, chosen)} alt="" />
                        {avatarState && (
                          <span key={`${stepIndex}-${choiceIndex}-${avatarState}-${round?.stepsCompleted ?? 0}`} className={`lava-run-avatar ${avatarState}-avatar`}>
                            <img src={emberAvatarAsset} alt="" />
                          </span>
                        )}
                        {step?.result === "safe" && <CoinBurst count={6} />}
                        {step?.result === "lava" && <img className="lava-burst-sprite" src={lavaBurstAsset} alt="" />}
                        {cashoutChoice && <img className="cashout-burst-sprite" src={cashoutBurstAsset} alt="" />}
                      </button>
                    );
                  })}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {round?.status === "BUST" && (
            <div className="lava-run-result loss" role="status">
              <strong>Bust</strong>
              <span>Lava hit. The visible canyon is revealed until reset.</span>
            </div>
          )}
          {round?.status === "CASHED_OUT" && (
            <div className="lava-run-result win" role="status">
              <strong>Escaped</strong>
              <span className="lava-run-payout-count">{formatCurrencyDisplay(Math.min(round.totalPaid, animatedPayout > 0 || cashoutOverlay ? animatedPayout : round.totalPaid), currency)} at {formatLavaRunMultiplier(round.finalMultiplier ?? round.currentMultiplier)}.</span>
            </div>
          )}
        </main>
      </ScreenShake>

      <section className="lava-run-controls">
        <div className="lava-run-risk" role="radiogroup" aria-label="Risk">
          {riskOrder.map((riskId) => (
            <button key={riskId} type="button" className={risk === riskId ? "active" : ""} disabled={controlsLocked} onClick={() => setRisk(riskId)}>
              {lavaRunConfig.riskProfiles[riskId].label}
            </button>
          ))}
        </div>
        <BetControls
          currentBet={betAmount}
          minBet={betLimits.minBet}
          maxBet={betLimits.maxBet}
          balance={balance}
          currency={currency}
          increment={betLimits.minBet}
          allowDecimals={currency === "BONUS"}
          disabled={controlsLocked}
          leadingInfo={
            active
              ? cashoutPending
                ? "Escaping"
                : activeCashOutAmount > 0
                  ? `Cashout ${formatCurrencyDisplay(availableCashOutAmount, currency)}`
                  : "Cashout after safe"
              : `${riskProfile.choicesPerRow} lanes, 1 safe`
          }
          onBetChange={(amount) => setBet(amount)}
        />
        {!active && !resolved && (
          <button className="lava-run-main-action" type="button" disabled={!canStart} onClick={start}>
            {betExceedsBalance ? `Bet exceeds ${currencyCopy[currency].short} balance` : "Start"}
          </button>
        )}
        {active && (
          <button className="lava-run-cashout lava-run-main-action" type="button" disabled={!canCashOut} onClick={cashOut}>
            {cashoutPending ? "Escaping" : "Cash Out"}
          </button>
        )}
        {resolved && (
          <button className="lava-run-reset lava-run-main-action" type="button" onClick={resetRound}>
            <RotateCcw size={17} />
            Reset / Play Again
          </button>
        )}
      </section>

      <WinOverlay show={Boolean(cashoutOverlay)} title={bigWin ? "Big Win" : "Cash Out"} amount={cashoutOverlay?.amount ?? 0} big={bigWin}>
        {cashoutOverlay ? `${formatLavaRunMultiplier(cashoutOverlay.multiplier)} Lava Run` : null}
      </WinOverlay>

      {rulesOpen && (
        <div className="lava-run-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="lava-run-rules" role="dialog" aria-modal="true" aria-labelledby="lava-run-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="lava-run-rules-title">Lava Run Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              <li>Each step has exactly one safe platform. Low has 2 paths, Medium has 3, and High has 4.</li>
              <li>Pick one glowing platform to jump right. A safe landing pans the canyon forward.</li>
              <li>Cash out after any safe step. Lava ends the run and reveals the visible canyon section.</li>
              <li>GC bets run from 1 to 1,000,000. SC bets run from 0.01 to 200.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}
