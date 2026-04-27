import { updateData } from "../lib/storage";
import { creditCurrency } from "./walletService";
import type { User } from "../types";

export const DAILY_BONUS_AMOUNT = 1000;

export function canClaimDailyBonus(user: User) {
  if (!user.lastDailyBonusClaimAt) return true;
  return new Date(user.lastDailyBonusClaimAt).toDateString() !== new Date().toDateString();
}

export function claimDailyBonus(userId: string) {
  const now = new Date().toISOString();
  updateData((data) => {
    const user = data.users.find((candidate) => candidate.id === userId);
    if (!user) throw new Error("User not found.");
    if (!canClaimDailyBonus(user)) throw new Error("Daily bonus already claimed today.");
    user.lastDailyBonusClaimAt = now;
  });

  return creditCurrency({
    userId,
    type: "DAILY_BONUS",
    currency: "BONUS",
    amount: DAILY_BONUS_AMOUNT,
    metadata: { source: "daily_bonus" },
  });
}
