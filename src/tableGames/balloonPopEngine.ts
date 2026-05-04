import { createId } from "../lib/ids";
import type { Currency, Transaction } from "../types";
import { creditCurrency, debitCurrency, getBalance } from "../wallet/walletService";

export type BalloonPopState = "idle" | "ready" | "choosing" | "popping" | "reveal" | "complete";
export type BalloonPrizeKind = "blank" | "coin" | "multiplier" | "bonus";

export interface BalloonWeight {
  value: number;
  weight: number;
}

export interface BalloonPrize {
  kind: BalloonPrizeKind;
  multiplier: number;
  label: string;
}

export interface BalloonTile {
  id: string;
  index: number;
  color: string;
  prize: BalloonPrize;
  popped: boolean;
  revealed: boolean;
  paidAmount: number;
}

export interface BalloonPopConfig {
  id: "balloonPop";
  name: "Balloon Pop";
  theme: string;
  targetRtp: number;
  minBet: number;
  maxBet: number;
  maxWinMultiplier: number;
  balloonCount: number;
  shotsPerRound: 3;
  prizeWeights: BalloonWeight[];
  multiplierWeights: BalloonWeight[];
  bonusWeights: BalloonWeight[];
  blankChance: number;
}

export interface BalloonPopRound {
  id: string;
  state: BalloonPopState;
  currency: Currency;
  betAmount: number;
  balloons: BalloonTile[];
  pickedIndexes: number[];
  shotsRemaining: number;
  runningTotal: number;
  rawTotal: number;
  totalPaid: number;
  net: number;
  capped: boolean;
  transactions: Transaction[];
}

export interface BalloonPopSimulationResult {
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  averagePayout: number;
  biggestWin: number;
  blankRate: number;
  maxPayoutCapHits: number;
  maxCapHitRate: number;
}

export const balloonPopConfig: BalloonPopConfig = {
  id: "balloonPop",
  name: "Balloon Pop",
  theme: "Carnival dart balloon wall",
  targetRtp: 0.935,
  minBet: 10,
  maxBet: 500,
  maxWinMultiplier: 25,
  balloonCount: 16,
  shotsPerRound: 3,
  prizeWeights: [
    { value: 0.1, weight: 50 },
    { value: 0.25, weight: 31 },
    { value: 0.5, weight: 18 },
    { value: 1, weight: 4.5 },
    { value: 2, weight: 0.8 },
    { value: 5, weight: 0.09 },
  ],
  multiplierWeights: [
    { value: 1.5, weight: 0.9 },
    { value: 2, weight: 0.24 },
    { value: 3, weight: 0.04 },
  ],
  bonusWeights: [
    { value: 0.75, weight: 1.1 },
    { value: 1.25, weight: 0.52 },
    { value: 2.5, weight: 0.08 },
  ],
  blankChance: 0,
};

const balloonColors = ["red", "yellow", "blue", "green", "pink", "orange", "teal", "purple"];

function pickWeighted(weights: BalloonWeight[], random: () => number) {
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * totalWeight;
  for (const item of weights) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return weights.at(-1)?.value ?? 0;
}

export function assertBalloonPopBet(userId: string, currency: Currency, amount: number, config = balloonPopConfig) {
  if (!Number.isFinite(amount) || amount < config.minBet) throw new Error(`Minimum bet is ${config.minBet} coins.`);
  if (amount > config.maxBet) throw new Error(`Maximum bet is ${config.maxBet} coins.`);
  if (getBalance(userId, currency) < amount) throw new Error("Insufficient balance for Balloon Pop.");
}

export function pickBalloonPrize(random = Math.random, config = balloonPopConfig): BalloonPrize {
  if (random() < config.blankChance) return { kind: "blank", multiplier: 0, label: "BLANK" };

  const pools = [
    { kind: "coin" as const, weight: config.prizeWeights.reduce((sum, item) => sum + item.weight, 0) },
    { kind: "multiplier" as const, weight: config.multiplierWeights.reduce((sum, item) => sum + item.weight, 0) },
    { kind: "bonus" as const, weight: config.bonusWeights.reduce((sum, item) => sum + item.weight, 0) },
  ];
  const kind = pickWeighted(pools.map((pool) => ({ value: pools.indexOf(pool), weight: pool.weight })), random);
  if (pools[kind]?.kind === "multiplier") {
    const value = pickWeighted(config.multiplierWeights, random);
    return { kind: "multiplier", multiplier: value, label: `${value}x` };
  }
  if (pools[kind]?.kind === "bonus") {
    const value = pickWeighted(config.bonusWeights, random);
    return { kind: "bonus", multiplier: value, label: `BONUS ${value}x` };
  }
  const value = pickWeighted(config.prizeWeights, random);
  return { kind: "coin", multiplier: value, label: `${value}x` };
}

export function createBalloonPrizeMap(random = Math.random, config = balloonPopConfig): BalloonTile[] {
  return Array.from({ length: config.balloonCount }, (_, index) => ({
    id: createId("balloon"),
    index,
    color: balloonColors[index % balloonColors.length],
    prize: pickBalloonPrize(random, config),
    popped: false,
    revealed: false,
    paidAmount: 0,
  }));
}

function capForBet(betAmount: number, config: BalloonPopConfig) {
  return Math.round(betAmount * config.maxWinMultiplier);
}

function getPrizePaidAmount(prize: BalloonPrize, betAmount: number, currentTotal: number) {
  if (prize.kind === "blank") return 0;
  void currentTotal;
  return Math.max(0, Math.round(betAmount * prize.multiplier));
}

export function startBalloonPopRound({
  userId,
  currency,
  betAmount,
  random = Math.random,
  config = balloonPopConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  random?: () => number;
  config?: BalloonPopConfig;
}): BalloonPopRound {
  assertBalloonPopBet(userId, currency, betAmount, config);
  const betTx = debitCurrency({
    userId,
    currency,
    amount: betAmount,
    type: "ARCADE_BET",
    metadata: { arcadeGameId: config.id, arcadeGame: config.name, noSkill: true },
  });

  return {
    id: createId("popround"),
    state: "choosing",
    currency,
    betAmount,
    balloons: createBalloonPrizeMap(random, config),
    pickedIndexes: [],
    shotsRemaining: config.shotsPerRound,
    runningTotal: 0,
    rawTotal: 0,
    totalPaid: 0,
    net: -betAmount,
    capped: false,
    transactions: [betTx],
  };
}

export function popBalloon(round: BalloonPopRound, balloonIndex: number, config = balloonPopConfig): BalloonPopRound {
  if (round.state !== "choosing") throw new Error("This round is not accepting darts.");
  if (round.shotsRemaining <= 0) throw new Error("No darts remaining.");
  if (round.pickedIndexes.includes(balloonIndex)) throw new Error("That balloon is already popped.");

  const cap = capForBet(round.betAmount, config);
  let rawTotal = round.rawTotal;
  let runningTotal = round.runningTotal;
  const balloons = round.balloons.map((balloon) => {
    if (balloon.index !== balloonIndex) return balloon;
    const paidAmount = getPrizePaidAmount(balloon.prize, round.betAmount, runningTotal);
    rawTotal += paidAmount;
    runningTotal = Math.min(cap, runningTotal + paidAmount);
    return { ...balloon, popped: true, revealed: true, paidAmount };
  });
  const shotsRemaining = round.shotsRemaining - 1;

  return {
    ...round,
    state: shotsRemaining === 0 ? "reveal" : "choosing",
    balloons,
    pickedIndexes: [...round.pickedIndexes, balloonIndex],
    shotsRemaining,
    runningTotal,
    rawTotal,
    totalPaid: runningTotal,
    net: runningTotal - round.betAmount,
    capped: round.capped || rawTotal > cap,
  };
}

export function revealLeftoverBalloons(round: BalloonPopRound): BalloonPopRound {
  if (round.shotsRemaining > 0) throw new Error("Finish all darts before revealing leftovers.");
  return {
    ...round,
    state: "reveal",
    balloons: round.balloons.map((balloon) => ({ ...balloon, revealed: true })),
  };
}

export function completeBalloonPopRound({
  round,
  userId,
  config = balloonPopConfig,
}: {
  round: BalloonPopRound;
  userId: string;
  config?: BalloonPopConfig;
}): BalloonPopRound {
  if (round.shotsRemaining > 0) throw new Error("Balloon Pop round is not complete.");
  if (round.state === "complete") return round;

  const revealed = revealLeftoverBalloons(round);
  const transactions = [...revealed.transactions];
  if (revealed.totalPaid > 0) {
    transactions.push(
      creditCurrency({
        userId,
        currency: revealed.currency,
        amount: revealed.totalPaid,
        type: "ARCADE_WIN",
        metadata: {
          arcadeGameId: config.id,
          arcadeGame: config.name,
          wagered: revealed.betAmount,
          shots: config.shotsPerRound,
          capped: revealed.capped,
          multiplierAppliesTo: "bet",
          noSkill: true,
        },
      }),
    );
  }

  return { ...revealed, state: "complete", transactions };
}

function resolveSimulatedRound(betAmount: number, random: () => number, config: BalloonPopConfig) {
  let balloons = createBalloonPrizeMap(random, config);
  const available = balloons.map((balloon) => balloon.index);
  let runningTotal = 0;
  let rawTotal = 0;
  let blanks = 0;
  for (let shot = 0; shot < config.shotsPerRound; shot += 1) {
    const pickIndex = Math.floor(random() * available.length);
    const balloonIndex = available.splice(pickIndex, 1)[0] ?? 0;
    const balloon = balloons[balloonIndex];
    if (balloon.prize.kind === "blank") blanks += 1;
    const paidAmount = getPrizePaidAmount(balloon.prize, betAmount, runningTotal);
    rawTotal += paidAmount;
    runningTotal = Math.min(capForBet(betAmount, config), runningTotal + paidAmount);
    balloons = balloons.map((item) => item.index === balloonIndex ? { ...item, popped: true, revealed: true, paidAmount } : item);
  }
  return { totalPaid: runningTotal, blankPicks: blanks, capped: rawTotal > runningTotal };
}

export function simulateBalloonPop(rounds = 100000, betAmount = balloonPopConfig.minBet, config = balloonPopConfig): BalloonPopSimulationResult {
  let totalPaid = 0;
  let biggestWin = 0;
  let blankPicks = 0;
  let caps = 0;
  for (let index = 0; index < rounds; index += 1) {
    const result = resolveSimulatedRound(betAmount, Math.random, config);
    totalPaid += result.totalPaid;
    biggestWin = Math.max(biggestWin, result.totalPaid);
    blankPicks += result.blankPicks;
    if (result.capped) caps += 1;
  }
  const totalWagered = rounds * betAmount;
  return {
    totalWagered,
    totalPaid,
    observedRtp: totalPaid / totalWagered,
    averagePayout: totalPaid / rounds,
    biggestWin,
    blankRate: blankPicks / (rounds * config.shotsPerRound),
    maxPayoutCapHits: caps,
    maxCapHitRate: caps / rounds,
  };
}

export function getBalloonPopMathWarnings(simulation?: BalloonPopSimulationResult, config = balloonPopConfig) {
  const warnings: string[] = [];
  if (config.targetRtp > 0.95) warnings.push(`${config.name} target RTP is above 95%.`);
  if (simulation?.observedRtp && simulation.observedRtp > 0.95) warnings.push(`${config.name} observed RTP is above 95%.`);
  return warnings;
}
