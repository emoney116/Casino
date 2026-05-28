import { useEffect, useRef, useState, type CSSProperties } from "react";
import { ChevronLeft, Info, KeyRound, Minus, Plus, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, ScreenShake, SoundToggle } from "../feedback/components";
import {
  playError,
  playSafecrackerClick,
  playSafecrackerInsert,
  playSafecrackerJackpot,
  playSafecrackerOpen,
  playSafecrackerPayout,
  playSafecrackerSnap,
  playSafecrackerTension,
  playSafecrackerUnlock,
} from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import {
  applySafecrackerAttemptProgress,
  clampSafecrackerBet,
  createSafecrackerProgressState,
  getSafecrackerBetLimits,
  resolveSafecrackerPickAttempt,
  safecrackerConfig,
  safecrackerRiskOrder,
  type SafecrackerAttempt,
  type SafecrackerProgressByRisk,
  type SafecrackerRisk,
} from "./safecrackerEngine";

const closedSafeAsset = new URL("../assets/safecracker/safe-closed.png", import.meta.url).href;
const partialSafeAsset = new URL("../assets/safecracker/safe-partial.png", import.meta.url).href;
const openSafeAsset = new URL("../assets/safecracker/safe-open.png", import.meta.url).href;
const lockpickKeyAsset = new URL("../assets/safecracker/lockpick-key.png", import.meta.url).href;
const brokenPickAsset = new URL("../assets/safecracker/broken-pick.png", import.meta.url).href;
const multiplierBurstAsset = new URL("../assets/safecracker/multiplier-burst.png", import.meta.url).href;

const currencyCopy: Record<Currency, { short: string; className: string }> = {
  GOLD: { short: "GC", className: "currency-gc" },
  BONUS: { short: "SC", className: "currency-sc" },
};

export const safecrackerAssetManifest = {
  closedSafe: closedSafeAsset,
  partialSafe: partialSafeAsset,
  openSafe: openSafeAsset,
  lockpickKey: lockpickKeyAsset,
  brokenPick: brokenPickAsset,
  multiplierBurst: multiplierBurstAsset,
};

export const safecrackerAnimationTimings = {
  insertMs: 220,
  tensionMs: 560,
  resolveMs: 840,
  successSettleMs: 520,
  failSettleMs: 620,
  unlockMs: 1280,
};

export const safecrackerUiMarkers = {
  gameName: "Safecracker",
  playheaterBranding: true,
  goldBonusToggle: true,
  riskSelector: true,
  riskSpecificBetLimits: true,
  perPickPaidAttempt: true,
  noFixedPicksRemaining: true,
  separateRiskProgress: true,
  lowStages: 3,
  mediumStages: 5,
  highStages: 7,
  safeTapToPick: true,
  oneHeroSafe: true,
  shortInstructionCopy: true,
  visualLockProgress: true,
  noBelowSafeProgressBars: true,
  noNumericProgressText: true,
  riskToneAnimationFilters: true,
  balanceBesideBet: true,
  leftAlignedBetLabel: true,
  centeredBetAmount: true,
  currencyTintedControls: true,
  noResultBanner: true,
  noRecentResults: true,
  noComplianceFooter: true,
  roundHeaderButtons: true,
  ovalCurrencyToggle: true,
  scBlueToggle: true,
  riskTunedRtpBands: true,
  multiplierRevealNotPickCountBased: true,
  threeRiskVisualTones: true,
  rasterSafeAssets: true,
  brokenPickRasterAsset: true,
  lockpickKeyRasterAsset: true,
  multiplierBurstRasterAsset: true,
  lockpickInsertAnimation: true,
  keyholeTargetedPickAnimation: true,
  tensionPause: true,
  clickAndGlowProgress: true,
  snapAndFallFailure: true,
  safeDoorOpenMoment: true,
  unlockWonAmountReveal: true,
  payoutCountUp: true,
  emberParticles: true,
  mobileFirstSafeDominant: true,
  sharedSoundToggle: true,
  audioHooks: true,
};

type SafecrackerActionState = "idle" | "insert" | "tension" | "progress" | "fail" | "unlocking";

export function SafecrackerPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [risk, setRisk] = useState<SafecrackerRisk>("medium");
  const [betAmount, setBetAmount] = useState(() => getSafecrackerBetLimits("GOLD", "medium").minBet);
  const [betInput, setBetInput] = useState(() => formatBetInput(getSafecrackerBetLimits("GOLD", "medium").minBet, "GOLD"));
  const [progressByRisk, setProgressByRisk] = useState<SafecrackerProgressByRisk>(() => createSafecrackerProgressState());
  const [lastAttempt, setLastAttempt] = useState<SafecrackerAttempt | null>(null);
  const [actionState, setActionState] = useState<SafecrackerActionState>("idle");
  const [rulesOpen, setRulesOpen] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => clearTimers(), []);

  if (!user) return null;
  const currentUser = user;
  const profile = safecrackerConfig.riskProfiles[risk];
  const limits = getSafecrackerBetLimits(currency, risk);
  const balance = getBalance(currentUser.id, currency);
  const active = actionState !== "idle";
  const progress = progressByRisk[risk];
  const stageProgress = profile.stageCount > 0 ? progress / profile.stageCount : 0;
  const betInvalid = !Number.isFinite(betAmount) || betAmount < limits.minBet || betAmount > limits.maxBet;
  const balanceTooLow = balance < betAmount;
  const canPick = !active && !betInvalid && !balanceTooLow;
  const unlocked = lastAttempt?.result === "unlock" && actionState !== "insert" && actionState !== "tension";
  const pageClass = [
    "safecracker-page",
    currencyCopy[currency].className,
    `risk-${risk}`,
    `tone-${profile.visualTone}`,
    `action-${actionState}`,
    unlocked ? "status-unlocked" : "status-picking",
  ].join(" ");
  const pageStyle = {
    "--safecracker-progress": stageProgress.toFixed(3),
    "--safecracker-stage": progress,
    "--safecracker-stage-count": profile.stageCount,
  } as CSSProperties;

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function schedule(callback: () => void, delay: number) {
    const timer = window.setTimeout(callback, delay);
    timersRef.current.push(timer);
  }

  function setBet(value: number, nextCurrency = currency, nextRisk = risk) {
    const next = clampSafecrackerBet(value, nextCurrency, nextRisk);
    setBetAmount(next);
    setBetInput(formatBetInput(next, nextCurrency));
  }

  function updateBetInput(value: string) {
    setBetInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const normalized = currency === "BONUS" ? Math.round(parsed * 100) / 100 : Math.round(parsed);
      setBetAmount(Math.max(0, Math.min(limits.maxBet, normalized)));
    }
  }

  function selectCurrency(nextCurrency: Currency) {
    if (active || nextCurrency === currency) return;
    setCurrency(nextCurrency);
    setBet(clampSafecrackerBet(betAmount, nextCurrency, risk), nextCurrency, risk);
  }

  function selectRisk(nextRisk: SafecrackerRisk) {
    if (active || nextRisk === risk) return;
    setRisk(nextRisk);
    setBet(clampSafecrackerBet(betAmount, currency, nextRisk), currency, nextRisk);
  }

  function pickLock() {
    if (!canPick) return;
    try {
      clearTimers();
      const attempt = resolveSafecrackerPickAttempt({
        userId: currentUser.id,
        currency,
        betAmount: clampSafecrackerBet(betAmount, currency, risk),
        risk,
        progress,
      });
      refreshUser();
      setActionState("insert");
      playSafecrackerInsert();
      schedule(() => {
        setActionState("tension");
        playSafecrackerTension();
      }, safecrackerAnimationTimings.insertMs);
      schedule(() => revealAttempt(attempt), safecrackerAnimationTimings.resolveMs);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to pick the lock.", "error");
      setActionState("idle");
      playError();
    }
  }

  function revealAttempt(attempt: SafecrackerAttempt) {
    setLastAttempt(attempt);
    setProgressByRisk((current) => applySafecrackerAttemptProgress(current, attempt));
    if (attempt.result === "unlock") {
      setActionState("unlocking");
      playSafecrackerUnlock();
      schedule(() => playSafecrackerOpen(), 320);
      schedule(() => {
        if (attempt.multiplier >= 100) playSafecrackerJackpot();
        else playSafecrackerPayout();
      }, 640);
      schedule(() => finishAttempt(attempt), safecrackerAnimationTimings.unlockMs);
      return;
    }
    if (attempt.result === "progress") {
      setActionState("progress");
      playSafecrackerClick();
      schedule(() => finishAttempt(attempt), safecrackerAnimationTimings.successSettleMs);
      return;
    }
    setActionState("fail");
    playSafecrackerSnap();
    schedule(() => finishAttempt(attempt), safecrackerAnimationTimings.failSettleMs);
  }

  function finishAttempt(attempt: SafecrackerAttempt) {
    setActionState("idle");
    recordRetentionRound({
      userId: currentUser.id,
      gameId: "safecracker",
      wager: attempt.betAmount,
      won: attempt.totalPaid,
      multiplier: attempt.multiplier,
      bonusTriggered: attempt.multiplier >= 100,
    });
    refreshUser();
  }

  const safeAsset = getSafeAsset(lastAttempt, actionState, progress);

  return (
    <section className={pageClass} style={pageStyle}>
      <header className="safecracker-header">
        <button className="safecracker-icon-button safecracker-back" type="button" onClick={onExit} aria-label="Back to games">
          <ChevronLeft size={18} />
        </button>
        <div className="safecracker-title">
          <h1>Safecracker</h1>
          <button type="button" aria-label="Safecracker rules" onClick={() => setRulesOpen(true)}>
            <Info size={14} />
          </button>
        </div>
        <div className="safecracker-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={active} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={active} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="safecracker-icon-button" compact />
      </header>
      <p className="safecracker-instruction">Click safe or press Pick Lock.</p>

      <ScreenShake active={actionState === "unlocking" || (actionState === "fail" && risk === "high")}>
        <main className="safecracker-stage">
          <div className="safecracker-embers" aria-hidden="true">
            {Array.from({ length: risk === "high" ? 24 : risk === "medium" ? 18 : 12 }, (_, index) => (
              <i
                key={index}
                style={{
                  "--ember-index": index,
                  "--ember-left": `${(index * 37) % 100}%`,
                  "--ember-bottom": `${2 + (index % 7) * 11}%`,
                } as CSSProperties}
              />
            ))}
          </div>
          <section className="safecracker-vault" aria-live="polite">
            <button
              className="safecracker-safe-button"
              type="button"
              disabled={!canPick}
              onClick={pickLock}
              aria-label="Pick the Safecracker lock"
            >
              <img className="safecracker-safe-image" src={safeAsset} alt="" draggable={false} />
              <span className="safecracker-risk-shell" aria-hidden="true" />
              <span className="safecracker-safe-glow" aria-hidden="true" />
              <span className="safecracker-lock-core" aria-hidden="true">
                {Array.from({ length: profile.stageCount }, (_, index) => (
                  <i key={index} className={index < progress ? "lit" : ""} style={{ "--dot-index": index, "--dot-count": profile.stageCount } as CSSProperties} />
                ))}
              </span>
              {(actionState === "insert" || actionState === "tension") && <img className="safecracker-live-pick" src={lockpickKeyAsset} alt="" draggable={false} />}
              {actionState === "fail" && <img className="safecracker-broken-pick" src={brokenPickAsset} alt="" draggable={false} />}
              {actionState === "fail" && <span className="safecracker-sparks" aria-hidden="true" />}
              {unlocked && (
                <span className="safecracker-multiplier-reveal">
                  <img src={multiplierBurstAsset} alt="" draggable={false} />
                  <span>
                    <em>{lastAttempt.multiplier >= 100 ? "JACKPOT" : "UNLOCKED"}</em>
                    <strong>{formatMultiplier(lastAttempt.multiplier)}</strong>
                    <small>Won {formatWinAmount(lastAttempt)}</small>
                  </span>
                  <CoinBurst count={lastAttempt.multiplier >= 100 ? 24 : 16} />
                </span>
              )}
            </button>

          </section>
        </main>
      </ScreenShake>

      <section className="safecracker-controls">
        <div className="safecracker-risk-tabs" role="tablist" aria-label="Risk level">
          {safecrackerRiskOrder.map((riskId) => (
            <button key={riskId} type="button" className={risk === riskId ? "active" : ""} disabled={active} onClick={() => selectRisk(riskId)}>
              <span>{safecrackerConfig.riskProfiles[riskId].label}</span>
            </button>
          ))}
        </div>

        <div className={balanceTooLow || betInvalid ? "safecracker-bet-bank warning" : "safecracker-bet-bank"}>
          <button type="button" aria-label="Decrease bet" disabled={active} onClick={() => setBet(betAmount - limits.minBet)}>
            <Minus size={17} />
          </button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode={currency === "BONUS" ? "decimal" : "numeric"}
              value={betInput}
              disabled={active}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.currentTarget.value))}
            />
          </label>
          <div className="safecracker-balance" aria-label={`${currencyCopy[currency].short} balance`}>
            <span>Balance</span>
            <strong>{currencyCopy[currency].short} {formatCoins(balance)}</strong>
          </div>
          <button type="button" aria-label="Increase bet" disabled={active} onClick={() => setBet(betAmount + limits.minBet)}>
            <Plus size={17} />
          </button>
        </div>

        <div className="safecracker-limit-row">
          <span>Min {currencyCopy[currency].short}: {formatCoins(limits.minBet)}</span>
          <strong>Max {currencyCopy[currency].short}: {formatCoins(limits.maxBet)}</strong>
        </div>

        <div className="safecracker-bottom-row">
          <button className="safecracker-main-action" type="button" disabled={!canPick} onClick={pickLock}>
            <KeyRound size={18} />
            <span>{getMainButtonLabel({ active, betInvalid, balanceTooLow, currency })}</span>
          </button>
        </div>
      </section>

      {rulesOpen && (
        <div className="safecracker-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="safecracker-rules" role="dialog" aria-modal="true" aria-labelledby="safecracker-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="safecracker-rules-title">Safecracker Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              <li>Every PICK LOCK press is a paid attempt and deducts the selected bet.</li>
              <li>Low, Medium, and High each keep their own lock progress.</li>
              <li>Progress raises tension but never guarantees the open. Any paid pick can unlock the safe.</li>
              <li>The multiplier is generated only when the safe opens and is not based on how many picks it took.</li>
              <li>Prototype mode. Redemptions are not currently enabled. Gold Coins have no cash value.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function getSafeAsset(attempt: SafecrackerAttempt | null, actionState: SafecrackerActionState, progress: number) {
  if (attempt?.result === "unlock" && actionState !== "insert" && actionState !== "tension") return openSafeAsset;
  if (progress > 0 || actionState === "progress") return partialSafeAsset;
  return closedSafeAsset;
}

function getMainButtonLabel({
  active,
  betInvalid,
  balanceTooLow,
  currency,
}: {
  active: boolean;
  betInvalid: boolean;
  balanceTooLow: boolean;
  currency: Currency;
}) {
  if (active) return "WORKING";
  if (balanceTooLow) return `LOW ${currencyCopy[currency].short}`;
  if (betInvalid) return "CHECK BET";
  return "PICK LOCK";
}

function formatMultiplier(multiplier: number) {
  if (!Number.isFinite(multiplier) || multiplier <= 0) return "0x";
  return `${Number.isInteger(multiplier) ? multiplier.toFixed(0) : multiplier.toFixed(2).replace(/0+$/, "").replace(/\.$/, "")}x`;
}

function formatWinAmount(attempt: SafecrackerAttempt) {
  const amount = formatCoins(attempt.totalPaid);
  return attempt.currency === "BONUS" ? `$${amount}` : `GC ${amount}`;
}

function formatBetInput(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return "0";
  return currency === "BONUS" ? Number(amount.toFixed(2)).toString() : Math.round(amount).toString();
}
