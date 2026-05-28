import { createId } from "../lib/ids";
import type { Currency, Transaction } from "../types";
import { creditCurrency, debitCurrency, getBalance } from "../wallet/walletService";

export type SafecrackerRisk = "low" | "medium" | "high";
export type SafecrackerAttemptResult = "fail" | "progress" | "unlock";

export interface SafecrackerWeight<T> {
  value: T;
  weight: number;
}

export interface SafecrackerRiskProfile {
  label: string;
  visualTone: "bronze" | "gold" | "diamond";
  stageCount: number;
  targetRtp: number;
  progressChance: number;
  baseUnlockChance: number;
  progressUnlockBoost: number;
  maxUnlockChance: number;
  minBetGold: number;
  maxBetGold: number;
  minBetSweepstakes: number;
  maxBetSweepstakes: number;
  multiplierWeights: Array<SafecrackerWeight<number>>;
}

export interface SafecrackerConfig {
  id: "safecracker";
  slug: "safecracker";
  name: "Safecracker";
  theme: string;
  minBet: number;
  maxBet: number;
  minBetGold: number;
  maxBetGold: number;
  minBetSweepstakes: number;
  maxBetSweepstakes: number;
  minBetRealCentsPlaceholder: number;
  maxBetRealCentsPlaceholder: number;
  maxPayout: number;
  targetRtp: number;
  riskProfiles: Record<SafecrackerRisk, SafecrackerRiskProfile>;
}

export type SafecrackerProgressByRisk = Record<SafecrackerRisk, number>;

export interface SafecrackerAttempt {
  id: string;
  risk: SafecrackerRisk;
  currency: Currency;
  betAmount: number;
  result: SafecrackerAttemptResult;
  progressBefore: number;
  progressAfter: number;
  stageCount: number;
  multiplier: number;
  totalPaid: number;
  capped: boolean;
  transactions: Transaction[];
}

export interface SafecrackerSimulationResult {
  risk: SafecrackerRisk;
  safesOpened: number;
  totalAttempts: number;
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  estimatedRtp: number;
  houseEdge: number;
  averageAttemptsToOpen: number;
  failRate: number;
  progressRate: number;
  instantUnlockRate: number;
  averagePayout: number;
  maxWinObserved: number;
  biggestWin: number;
  maxPayoutCapHits: number;
  maxCapHitRate: number;
}

export const safecrackerRiskOrder: SafecrackerRisk[] = ["low", "medium", "high"];

export const safecrackerRtpBands: Record<SafecrackerRisk, { min: number; max: number }> = {
  low: { min: 0.95, max: 0.96 },
  medium: { min: 0.93, max: 0.94 },
  high: { min: 0.92, max: 0.93 },
};

export const safecrackerConfig: SafecrackerConfig = {
  id: "safecracker",
  slug: "safecracker",
  name: "Safecracker",
  theme: "Premium casino vault lockpicking",
  minBet: 1,
  maxBet: 1000000,
  minBetGold: 1,
  maxBetGold: 1000000,
  minBetSweepstakes: 0.01,
  maxBetSweepstakes: 500,
  minBetRealCentsPlaceholder: 1,
  maxBetRealCentsPlaceholder: 500,
  maxPayout: 1000000000,
  targetRtp: 0.935,
  riskProfiles: {
    low: {
      label: "Low",
      visualTone: "bronze",
      stageCount: 3,
      targetRtp: 0.953,
      progressChance: 0.34,
      baseUnlockChance: 0.365,
      progressUnlockBoost: 0,
      maxUnlockChance: 0.365,
      minBetGold: 1,
      maxBetGold: 10000,
      minBetSweepstakes: 0.01,
      maxBetSweepstakes: 50,
      multiplierWeights: [
        { value: 2, weight: 80 },
        { value: 3, weight: 10 },
        { value: 5, weight: 6 },
        { value: 8, weight: 3 },
        { value: 15, weight: 0.8 },
        { value: 25, weight: 0.2 },
      ],
    },
    medium: {
      label: "Medium",
      visualTone: "gold",
      stageCount: 5,
      targetRtp: 0.935,
      progressChance: 0.31,
      baseUnlockChance: 0.14,
      progressUnlockBoost: 0,
      maxUnlockChance: 0.14,
      minBetGold: 1,
      maxBetGold: 100000,
      minBetSweepstakes: 0.1,
      maxBetSweepstakes: 100,
      multiplierWeights: [
        { value: 2, weight: 35.2 },
        { value: 3, weight: 24 },
        { value: 5, weight: 16 },
        { value: 8, weight: 10 },
        { value: 12, weight: 6 },
        { value: 20, weight: 4.8 },
        { value: 35, weight: 2.5 },
        { value: 60, weight: 1 },
        { value: 100, weight: 0.5 },
      ],
    },
    high: {
      label: "High",
      visualTone: "diamond",
      stageCount: 7,
      targetRtp: 0.925,
      progressChance: 0.2,
      baseUnlockChance: 0.0307,
      progressUnlockBoost: 0,
      maxUnlockChance: 0.0307,
      minBetGold: 1,
      maxBetGold: 1000000,
      minBetSweepstakes: 0.2,
      maxBetSweepstakes: 500,
      multiplierWeights: [
        { value: 5, weight: 39.6 },
        { value: 8, weight: 26 },
        { value: 15, weight: 14 },
        { value: 25, weight: 8 },
        { value: 50, weight: 5 },
        { value: 100, weight: 3.5 },
        { value: 250, weight: 2.4 },
        { value: 500, weight: 1 },
        { value: 1000, weight: 0.5 },
      ],
    },
  },
};

export function createSafecrackerProgressState(): SafecrackerProgressByRisk {
  return { low: 0, medium: 0, high: 0 };
}

export function getSafecrackerBetLimits(currency: Currency, risk: SafecrackerRisk = "medium", config = safecrackerConfig) {
  const profile = config.riskProfiles[risk];
  if (currency === "BONUS") return { minBet: profile.minBetSweepstakes, maxBet: profile.maxBetSweepstakes };
  return { minBet: profile.minBetGold, maxBet: profile.maxBetGold };
}

export function clampSafecrackerBet(amount: number, currency: Currency, risk: SafecrackerRisk, config = safecrackerConfig) {
  const limits = getSafecrackerBetLimits(currency, risk, config);
  if (!Number.isFinite(amount)) return limits.minBet;
  const normalized = currency === "BONUS" ? Math.round(amount * 100) / 100 : Math.round(amount);
  return Math.max(limits.minBet, Math.min(limits.maxBet, normalized));
}

export function assertSafecrackerBet(userId: string, currency: Currency, amount: number, risk: SafecrackerRisk, config = safecrackerConfig) {
  const limits = getSafecrackerBetLimits(currency, risk, config);
  const label = currency === "BONUS" ? "SC" : "GC";
  if (!Number.isFinite(amount) || amount < limits.minBet) throw new Error(`Minimum ${label} ${config.riskProfiles[risk].label} bet is ${limits.minBet}.`);
  if (amount > limits.maxBet) throw new Error(`Maximum ${label} ${config.riskProfiles[risk].label} bet is ${limits.maxBet}.`);
  if (getBalance(userId, currency) < amount) throw new Error("Insufficient balance for Safecracker.");
}

export function getSafecrackerUnlockChance(risk: SafecrackerRisk, progress: number, config = safecrackerConfig) {
  const profile = config.riskProfiles[risk];
  const stageProgress = Math.max(0, Math.min(profile.stageCount, Math.round(progress)));
  return Math.min(profile.maxUnlockChance, profile.baseUnlockChance + stageProgress * profile.progressUnlockBoost);
}

export function getSafecrackerAttemptChances(risk: SafecrackerRisk, progress: number, config = safecrackerConfig) {
  const profile = config.riskProfiles[risk];
  const unlockChance = getSafecrackerUnlockChance(risk, progress, config);
  const progressChance = progress >= profile.stageCount ? 0 : Math.min(profile.progressChance, Math.max(0, 0.96 - unlockChance));
  return {
    unlockChance,
    progressChance,
    failChance: Math.max(0, 1 - unlockChance - progressChance),
  };
}

export function pickSafecrackerAttemptResult({
  risk,
  progress,
  random = Math.random,
  config = safecrackerConfig,
}: {
  risk: SafecrackerRisk;
  progress: number;
  random?: () => number;
  config?: SafecrackerConfig;
}): SafecrackerAttemptResult {
  const chances = getSafecrackerAttemptChances(risk, progress, config);
  const roll = random();
  if (roll < chances.unlockChance) return "unlock";
  if (roll < chances.unlockChance + chances.progressChance) return "progress";
  return "fail";
}

export function pickSafecrackerMultiplier(risk: SafecrackerRisk, random = Math.random, config = safecrackerConfig) {
  return pickWeighted(config.riskProfiles[risk].multiplierWeights, random);
}

export function resolveSafecrackerPickAttempt({
  userId,
  currency,
  betAmount,
  risk,
  progress,
  random = Math.random,
  forcedResult,
  forcedMultiplier,
  config = safecrackerConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  risk: SafecrackerRisk;
  progress: number;
  random?: () => number;
  forcedResult?: SafecrackerAttemptResult;
  forcedMultiplier?: number;
  config?: SafecrackerConfig;
}): SafecrackerAttempt {
  const wager = round2(betAmount);
  assertSafecrackerBet(userId, currency, wager, risk, config);
  const profile = config.riskProfiles[risk];
  const progressBefore = Math.max(0, Math.min(profile.stageCount, Math.round(progress)));
  const result = forcedResult ?? pickSafecrackerAttemptResult({ risk, progress: progressBefore, random, config });
  const multiplier = result === "unlock" ? (forcedMultiplier ?? pickSafecrackerMultiplier(risk, random, config)) : 0;
  const rawPaid = result === "unlock" ? wager * multiplier : 0;
  const totalPaid = result === "unlock" ? round2(Math.min(rawPaid, config.maxPayout)) : 0;
  const progressAfter = result === "unlock"
    ? 0
    : result === "progress"
      ? Math.min(profile.stageCount, progressBefore + 1)
      : progressBefore;
  const metadata = {
    game: config.id,
    arcadeGameId: config.id,
    arcadeGame: config.name,
    risk,
    bet: wager,
    progressBefore,
    progressAfter,
    attemptResult: result,
    multiplier,
    payout: totalPaid,
    noSkill: true,
  };
  const transactions: Transaction[] = [
    debitCurrency({
      userId,
      currency,
      amount: wager,
      type: "ARCADE_BET",
      metadata,
    }),
  ];
  if (result === "unlock") {
    transactions.push(
      creditCurrency({
        userId,
        currency,
        amount: totalPaid,
        type: "ARCADE_WIN",
        metadata,
      }),
    );
  }
  return {
    id: createId("safeattempt"),
    risk,
    currency,
    betAmount: wager,
    result,
    progressBefore,
    progressAfter,
    stageCount: profile.stageCount,
    multiplier,
    totalPaid,
    capped: rawPaid > totalPaid,
    transactions,
  };
}

export function applySafecrackerAttemptProgress(progressByRisk: SafecrackerProgressByRisk, attempt: Pick<SafecrackerAttempt, "risk" | "progressAfter">): SafecrackerProgressByRisk {
  return { ...progressByRisk, [attempt.risk]: attempt.progressAfter };
}

export function getSafecrackerTopMultiplier(risk: SafecrackerRisk, config = safecrackerConfig) {
  return Math.max(...config.riskProfiles[risk].multiplierWeights.map((item) => item.value));
}

export function getSafecrackerRewardRange(risk: SafecrackerRisk, config = safecrackerConfig) {
  const values = config.riskProfiles[risk].multiplierWeights.map((item) => item.value);
  return { min: Math.min(...values), max: Math.max(...values) };
}

export function getSafecrackerExpectedAttemptsToOpen(risk: SafecrackerRisk, config = safecrackerConfig) {
  const profile = config.riskProfiles[risk];
  let nextExpectedAttempts = 1 / getSafecrackerUnlockChance(risk, profile.stageCount, config);
  for (let progress = profile.stageCount - 1; progress >= 0; progress -= 1) {
    const chances = getSafecrackerAttemptChances(risk, progress, config);
    nextExpectedAttempts = (1 + chances.progressChance * nextExpectedAttempts) / (chances.unlockChance + chances.progressChance);
  }
  return nextExpectedAttempts;
}

export function getSafecrackerEstimatedRtp(risk: SafecrackerRisk, config = safecrackerConfig) {
  return weightedAverage(config.riskProfiles[risk].multiplierWeights) / getSafecrackerExpectedAttemptsToOpen(risk, config);
}

export function simulateSafecracker(
  risk: SafecrackerRisk = "medium",
  safesToOpen = 100000,
  betAmount = 1,
  config = safecrackerConfig,
): SafecrackerSimulationResult {
  const random = seededRandom(0x5afe + safecrackerRiskOrder.indexOf(risk) * 1009);
  const profile = config.riskProfiles[risk];
  let totalAttempts = 0;
  let totalPaid = 0;
  let failCount = 0;
  let progressCount = 0;
  let unlockCount = 0;
  let biggestWin = 0;
  let caps = 0;

  for (let safeIndex = 0; safeIndex < safesToOpen; safeIndex += 1) {
    let progress = 0;
    let opened = false;
    let guard = 0;
    while (!opened && guard < 10000) {
      guard += 1;
      totalAttempts += 1;
      const result = pickSafecrackerAttemptResult({ risk, progress, random, config });
      if (result === "unlock") {
        unlockCount += 1;
        const multiplier = pickSafecrackerMultiplier(risk, random, config);
        const rawPaid = betAmount * multiplier;
        const paid = round2(Math.min(config.maxPayout, rawPaid));
        totalPaid += paid;
        biggestWin = Math.max(biggestWin, paid);
        if (rawPaid > paid) caps += 1;
        opened = true;
      } else if (result === "progress") {
        progressCount += 1;
        progress = Math.min(profile.stageCount, progress + 1);
      } else {
        failCount += 1;
      }
    }
  }

  const totalWagered = totalAttempts * betAmount;
  const observedRtp = totalPaid / totalWagered;
  return {
    risk,
    safesOpened: safesToOpen,
    totalAttempts,
    totalWagered,
    totalPaid,
    observedRtp,
    estimatedRtp: getSafecrackerEstimatedRtp(risk, config),
    houseEdge: 1 - observedRtp,
    averageAttemptsToOpen: totalAttempts / safesToOpen,
    failRate: failCount / totalAttempts,
    progressRate: progressCount / totalAttempts,
    instantUnlockRate: unlockCount / totalAttempts,
    averagePayout: totalPaid / safesToOpen,
    maxWinObserved: biggestWin,
    biggestWin,
    maxPayoutCapHits: caps,
    maxCapHitRate: caps / safesToOpen,
  };
}

export function getSafecrackerMathWarnings(simulation?: SafecrackerSimulationResult, config = safecrackerConfig) {
  const warnings: string[] = [];
  for (const risk of safecrackerRiskOrder) {
    const estimatedRtp = getSafecrackerEstimatedRtp(risk, config);
    const band = safecrackerRtpBands[risk];
    if (estimatedRtp < band.min || estimatedRtp > band.max) warnings.push(`${config.name} ${risk} estimated RTP is outside the ${(band.min * 100).toFixed(0)}-${(band.max * 100).toFixed(0)}% band.`);
    if (config.riskProfiles[risk].targetRtp < band.min || config.riskProfiles[risk].targetRtp > band.max) warnings.push(`${config.name} ${risk} target RTP is outside the ${(band.min * 100).toFixed(0)}-${(band.max * 100).toFixed(0)}% band.`);
  }
  if (simulation?.observedRtp) {
    const band = safecrackerRtpBands[simulation.risk];
    if (simulation.observedRtp > band.max + 0.02) warnings.push(`${config.name} ${simulation.risk} observed RTP is above the tuned variance band.`);
  }
  return warnings;
}

function pickWeighted<T>(weights: Array<SafecrackerWeight<T>>, random: () => number): T {
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * totalWeight;
  for (const item of weights) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return weights.at(-1)!.value;
}

function weightedAverage(weights: Array<SafecrackerWeight<number>>) {
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  return weights.reduce((sum, item) => sum + item.value * item.weight, 0) / totalWeight;
}

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function seededRandom(seed: number) {
  let state = seed >>> 0;
  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}
