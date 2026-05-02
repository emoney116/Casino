import { createId } from "../lib/ids";
import type { Currency, Transaction } from "../types";
import { creditCurrency, debitCurrency, getBalance } from "../wallet/walletService";

export type BrickBreakState = "idle" | "betting" | "playing" | "revealing" | "gameOver";

export interface BrickBreakBonusConfig {
  id: "brickBreakBonus";
  name: "Brick Break Bonus";
  theme: string;
  targetRtp: number;
  minBet: number;
  maxBet: number;
  maxWinMultiplier: number;
  maxPayout: number;
  brickValueMultipliers: number[];
  rareBonusBrickChance: number;
  bustChance: number;
  outcomeWeights: Array<{ multiplier: number; weight: number }>;
}

export interface BrickBreakHit {
  id: string;
  brickIndex: number;
  multiplier: number;
  amount: number;
  bonusBall: boolean;
  breakType: "partial" | "full";
}

export interface BrickBreakResult {
  id: string;
  currency: Currency;
  betAmount: number;
  state: BrickBreakState;
  hitList: BrickBreakHit[];
  totalPaid: number;
  totalMultiplier: number;
  net: number;
  bust: boolean;
  capped: boolean;
  transactions: Transaction[];
}

export interface BrickBreakSimulationResult {
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  averagePayout: number;
  biggestWin: number;
  bustRate: number;
  averageBricksHit: number;
  maxPayoutCapHits: number;
  maxCapHitRate: number;
}

export const brickBreakBonusConfig: BrickBreakBonusConfig = {
  id: "brickBreakBonus",
  name: "Brick Break Bonus",
  theme: "CPU autoplay brick breaker",
  targetRtp: 0.92,
  minBet: 10,
  maxBet: 500,
  maxWinMultiplier: 10,
  maxPayout: 5000,
  brickValueMultipliers: [0.1, 0.25, 0.5, 1, 2, 5, 10],
  rareBonusBrickChance: 0.08,
  bustChance: 0.24,
  outcomeWeights: [
    { multiplier: 0, weight: 24 },
    { multiplier: 0.1, weight: 7 },
    { multiplier: 0.25, weight: 12 },
    { multiplier: 0.5, weight: 17 },
    { multiplier: 1, weight: 20 },
    { multiplier: 2, weight: 15 },
    { multiplier: 5, weight: 4 },
    { multiplier: 10, weight: 1 },
  ],
};

function assertBrickBreakBet(userId: string, currency: Currency, amount: number, config = brickBreakBonusConfig) {
  if (!Number.isFinite(amount) || amount < config.minBet) throw new Error(`Minimum bet is ${config.minBet} coins.`);
  if (amount > config.maxBet) throw new Error(`Maximum bet is ${config.maxBet} coins.`);
  if (getBalance(userId, currency) < amount) throw new Error("Insufficient balance for Brick Break Bonus.");
}

export function pickBrickBreakOutcome(random = Math.random, config = brickBreakBonusConfig) {
  const totalWeight = config.outcomeWeights.reduce((sum, outcome) => sum + outcome.weight, 0);
  let cursor = random() * totalWeight;
  for (const outcome of config.outcomeWeights) {
    cursor -= outcome.weight;
    if (cursor <= 0) return outcome.multiplier;
  }
  return config.outcomeWeights.at(-1)?.multiplier ?? 0;
}

function createBrickIndexes(count: number, random: () => number) {
  const indexes: number[] = [];
  for (let row = 4; row >= 0 && indexes.length < count; row -= 1) {
    const rowIndexes = Array.from({ length: 6 }, (_, column) => row * 6 + column);
    while (rowIndexes.length > 0 && indexes.length < count) {
      indexes.push(rowIndexes.splice(Math.floor(random() * rowIndexes.length), 1)[0]);
    }
  }
  return indexes;
}

export function createBrickBreakHitList({
  betAmount,
  desiredMultiplier,
  random = Math.random,
  config = brickBreakBonusConfig,
}: {
  betAmount: number;
  desiredMultiplier: number;
  random?: () => number;
  config?: BrickBreakBonusConfig;
}): BrickBreakHit[] {
  const cappedMultiplier = Math.min(config.maxWinMultiplier, Math.max(0, desiredMultiplier));
  if (cappedMultiplier <= 0) return [];

  const values = [...config.brickValueMultipliers].sort((a, b) => b - a);
  const hitMultipliers: number[] = [];
  let remaining = Math.round(cappedMultiplier * 100);
  while (remaining > 0) {
    const chosen = values.find((value) => Math.round(value * 100) <= remaining) ?? 0.1;
    hitMultipliers.push(chosen);
    remaining = Math.max(0, remaining - Math.round(chosen * 100));
  }

  const indexes = createBrickIndexes(hitMultipliers.length, random);
  return hitMultipliers.map((multiplier, index) => ({
    id: createId("brick"),
    brickIndex: indexes[index],
    multiplier,
    amount: Math.round(betAmount * multiplier),
    bonusBall: multiplier >= 2 && random() < config.rareBonusBrickChance,
    breakType: multiplier >= 1 ? "full" : "partial",
  }));
}

export function generateBrickBreakResult({
  userId,
  currency,
  betAmount,
  random = Math.random,
  config = brickBreakBonusConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  random?: () => number;
  config?: BrickBreakBonusConfig;
}): BrickBreakResult {
  assertBrickBreakBet(userId, currency, betAmount, config);
  const betTx = debitCurrency({
    userId,
    currency,
    amount: betAmount,
    type: "ARCADE_BET",
    metadata: { arcadeGameId: config.id, arcadeGame: config.name, noSkill: true },
  });

  const desiredMultiplier = pickBrickBreakOutcome(random, config);
  const hitList = createBrickBreakHitList({ betAmount, desiredMultiplier, random, config });
  const rawPaid = hitList.reduce((sum, hit) => sum + hit.amount, 0);
  const cap = Math.min(config.maxPayout, Math.round(betAmount * config.maxWinMultiplier));
  const totalPaid = Math.min(rawPaid, cap);
  const transactions = [betTx];
  if (totalPaid > 0) {
    transactions.push(
      creditCurrency({
        userId,
        currency,
        amount: totalPaid,
        type: "ARCADE_WIN",
        metadata: {
          arcadeGameId: config.id,
          arcadeGame: config.name,
          wagered: betAmount,
          bricksHit: hitList.length,
          capped: rawPaid > totalPaid,
          noSkill: true,
        },
      }),
    );
  }

  return {
    id: createId("break"),
    currency,
    betAmount,
    state: "gameOver",
    hitList,
    totalPaid,
    totalMultiplier: totalPaid / betAmount,
    net: totalPaid - betAmount,
    bust: totalPaid === 0,
    capped: rawPaid > totalPaid,
    transactions,
  };
}

export function simulateBrickBreakBonus(rounds = 100000, betAmount = brickBreakBonusConfig.minBet, config = brickBreakBonusConfig): BrickBreakSimulationResult {
  let totalPaid = 0;
  let biggestWin = 0;
  let busts = 0;
  let bricksHit = 0;
  let caps = 0;
  for (let index = 0; index < rounds; index += 1) {
    const multiplier = pickBrickBreakOutcome(Math.random, config);
    const hits = createBrickBreakHitList({ betAmount, desiredMultiplier: multiplier, config });
    const rawPaid = hits.reduce((sum, hit) => sum + hit.amount, 0);
    const cap = Math.min(config.maxPayout, Math.round(betAmount * config.maxWinMultiplier));
    const paid = Math.min(rawPaid, cap);
    totalPaid += paid;
    biggestWin = Math.max(biggestWin, paid);
    if (paid === 0) busts += 1;
    if (rawPaid > paid) caps += 1;
    bricksHit += hits.length;
  }
  const totalWagered = rounds * betAmount;
  return {
    totalWagered,
    totalPaid,
    observedRtp: totalPaid / totalWagered,
    averagePayout: totalPaid / rounds,
    biggestWin,
    bustRate: busts / rounds,
    averageBricksHit: bricksHit / rounds,
    maxPayoutCapHits: caps,
    maxCapHitRate: caps / rounds,
  };
}

export function getBrickBreakMathWarnings(simulation?: BrickBreakSimulationResult, config = brickBreakBonusConfig) {
  const warnings: string[] = [];
  if (config.targetRtp > 0.95) warnings.push(`${config.name} target RTP is above 95%.`);
  if (simulation?.observedRtp && simulation.observedRtp > 0.95) warnings.push(`${config.name} observed RTP is above 95%.`);
  return warnings;
}
