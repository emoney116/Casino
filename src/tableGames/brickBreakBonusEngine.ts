import { createId } from "../lib/ids";
import type { Currency, Transaction } from "../types";
import { creditCurrency, debitCurrency, getBalance } from "../wallet/walletService";

export type BrickBreakState = "idle" | "betting" | "playing" | "revealing" | "gameOver";

export interface BrickBreakBonusConfig {
  id: "brickBreakBonus";
  name: "Brick Break";
  theme: string;
  targetRtp: number;
  minBet: number;
  maxBet: number;
  minBetGold: number;
  maxBetGold: number;
  minBetSweepstakes: number;
  maxBetSweepstakes: number;
  maxWinMultiplier: number;
  maxPayout: number;
  brickValueMultipliers: number[];
  rareBonusBrickChance: number;
  explosiveBrickChance: number;
  explosiveBundleMultiplier: number;
  bustChance: number;
  normalSpeed: number;
  fastSpeed: number;
  impactPauseMs: number;
  brickCrackPauseMs: number;
  showcaseBrickCount: number;
  highMultiplierShowcaseChance: number;
  showcaseMultipliers: number[];
  outcomeWeights: Array<{ multiplier: number; weight: number }>;
}

export interface BrickBreakHit {
  id: string;
  brickIndex: number;
  multiplier: number;
  amount: number;
  bonusBall: boolean;
  effect: "normal" | "explosive" | "blast" | "jackpot";
  blastSourceId?: string;
  blastSourceBrickIndex?: number;
  breakType: "partial" | "full";
  hitsRequired: number;
}

export interface BrickBreakStep {
  id: string;
  brickId: string;
  brickIndex: number;
  hitNumber: number;
  hitsRequired: number;
  hpBefore: number;
  hpAfter: number;
  crackLevel: 1 | 2 | 3 | 4;
  revealsPrize: boolean;
  prizeAmount: number;
  prizeMultiplier: number;
  blastHitIds: string[];
  blastBrickIndexes: number[];
  blastPrizeAmount: number;
  blastPrizeMultiplier: number;
  breakType: BrickBreakHit["breakType"];
  bonusBall: boolean;
}

export interface BrickBreakShowcase {
  id: string;
  brickIndex: number;
  multiplier: number;
  amount: number;
  kind: "missed" | "nearMiss" | "jackpotTease";
  crackLevel: 0 | 1 | 2 | 3;
}

export interface BrickBreakBoardBrick {
  id: string;
  brickIndex: number;
  multiplier: number;
  amount: number;
  effect: BrickBreakHit["effect"];
  kind: "paid" | "showcase";
  crackLevel: 0 | 1 | 2 | 3;
}

export interface BrickBreakResult {
  id: string;
  currency: Currency;
  betAmount: number;
  state: BrickBreakState;
  hitList: BrickBreakHit[];
  replaySteps: BrickBreakStep[];
  showcaseBricks: BrickBreakShowcase[];
  boardBricks: BrickBreakBoardBrick[];
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
  name: "Brick Break",
  theme: "CPU autoplay brick breaker",
  targetRtp: 0.91,
  minBet: 1,
  maxBet: 1000000,
  minBetGold: 1,
  maxBetGold: 1000000,
  minBetSweepstakes: 0.01,
  maxBetSweepstakes: 100,
  maxWinMultiplier: 50,
  maxPayout: 50_000_000,
  brickValueMultipliers: [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50],
  rareBonusBrickChance: 0.08,
  explosiveBrickChance: 0.18,
  explosiveBundleMultiplier: 5,
  bustChance: 0.24,
  normalSpeed: 1040,
  fastSpeed: 560,
  impactPauseMs: 80,
  brickCrackPauseMs: 220,
  showcaseBrickCount: 30,
  highMultiplierShowcaseChance: 0.42,
  showcaseMultipliers: [0.1, 0.25, 0.5, 1, 2, 5, 10, 25, 50],
  outcomeWeights: [
    { multiplier: 0, weight: 28.5 },
    { multiplier: 0.1, weight: 7 },
    { multiplier: 0.25, weight: 12 },
    { multiplier: 0.5, weight: 17 },
    { multiplier: 1, weight: 20 },
    { multiplier: 2, weight: 10.25 },
    { multiplier: 5, weight: 4 },
    { multiplier: 10, weight: 1 },
    { multiplier: 25, weight: 0.2 },
    { multiplier: 50, weight: 0.05 },
  ],
};

function assertBrickBreakBet(userId: string, currency: Currency, amount: number, config = brickBreakBonusConfig) {
  const limits = getBrickBreakBetLimits(currency, config);
  const label = currency === "BONUS" ? "SC" : "GC";
  if (!Number.isFinite(amount) || amount < limits.minBet) throw new Error(`Minimum ${label} bet is ${limits.minBet}.`);
  if (amount > limits.maxBet) throw new Error(`Maximum ${label} bet is ${limits.maxBet}.`);
  if (getBalance(userId, currency) < amount) throw new Error("Insufficient balance for Brick Break.");
}

export function getBrickBreakBetLimits(currency: Currency, config = brickBreakBonusConfig) {
  if (currency === "BONUS") {
    return { minBet: config.minBetSweepstakes, maxBet: config.maxBetSweepstakes };
  }
  return { minBet: config.minBetGold, maxBet: config.maxBetGold };
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

function getExposedBrickIndexes(brokenIndexes: Set<number>) {
  return Array.from({ length: 30 }, (_, index) => index).filter((index) => {
    if (brokenIndexes.has(index)) return false;
    const row = Math.floor(index / 6);
    const column = index % 6;
    if (row === 4) return true;
    for (let belowRow = row + 1; belowRow <= 4; belowRow += 1) {
      if (!brokenIndexes.has(belowRow * 6 + column)) return false;
    }
    return true;
  });
}

export function isBrickExposed(brickIndex: number, brokenIndexes: number[]) {
  return getExposedBrickIndexes(new Set(brokenIndexes)).includes(brickIndex);
}

function pickExposedBrickIndex(brokenIndexes: Set<number>, random: () => number) {
  const exposed = getExposedBrickIndexes(brokenIndexes);
  return exposed[Math.floor(random() * exposed.length)] ?? exposed[0] ?? 0;
}

function getAdjacentBrickIndexes(brickIndex: number) {
  const row = Math.floor(brickIndex / 6);
  const column = brickIndex % 6;
  const adjacent: number[] = [];
  for (let rowOffset = -1; rowOffset <= 1; rowOffset += 1) {
    for (let columnOffset = -1; columnOffset <= 1; columnOffset += 1) {
      if (rowOffset === 0 && columnOffset === 0) continue;
      const nextRow = row + rowOffset;
      const nextColumn = column + columnOffset;
      if (nextRow < 0 || nextRow > 4 || nextColumn < 0 || nextColumn > 5) continue;
      adjacent.push(nextRow * 6 + nextColumn);
    }
  }
  return adjacent;
}

function splitExplosiveMultiplier(multiplier: number, blastCount: number) {
  if (blastCount <= 0) return [multiplier];
  const totalCents = Math.max(1, Math.round(multiplier * 100));
  const sourceCents = Math.max(1, Math.round(totalCents * 0.46));
  let remaining = Math.max(0, totalCents - sourceCents);
  const parts = [sourceCents];
  for (let index = 0; index < blastCount; index += 1) {
    const slotsLeft = blastCount - index;
    const next = slotsLeft > 0 ? Math.floor(remaining / slotsLeft) : 0;
    parts.push(next);
    remaining -= next;
  }
  parts[parts.length - 1] += remaining;
  return parts.map((part) => part / 100);
}

function getBrickHitsRequired(multiplier: number, random: () => number) {
  if (multiplier >= 25) return 4;
  if (multiplier >= 5) return random() < 0.55 ? 3 : 4;
  if (multiplier >= 1) return random() < 0.42 ? 2 : random() < 0.82 ? 3 : 4;
  return random() < 0.7 ? 1 : 2;
}

function canBuildBrickMultiplier(totalCents: number, denominations: number[], maxParts: number, memo = new Map<string, boolean>()): boolean {
  if (totalCents === 0) return true;
  if (totalCents < 0 || maxParts <= 0) return false;
  const key = `${totalCents}:${maxParts}`;
  const cached = memo.get(key);
  if (cached !== undefined) return cached;
  const canBuild = denominations.some((value) => value <= totalCents && canBuildBrickMultiplier(totalCents - value, denominations, maxParts - 1, memo));
  memo.set(key, canBuild);
  return canBuild;
}

function createPrizeMultipliers(totalMultiplier: number, random: () => number, config: BrickBreakBonusConfig) {
  const denominations = [...config.brickValueMultipliers]
    .map((value) => Math.round(value * 100))
    .filter((value, index, values) => value > 0 && values.indexOf(value) === index)
    .sort((a, b) => a - b);
  const maxParts = 24;
  const multipliers: number[] = [];
  let remaining = Math.round(totalMultiplier * 100);
  const feasibilityMemo = new Map<string, boolean>();

  while (remaining > 0 && multipliers.length < maxParts) {
    const slotsLeft = maxParts - multipliers.length - 1;
    const candidates = denominations.filter((value) => value <= remaining && canBuildBrickMultiplier(remaining - value, denominations, slotsLeft, feasibilityMemo));
    const pool = candidates.length > 0 ? candidates : denominations.filter((value) => value <= remaining);
    const smallPool = pool.slice(0, Math.min(pool.length, remaining >= 100 ? 4 : 2));
    const chosenPool = smallPool.length > 0 ? smallPool : pool;
    const chosen = chosenPool[Math.floor(random() * chosenPool.length)] ?? pool.at(-1) ?? remaining;
    multipliers.push(chosen / 100);
    remaining = Math.max(0, remaining - chosen);
  }

  if (remaining > 0) multipliers.push(remaining / 100);
  return multipliers;
}

function allocateBrickPrizeAmounts(betAmount: number, multipliers: number[]) {
  const scale = 100;
  const exactAmounts = multipliers.map((multiplier) => betAmount * multiplier * scale);
  const floors = exactAmounts.map(Math.floor);
  const targetTotal = Math.round(exactAmounts.reduce((sum, amount) => sum + amount, 0));
  let remainder = targetTotal - floors.reduce((sum, amount) => sum + amount, 0);
  const order = exactAmounts
    .map((amount, index) => ({ index, fraction: amount - Math.floor(amount) }))
    .sort((a, b) => b.fraction - a.fraction);
  for (let index = 0; index < order.length && remainder > 0; index += 1) {
    floors[order[index].index] += 1;
    remainder -= 1;
  }
  return floors.map((amount) => amount / scale);
}

function roundPayoutAmount(amount: number, betAmount: number) {
  void betAmount;
  return Number(amount.toFixed(2));
}

function capForBet(betAmount: number, config: BrickBreakBonusConfig) {
  return Math.min(config.maxPayout, roundPayoutAmount(betAmount * config.maxWinMultiplier, betAmount));
}

function pickShowcaseMultiplier(index: number, actualMultiplier: number, random: () => number, config: BrickBreakBonusConfig) {
  const anchorMultipliers = [0.25, 0.5, 1, 2, 5, 25, 50];
  if (index === 0 && actualMultiplier < 2) return random() < 0.62 ? 25 : 50;
  if (index < anchorMultipliers.length) return anchorMultipliers[index] ?? 1;

  const weights = [
    { value: 0.1, weight: 16 },
    { value: 0.25, weight: 19 },
    { value: 0.5, weight: 18 },
    { value: 1, weight: 16 },
    { value: 2, weight: 13 },
    { value: 5, weight: 7 },
    { value: 10, weight: 4 },
    { value: 25, weight: 1.4 },
    { value: 50, weight: 0.45 },
  ].filter((item) => config.showcaseMultipliers.includes(item.value));
  const totalWeight = weights.reduce((sum, item) => sum + item.weight, 0);
  let cursor = random() * totalWeight;
  for (const item of weights) {
    cursor -= item.weight;
    if (cursor <= 0) return item.value;
  }
  return weights.at(-1)?.value ?? config.showcaseMultipliers[0] ?? 1;
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

  const shouldCreateExplosion = cappedMultiplier >= config.explosiveBundleMultiplier && random() < config.explosiveBrickChance;
  const explosiveMultiplier = shouldCreateExplosion ? Math.min(config.explosiveBundleMultiplier, cappedMultiplier) : 0;
  const hitMultipliers = [
    ...(explosiveMultiplier > 0 ? [explosiveMultiplier] : []),
    ...createPrizeMultipliers(cappedMultiplier - explosiveMultiplier, random, config),
  ];

  const brokenIndexes = new Set<number>();
  const drafts: Array<Omit<BrickBreakHit, "amount">> = [];
  hitMultipliers.forEach((multiplier, index) => {
    const brickIndex = pickExposedBrickIndex(brokenIndexes, random);
    brokenIndexes.add(brickIndex);
    const sourceId = createId("brick");
    const isExplosive = index === 0 && explosiveMultiplier > 0;
    const blastIndexes = isExplosive
      ? getAdjacentBrickIndexes(brickIndex).filter((candidate) => !brokenIndexes.has(candidate))
      : [];
    const splitMultipliers = isExplosive ? splitExplosiveMultiplier(multiplier, blastIndexes.length) : [multiplier];
    drafts.push({
      id: sourceId,
      brickIndex,
      multiplier: splitMultipliers[0] ?? multiplier,
      bonusBall: !isExplosive && multiplier >= 2 && random() < config.rareBonusBrickChance,
      effect: isExplosive ? "explosive" : multiplier >= config.maxWinMultiplier ? "jackpot" : "normal",
      breakType: multiplier >= 1 ? "full" : "partial",
      hitsRequired: getBrickHitsRequired(multiplier, random),
    });
    blastIndexes.forEach((blastIndex, blastOffset) => {
      brokenIndexes.add(blastIndex);
      const blastMultiplier = splitMultipliers[blastOffset + 1] ?? 0;
      if (blastMultiplier <= 0) return;
      drafts.push({
        id: createId("brick"),
        brickIndex: blastIndex,
        multiplier: blastMultiplier,
        bonusBall: false,
        effect: "blast",
        blastSourceId: sourceId,
        blastSourceBrickIndex: brickIndex,
        breakType: blastMultiplier >= 1 ? "full" : "partial",
        hitsRequired: 1,
      });
    });
  });

  const amounts = allocateBrickPrizeAmounts(betAmount, drafts.map((hit) => hit.multiplier));
  return drafts.map((hit, index) => ({
    ...hit,
    amount: amounts[index] ?? roundPayoutAmount(betAmount * hit.multiplier, betAmount),
  }));
}

export function createBrickBreakReplaySteps(hitList: BrickBreakHit[]): BrickBreakStep[] {
  const blastHitsBySource = hitList.reduce((map, hit) => {
    if (hit.effect !== "blast" || !hit.blastSourceId) return map;
    const current = map.get(hit.blastSourceId) ?? [];
    current.push(hit);
    map.set(hit.blastSourceId, current);
    return map;
  }, new Map<string, BrickBreakHit[]>());

  return hitList.filter((hit) => hit.effect !== "blast").flatMap((hit) => Array.from({ length: hit.hitsRequired }, (_, index) => {
    const hitNumber = index + 1;
    const hpBefore = hit.hitsRequired - index;
    const hpAfter = Math.max(0, hpBefore - 1);
    const blastHits = hpAfter === 0 ? blastHitsBySource.get(hit.id) ?? [] : [];
    return {
      id: createId("brickstep"),
      brickId: hit.id,
      brickIndex: hit.brickIndex,
      hitNumber,
      hitsRequired: hit.hitsRequired,
      hpBefore,
      hpAfter,
      crackLevel: Math.min(4, hitNumber) as 1 | 2 | 3 | 4,
      revealsPrize: hpAfter === 0,
      prizeAmount: hpAfter === 0 ? hit.amount : 0,
      prizeMultiplier: hpAfter === 0 ? hit.multiplier : 0,
      blastHitIds: blastHits.map((blastHit) => blastHit.id),
      blastBrickIndexes: blastHits.map((blastHit) => blastHit.brickIndex),
      blastPrizeAmount: blastHits.reduce((sum, blastHit) => sum + blastHit.amount, 0),
      blastPrizeMultiplier: blastHits.reduce((sum, blastHit) => sum + blastHit.multiplier, 0),
      breakType: hit.breakType,
      bonusBall: hit.bonusBall,
    };
  }));
}

export function applyBrickBreakStep(currentTotal: number, step: BrickBreakStep) {
  return step.revealsPrize ? currentTotal + step.prizeAmount + step.blastPrizeAmount : currentTotal;
}

export function createBrickBreakShowcases({
  betAmount,
  hitList,
  totalPaid,
  random = Math.random,
  config = brickBreakBonusConfig,
}: {
  betAmount: number;
  hitList: BrickBreakHit[];
  totalPaid: number;
  random?: () => number;
  config?: BrickBreakBonusConfig;
}): BrickBreakShowcase[] {
  const usedIndexes = new Set(hitList.map((hit) => hit.brickIndex));
  const hiddenIndexes = Array.from({ length: 30 }, (_, index) => index).filter((index) => !usedIndexes.has(index));
  const actualMultiplier = betAmount > 0 ? totalPaid / betAmount : 0;
  const showcaseCount = Math.min(config.showcaseBrickCount, hiddenIndexes.length);

  return Array.from({ length: showcaseCount }, (_, index) => {
    const poolIndex = Math.floor(random() * hiddenIndexes.length);
    const brickIndex = hiddenIndexes.splice(poolIndex, 1)[0] ?? hiddenIndexes.shift() ?? 0;
    const forceHighTease = index === 0 && actualMultiplier < 2;
    const multiplier = pickShowcaseMultiplier(index, actualMultiplier, random, config);
    const kind: BrickBreakShowcase["kind"] =
      multiplier >= 25 || forceHighTease ? "jackpotTease" : random() < config.highMultiplierShowcaseChance ? "nearMiss" : "missed";
    return {
      id: createId("brickshow"),
      brickIndex,
      multiplier,
      amount: roundPayoutAmount(betAmount * multiplier, betAmount),
      kind,
      crackLevel: (kind === "jackpotTease" ? 3 : kind === "nearMiss" ? 2 : 0) as BrickBreakShowcase["crackLevel"],
    };
  }).sort((a, b) => b.multiplier - a.multiplier);
}

export function createBrickBreakBoardBricks(hitList: BrickBreakHit[], showcaseBricks: BrickBreakShowcase[]): BrickBreakBoardBrick[] {
  const paidBricks = hitList.map((hit): BrickBreakBoardBrick => ({
    id: hit.id,
    brickIndex: hit.brickIndex,
    multiplier: hit.multiplier,
    amount: hit.amount,
    effect: hit.effect,
    kind: "paid",
    crackLevel: 0,
  }));
  const paidIndexes = new Set(paidBricks.map((brick) => brick.brickIndex));
  const showcaseBoardBricks = showcaseBricks
    .filter((showcase) => !paidIndexes.has(showcase.brickIndex))
    .map((showcase): BrickBreakBoardBrick => ({
      id: showcase.id,
      brickIndex: showcase.brickIndex,
      multiplier: showcase.multiplier,
      amount: showcase.amount,
      effect: "normal",
      kind: "showcase",
      crackLevel: showcase.crackLevel,
    }));
  return [...paidBricks, ...showcaseBoardBricks].sort((a, b) => a.brickIndex - b.brickIndex);
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
  const replaySteps = createBrickBreakReplaySteps(hitList);
  const rawPaid = hitList.reduce((sum, hit) => sum + hit.amount, 0);
  const cap = capForBet(betAmount, config);
  const totalPaid = Math.min(rawPaid, cap);
  const showcaseBricks = createBrickBreakShowcases({ betAmount, hitList, totalPaid, random, config });
  const boardBricks = createBrickBreakBoardBricks(hitList, showcaseBricks);
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
    replaySteps,
    showcaseBricks,
    boardBricks,
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
    const cap = capForBet(betAmount, config);
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
