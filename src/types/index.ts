export type Role = "USER" | "ADMIN";
export type AccountStatus = "ACTIVE" | "SUSPENDED" | "CLOSED";

export type Currency = "GOLD" | "BONUS";
export type TransactionType =
  | "PURCHASE_FAKE"
  | "DAILY_BONUS"
  | "GAME_BET"
  | "GAME_WIN"
  | "ADMIN_ADJUSTMENT"
  | "LEVEL_REWARD"
  | "MISSION_REWARD"
  | "STREAK_REWARD"
  | "BUY_BONUS"
  | "BONUS_WIN"
  | "JACKPOT_WIN"
  | "TABLE_BET"
  | "TABLE_WIN"
  | "TABLE_PUSH"
  | "TABLE_LOSS"
  | "TABLE_REFUND";
export type TransactionStatus = "PENDING" | "COMPLETED" | "FAILED";

export interface User {
  id: string;
  email: string;
  username: string;
  createdAt: string;
  lastLoginAt: string;
  roles: Role[];
  accountStatus: AccountStatus;
  lastDailyBonusClaimAt?: string;
}

export interface Session {
  userId: string;
  createdAt: string;
}

export interface WalletBalances {
  GOLD: number;
  BONUS: number;
}

export interface Transaction {
  id: string;
  userId: string;
  type: TransactionType;
  currency: Currency;
  amount: number;
  balanceAfter: number;
  status: TransactionStatus;
  createdAt: string;
  metadata: Record<string, unknown>;
}

export interface CasinoData {
  users: User[];
  passwordRecords: Record<string, string>;
  sessions: Session[];
  walletBalances: Record<string, WalletBalances>;
  transactions: Transaction[];
  progression: Record<string, PlayerProgression>;
  streaks: Record<string, DailyStreak>;
  missions: Record<string, MissionState>;
  favorites: Record<string, string[]>;
}

export interface PlayerProgression {
  userId: string;
  level: number;
  xp: number;
  lifetimeSpins: number;
  lifetimeWins: number;
  lifetimeWagered: number;
  lifetimeWon: number;
  biggestWin: number;
  currentStreakDays: number;
  lastActiveAt?: string;
}

export interface DailyStreak {
  userId: string;
  day: number;
  currentStreakDays: number;
  lastClaimedAt?: string;
}

export type MissionPeriod = "DAILY" | "WEEKLY";
export type MissionStatus = "ACTIVE" | "CLAIMABLE" | "CLAIMED";

export interface MissionProgress {
  progress: number;
  status: MissionStatus;
  lastResetAt: string;
  playedGames?: string[];
}

export type MissionState = Record<string, MissionProgress>;
