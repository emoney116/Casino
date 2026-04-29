import type { Currency, User } from "../types";

export type Volatility = "Low" | "Medium" | "High";
export type BonusFeatureType = "FREE_SPINS" | "HOLD_AND_WIN" | "WHEEL_BONUS" | "PICK_BONUS";

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
  holdAndWin?: {
    coinValueMultipliers: number[];
    grandMultiplier: number;
    majorMultiplier: number;
    minorMultiplier: number;
    miniMultiplier: number;
    coinLandingChance: number;
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
  hitRate: number;
  biggestWin: number;
  bonusTriggerRate: number;
  freeSpinTriggerRate: number;
  pickBonusTriggerRate: number;
  holdAndWinTriggerRate?: number;
  wheelBonusTriggerRate?: number;
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
}
