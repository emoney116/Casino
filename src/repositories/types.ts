import type { DailyStreak, Transaction, User, WalletBalances } from "../types";

export interface CasinoRepository {
  mode: "local" | "supabase";
  syncProfile(user: User): Promise<void>;
  syncProfileAvatar?(userId: string, avatarDataUrl?: string): Promise<void>;
  syncStreak(streak: DailyStreak): Promise<void>;
  syncWalletBalance(userId: string, balances: WalletBalances): Promise<void>;
  syncWalletTransaction(transaction: Transaction): Promise<void>;
}
