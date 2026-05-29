import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { CasinoData, Currency, User } from "../types";
import {
  getFeedbackDebugCount,
  playSafecrackerClick,
  playSafecrackerInsert,
  playSafecrackerJackpot,
  playSafecrackerOpen,
  playSafecrackerPayout,
  playSafecrackerSnap,
  playSafecrackerTension,
  playSafecrackerUnlock,
  resetFeedbackDebugCounts,
  setSoundEnabled,
} from "../feedback/feedbackService";
import {
  applySafecrackerAttemptProgress,
  clampSafecrackerBet,
  createSafecrackerProgressState,
  getSafecrackerBetLimits,
  getSafecrackerEstimatedRtp,
  getSafecrackerRewardRange,
  getSafecrackerUnlockChance,
  getSafecrackerTopMultiplier,
  pickSafecrackerAttemptResult,
  pickSafecrackerMultiplier,
  resolveSafecrackerPickAttempt,
  safecrackerConfig,
  safecrackerRtpBands,
  safecrackerRiskOrder,
  simulateSafecracker,
  type SafecrackerAttempt,
  type SafecrackerAttemptResult,
  type SafecrackerRisk,
} from "./safecrackerEngine";
import { safecrackerAnimationTimings, safecrackerAssetManifest, safecrackerUiMarkers } from "./SafecrackerPage";
import { safecrackerTableConfig } from "./configs";
import { simulateTableGame } from "./tableMath";

const memory: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key) => memory[key] ?? null,
  setItem: (key, value) => {
    memory[key] = value;
  },
  removeItem: (key) => {
    delete memory[key];
  },
  clear: () => {
    Object.keys(memory).forEach((key) => delete memory[key]);
  },
  key: (index) => Object.keys(memory)[index] ?? null,
  get length() {
    return Object.keys(memory).length;
  },
} as Storage;

const user: User = {
  id: "safecracker-test-user",
  email: "safecracker@test.local",
  username: "SafeTest",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user],
  passwordRecords: {},
  sessions: [],
  walletBalances: {},
  transactions: [],
  progression: {},
  streaks: {},
  missions: {},
  favorites: {},
  retention: {},
  redemptionRequests: [],
  kycStatuses: {},
  eligibilityFlags: {},
};

localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100000 });
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "BONUS", amount: 1000 });

if (safecrackerConfig.name !== "Safecracker" || safecrackerConfig.slug !== "safecracker" || safecrackerTableConfig.id !== "safecracker") {
  throw new Error("Expected Safecracker config and table registration to use the Safecracker identity.");
}

if (
  safecrackerConfig.riskProfiles.low.stageCount !== 3 ||
  safecrackerConfig.riskProfiles.medium.stageCount !== 5 ||
  safecrackerConfig.riskProfiles.high.stageCount !== 7
) {
  throw new Error("Expected Safecracker Low/Medium/High locks to use 3/5/7 progress stages.");
}

if (
  getSafecrackerBetLimits("GOLD", "low").maxBet !== 10000 ||
  getSafecrackerBetLimits("GOLD", "medium").maxBet !== 100000 ||
  getSafecrackerBetLimits("GOLD", "high").maxBet !== 1000000 ||
  getSafecrackerBetLimits("BONUS", "low").minBet !== 0.01 ||
  getSafecrackerBetLimits("BONUS", "medium").minBet !== 0.1 ||
  getSafecrackerBetLimits("BONUS", "high").minBet !== 0.2 ||
  getSafecrackerBetLimits("BONUS", "high").maxBet !== 500
) {
  throw new Error("Expected Safecracker risk-specific GC and SC bet limits.");
}

if (
  clampSafecrackerBet(50000, "GOLD", "low") !== 10000 ||
  clampSafecrackerBet(0.02, "BONUS", "medium") !== 0.1 ||
  clampSafecrackerBet(1000, "BONUS", "high") !== 500
) {
  throw new Error("Expected Safecracker bet clamp to react to risk and currency changes.");
}

if (
  getSafecrackerTopMultiplier("low") >= getSafecrackerTopMultiplier("medium") ||
  getSafecrackerTopMultiplier("medium") >= getSafecrackerTopMultiplier("high") ||
  getSafecrackerRewardRange("high").max !== 1000
) {
  throw new Error("Expected Safecracker risk levels to increase max multiplier rewards.");
}

const failUser = "safecracker-fail-user";
creditCurrency({ userId: failUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100 });
const failBalanceBefore = getBalance(failUser, "GOLD");
const failAttempt = resolveSafecrackerPickAttempt({
  userId: failUser,
  currency: "GOLD",
  betAmount: 10,
  risk: "low",
  progress: 1,
  forcedResult: "fail",
});
if (failAttempt.result !== "fail" || failAttempt.progressBefore !== 1 || failAttempt.progressAfter !== 1 || failAttempt.totalPaid !== 0) {
  throw new Error("Expected Safecracker failed paid pick to break without progressing.");
}
if (getBalance(failUser, "GOLD") !== failBalanceBefore - 10) {
  throw new Error("Expected every Safecracker PICK LOCK press to deduct the selected bet.");
}
if ("picksRemaining" in (failAttempt as SafecrackerAttempt & { picksRemaining?: unknown })) {
  throw new Error("Expected Safecracker attempts not to expose fixed picks remaining.");
}
const failBetTx = getTransactions(failUser).find((tx) => tx.type === "ARCADE_BET");
if (!failBetTx || failBetTx.metadata?.game !== "safecracker" || failBetTx.metadata?.risk !== "low" || failBetTx.metadata?.bet !== 10 || failBetTx.metadata?.progressBefore !== 1 || failBetTx.metadata?.progressAfter !== 1 || failBetTx.metadata?.attemptResult !== "fail") {
  throw new Error("Expected Safecracker bet ledger metadata for a failed paid pick.");
}

const progressUser = "safecracker-progress-user";
creditCurrency({ userId: progressUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const progressAttempt = resolveSafecrackerPickAttempt({
  userId: progressUser,
  currency: "GOLD",
  betAmount: 25,
  risk: "medium",
  progress: 2,
  forcedResult: "progress",
});
if (progressAttempt.result !== "progress" || progressAttempt.progressAfter !== 3 || getBalance(progressUser, "GOLD") !== 975) {
  throw new Error("Expected Safecracker progress attempt to advance exactly one lock stage and charge one bet.");
}

let progressByRisk = createSafecrackerProgressState();
progressByRisk = applySafecrackerAttemptProgress(progressByRisk, resolveSafecrackerPickAttempt({
  userId: progressUser,
  currency: "GOLD",
  betAmount: 10,
  risk: "low",
  progress: progressByRisk.low,
  forcedResult: "progress",
}));
progressByRisk = applySafecrackerAttemptProgress(progressByRisk, progressAttempt);
if (progressByRisk.low !== 1 || progressByRisk.medium !== 3 || progressByRisk.high !== 0) {
  throw new Error("Expected Safecracker progress to persist separately for each risk when switching locks.");
}

const winUser = "safecracker-win-user";
creditCurrency({ userId: winUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const winBalanceBefore = getBalance(winUser, "GOLD");
const unlockAttempt = resolveSafecrackerPickAttempt({
  userId: winUser,
  currency: "GOLD",
  betAmount: 20,
  risk: "medium",
  progress: 4,
  forcedResult: "unlock",
  forcedMultiplier: 8,
});
if (unlockAttempt.result !== "unlock" || unlockAttempt.progressAfter !== 0 || unlockAttempt.totalPaid !== 160) {
  throw new Error("Expected Safecracker unlock attempt to open, reveal multiplier, pay bet times multiplier, and reset lock progress.");
}
if (getBalance(winUser, "GOLD") !== winBalanceBefore - 20 + 160 || getBalance(winUser, "GOLD") < 0) {
  throw new Error("Expected Safecracker unlock payout to credit the wallet without negative balances.");
}
const winTx = getTransactions(winUser).find((tx) => tx.type === "ARCADE_WIN");
if (!winTx || winTx.metadata?.game !== "safecracker" || winTx.metadata?.risk !== "medium" || winTx.metadata?.multiplier !== 8 || winTx.metadata?.payout !== 160 || winTx.metadata?.attemptResult !== "unlock") {
  throw new Error("Expected Safecracker win ledger metadata to include risk, multiplier, and payout.");
}

try {
  resolveSafecrackerPickAttempt({ userId: "safecracker-empty-user", currency: "GOLD", betAmount: 1, risk: "low", progress: 0 });
  throw new Error("Expected Safecracker to block insufficient balances.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}

for (const risk of safecrackerRiskOrder) {
  const estimatedRtp = getSafecrackerEstimatedRtp(risk);
  const rtpBand = safecrackerRtpBands[risk];
  const sim = simulateSafecracker(risk, 50000, 1);
  if (
    getSafecrackerUnlockChance(risk, 0) !== getSafecrackerUnlockChance(risk, Math.floor(safecrackerConfig.riskProfiles[risk].stageCount / 2)) ||
    getSafecrackerUnlockChance(risk, 0) !== getSafecrackerUnlockChance(risk, safecrackerConfig.riskProfiles[risk].stageCount)
  ) {
    throw new Error(`Expected Safecracker ${risk} unlock odds to stay independent from visual lock progress so bet sizing cannot change RTP.`);
  }
  if (estimatedRtp < rtpBand.min || estimatedRtp > rtpBand.max) {
    throw new Error(`Expected Safecracker ${risk} estimated RTP to remain inside its tuned target band.`);
  }
  if (
    sim.observedRtp > rtpBand.max + 0.04 ||
    sim.houseEdge <= 0 ||
    sim.averageAttemptsToOpen <= 0 ||
    sim.failRate <= 0 ||
    sim.progressRate < 0 ||
    sim.instantUnlockRate <= 0 ||
    sim.averagePayout <= 0 ||
    sim.maxWinObserved <= 0
  ) {
    throw new Error(`Expected Safecracker ${risk} repeated-attempt simulation to report RTP and attempt stats inside the tuned variance window.`);
  }
}

const lowSim = simulateSafecracker("low", 50000, 1);
const mediumSim = simulateSafecracker("medium", 50000, 1);
const highSim = simulateSafecracker("high", 50000, 1);
if (lowSim.averageAttemptsToOpen >= mediumSim.averageAttemptsToOpen || mediumSim.averageAttemptsToOpen >= highSim.averageAttemptsToOpen || highSim.maxWinObserved < mediumSim.maxWinObserved) {
  throw new Error("Expected Safecracker risks to feel forgiving, balanced, then volatile.");
}

const tableSim = simulateTableGame("safecracker", 50000);
if (tableSim.observedRtp >= 0.96 || safecrackerTableConfig.houseEdgeTarget < 0.04) {
  throw new Error("Expected Safecracker table simulation and config target to stay inside tuned RTP limits.");
}

const assetValues = Object.values(safecrackerAssetManifest);
if (
  assetValues.length !== 6 ||
  !assetValues.every((asset) => asset.includes("/assets/safecracker/") && asset.endsWith(".png")) ||
  !safecrackerAssetManifest.openSafe.includes("safe-open.png") ||
  !safecrackerAssetManifest.lockpickKey.includes("lockpick-key.png") ||
  !safecrackerAssetManifest.brokenPick.includes("broken-pick.png")
) {
  throw new Error("Expected Safecracker to use premium raster safe, lockpick-key, broken-pick, and multiplier reveal assets.");
}

if (
  safecrackerUiMarkers.gameName !== "Safecracker" ||
  !safecrackerUiMarkers.goldBonusToggle ||
  !safecrackerUiMarkers.riskSelector ||
  !safecrackerUiMarkers.riskSpecificBetLimits ||
  !safecrackerUiMarkers.perPickPaidAttempt ||
  !safecrackerUiMarkers.noFixedPicksRemaining ||
  !safecrackerUiMarkers.separateRiskProgress ||
  safecrackerUiMarkers.lowStages !== 3 ||
  safecrackerUiMarkers.mediumStages !== 5 ||
  safecrackerUiMarkers.highStages !== 7 ||
  !safecrackerUiMarkers.safeTapToPick ||
  !safecrackerUiMarkers.oneHeroSafe ||
  !safecrackerUiMarkers.shortInstructionCopy ||
  !safecrackerUiMarkers.visualLockProgress ||
  !safecrackerUiMarkers.noBelowSafeProgressBars ||
  !safecrackerUiMarkers.noNumericProgressText ||
  !safecrackerUiMarkers.riskToneAnimationFilters ||
  !safecrackerUiMarkers.balanceBesideBet ||
  !safecrackerUiMarkers.leftAlignedBetLabel ||
  !safecrackerUiMarkers.centeredBetAmount ||
  !safecrackerUiMarkers.currencyTintedControls ||
  !safecrackerUiMarkers.noResultBanner ||
  !safecrackerUiMarkers.noRecentResults ||
  !safecrackerUiMarkers.noComplianceFooter ||
  !safecrackerUiMarkers.roundHeaderButtons ||
  !safecrackerUiMarkers.ovalCurrencyToggle ||
  !safecrackerUiMarkers.scGreenToggle ||
  !safecrackerUiMarkers.riskTunedRtpBands ||
  !safecrackerUiMarkers.multiplierRevealNotPickCountBased ||
  !safecrackerUiMarkers.threeRiskVisualTones ||
  !safecrackerUiMarkers.lockpickKeyRasterAsset ||
  !safecrackerUiMarkers.lockpickInsertAnimation ||
  !safecrackerUiMarkers.keyholeTargetedPickAnimation ||
  !safecrackerUiMarkers.tensionPause ||
  !safecrackerUiMarkers.clickAndGlowProgress ||
  !safecrackerUiMarkers.snapAndFallFailure ||
  !safecrackerUiMarkers.safeDoorOpenMoment ||
  !safecrackerUiMarkers.unlockWonAmountReveal ||
  !safecrackerUiMarkers.payoutCountUp ||
  !safecrackerUiMarkers.mobileFirstSafeDominant ||
  !safecrackerUiMarkers.sharedSoundToggle ||
  !safecrackerUiMarkers.audioHooks
) {
  throw new Error("Expected Safecracker UI markers for repeated paid lockpicking with per-risk progress.");
}

if (
  safecrackerAnimationTimings.insertMs < 160 ||
  safecrackerAnimationTimings.tensionMs < 420 ||
  safecrackerAnimationTimings.resolveMs < 700 ||
  safecrackerAnimationTimings.unlockMs < 1100
) {
  throw new Error("Expected Safecracker animation timings to leave room for insert, tension, and unlock beats.");
}

resetFeedbackDebugCounts();
setSoundEnabled(false);
for (const hook of [
  playSafecrackerInsert,
  playSafecrackerTension,
  playSafecrackerClick,
  playSafecrackerSnap,
  playSafecrackerUnlock,
  playSafecrackerOpen,
  playSafecrackerPayout,
  playSafecrackerJackpot,
]) {
  hook();
}
if (getFeedbackDebugCount("playSafecrackerInsert") !== 1 || getFeedbackDebugCount("playSafecrackerJackpot") !== 1) {
  throw new Error("Expected Safecracker audio hooks to be callable even when sound is disabled.");
}

interface SafecrackerVariableBetStrategyContext {
  risk: SafecrackerRisk;
  currency: Currency;
  progress: number;
  stageCount: number;
  attemptInSafe: number;
  failStreak: number;
  limits: { minBet: number; maxBet: number };
  capSafeMaxBet: number;
  random: () => number;
  lastResult: SafecrackerAttemptResult | null;
}

interface SafecrackerVariableBetStrategy {
  name: string;
  getBet: (context: SafecrackerVariableBetStrategyContext) => number;
}

const safecrackerVariableBetStrategies: SafecrackerVariableBetStrategy[] = [
  {
    name: "random legal bets",
    getBet: ({ limits, random }) => limits.minBet + (limits.maxBet - limits.minBet) * random(),
  },
  {
    name: "progress chaser",
    getBet: ({ progress, stageCount, limits, capSafeMaxBet }) => (progress >= stageCount - 1 ? capSafeMaxBet : limits.minBet),
  },
  {
    name: "martingale-ish fail ramp",
    getBet: ({ failStreak, limits, capSafeMaxBet }) => Math.min(capSafeMaxBet, limits.minBet * 2 ** Math.min(failStreak, 10)),
  },
  {
    name: "reverse chaser",
    getBet: ({ progress, limits, capSafeMaxBet }) => (progress === 0 ? capSafeMaxBet : limits.minBet),
  },
];

function simulateSafecrackerVariableBetStrategy(
  risk: SafecrackerRisk,
  currency: Currency,
  safesToOpen: number,
  strategy: SafecrackerVariableBetStrategy,
) {
  const outcomeRandom = seededTestRandom(0x51a7e + safecrackerRiskOrder.indexOf(risk) * 4099 + strategy.name.length * 97);
  const betRandom = seededTestRandom(0xbe771 + safecrackerRiskOrder.indexOf(risk) * 8191 + strategy.name.length * 193);
  const profile = safecrackerConfig.riskProfiles[risk];
  const limits = getSafecrackerBetLimits(currency, risk);
  const capSafeMaxBet = Math.min(limits.maxBet, safecrackerConfig.maxPayout / getSafecrackerTopMultiplier(risk));
  let totalWagered = 0;
  let totalPaid = 0;
  let totalAttempts = 0;
  let maxPayoutCapHits = 0;

  for (let safeIndex = 0; safeIndex < safesToOpen; safeIndex += 1) {
    let progress = 0;
    let failStreak = 0;
    let attemptInSafe = 0;
    let lastResult: SafecrackerAttemptResult | null = null;
    let opened = false;
    let guard = 0;
    while (!opened && guard < 10000) {
      guard += 1;
      attemptInSafe += 1;
      totalAttempts += 1;
      const rawBet = strategy.getBet({
        risk,
        currency,
        progress,
        stageCount: profile.stageCount,
        attemptInSafe,
        failStreak,
        limits,
        capSafeMaxBet,
        random: betRandom,
        lastResult,
      });
      const bet = Math.max(limits.minBet, Math.min(capSafeMaxBet, Math.round(rawBet * 100) / 100));
      totalWagered += bet;
      const result = pickSafecrackerAttemptResult({ risk, progress, random: outcomeRandom });
      lastResult = result;
      if (result === "unlock") {
        const multiplier = pickSafecrackerMultiplier(risk, outcomeRandom);
        const rawPaid = bet * multiplier;
        const paid = Math.min(rawPaid, safecrackerConfig.maxPayout);
        totalPaid += Math.round(paid * 100) / 100;
        if (rawPaid > paid) maxPayoutCapHits += 1;
        opened = true;
      } else if (result === "progress") {
        progress = Math.min(profile.stageCount, progress + 1);
        failStreak = 0;
      } else {
        failStreak += 1;
      }
    }
  }

  return {
    observedRtp: totalPaid / totalWagered,
    totalAttempts,
    totalWagered,
    totalPaid,
    maxPayoutCapHits,
  };
}

function seededTestRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

for (const risk of safecrackerRiskOrder) {
  const expectedRtp = getSafecrackerEstimatedRtp(risk);
  for (const strategy of safecrackerVariableBetStrategies) {
    const strategySim = simulateSafecrackerVariableBetStrategy(risk, "BONUS", 100000, strategy);
    if (strategySim.maxPayoutCapHits !== 0) {
      throw new Error(`Expected Safecracker ${risk} ${strategy.name} bet strategy test to avoid max payout cap distortion.`);
    }
    if (Math.abs(strategySim.observedRtp - expectedRtp) > 0.05) {
      throw new Error(`Expected Safecracker ${risk} ${strategy.name} bet strategy RTP to stay aligned with fixed-bet RTP.`);
    }
  }
}

console.log("safecracker.devtest passed");
