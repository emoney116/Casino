import type { DailyStreak, Transaction, User, WalletBalances } from "../types";

export interface UserFoundationOptions {
  initialBalances?: WalletBalances;
}

export interface CasinoRepository {
  mode: "local" | "supabase";
  fetchWalletBalance(userId: string): Promise<WalletBalances | null>;
  fetchWalletTransactions(userId: string): Promise<Transaction[]>;
  ensureVipProgress(userId: string): Promise<void>;
  fetchVipLifetimeSCWagered(userId: string): Promise<number | null>;
  recordVipWager(transaction: Transaction): Promise<void>;
  ensureUserFoundation?(user: User, options?: UserFoundationOptions): Promise<void>;
  syncProfile(user: User): Promise<void>;
  syncProfileAvatar?(userId: string, avatarDataUrl?: string): Promise<void>;
  syncStreak(streak: DailyStreak): Promise<void>;
  syncWalletBalance(userId: string, balances: WalletBalances): Promise<void>;
  syncWalletTransaction(transaction: Transaction): Promise<void>;
}
