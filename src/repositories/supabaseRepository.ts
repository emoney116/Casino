import { supabase } from "../lib/supabaseClient";
import type { Currency, DailyStreak, Transaction, TransactionStatus, TransactionType, User, WalletBalances } from "../types";
import type { CasinoRepository } from "./types";

function requireSupabase() {
  if (!supabase) throw new Error("Supabase is not configured.");
  return supabase;
}

function numericValue(value: unknown) {
  const parsed = typeof value === "number" ? value : Number(value ?? 0);
  return Number.isFinite(parsed) ? parsed : 0;
}

function metadataValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {};
}

export const supabaseRepository: CasinoRepository = {
  mode: "supabase",
  async fetchWalletBalance(userId: string) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("wallet_balances")
      .select("user_id,gold,bonus,updated_at")
      .eq("user_id", userId)
      .maybeSingle();
    if (error) throw error;
    if (!data) return null;
    return {
      GOLD: numericValue(data.gold),
      BONUS: numericValue(data.bonus),
    };
  },
  async fetchWalletTransactions(userId: string) {
    const client = requireSupabase();
    const { data, error } = await client
      .from("wallet_transactions")
      .select("id,user_id,type,currency,amount,balance_after,status,created_at,metadata")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(500);
    if (error) throw error;
    return (data ?? []).map((row): Transaction => ({
      id: String(row.id),
      userId: String(row.user_id),
      type: row.type as TransactionType,
      currency: row.currency as Currency,
      amount: numericValue(row.amount),
      balanceAfter: numericValue(row.balance_after),
      status: row.status as TransactionStatus,
      createdAt: String(row.created_at),
      metadata: metadataValue(row.metadata),
    }));
  },
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
