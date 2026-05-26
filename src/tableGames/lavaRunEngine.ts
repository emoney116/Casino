import { createId } from "../lib/ids";
import type { Currency, Transaction } from "../types";
import { creditCurrency, debitCurrency, getBalance, recordWalletEvent } from "../wallet/walletService";

export type LavaRunRisk = "low" | "medium" | "high";
export type LavaRunRoundStatus = "RUNNING" | "CASHED_OUT" | "BUST";
export type LavaRunRevealResult = "safe" | "lava";

export interface LavaRunRiskConfig {
  label: string;
  choicesPerRow: number;
  safeTilesPerRow: 1;
  safeProbability: number;
  rtpFactor: number;
  maxSteps: number;
  maxWinMultiplier: number;
  capRampExponent: number;
}

export interface LavaRunConfig {
  id: "lavaRun";
  slug: "lava-run";
  name: "Lava Run";
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
  riskProfiles: Record<LavaRunRisk, LavaRunRiskConfig>;
}

export interface LavaRunStep {
  stepIndex: number;
  choiceIndex: number;
  result: LavaRunRevealResult;
  multiplierBefore: number;
  multiplierAfter: number;
}

export interface LavaRunBoardRow {
  rowIndex: number;
  safeChoiceIndex: number;
  tiles: LavaRunRevealResult[];
}

export interface LavaRunRound {
  id: string;
  status: LavaRunRoundStatus;
  currency: Currency;
  betAmount: number;
  risk: LavaRunRisk;
  choicesPerRow: number;
  maxSteps: number;
  multipliers: number[];
  board: LavaRunBoardRow[];
  steps: LavaRunStep[];
  stepsCompleted: number;
  currentMultiplier: number;
  finalMultiplier?: number;
  totalPaid: number;
  capped: boolean;
  transactions: Transaction[];
}

export interface LavaRunSimulationResult {
  risk: LavaRunRisk;
  strategy: LavaRunSimulationStrategy;
  cashoutStep: number | null;
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  theoreticalRtp: number;
  hitRate: number;
  biggestWin: number;
  bustRate: number;
  averagePayout: number;
  averageMultiplier: number;
  maxMultiplierObserved: number;
  maxPayoutCapHits: number;
  maxCapHitRate: number;
  multiplierCapHits: number;
  multiplierCapHitRate: number;
  cashoutEvByStep: LavaRunCashoutEv[];
}

export type LavaRunSimulationStrategy = "auto-step" | "conservative" | "balanced" | "aggressive" | "random";

export interface LavaRunCashoutEv {
  step: number;
  safeChance: number;
  cumulativeSurvivalProbability: number;
  fairMultiplier: number;
  uncappedMultiplier: number;
  maxMultiplierCap: number;
  stepCapMultiplier: number;
  multiplier: number;
  capped: boolean;
  capReduction: number;
  theoreticalRtp: number;
}

export const lavaRunConfig: LavaRunConfig = {
  id: "lavaRun",
  slug: "lava-run",
  name: "Lava Run",
  theme: "Dark lava canyon platform run",
  targetRtp: 0.94,
  minBet: 1,
  maxBet: 1000000,
  minBetGold: 1,
  maxBetGold: 1000000,
  minBetSweepstakes: 0.01,
  maxBetSweepstakes: 200,
  minBetRealCentsPlaceholder: 1,
  maxBetRealCentsPlaceholder: 200,
  maxPayout: 100000000,
  riskProfiles: {
    low: {
      label: "Low",
      choicesPerRow: 2,
      safeTilesPerRow: 1,
      safeProbability: 1 / 2,
      rtpFactor: 0.94,
      maxSteps: 10,
      maxWinMultiplier: 100,
      capRampExponent: 0.8,
    },
    medium: {
      label: "Medium",
      choicesPerRow: 3,
      safeTilesPerRow: 1,
      safeProbability: 1 / 3,
      rtpFactor: 0.93,
      maxSteps: 10,
      maxWinMultiplier: 250,
      capRampExponent: 0.8,
    },
    high: {
      label: "High",
      choicesPerRow: 4,
      safeTilesPerRow: 1,
      safeProbability: 1 / 4,
      rtpFactor: 0.92,
      maxSteps: 10,
      maxWinMultiplier: 500,
      capRampExponent: 0.8,
    },
  },
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function floor2(value: number) {
  return Math.floor(value * 100) / 100;
}

function getProfile(risk: LavaRunRisk, config = lavaRunConfig) {
  return config.riskProfiles[risk];
}

export function createLavaRunBoard(risk: LavaRunRisk, random = Math.random, config = lavaRunConfig) {
  const profile = getProfile(risk, config);
  return Array.from({ length: profile.maxSteps }, (_, rowIndex): LavaRunBoardRow => {
    const safeChoiceIndex = Math.min(profile.choicesPerRow - 1, Math.floor(random() * profile.choicesPerRow));
    return {
      rowIndex,
      safeChoiceIndex,
      tiles: Array.from({ length: profile.choicesPerRow }, (_, choiceIndex) => (choiceIndex === safeChoiceIndex ? "safe" : "lava")),
    };
  });
}

function maxMultiplierForBet(risk: LavaRunRisk, betAmount: number, config = lavaRunConfig) {
  const profile = getProfile(risk, config);
  const payoutCapMultiplier = config.maxPayout / Math.max(betAmount, 0.01);
  return Math.max(1, floor2(Math.min(profile.maxWinMultiplier, payoutCapMultiplier)));
}

export function getLavaRunBetLimits(currency: Currency, config = lavaRunConfig) {
  if (currency === "BONUS") return { minBet: config.minBetSweepstakes, maxBet: config.maxBetSweepstakes };
  return { minBet: config.minBetGold, maxBet: config.maxBetGold };
}

export function assertLavaRunBet(userId: string, currency: Currency, amount: number, config = lavaRunConfig) {
  const limits = getLavaRunBetLimits(currency, config);
  const label = currency === "BONUS" ? "SC" : "GC";
  if (!Number.isFinite(amount) || amount < limits.minBet) throw new Error(`Minimum ${label} bet is ${limits.minBet}.`);
  if (amount > limits.maxBet) throw new Error(`Maximum ${label} bet is ${limits.maxBet}.`);
  if (getBalance(userId, currency) < amount) throw new Error("Insufficient balance for Lava Run.");
}

export function getLavaRunMultiplierCurve(risk: LavaRunRisk, betAmount = 1, config = lavaRunConfig) {
  const profile = getProfile(risk, config);
  return Array.from({ length: profile.maxSteps }, (_, stepIndex) => getLavaRunDisplayMultiplier(risk, stepIndex + 1, betAmount, config));
}

export function getLavaRunFairMultiplier(risk: LavaRunRisk, cashoutStep = 1, config = lavaRunConfig) {
  const profile = getProfile(risk, config);
  const step = Math.max(1, Math.min(profile.maxSteps, Math.round(cashoutStep)));
  const cumulativeSurvivalProbability = Math.pow(profile.safeProbability, step);
  return 1 / cumulativeSurvivalProbability;
}

export function getLavaRunDisplayMultiplier(risk: LavaRunRisk, cashoutStep = 1, betAmount = 1, config = lavaRunConfig) {
  const profile = getProfile(risk, config);
  const uncappedMultiplier = floor2(getLavaRunFairMultiplier(risk, cashoutStep, config) * profile.rtpFactor);
  return Math.max(1, Math.min(uncappedMultiplier, getLavaRunStepCapMultiplier(risk, cashoutStep, betAmount, config)));
}

export function getLavaRunStepCapMultiplier(risk: LavaRunRisk, cashoutStep = 1, betAmount = 1, config = lavaRunConfig) {
  const profile = getProfile(risk, config);
  const step = Math.max(1, Math.min(profile.maxSteps, Math.round(cashoutStep)));
  const maxMultiplierCap = maxMultiplierForBet(risk, betAmount, config);
  if (step >= profile.maxSteps) return maxMultiplierCap;
  const progress = step / profile.maxSteps;
  return Math.max(1, Math.min(maxMultiplierCap, floor2(1 + (maxMultiplierCap - 1) * Math.pow(progress, profile.capRampExponent))));
}

export function getLavaRunCashoutEvByStep(risk: LavaRunRisk, betAmount = 1, config = lavaRunConfig): LavaRunCashoutEv[] {
  const profile = getProfile(risk, config);
  const maxMultiplierCap = maxMultiplierForBet(risk, betAmount, config);
  return Array.from({ length: profile.maxSteps }, (_, stepIndex) => {
    const step = stepIndex + 1;
    const cumulativeSurvivalProbability = Math.pow(profile.safeProbability, step);
    const fairMultiplier = 1 / cumulativeSurvivalProbability;
    const uncappedMultiplier = floor2(fairMultiplier * profile.rtpFactor);
    const stepCapMultiplier = getLavaRunStepCapMultiplier(risk, step, betAmount, config);
    const multiplier = Math.max(1, Math.min(uncappedMultiplier, stepCapMultiplier));
    return {
      step,
      safeChance: profile.safeProbability,
      cumulativeSurvivalProbability,
      fairMultiplier,
      uncappedMultiplier,
      maxMultiplierCap,
      stepCapMultiplier,
      multiplier,
      capped: multiplier < uncappedMultiplier,
      capReduction: Math.max(0, floor2(uncappedMultiplier - multiplier)),
      theoreticalRtp: cumulativeSurvivalProbability * multiplier,
    };
  });
}

export function getLavaRunTheoreticalRtp(risk: LavaRunRisk, cashoutStep = 1, betAmount = 1, config = lavaRunConfig) {
  const profile = getProfile(risk, config);
  const step = Math.max(1, Math.min(profile.maxSteps, Math.round(cashoutStep)));
  return getLavaRunCashoutEvByStep(risk, betAmount, config)[step - 1]?.theoreticalRtp ?? 0;
}

function createRoundMetadata(round: LavaRunRound, result: "cashout" | "bust", finalMultiplier: number) {
  return {
    game: "lava-run",
    risk: round.risk,
    bet: round.betAmount,
    stepsCompleted: round.stepsCompleted,
    finalMultiplier,
    result,
    path: round.steps.map((step) => ({
      step: step.stepIndex + 1,
      choice: step.choiceIndex,
      result: step.result,
      multiplier: step.multiplierAfter,
    })),
    reveals: round.board.map((row) => ({
      step: row.rowIndex + 1,
      safeChoice: row.safeChoiceIndex,
      tiles: row.tiles.map((tile, choiceIndex) => ({
        choice: choiceIndex,
        tile,
        chosen: round.steps.some((step) => step.stepIndex === row.rowIndex && step.choiceIndex === choiceIndex),
      })),
    })),
    capped: round.capped,
  };
}

export function startLavaRunRound({
  userId,
  currency,
  betAmount,
  risk,
  random = Math.random,
  config = lavaRunConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  risk: LavaRunRisk;
  random?: () => number;
  config?: LavaRunConfig;
}): LavaRunRound {
  assertLavaRunBet(userId, currency, betAmount, config);
  const profile = getProfile(risk, config);
  const betTx = debitCurrency({
    userId,
    currency,
    amount: betAmount,
    type: "TABLE_BET",
    metadata: {
      tableGameId: config.id,
      tableGame: config.name,
      game: "lava-run",
      risk,
      bet: betAmount,
    },
  });

  return {
    id: createId("lavarun"),
    status: "RUNNING",
    currency,
    betAmount,
    risk,
    choicesPerRow: profile.choicesPerRow,
    maxSteps: profile.maxSteps,
    multipliers: getLavaRunMultiplierCurve(risk, betAmount, config),
    board: createLavaRunBoard(risk, random, config),
    steps: [],
    stepsCompleted: 0,
    currentMultiplier: 1,
    totalPaid: 0,
    capped: false,
    transactions: [betTx],
  };
}

export function pickLavaRunTile({
  round,
  userId,
  choiceIndex,
  config = lavaRunConfig,
}: {
  round: LavaRunRound;
  userId: string;
  choiceIndex: number;
  config?: LavaRunConfig;
}): LavaRunRound {
  if (round.status !== "RUNNING") return round;
  if (round.stepsCompleted >= round.maxSteps) throw new Error("Lava Run path is complete. Cash out to finish.");
  if (choiceIndex < 0 || choiceIndex >= round.choicesPerRow) throw new Error("Choose a platform in the current row.");

  const currentRow = round.board[round.stepsCompleted];
  if (!currentRow) throw new Error("Lava Run path is complete. Cash out to finish.");
  const safe = choiceIndex === currentRow.safeChoiceIndex;
  const multiplierBefore = round.currentMultiplier;
  const multiplierAfter = safe ? round.multipliers[round.stepsCompleted] ?? multiplierBefore : 0;
  const step: LavaRunStep = {
    stepIndex: round.stepsCompleted,
    choiceIndex,
    result: safe ? "safe" : "lava",
    multiplierBefore,
    multiplierAfter,
  };
  const steps = [...round.steps, step];

  if (!safe) {
    const busted: LavaRunRound = {
      ...round,
      status: "BUST",
      steps,
      stepsCompleted: round.stepsCompleted,
      currentMultiplier: 0,
      finalMultiplier: 0,
      totalPaid: 0,
    };
    const lossTx = recordWalletEvent({
      userId,
      currency: round.currency,
      amount: 0,
      type: "TABLE_LOSS",
      metadata: {
        tableGameId: config.id,
        tableGame: config.name,
        wagered: round.betAmount,
        ...createRoundMetadata(busted, "bust", 0),
      },
    });
    return { ...busted, transactions: [...round.transactions, lossTx] };
  }

  const capped = multiplierAfter >= maxMultiplierForBet(round.risk, round.betAmount, config);
  return {
    ...round,
    steps,
    stepsCompleted: round.stepsCompleted + 1,
    currentMultiplier: multiplierAfter,
    capped: round.capped || capped,
  };
}

export function cashOutLavaRunRound({
  round,
  userId,
  config = lavaRunConfig,
}: {
  round: LavaRunRound;
  userId: string;
  config?: LavaRunConfig;
}): LavaRunRound {
  if (round.status !== "RUNNING") return round;
  if (round.stepsCompleted <= 0) throw new Error("Cross at least one platform before cashing out.");

  const rawPaid = round2(round.betAmount * round.currentMultiplier);
  const totalPaid = Math.min(rawPaid, config.maxPayout);
  const finalMultiplier = round2(totalPaid / round.betAmount);
  const capped = round.capped || totalPaid < rawPaid;
  const completed: LavaRunRound = {
    ...round,
    status: "CASHED_OUT",
    finalMultiplier,
    totalPaid,
    capped,
  };
  const winTx = creditCurrency({
    userId,
    currency: round.currency,
    amount: totalPaid,
    type: "TABLE_WIN",
    metadata: {
      tableGameId: config.id,
      tableGame: config.name,
      wagered: round.betAmount,
      ...createRoundMetadata(completed, "cashout", finalMultiplier),
    },
  });

  return { ...completed, transactions: [...round.transactions, winTx] };
}

function createSimulationRandom(seedStart: number) {
  let seed = seedStart >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function getLavaRunStrategyStep(strategy: Exclude<LavaRunSimulationStrategy, "auto-step" | "random">, maxSteps: number) {
  if (strategy === "conservative") return 1;
  if (strategy === "balanced") return Math.min(maxSteps, 3);
  return maxSteps;
}

function summarizeLavaRunSimulation({
  risk,
  strategy,
  cashoutStep,
  rounds,
  betAmount,
  totalPaid,
  biggestWin,
  busts,
  maxPayoutCapHits,
  multiplierCapHits,
  theoreticalRtp,
  config,
}: {
  risk: LavaRunRisk;
  strategy: LavaRunSimulationStrategy;
  cashoutStep: number | null;
  rounds: number;
  betAmount: number;
  totalPaid: number;
  biggestWin: number;
  busts: number;
  maxPayoutCapHits: number;
  multiplierCapHits: number;
  theoreticalRtp: number;
  config: LavaRunConfig;
}): LavaRunSimulationResult {
  const totalWagered = rounds * betAmount;
  const hitRate = rounds > 0 ? (rounds - busts) / rounds : 0;
  return {
    risk,
    strategy,
    cashoutStep,
    totalWagered,
    totalPaid,
    observedRtp: totalWagered > 0 ? totalPaid / totalWagered : 0,
    theoreticalRtp,
    hitRate,
    biggestWin,
    bustRate: rounds > 0 ? busts / rounds : 0,
    averagePayout: rounds > 0 ? totalPaid / rounds : 0,
    averageMultiplier: totalWagered > 0 ? totalPaid / totalWagered : 0,
    maxMultiplierObserved: betAmount > 0 ? biggestWin / betAmount : 0,
    maxPayoutCapHits,
    maxCapHitRate: rounds > 0 ? maxPayoutCapHits / rounds : 0,
    multiplierCapHits,
    multiplierCapHitRate: rounds > 0 ? multiplierCapHits / rounds : 0,
    cashoutEvByStep: getLavaRunCashoutEvByStep(risk, betAmount, config),
  };
}

export function simulateLavaRun(
  risk: LavaRunRisk,
  rounds = 100000,
  betAmount = lavaRunConfig.minBet,
  cashoutStep = 1,
  config = lavaRunConfig,
): LavaRunSimulationResult {
  const profile = getProfile(risk, config);
  const targetStep = Math.max(1, Math.min(profile.maxSteps, Math.round(cashoutStep)));
  const stepMath = getLavaRunCashoutEvByStep(risk, betAmount, config)[targetStep - 1];
  const random = createSimulationRandom(0x1f1a7a + targetStep + profile.choicesPerRow);
  const survivalProbability = Math.pow(profile.safeProbability, targetStep);
  let totalPaid = 0;
  let biggestWin = 0;
  let busts = 0;
  let maxPayoutCapHits = 0;
  let multiplierCapHits = 0;

  for (let round = 0; round < rounds; round += 1) {
    const survivalSample = (round + random()) / rounds;
    if (survivalSample >= survivalProbability) {
      busts += 1;
      continue;
    }
    const rawPaid = round2(betAmount * (stepMath?.multiplier ?? 1));
    const paid = Math.min(rawPaid, config.maxPayout);
    if (paid < rawPaid) maxPayoutCapHits += 1;
    if (stepMath?.capped) multiplierCapHits += 1;
    totalPaid += paid;
    biggestWin = Math.max(biggestWin, paid);
  }

  return summarizeLavaRunSimulation({
    risk,
    strategy: "auto-step",
    cashoutStep: targetStep,
    rounds,
    betAmount,
    totalPaid,
    biggestWin,
    busts,
    maxPayoutCapHits,
    multiplierCapHits,
    theoreticalRtp: stepMath?.theoreticalRtp ?? 0,
    config,
  });
}

export function simulateLavaRunStrategy(
  risk: LavaRunRisk,
  strategy: Exclude<LavaRunSimulationStrategy, "auto-step">,
  rounds = 100000,
  betAmount = lavaRunConfig.minBet,
  config = lavaRunConfig,
): LavaRunSimulationResult {
  const profile = getProfile(risk, config);
  if (strategy !== "random") {
    return {
      ...simulateLavaRun(risk, rounds, betAmount, getLavaRunStrategyStep(strategy, profile.maxSteps), config),
      strategy,
    };
  }

  const stepMath = getLavaRunCashoutEvByStep(risk, betAmount, config);
  const random = createSimulationRandom(0x51d15c + profile.choicesPerRow);
  const roundsPerStep = Math.ceil(rounds / profile.maxSteps);
  let totalPaid = 0;
  let biggestWin = 0;
  let busts = 0;
  let maxPayoutCapHits = 0;
  let multiplierCapHits = 0;

  for (let round = 0; round < rounds; round += 1) {
    const targetStep = (round % profile.maxSteps) + 1;
    const targetRound = Math.floor(round / profile.maxSteps);
    const survivalProbability = Math.pow(profile.safeProbability, targetStep);
    const survivalSample = (targetRound + random()) / roundsPerStep;
    if (survivalSample >= survivalProbability) {
      busts += 1;
      continue;
    }
    const targetMath = stepMath[targetStep - 1];
    const rawPaid = round2(betAmount * (targetMath?.multiplier ?? 1));
    const paid = Math.min(rawPaid, config.maxPayout);
    if (paid < rawPaid) maxPayoutCapHits += 1;
    if (targetMath?.capped) multiplierCapHits += 1;
    totalPaid += paid;
    biggestWin = Math.max(biggestWin, paid);
  }

  return summarizeLavaRunSimulation({
    risk,
    strategy,
    cashoutStep: null,
    rounds,
    betAmount,
    totalPaid,
    biggestWin,
    busts,
    maxPayoutCapHits,
    multiplierCapHits,
    theoreticalRtp: stepMath.reduce((sum, item) => sum + item.theoreticalRtp, 0) / stepMath.length,
    config,
  });
}

export function getLavaRunMathWarnings(simulation?: LavaRunSimulationResult, config = lavaRunConfig) {
  const warnings: string[] = [];
  if (config.targetRtp > 0.95) warnings.push(`${config.name} target RTP is above 95%.`);
  for (const risk of Object.keys(config.riskProfiles) as LavaRunRisk[]) {
    const profile = getProfile(risk, config);
    for (let step = 1; step <= profile.maxSteps; step += 1) {
      const theoreticalRtp = getLavaRunTheoreticalRtp(risk, step, config.minBet, config);
      if (theoreticalRtp > 0.95) warnings.push(`${config.name} ${risk} step ${step} RTP is above 95%.`);
      if (theoreticalRtp > profile.rtpFactor + 0.0001) warnings.push(`${config.name} ${risk} step ${step} RTP exceeds target RTP.`);
    }
  }
  if (simulation?.observedRtp && simulation.observedRtp > 0.95) warnings.push(`${config.name} observed RTP is above 95%.`);
  return warnings;
}
