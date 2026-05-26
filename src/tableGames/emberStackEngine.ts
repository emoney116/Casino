import { createId } from "../lib/ids";
import type { Currency, Transaction } from "../types";
import { creditCurrency, debitCurrency, getBalance } from "../wallet/walletService";

export type EmberStackRisk = "low" | "medium" | "high";
export type EmberStackRoundStatus = "RUNNING" | "CASHED_OUT" | "BUST";
export type EmberStackStackQuality = "perfect" | "good" | "bad" | "miss";
export type EmberStackOutcome = "ready" | "perfect" | "good" | "bad" | "bust" | "cashout";
export type EmberStackSimulationStrategy = "random" | "quick" | "balanced" | "greedy";

export interface EmberStackBoardConfig {
  width: number;
  height: number;
  platformHeight: number;
  platformGap: number;
  visibleRows: number;
}

export interface EmberStackRiskConfig {
  label: string;
  startingWidth: number;
  cashoutUnlockStacks: number;
  cpuBaseSuccessChance: number;
  cpuSuccessDecay: number;
  cpuMinSuccessChance: number;
  cpuMultiplierPressure: number;
  cpuPerfectChance: number;
  cpuGoodChance: number;
  goodWidthRetention: number;
  badWidthRetention: number;
  baseSpeed: number;
  speedGrowth: number;
  maxSpeed: number;
  perfectRestorePx: number;
  perfectMultiplierBoost: number;
  goodMultiplierBoost: number;
  maxWinMultiplier: number;
  minPlatformWidth: number;
}

export interface EmberStackConfig {
  id: "emberStack";
  slug: "ember-stack";
  name: "Ember Stack";
  theme: string;
  targetRtp: number;
  minBet: number;
  maxBet: number;
  minBetGold: number;
  maxBetGold: number;
  minBetSweepstakes: number;
  maxBetSweepstakes: number;
  minBetRealCentsPlaceholder: number;
  maxBetRealCentsPlaceholder: number;
  maxPayout: number;
  board: EmberStackBoardConfig;
  riskProfiles: Record<EmberStackRisk, EmberStackRiskConfig>;
  multiplierCurves: Record<EmberStackRisk, number[]>;
}

export interface EmberStackPlatform {
  id: string;
  level: number;
  x: number;
  width: number;
  speed: number;
  phase: number;
  kind: "base" | "locked" | "active";
}

export interface EmberStackCutPiece {
  id: string;
  level: number;
  x: number;
  width: number;
  side: "left" | "right" | "full";
}

export interface EmberStackParticle {
  id: string;
  x: number;
  level: number;
  delayMs: number;
}

export interface EmberStackRound {
  id: string;
  status: EmberStackRoundStatus;
  currency: Currency;
  betAmount: number;
  risk: EmberStackRisk;
  tower: EmberStackPlatform[];
  activePlatform: EmberStackPlatform | null;
  choiceAvailable: boolean;
  stackCount: number;
  currentMultiplier: number;
  perfectCombo: number;
  perfectCount: number;
  goodCount: number;
  capped: boolean;
  totalPaid: number;
  lastOutcome: EmberStackOutcome;
  lastQuality: EmberStackStackQuality;
  lastMessage: string;
  lastCut: EmberStackCutPiece | null;
  lastParticles: EmberStackParticle[];
  lastLockX?: number;
  lastOverlapWidth?: number;
  transactions: Transaction[];
}

export interface EmberStackCpuResolution {
  quality: EmberStackStackQuality;
  lockedPlatform?: EmberStackPlatform;
  cutPiece?: EmberStackCutPiece;
  particles: EmberStackParticle[];
  overlapWidth: number;
  effectiveX: number;
  alignmentError: number;
  forgiven: boolean;
}

export interface EmberStackSimulationResult {
  risk: EmberStackRisk;
  strategy: EmberStackSimulationStrategy;
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  houseEdge: number;
  biggestWin: number;
  bustRate: number;
  cashoutRate: number;
  averagePayout: number;
  averageMultiplier: number;
  averageStacks: number;
  successRate: number;
  perfectRate: number;
  goodRate: number;
  averageCashoutEv: number;
  maxMultiplierObserved: number;
  maxWin: number;
  maxPayoutCapHits: number;
  maxCapHitRate: number;
}

export const emberStackRiskOrder: EmberStackRisk[] = ["low", "medium", "high"];

export const emberStackConfig: EmberStackConfig = {
  id: "emberStack",
  slug: "ember-stack",
  name: "Ember Stack",
  theme: "Premium arcade CPU stacker",
  targetRtp: 0.9,
  minBet: 1,
  maxBet: 1000000,
  minBetGold: 1,
  maxBetGold: 1000000,
  minBetSweepstakes: 0.01,
  maxBetSweepstakes: 500,
  minBetRealCentsPlaceholder: 1,
  maxBetRealCentsPlaceholder: 500,
  maxPayout: 100000000,
  board: {
    width: 320,
    height: 560,
    platformHeight: 22,
    platformGap: 3,
    visibleRows: 13,
  },
  multiplierCurves: {
    low: [1, 1.04, 1.1, 1.18, 1.3, 1.48, 1.72, 2.05, 2.45, 3.1, 4, 5.5, 8],
    medium: [1, 1.15, 1.42, 2.05, 3.4, 6, 12, 22.5, 40, 70, 110, 160, 220, 300, 400],
    high: [1, 1.35, 2.5, 5.5, 12, 25, 50, 90, 150, 250, 400, 650, 1000, 1500, 2500, 4000, 5000],
  },
  riskProfiles: {
    low: {
      label: "Low",
      startingWidth: 176,
      cashoutUnlockStacks: 1,
      cpuBaseSuccessChance: 0.9,
      cpuSuccessDecay: 0.035,
      cpuMinSuccessChance: 0.48,
      cpuMultiplierPressure: 0.025,
      cpuPerfectChance: 0.14,
      cpuGoodChance: 0.66,
      goodWidthRetention: 0.86,
      badWidthRetention: 0.56,
      baseSpeed: 280,
      speedGrowth: 28,
      maxSpeed: 620,
      perfectRestorePx: 6,
      perfectMultiplierBoost: 0.012,
      goodMultiplierBoost: 0.004,
      maxWinMultiplier: 8,
      minPlatformWidth: 36,
    },
    medium: {
      label: "Medium",
      startingWidth: 142,
      cashoutUnlockStacks: 1,
      cpuBaseSuccessChance: 0.76,
      cpuSuccessDecay: 0.052,
      cpuMinSuccessChance: 0.44,
      cpuMultiplierPressure: 0.04,
      cpuPerfectChance: 0.11,
      cpuGoodChance: 0.57,
      goodWidthRetention: 0.82,
      badWidthRetention: 0.5,
      baseSpeed: 380,
      speedGrowth: 44,
      maxSpeed: 780,
      perfectRestorePx: 5,
      perfectMultiplierBoost: 0.014,
      goodMultiplierBoost: 0.005,
      maxWinMultiplier: 400,
      minPlatformWidth: 34,
    },
    high: {
      label: "High",
      startingWidth: 118,
      cashoutUnlockStacks: 1,
      cpuBaseSuccessChance: 0.6,
      cpuSuccessDecay: 0.068,
      cpuMinSuccessChance: 0.45,
      cpuMultiplierPressure: 0.055,
      cpuPerfectChance: 0.08,
      cpuGoodChance: 0.49,
      goodWidthRetention: 0.78,
      badWidthRetention: 0.44,
      baseSpeed: 500,
      speedGrowth: 58,
      maxSpeed: 900,
      perfectRestorePx: 3.5,
      perfectMultiplierBoost: 0.018,
      goodMultiplierBoost: 0.006,
      maxWinMultiplier: 5000,
      minPlatformWidth: 32,
    },
  },
};

function round2(value: number) {
  return Math.round(value * 100) / 100;
}

function floor2(value: number) {
  return Math.floor(value * 100) / 100;
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function easeTurn(value: number) {
  return value * value * (3 - 2 * value);
}

function getProfile(risk: EmberStackRisk, config = emberStackConfig) {
  return config.riskProfiles[risk];
}

function getTopPlatform(round: Pick<EmberStackRound, "tower">) {
  return round.tower[round.tower.length - 1];
}

function getRowBottom(level: number, config = emberStackConfig) {
  return level * (config.board.platformHeight + config.board.platformGap);
}

function createBasePlatform(risk: EmberStackRisk, config = emberStackConfig): EmberStackPlatform {
  const width = getProfile(risk, config).startingWidth;
  return {
    id: createId("emberbase"),
    level: 0,
    x: round2((config.board.width - width) / 2),
    width,
    speed: 0,
    phase: 0,
    kind: "base",
  };
}

function createActivePlatform({
  previous,
  stackCount,
  risk,
  random,
  config,
}: {
  previous: EmberStackPlatform;
  stackCount: number;
  risk: EmberStackRisk;
  random: () => number;
  config: EmberStackConfig;
}): EmberStackPlatform {
  const profile = getProfile(risk, config);
  const speed = Math.min(profile.maxSpeed, profile.baseSpeed + stackCount * profile.speedGrowth);
  return {
    id: createId("emberactive"),
    level: previous.level + 1,
    x: -previous.width,
    width: previous.width,
    speed,
    phase: random(),
    kind: "active",
  };
}

function createParticles(level: number, x: number, width: number): EmberStackParticle[] {
  return Array.from({ length: 9 }, (_, index) => ({
    id: createId("emberparticle"),
    x: clamp(x + width * (0.12 + index * 0.095), 0, emberStackConfig.board.width),
    level,
    delayMs: index * 18,
  }));
}

export function getEmberStackBetLimits(currency: Currency, config = emberStackConfig) {
  if (currency === "BONUS") return { minBet: config.minBetSweepstakes, maxBet: config.maxBetSweepstakes };
  return { minBet: config.minBetGold, maxBet: config.maxBetGold };
}

export function assertEmberStackBet(userId: string, currency: Currency, amount: number, config = emberStackConfig) {
  const limits = getEmberStackBetLimits(currency, config);
  const label = currency === "BONUS" ? "SC" : "GC";
  if (!Number.isFinite(amount) || amount < limits.minBet) throw new Error(`Minimum ${label} bet is ${limits.minBet}.`);
  if (amount > limits.maxBet) throw new Error(`Maximum ${label} bet is ${limits.maxBet}.`);
  if (getBalance(userId, currency) < amount) throw new Error("Insufficient balance for Ember Stack.");
}

export function getEmberStackCycleMs(platform: EmberStackPlatform, config = emberStackConfig) {
  const travel = config.board.width + platform.width;
  return Math.max(760, (travel * 2 / Math.max(1, platform.speed)) * 1000);
}

export function getEmberStackPlatformX(platform: EmberStackPlatform, elapsedMs: number, config = emberStackConfig) {
  if (platform.kind !== "active") return platform.x;
  const cycleMs = getEmberStackCycleMs(platform, config);
  const phase = ((platform.phase + elapsedMs / cycleMs) % 1 + 1) % 1;
  const linear = phase < 0.5 ? phase * 2 : (1 - phase) * 2;
  const eased = easeTurn(linear);
  return round2(-platform.width + (config.board.width + platform.width) * eased);
}

export function getEmberStackSpeedForLevel(risk: EmberStackRisk, stackCount: number, config = emberStackConfig) {
  const profile = getProfile(risk, config);
  return Math.min(profile.maxSpeed, profile.baseSpeed + stackCount * profile.speedGrowth);
}

export function getEmberStackCashoutUnlockStacks(risk: EmberStackRisk, config = emberStackConfig) {
  return getProfile(risk, config).cashoutUnlockStacks;
}

export function canCashOutEmberStackRound(round: Pick<EmberStackRound, "status" | "choiceAvailable" | "stackCount" | "currentMultiplier" | "risk">, config = emberStackConfig) {
  return round.status === "RUNNING" && round.choiceAvailable && round.currentMultiplier > 1 && round.stackCount >= getEmberStackCashoutUnlockStacks(round.risk, config);
}

export function getEmberStackCameraOffset(stackCount: number, config = emberStackConfig) {
  void stackCount;
  void config;
  return 0;
}

export function getEmberStackBaseMultiplier(stackCount: number, risk: EmberStackRisk, config = emberStackConfig) {
  const curve = config.multiplierCurves[risk];
  const cap = getProfile(risk, config).maxWinMultiplier;
  if (stackCount <= 0) return 1;
  if (stackCount < curve.length) return Math.min(curve[stackCount], cap);
  const last = curve[curve.length - 1];
  const growth = risk === "high" ? 1.42 : risk === "medium" ? 1.34 : 1.22;
  return Math.min(cap, last * Math.pow(growth, stackCount - curve.length + 1));
}

export function getEmberStackMaxWinMultiplier(risk: EmberStackRisk, betAmount = 1, config = emberStackConfig) {
  void betAmount;
  return floor2(getProfile(risk, config).maxWinMultiplier);
}

export function getEmberStackMultiplier({
  stackCount,
  risk,
  perfectCombo,
  quality,
  betAmount = 1,
  config = emberStackConfig,
}: {
  stackCount: number;
  risk: EmberStackRisk;
  perfectCombo: number;
  quality: EmberStackStackQuality;
  betAmount?: number;
  config?: EmberStackConfig;
}) {
  const base = getEmberStackBaseMultiplier(stackCount, risk, config);
  void perfectCombo;
  void quality;
  return round2(Math.min(base, getEmberStackMaxWinMultiplier(risk, betAmount, config)));
}

export function getEmberStackNextMultiplier(round: Pick<EmberStackRound, "stackCount" | "risk" | "perfectCombo" | "betAmount"> | null, config = emberStackConfig) {
  if (!round) return getEmberStackBaseMultiplier(1, "medium", config);
  return getEmberStackMultiplier({
    stackCount: round.stackCount + 1,
    risk: round.risk,
    perfectCombo: round.perfectCombo,
    quality: "good",
    betAmount: round.betAmount,
    config,
  });
}

export function getEmberStackCashoutAmount(round: Pick<EmberStackRound, "betAmount" | "currentMultiplier" | "risk">, config = emberStackConfig) {
  const cappedMultiplier = Math.min(round.currentMultiplier, getEmberStackMaxWinMultiplier(round.risk, round.betAmount, config));
  return round2(round.betAmount * cappedMultiplier);
}

export function getEmberStackCpuSuccessChance({
  risk,
  stackCount,
  currentMultiplier,
  platformWidth,
  config = emberStackConfig,
}: {
  risk: EmberStackRisk;
  stackCount: number;
  currentMultiplier: number;
  platformWidth: number;
  config?: EmberStackConfig;
}) {
  const profile = getProfile(risk, config);
  const widthRatio = platformWidth / Math.max(profile.startingWidth, 1);
  const progressionPenalty = stackCount * profile.cpuSuccessDecay;
  const multiplierPenalty = Math.max(0, Math.log2(Math.max(1, currentMultiplier))) * profile.cpuMultiplierPressure;
  const widthPenalty = Math.max(0, 0.42 - widthRatio) * (risk === "high" ? 0.34 : risk === "medium" ? 0.26 : 0.18);
  return round2(clamp(profile.cpuBaseSuccessChance - progressionPenalty - multiplierPenalty - widthPenalty, profile.cpuMinSuccessChance, 0.95));
}

export function pickEmberStackCpuOutcome({
  risk,
  stackCount,
  currentMultiplier,
  platformWidth,
  random = Math.random,
  config = emberStackConfig,
}: {
  risk: EmberStackRisk;
  stackCount: number;
  currentMultiplier: number;
  platformWidth: number;
  random?: () => number;
  config?: EmberStackConfig;
}): EmberStackStackQuality {
  const profile = getProfile(risk, config);
  const successChance = getEmberStackCpuSuccessChance({ risk, stackCount, currentMultiplier, platformWidth, config });
  if (random() > successChance) return "miss";
  const qualityRoll = random();
  if (qualityRoll < profile.cpuPerfectChance) return "perfect";
  if (qualityRoll < profile.cpuPerfectChance + profile.cpuGoodChance) return "good";
  return "bad";
}

function resolveEmberStackCpuSuccess({
  round,
  quality,
  random,
  config,
}: {
  round: EmberStackRound;
  quality: Exclude<EmberStackStackQuality, "miss">;
  random: () => number;
  config: EmberStackConfig;
}): EmberStackCpuResolution {
  const active = round.activePlatform;
  const previous = getTopPlatform(round);
  const profile = getProfile(round.risk, config);
  if (!active || !previous) {
    return { quality: "miss", particles: [], overlapWidth: 0, effectiveX: 0, alignmentError: 0, forgiven: false };
  }

  const maxWidth = profile.startingWidth;
  const restoredWidth = quality === "perfect"
    ? Math.min(maxWidth, previous.width + profile.perfectRestorePx + Math.min(8, round.perfectCombo * 1.1))
    : Math.max(profile.minPlatformWidth, previous.width * (quality === "good" ? profile.goodWidthRetention : profile.badWidthRetention));
  const nextWidth = round2(restoredWidth);
  const overhang = Math.max(0, previous.width - nextWidth);
  const side: "left" | "right" = random() < 0.5 ? "left" : "right";
  const effectiveX = quality === "perfect"
    ? round2(clamp(previous.x + previous.width / 2 - active.width / 2, -active.width, config.board.width))
    : side === "left"
      ? round2(previous.x - overhang)
      : round2(previous.x + overhang);
  const lockedX = quality === "perfect"
    ? round2(clamp(previous.x + previous.width / 2 - nextWidth / 2, 0, config.board.width - nextWidth))
    : side === "left"
      ? round2(previous.x)
      : round2(previous.x + overhang);
  const lockedPlatform: EmberStackPlatform = {
    id: createId("emberlocked"),
    level: active.level,
    x: lockedX,
    width: nextWidth,
    speed: 0,
    phase: 0,
    kind: "locked",
  };
  const cutPiece = overhang > 0.75
    ? {
      id: createId("embercut"),
      level: active.level,
      x: side === "left" ? round2(previous.x - overhang) : round2(previous.x + previous.width),
      width: round2(overhang),
      side,
    }
    : undefined;

  return {
    quality,
    lockedPlatform,
    cutPiece,
    particles: createParticles(active.level, lockedPlatform.x, lockedPlatform.width),
    overlapWidth: nextWidth,
    effectiveX,
    alignmentError: round2(Math.abs(effectiveX - previous.x)),
    forgiven: false,
  };
}

function createCpuMissResolution(round: EmberStackRound, random: () => number, config = emberStackConfig): EmberStackCpuResolution {
  const active = round.activePlatform;
  const previous = getTopPlatform(round);
  const missLeft = random() < 0.5;
  const missGap = 16 + random() * 34;
  const effectiveX = active && previous
    ? missLeft
      ? previous.x - active.width - missGap
      : previous.x + previous.width + missGap
    : 0;
  return {
    quality: "miss",
    cutPiece: active ? { id: createId("embercut"), level: active.level, x: round2(effectiveX), width: active.width, side: "full" } : undefined,
    particles: active ? createParticles(active.level, clamp(effectiveX, 0, config.board.width), Math.max(24, active.width * 0.35)) : [],
    overlapWidth: 0,
    effectiveX: round2(effectiveX),
    alignmentError: previous ? round2(Math.abs(effectiveX - previous.x)) : 0,
    forgiven: false,
  };
}

function createRoundMetadata(round: EmberStackRound, result: "cashout" | "bust") {
  return {
    arcadeGameId: emberStackConfig.id,
    arcadeGame: emberStackConfig.name,
    game: "ember-stack",
    risk: round.risk,
    bet: round.betAmount,
    result,
    finalMultiplier: round.status === "BUST" ? 0 : round.currentMultiplier,
    stacks: round.stackCount,
    perfects: round.perfectCount,
    goodStacks: round.goodCount,
    perfectCombo: round.perfectCombo,
    towerHeight: round.tower.length,
    capped: round.capped,
  };
}

export function startEmberStackRound({
  userId,
  currency,
  betAmount,
  risk,
  random = Math.random,
  config = emberStackConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  risk: EmberStackRisk;
  random?: () => number;
  config?: EmberStackConfig;
}): EmberStackRound {
  assertEmberStackBet(userId, currency, betAmount, config);
  const base = createBasePlatform(risk, config);
  const activePlatform = createActivePlatform({ previous: base, stackCount: 0, risk, random, config });
  const betTx = debitCurrency({
    userId,
    currency,
    amount: betAmount,
    type: "ARCADE_BET",
    metadata: {
      arcadeGameId: config.id,
      arcadeGame: config.name,
      game: "ember-stack",
      risk,
      bet: betAmount,
      targetRtp: config.targetRtp,
    },
  });

  return {
    id: createId("emberround"),
    status: "RUNNING",
    currency,
    betAmount,
    risk,
    tower: [base],
    activePlatform,
    choiceAvailable: false,
    stackCount: 0,
    currentMultiplier: 1,
    perfectCombo: 0,
    perfectCount: 0,
    goodCount: 0,
    capped: false,
    totalPaid: 0,
    lastOutcome: "ready",
    lastQuality: "good",
    lastMessage: "CPU lining up the first block.",
    lastCut: null,
    lastParticles: [],
    transactions: [betTx],
  };
}

export function attemptEmberStackCpuStack({
  round,
  random = Math.random,
  config = emberStackConfig,
}: {
  round: EmberStackRound;
  random?: () => number;
  config?: EmberStackConfig;
}): EmberStackRound {
  if (round.status !== "RUNNING" || round.choiceAvailable) return round;
  const active = round.activePlatform;
  if (!active) return round;
  const previous = getTopPlatform(round);
  const quality = pickEmberStackCpuOutcome({
    risk: round.risk,
    stackCount: round.stackCount,
    currentMultiplier: round.currentMultiplier,
    platformWidth: previous?.width ?? active.width,
    random,
    config,
  });
  const resolution = quality === "miss"
    ? createCpuMissResolution(round, random, config)
    : resolveEmberStackCpuSuccess({ round, quality, random, config });

  if (resolution.quality === "miss" || !resolution.lockedPlatform) {
    return {
      ...round,
      status: "BUST",
      activePlatform: null,
      choiceAvailable: false,
      currentMultiplier: 0,
      totalPaid: 0,
      lastOutcome: "bust",
      lastQuality: "miss",
      lastMessage: "BUST",
      lastCut: resolution.cutPiece ?? { id: createId("embercut"), level: active.level, x: active.x, width: active.width, side: "full" },
      lastParticles: resolution.particles,
      lastLockX: resolution.effectiveX,
      lastOverlapWidth: 0,
    };
  }

  const nextStackCount = round.stackCount + 1;
  const nextPerfectCombo = resolution.quality === "perfect" ? round.perfectCombo + 1 : 0;
  const nextMultiplier = getEmberStackMultiplier({
    stackCount: nextStackCount,
    risk: round.risk,
    perfectCombo: nextPerfectCombo,
    quality: resolution.quality,
    betAmount: round.betAmount,
    config,
  });
  const capped = round.capped || nextMultiplier >= getEmberStackMaxWinMultiplier(round.risk, round.betAmount, config);
  const nextTower = [...round.tower, resolution.lockedPlatform];
  const nextActive = createActivePlatform({
    previous: resolution.lockedPlatform,
    stackCount: nextStackCount,
    risk: round.risk,
    random,
    config,
  });
  const outcome: EmberStackOutcome = resolution.quality === "perfect"
    ? "perfect"
    : resolution.quality === "bad"
      ? "bad"
      : "good";

  return {
    ...round,
    tower: nextTower,
    activePlatform: nextActive,
    choiceAvailable: true,
    stackCount: nextStackCount,
    currentMultiplier: nextMultiplier,
    perfectCombo: nextPerfectCombo,
    perfectCount: round.perfectCount + (resolution.quality === "perfect" ? 1 : 0),
    goodCount: round.goodCount + (resolution.quality === "good" ? 1 : 0),
    capped,
    lastOutcome: outcome,
    lastQuality: resolution.quality,
    lastMessage: outcome === "perfect" ? "PERFECT" : outcome === "bad" ? "Thin stack" : "Good stack",
    lastCut: resolution.cutPiece ?? null,
    lastParticles: resolution.particles,
    lastLockX: resolution.effectiveX,
    lastOverlapWidth: resolution.overlapWidth,
  };
}

export function continueEmberStackRound(round: EmberStackRound): EmberStackRound {
  if (round.status !== "RUNNING" || !round.choiceAvailable || !round.activePlatform) return round;
  return {
    ...round,
    choiceAvailable: false,
    lastOutcome: "ready",
    lastMessage: "CPU lining up the next block.",
    lastCut: null,
    lastParticles: [],
  };
}

export function cashOutEmberStackRound({
  round,
  userId,
  config = emberStackConfig,
}: {
  round: EmberStackRound;
  userId: string;
  config?: EmberStackConfig;
}): EmberStackRound {
  if (round.status !== "RUNNING") return round;
  if (!canCashOutEmberStackRound(round, config)) throw new Error(`Stack ${getEmberStackCashoutUnlockStacks(round.risk, config)} platforms before cashing out.`);
  const totalPaid = getEmberStackCashoutAmount(round, config);
  const finalMultiplier = round2(totalPaid / round.betAmount);
  const completed: EmberStackRound = {
    ...round,
    status: "CASHED_OUT",
    activePlatform: null,
    choiceAvailable: false,
    currentMultiplier: finalMultiplier,
    totalPaid,
    capped: round.capped || finalMultiplier < round.currentMultiplier,
    lastOutcome: "cashout",
    lastMessage: "CASHED OUT",
  };
  const winTx = creditCurrency({
    userId,
    currency: round.currency,
    amount: totalPaid,
    type: "ARCADE_WIN",
    metadata: {
      wagered: round.betAmount,
      ...createRoundMetadata(completed, "cashout"),
    },
  });
  return { ...completed, transactions: [...round.transactions, winTx] };
}

export function createEmberStackSimulationRandom(seedStart: number) {
  let seed = seedStart >>> 0;
  return () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
    return seed / 4294967296;
  };
}

function getSimulationTargetStacks(risk: EmberStackRisk, strategy: EmberStackSimulationStrategy, random: () => number) {
  if (strategy === "quick") return 1;
  if (strategy === "balanced") return risk === "high" ? 2 : risk === "medium" ? 3 : 4;
  if (strategy === "greedy") return risk === "high" ? 4 : risk === "medium" ? 5 : 7;
  return 1 + Math.floor(random() * (risk === "high" ? 5 : risk === "medium" ? 6 : 8));
}

export function simulateEmberStack(
  risk: EmberStackRisk,
  rounds = 100000,
  betAmount = emberStackConfig.minBet,
  strategy: EmberStackSimulationStrategy = "balanced",
  config = emberStackConfig,
): EmberStackSimulationResult {
  const random = createEmberStackSimulationRandom(0xe5a117 + rounds + risk.length * 193 + strategy.length * 79);
  let totalPaid = 0;
  let busts = 0;
  let cashouts = 0;
  let biggestWin = 0;
  let maxPayoutCapHits = 0;
  let totalStacks = 0;
  let totalPerfects = 0;
  let totalGood = 0;
  let maxMultiplierObserved = 0;

  for (let roundIndex = 0; roundIndex < rounds; roundIndex += 1) {
    const targetStacks = getSimulationTargetStacks(risk, strategy, random);
    const profile = getProfile(risk, config);
    let platformWidth = profile.startingWidth;
    let multiplier = 1;
    let perfectCombo = 0;
    let cashed = false;
    for (let stackIndex = 0; stackIndex < Math.min(22, targetStacks + 5); stackIndex += 1) {
      const quality = pickEmberStackCpuOutcome({
        risk,
        stackCount: stackIndex,
        currentMultiplier: multiplier,
        platformWidth,
        random,
        config,
      });
      if (quality === "miss") {
        busts += 1;
        break;
      }
      perfectCombo = quality === "perfect" ? perfectCombo + 1 : 0;
      totalPerfects += quality === "perfect" ? 1 : 0;
      totalGood += quality === "good" ? 1 : 0;
      totalStacks += 1;
      platformWidth = clamp(
        quality === "perfect"
          ? Math.min(profile.startingWidth, platformWidth + profile.perfectRestorePx + Math.min(8, perfectCombo * 1.1))
          : platformWidth * (quality === "good" ? profile.goodWidthRetention : profile.badWidthRetention),
        profile.minPlatformWidth,
        profile.startingWidth,
      );
      multiplier = getEmberStackMultiplier({ stackCount: stackIndex + 1, risk, perfectCombo, quality, betAmount, config });
      if (stackIndex + 1 >= targetStacks || (strategy === "random" && random() < 0.3)) {
        const rawPaid = round2(betAmount * multiplier);
        const paid = rawPaid;
        if (multiplier >= getEmberStackMaxWinMultiplier(risk, betAmount, config)) maxPayoutCapHits += 1;
        totalPaid += paid;
        biggestWin = Math.max(biggestWin, paid);
        maxMultiplierObserved = Math.max(maxMultiplierObserved, multiplier);
        cashouts += 1;
        cashed = true;
        break;
      }
    }
    if (!cashed && cashouts + busts < roundIndex + 1) busts += 1;
  }

  const totalWagered = rounds * betAmount;
  return {
    risk,
    strategy,
    totalWagered,
    totalPaid,
    observedRtp: totalWagered > 0 ? totalPaid / totalWagered : 0,
    houseEdge: totalWagered > 0 ? 1 - totalPaid / totalWagered : 1,
    biggestWin,
    bustRate: rounds > 0 ? busts / rounds : 0,
    cashoutRate: rounds > 0 ? cashouts / rounds : 0,
    averagePayout: rounds > 0 ? totalPaid / rounds : 0,
    averageMultiplier: totalWagered > 0 ? totalPaid / totalWagered : 0,
    averageStacks: rounds > 0 ? totalStacks / rounds : 0,
    successRate: totalStacks + busts > 0 ? totalStacks / (totalStacks + busts) : 0,
    perfectRate: totalStacks > 0 ? totalPerfects / totalStacks : 0,
    goodRate: totalStacks > 0 ? totalGood / totalStacks : 0,
    averageCashoutEv: rounds > 0 ? totalPaid / rounds - betAmount : 0,
    maxMultiplierObserved,
    maxWin: biggestWin,
    maxPayoutCapHits,
    maxCapHitRate: rounds > 0 ? maxPayoutCapHits / rounds : 0,
  };
}

export function getEmberStackMathWarnings(simulation?: EmberStackSimulationResult, config = emberStackConfig) {
  const warnings: string[] = [];
  if (config.targetRtp > 0.95) warnings.push(`${config.name} target RTP is above 95%.`);
  for (const risk of emberStackRiskOrder) {
    const curve = config.multiplierCurves[risk];
    const curveMax = curve[curve.length - 1] ?? 1;
    if (getProfile(risk, config).maxWinMultiplier < curveMax) warnings.push(`${config.name} ${risk} max win is below the multiplier curve.`);
  }
  if (simulation?.observedRtp && simulation.observedRtp > 0.95) warnings.push(`${config.name} observed RTP is above 95%.`);
  return warnings;
}

export const emberStackLayout = {
  getRowBottom,
};
