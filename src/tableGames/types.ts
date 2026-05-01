import type { Currency, Transaction } from "../types";

export type TableGameId = "blackjack" | "roulette" | "dice" | "crash" | "treasureDig";
export type TableGameStatus = "IDLE" | "BETTING" | "PLAYER_TURN" | "DEALER_TURN" | "RESOLVED" | "ERROR";

export interface TableGameConfig {
  id: TableGameId;
  name: string;
  theme: string;
  minBet: number;
  maxBet: number;
  minBetGold: number;
  maxBetGold: number;
  minBetRealCentsPlaceholder: number;
  maxBetRealCentsPlaceholder: number;
  maxPayout: number;
  houseEdgeTarget: number;
  currency: Currency;
  demoOnlyCopy: string;
  rules: string[];
}

export interface TableSettlement {
  result: "WIN" | "LOSS" | "PUSH" | "REFUND";
  amountPaid: number;
  profit: number;
  transactions: Transaction[];
  message: string;
}

export interface PlayingCard {
  rank: "A" | "2" | "3" | "4" | "5" | "6" | "7" | "8" | "9" | "10" | "J" | "Q" | "K";
  suit: "S" | "H" | "D" | "C";
}

export interface BlackjackConfig extends TableGameConfig {
  dealerHitsSoft17: boolean;
  blackjackPayout: number;
  allowDouble: boolean;
  allowSplit: boolean;
  allowInsurance: boolean;
  allowEvenMoney: boolean;
  allowResplit: boolean;
  allowSplitTens: boolean;
  allowDoubleAfterSplit: boolean;
  deckCount: number;
  shoeReshuffleThreshold: number;
  maxHandsAfterSplit: number;
  maxSplitHands: number;
  dealerAdvantageAssistRate: number;
}

export interface BlackjackHand {
  id: string;
  cards: PlayingCard[];
  betAmount: number;
  status: "ACTIVE" | "STOOD" | "BUST" | "RESOLVED";
  doubled?: boolean;
  splitFromPair?: boolean;
  result?: TableSettlement;
}

export interface BlackjackRound {
  id: string;
  status: TableGameStatus;
  currency: Currency;
  betAmount: number;
  totalBet: number;
  playerCards: PlayingCard[];
  playerHands: BlackjackHand[];
  activeHandIndex: number;
  dealerCards: PlayingCard[];
  dealerRevealed: boolean;
  deck: PlayingCard[];
  result?: TableSettlement;
  insuranceBet?: number;
  insuranceResolved?: boolean;
  insuranceResult?: TableSettlement;
  evenMoneyOffered?: boolean;
}

export type RouletteBet =
  | { kind: "color"; value: "red" | "black" }
  | { kind: "parity"; value: "odd" | "even" }
  | { kind: "range"; value: "low" | "high" }
  | { kind: "dozen"; value: 1 | 2 | 3 }
  | { kind: "column"; value: 1 | 2 | 3 }
  | { kind: "straight"; value: "0" | "00" | number }
  | { kind: "split"; numbers: Array<"0" | "00" | number> }
  | { kind: "street"; numbers: number[] }
  | { kind: "corner"; numbers: number[] }
  | { kind: "sixLine"; numbers: number[] }
  | { kind: "basket"; numbers: Array<"0" | "00" | number> };

export interface RouletteConfig extends TableGameConfig {
  payouts: Record<RouletteBet["kind"], number>;
  maxTotalBetGold: number;
  maxPayoutGold: number;
  realMoneyMinCentsPlaceholder: number;
}

export interface RouletteResult {
  outcome: "0" | "00" | number;
  color: "red" | "black" | "green";
  won: boolean;
  totalPaid: number;
  totalWagered?: number;
  net?: number;
  winningBetIds?: string[];
  settlement: TableSettlement;
}

export type DiceDirection = "over" | "under";

export interface DiceConfig extends TableGameConfig {
  edge: number;
  minTarget: number;
  maxTarget: number;
}

export interface DiceResult {
  roll: number;
  won: boolean;
  totalReturnMultiplier: number;
  totalPaid: number;
  settlement: TableSettlement;
}

export interface CrashConfig extends TableGameConfig {
  edge: number;
  minCrashPoint: number;
  maxCrashPoint: number;
}

export interface CrashRound {
  id: string;
  status: "RUNNING" | "CASHED_OUT" | "CRASHED";
  currency: Currency;
  betAmount: number;
  crashPoint: number;
  startedAt: number;
  cashedOutAt?: number;
  cashOutMultiplier?: number;
  totalPaid?: number;
  settlement?: TableSettlement;
}

export interface TreasureDigConfig extends TableGameConfig {
  gridSize: number;
  minTraps: number;
  maxTraps: number;
  edge: number;
}

export type TreasureTileState = "hidden" | "safe" | "trap";

export interface TreasureDigRound {
  id: string;
  status: "RUNNING" | "CASHED_OUT" | "TRAPPED";
  currency: Currency;
  betAmount: number;
  gridSize: number;
  trapCount: number;
  trapIndexes: number[];
  pickedIndexes: number[];
  currentMultiplier: number;
  totalPaid?: number;
  settlement?: TableSettlement;
}

export interface TableSimulationResult {
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  houseEdge: number;
  biggestWin: number;
  maxPayoutCapHits: number;
}
