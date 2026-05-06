import type { Currency, User } from "../types";

export type Volatility = "Low" | "Medium" | "High";
export type BonusFeatureType = "FREE_SPINS" | "HOLD_AND_WIN" | "WHEEL_BONUS" | "PICK_BONUS";
export type SpinMode = "NORMAL" | "GOLD_BOOST" | "SCATTER_BOOST";

export interface SlotSymbol {
  id: string;
  label: string;
  icon: string;
  image?: string;
  weight: number;
  kind?: "regular" | "wild" | "scatter" | "bonus" | "coin" | "multiplier" | "collector";
  color?: string;
}

export interface PayoutRule {
  symbol: string;
  count: number;
  multiplier: number;
}

export interface SlotConfig {
  id: string;
  name: string;
  theme: string;
  symbols: SlotSymbol[];
  reelCount: number;
  rowCount: number;
  paylines: Payline[];
  waysToWin?: string;
  minBet: number;
  maxBet: number;
  volatility: Volatility;
  targetRtp: number;
  maxPayoutMultiplier: number;
  currencyBetOptions?: Partial<Record<Currency, number[]>>;
  jackpotLabels?: {
    Grand: string;
    Major: string;
    Minor: string;
    Mini: string;
  };
  buyBonus?: {
    enabled: boolean;
    costMultiplier: number;
    featureType: BonusFeatureType;
  };
  bonusBuys?: Array<{
    id: "hold-and-win" | "wheel-bonus";
    label: string;
    featureType: BonusFeatureType;
    costMultiplier: number;
    currencyCostMultipliers?: Partial<Record<Currency, number>>;
    payoutBetMultipliers?: Partial<Record<Currency, number>>;
    startingCoins?: number;
  }>;
  boostSpins?: Partial<Record<Exclude<SpinMode, "NORMAL">, {
    label: string;
    costMultiplier: number;
    coinWeightMultiplier?: number;
    scatterWeightMultiplier?: number;
    holdAndWinTriggerBoost?: number;
    wheelTriggerBoost?: number;
    collectorTriggerBoost?: number;
  }>>;
  holdAndWin?: {
    coinValueMultipliers: number[];
    coinAwards?: Array<{
      label: string;
      multiplier: number;
      weight: number;
      jackpotLabel?: "Grand" | "Major" | "Minor" | "Mini";
    }>;
    grandMultiplier: number;
    majorMultiplier: number;
    minorMultiplier: number;
    miniMultiplier: number;
    coinLandingChance: number;
    triggerCount?: number;
  };
  wheelBonus?: {
    triggerCount: number;
    segments: Array<{
      label: string;
      multiplier: number;
      weight: number;
      jackpotLabel?: "Grand" | "Major" | "Minor" | "Mini";
      featureTrigger?: "HOLD_AND_WIN" | "SUPER_HOLD_AND_WIN";
      freeSpinsAwarded?: number;
    }>;
  };
  coinCollector?: {
    enabled: boolean;
    maxCoins: number;
    minCollect: number;
    maxCollect: number;
    triggerChancePerCoin: number;
    resetOnTrigger: boolean;
  };
  featureTypes?: BonusFeatureType[];
  specialSymbols?: {
    wild?: string;
    scatter?: string;
    bonus?: string;
    coin?: string;
    multiplier?: string;
    collector?: string;
  };
  payoutTable: PayoutRule[];
  twoMatchMultiplier: number;
  scatterSymbol: string;
  bonusSymbol: string;
  bonusFeature: {
    meterPerSpin: number;
  };
  freeSpins: {
    triggerCount: number;
    awarded: [number, number];
    winMultiplier: number;
    retrigger: boolean;
    retriggerAward?: number;
    maxSpins?: number;
    stickyWilds?: boolean;
  };
  pickBonus: {
    triggerCount: number;
    picks: number;
    awards: number[];
  };
  demoProgressive?: {
    seed: number;
    contributionRate: number;
    maxPayoutMultiplier: number;
  };
  visual: {
    accent: string;
    secondary: string;
    panel: string;
    logo: string;
    logoImage?: string;
    background?: string;
    cabinet?: string;
  };
}

export interface Payline {
  id: string;
  name: string;
  rows: number[];
}

export interface SlotSpinInput {
  user: User;
  game: SlotConfig;
  currency: Currency;
  betAmount: number;
  freeSpin?: boolean;
  spinMode?: SpinMode;
  stickyWildPositions?: number[];
}

export interface SlotSpinResult {
  gameId: string;
  grid: string[][];
  wager: number;
  payout: number;
  multiplier: number;
  winType: "LOSS" | "LINE_WIN" | "BIG_WIN" | "FREE_SPINS" | "PICK_BONUS" | "HOLD_AND_WIN" | "WHEEL_BONUS" | "BUY_BONUS";
  winTier: "NONE" | "SMALL" | "BIG" | "MEGA";
  capped: boolean;
  lineWins: Array<{
    paylineId: string;
    paylineName: string;
    symbol: string;
    count: number;
    multiplier: number;
    positions: Array<{ reel: number; row: number }>;
    payout: number;
  }>;
  winningPositions: Array<{ reel: number; row: number }>;
  freeSpinsAwarded: number;
  pickBonusAwards?: number[];
  pickBonusWin?: number;
  pickBonusPicks?: number;
  triggeredBonus: boolean;
  triggeredFreeSpins: boolean;
  triggeredPickBonus: boolean;
  triggeredHoldAndWin?: boolean;
  triggeredWheelBonus?: boolean;
  triggeredCoinCollector?: boolean;
  bonusPayout?: number;
  jackpotLabel?: "Grand" | "Major" | "Minor" | "Mini";
  holdAndWin?: HoldAndWinResult;
  wheelBonus?: WheelBonusResult;
  cascades?: Array<{
    grid: string[][];
    payout: number;
    multiplier: number;
    winningPositions: Array<{ reel: number; row: number }>;
  }>;
}

export interface SimulationResult {
  spins: number;
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  modeResults?: Partial<Record<SpinMode | "BUY_HOLD_AND_WIN" | "BUY_WHEEL_BONUS", {
    totalWagered: number;
    totalPaid: number;
    observedRtp: number;
    biggestWin: number;
    capHitRate: number;
    warning: boolean;
  }>>;
  hitRate: number;
  biggestWin: number;
  bonusTriggerRate: number;
  freeSpinTriggerRate: number;
  pickBonusTriggerRate: number;
  holdAndWinTriggerRate?: number;
  wheelBonusTriggerRate?: number;
  coinCollectorTriggerRate?: number;
  buyBonusRtp?: number;
  buyBonusAveragePayout?: number;
  holdAndWinAveragePayout?: number;
  capHitRate?: number;
}

export interface HoldAndWinResult {
  total: number;
  respinRounds: Array<{
    respinsRemaining: number;
    newCoins: number;
    lockedCoins: number;
    total: number;
  }>;
  filledAll: boolean;
}

export interface HoldAndWinState {
  betAmount?: number;
  values: Array<number | null>;
  respinsRemaining: number;
  total: number;
  finished: boolean;
  filledAll: boolean;
  lastNewCoins: number[];
}

export interface WheelBonusResult {
  segment: string;
  multiplier: number;
  payout: number;
  jackpotLabel?: "Grand" | "Major" | "Minor" | "Mini";
  featureTrigger?: "HOLD_AND_WIN" | "SUPER_HOLD_AND_WIN";
  freeSpinsAwarded?: number;
}
