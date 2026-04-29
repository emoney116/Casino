import type { Currency, Transaction } from "../types";

export type TableGameId = "blackjack" | "roulette" | "dice";
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
  suit: "♠" | "♥" | "♦" | "♣";
}

export interface BlackjackConfig extends TableGameConfig {
  dealerHitsSoft17: boolean;
  blackjackPayout: number;
  doubleDownAllowed: boolean;
  dealerAdvantageAssistRate: number;
}

export interface BlackjackRound {
  id: string;
  status: TableGameStatus;
  currency: Currency;
  betAmount: number;
  totalBet: number;
  playerCards: PlayingCard[];
  dealerCards: PlayingCard[];
  deck: PlayingCard[];
  result?: TableSettlement;
  doubled?: boolean;
}

export type RouletteBet =
  | { kind: "color"; value: "red" | "black" }
  | { kind: "parity"; value: "odd" | "even" }
  | { kind: "range"; value: "low" | "high" }
  | { kind: "dozen"; value: 1 | 2 | 3 }
  | { kind: "column"; value: 1 | 2 | 3 }
  | { kind: "straight"; value: "0" | "00" | number };

export interface RouletteConfig extends TableGameConfig {
  payouts: Record<RouletteBet["kind"], number>;
}

export interface RouletteResult {
  outcome: "0" | "00" | number;
  color: "red" | "black" | "green";
  won: boolean;
  totalPaid: number;
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

export interface TableSimulationResult {
  totalWagered: number;
  totalPaid: number;
  observedRtp: number;
  houseEdge: number;
  biggestWin: number;
  maxPayoutCapHits: number;
}
