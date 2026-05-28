import { supabase } from "../lib/supabaseClient";
import type { DailyStreak, Transaction, User, WalletBalances } from "../types";
import type { CasinoRepository } from "./types";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

export const supabaseRepository: CasinoRepository = {
  mode: "supabase",
  async syncProfile(user: User) {
    const client = requireSupabase();
    const { error } = await client.from("profiles").upsert({
      id: user.id,
      email: user.email,
      username: user.username,
      created_at: user.createdAt,
      last_login_at: user.lastLoginAt,
      role: user.roles.includes("ADMIN") ? "ADMIN" : "USER",
      roles: user.roles,
      account_status: user.accountStatus,
    });
    if (error) throw error;
  },
  async syncProfileAvatar(userId: string, avatarDataUrl?: string) {
    const client = requireSupabase();
    const { error } = await client.from("profiles").update({
      avatar_data_url: avatarDataUrl ?? null,
    }).eq("id", userId);
    if (error) throw error;
  },
  async syncStreak(streak: DailyStreak) {
    const client = requireSupabase();
    const { error } = await client.from("streaks").upsert({
      user_id: streak.userId,
      day: streak.day,
      current_streak_days: streak.currentStreakDays,
      last_claimed_at: streak.lastClaimedAt ?? null,
    });
    if (error) throw error;
  },
  async syncWalletBalance(userId: string, balances: WalletBalances) {
    const client = requireSupabase();
    const { error } = await client.from("wallet_balances").upsert({
      user_id: userId,
      gold: balances.GOLD,
      bonus: balances.BONUS,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;
  },
  async syncWalletTransaction(transaction: Transaction) {
    const client = requireSupabase();
    const { error } = await client.from("wallet_transactions").upsert({
      id: transaction.id,
      user_id: transaction.userId,
      type: transaction.type,
      currency: transaction.currency,
      amount: transaction.amount,
      balance_after: transaction.balanceAfter,
      status: transaction.status,
      created_at: transaction.createdAt,
      metadata: transaction.metadata,
    });
    if (error) throw error;
  },
};
