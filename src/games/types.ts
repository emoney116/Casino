import type { Currency, User } from "../types";

export type Volatility = "Low" | "Medium" | "High";
export type BonusFeatureType = "FREE_SPINS" | "HOLD_AND_WIN" | "WHEEL_BONUS" | "PICK_BONUS" | "EXPANSION_BONUS";
export type SpinMode = "NORMAL" | "GOLD_BOOST" | "SCATTER_BOOST" | "GOLD_RUSH_BONUS_BOOST" | "GOLD_RUSH_SHOWDOWN";
export type GoldRushBonusBuyType = "bonus-plus-spins" | "showdown-spin" | "buy-bonus" | "buy-super-bonus";

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
    id: "hold-and-win" | "wheel-bonus" | "gold-rush-buy-bonus" | "gold-rush-buy-super-bonus";
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
  paytableBasis?: "lineBet" | "totalBet";
  twoMatchMultiplier: number;
  scatterSymbol: string;
  bonusSymbol: string;
  bonusFeature: {
    meterPerSpin: number;
  };
  freeSpins: {
    triggerCount: number;
    awarded: [number, number];
    awardsByScatter?: Partial<Record<3 | 4 | 5, number>>;
    winMultiplier: number;
    retrigger: boolean;
    retriggerAward?: number;
    maxSpins?: number;
    stickyWilds?: boolean;
  };
  expansionBonus?: ExpansionBonusConfig;
  goldRushVs?: GoldRushVsConfig;
  goldRushInterior?: GoldRushInteriorConfig;
  goldRushBonusBuys?: GoldRushBonusBuyConfig;
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

export interface GoldRushVsConfig {
  triggerSymbol: string;
  maxActiveNormalVs: number;
  duelTiers: Array<{
    id: "gold-gold" | "gold-diamond" | "diamond-diamond";
    label: string;
    weight: number;
    winner: "gold" | "diamond";
    multipliers: Array<{ multiplier: number; weight: number }>;
  }>;
}

export interface GoldRushInteriorConfig {
  appearanceChance: number;
  sizes: Array<{ columns: number; weight: number }>;
  freeSpinsInteriorAlwaysActive?: boolean;
  freeSpinsInitialInteriorColumns?: number;
  scatterGrowInteriorColumns?: number;
  maxInteriorColumns: number;
}

export interface GoldRushBonusBuyConfig {
  options: Array<{
    type: GoldRushBonusBuyType;
    label: string;
    costMultiplier: number;
    mode: "boost" | "immediate";
    image?: string;
    forcedBonusSymbols?: 3 | 4;
    initialFreeSpins?: number;
    initialInteriorColumns?: number;
    spinMode?: SpinMode;
  }>;
  freeSpins: {
    initialSpins: number;
    normalInitialInteriorColumns: number;
    superInitialInteriorColumns: number;
    collectThreshold: number;
    addedSpins: number;
    growColumns: number;
    maxInteriorColumns: number;
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
  forcedGrid?: string[][];
  prepaidWager?: number;
  goldRushInteriorOverride?: GoldRushSpinMetadata["interior"];
}

export interface SlotSpinResult {
  gameId: string;
  grid: string[][];
  wager: number;
  payout: number;
  multiplier: number;
  winType: "LOSS" | "LINE_WIN" | "BIG_WIN" | "FREE_SPINS" | "PICK_BONUS" | "HOLD_AND_WIN" | "WHEEL_BONUS" | "EXPANSION_BONUS" | "BUY_BONUS";
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
  triggeredExpansionBonus?: boolean;
  triggeredCoinCollector?: boolean;
  bonusPayout?: number;
  jackpotLabel?: "Grand" | "Major" | "Minor" | "Mini";
  holdAndWin?: HoldAndWinResult;
  wheelBonus?: WheelBonusResult;
  expansionBonus?: ExpansionBonusResult;
  cascades?: Array<{
    grid: string[][];
    payout: number;
    multiplier: number;
    winningPositions: Array<{ reel: number; row: number }>;
  }>;
  goldRush?: GoldRushSpinMetadata;
}

export interface GoldRushSpinMetadata {
  baseLinePayout: number;
  inactiveVsPositions: Array<{ reel: number; row: number }>;
  activeVsPosition?: { reel: number; row: number };
  activeVsPositions?: Array<{ reel: number; row: number }>;
  vsActive: boolean;
  vsType?: "normal-column" | "interior";
  activeAreaType?: "column" | "interior";
  activeColumns?: { start: number; count: number };
  activeRows?: { start: number; count: number };
  vsTier?: "gold-gold" | "gold-diamond" | "diamond-diamond";
  vsMultiplier?: number;
  vsCandidateMultipliers?: { gold: number; diamond: number };
  vsWinningMultiplier?: number;
  vsWinnerSide?: "gold" | "diamond";
  transformedPositions?: Array<{ reel: number; row: number }>;
  mineClashColumns?: MineClashColumnResult[];
  activeSegments?: GoldRushMineClashSegment[];
  multiplierWilds?: MultiplierWildPosition[];
  interior?: {
    startColumn: number;
    columns: number;
    rowStart: number;
    rowCount: number;
  };
  vsInsideInteriorCount: number;
  activeNormalVsPayout: number;
  activeInteriorVsPayout: number;
  bonusSymbolCount?: number;
  freeSpinsTrigger?: {
    triggerCount: number;
    awardedSpins: number;
    initialInteriorColumns: number;
    source: "natural" | "buy-bonus" | "buy-super-bonus";
  };
}

export interface MultiplierWildPosition {
  reel: number;
  row: number;
  multiplier: number;
  winner?: "gold" | "diamond";
}

export interface MineClashColumnResult {
  position: { reel: number; row: number };
  reel: number;
  multiplier: number;
  winner: "gold" | "diamond";
  tier: "gold-gold" | "gold-diamond" | "diamond-diamond";
  goldMultiplier: number;
  diamondMultiplier: number;
  transformedPositions: Array<{ reel: number; row: number }>;
}

export interface GoldRushMineClashSegment {
  type: "column" | "interior";
  startReel: number;
  width: number;
  rowStart: number;
  rowCount: number;
  winner: "gold" | "diamond";
  multiplier: number;
  tier?: "gold-gold" | "gold-diamond" | "diamond-diamond";
  goldMultiplier?: number;
  diamondMultiplier?: number;
  triggerPosition?: { reel: number; row: number };
  transformedPositions: Array<{ reel: number; row: number }>;
}

export interface SimulationResult {
  spins: number;
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  modeResults?: Partial<Record<SpinMode | "BUY_HOLD_AND_WIN" | "BUY_WHEEL_BONUS" | "GOLD_RUSH_BUY_BONUS" | "GOLD_RUSH_BUY_SUPER_BONUS", {
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
  expansionBonusTriggerRate?: number;
  mineClashTriggerRate?: number;
  averageMineClashPayout?: number;
  multiplierWildEv?: number;
  freeSpinsAveragePayout?: number;
  coinCollectorTriggerRate?: number;
  buyBonusRtp?: number;
  buyBonusAveragePayout?: number;
  holdAndWinAveragePayout?: number;
  capHitRate?: number;
  baseLineRtp?: number;
  inactiveVsCount?: number;
  activeNormalVsCount?: number;
  activeNormalVsRate?: number;
  interiorBoardAppearanceCount?: number;
  interiorBoardAppearanceRate?: number;
  vsInsideInteriorCount?: number;
  activeInteriorVsCount?: number;
  activeInteriorVsRate?: number;
  averageActiveNormalVsPayout?: number;
  averageActiveInteriorVsPayout?: number;
  maxWinObserved?: number;
  interiorSizeDistribution?: Record<string, number>;
  vsDuelTierDistribution?: Record<string, number>;
  vsMultiplierDistribution?: Record<string, number>;
  naturalThreeBonusTriggerRate?: number;
  naturalFourBonusTriggerRate?: number;
  buyBonusRtp3?: number;
  buyBonusRtp4?: number;
  bonusPlusSpinsRtp?: number;
  showdownSpinRtp?: number;
  buyBonusAverageFreeSpins?: number;
  buyBonusAverageFinalInteriorSize?: number;
  vsInsideFreeSpinsRate?: number;
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

export interface ExpansionBonusGainOption {
  label: string;
  min: number;
  max: number;
  weight: number;
}

export interface ExpansionBonusPhaseConfig {
  id: string;
  title: string;
  rounds: number | [number, number];
  gains: ExpansionBonusGainOption[];
}

export interface ExpansionBonusConfig {
  triggerSymbol: string;
  triggerCount: number;
  phases: ExpansionBonusPhaseConfig[];
  mechanic?: "round-accumulator" | "mine-clash";
  rareFinalChance?: number;
  maxMultiplier: number;
  frameWidths?: Array<{
    width: number;
    weight: number;
  }>;
  mineClash?: {
    goldMiner: {
      min: number;
      max: number;
      weight: number;
    };
    diamondMiner: {
      min: number;
      max: number;
      weight: number;
    };
    rareBoost: {
      multiplier: number;
      chance: number;
    };
  };
  labels?: {
    intro?: string;
    total?: string;
    final?: string;
  };
  vsActive?: boolean;
  vsType?: "normal-column" | "interior";
  activeAreaType?: "column" | "interior";
  activeColumns?: { start: number; count: number };
  activeRows?: { start: number; count: number };
  vsTier?: "gold-gold" | "gold-diamond" | "diamond-diamond";
  vsMultiplier?: number;
  vsCandidateMultipliers?: { gold: number; diamond: number };
  vsWinningMultiplier?: number;
  vsWinnerSide?: "gold" | "diamond";
  inactiveVsPositions?: Array<{ reel: number; row: number }>;
  activeVsPosition?: { reel: number; row: number };
  interiorColumns?: number;
  interiorStartColumn?: number;
}

export interface ExpansionBonusRound {
  phaseId: string;
  phaseTitle: string;
  label: string;
  gain: number;
  totalMultiplier: number;
}

export interface ExpansionBonusResult {
  triggerPositions: Array<{ reel: number; row: number }>;
  rounds: ExpansionBonusRound[];
  multiplier: number;
  payout: number;
  capped: boolean;
  sourceFeature?: "heist-showdown" | "mine-clash";
  frame?: {
    startReel: number;
    width: number;
    rowStart: number;
    rowCount: number;
    reelCount: number;
  };
  transformedPositions?: Array<{ reel: number; row: number }>;
  mineClashColumns?: MineClashColumnResult[];
  activeSegments?: GoldRushMineClashSegment[];
  multiplierWilds?: MultiplierWildPosition[];
  vsActive?: boolean;
  vsType?: "normal-column" | "interior";
  activeAreaType?: "column" | "interior";
  activeColumns?: { start: number; count: number };
  activeRows?: { start: number; count: number };
  vsTier?: "gold-gold" | "gold-diamond" | "diamond-diamond";
  vsMultiplier?: number;
  vsCandidateMultipliers?: { gold: number; diamond: number };
  vsWinningMultiplier?: number;
  vsWinnerSide?: "gold" | "diamond";
  inactiveVsPositions?: Array<{ reel: number; row: number }>;
  activeVsPosition?: { reel: number; row: number };
  activeVsPositions?: Array<{ reel: number; row: number }>;
  interiorColumns?: number;
  interiorStartColumn?: number;
  mineClash?: {
    winner: "gold" | "diamond";
    goldMultiplier: number;
    diamondMultiplier: number;
    frameWidth: number;
    multiplierWildEv: number;
  };
}
