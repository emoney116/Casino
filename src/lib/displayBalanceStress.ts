import type { Currency, WalletBalances } from "../types";
import { isSupabaseConfigured } from "./supabaseClient";

export const displayBalanceStressValues: WalletBalances[] = [
  { GOLD: 0, BONUS: 0 },
  { GOLD: 999, BONUS: 9.7 },
  { GOLD: 24_999, BONUS: 999.99 },
  { GOLD: 999_999, BONUS: 2_170 },
  { GOLD: 5_678_450, BONUS: 100_000 },
  { GOLD: 123_456_789, BONUS: 5_678_450.55 },
  { GOLD: 9_999_999_999, BONUS: 5_678_450.55 },
];

export function getDisplayBalances(balances: WalletBalances) {
  const index = getDisplayBalanceStressIndex();
  if (index === null) return balances;
  return displayBalanceStressValues[index % displayBalanceStressValues.length];
}

export function getDisplayBalance(amount: number, currency: Currency) {
  const index = getDisplayBalanceStressIndex();
  if (index === null) return amount;
  return displayBalanceStressValues[index % displayBalanceStressValues.length][currency];
}

function getDisplayBalanceStressIndex() {
  if (isSupabaseConfigured) return null;
  const env = (import.meta as ImportMeta & { env?: Record<string, string | boolean | undefined> }).env;
  if (!env?.DEV || typeof window === "undefined") return null;
  const search = window.location?.search ?? "";
  const params = new URLSearchParams(search);
  const value = params.get("stressBalances") ?? params.get("displayBalanceStress");
  if (value === null) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? Math.floor(parsed) : 4;
}
