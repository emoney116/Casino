import type { Currency, User } from "../types";

export type Volatility = "Low" | "Medium" | "High";
export type BonusFeatureType = "FREE_SPINS" | "PICK_BONUS";

export interface SlotSymbol {
  id: string;
  label: string;
  icon: string;
  weight: number;
  kind?: "regular" | "wild" | "scatter" | "bonus";
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
  winType: "LOSS" | "LINE_WIN" | "BIG_WIN" | "FREE_SPINS" | "PICK_BONUS";
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
}
