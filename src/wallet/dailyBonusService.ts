import { updateData } from "../lib/storage";
import { DAILY_REWARD, assertSafeRewardGrant } from "../retention/rewardConfig";
import { creditCurrency } from "./walletService";
import type { User } from "../types";

export const DAILY_BONUS_AMOUNT = DAILY_REWARD.amount;
export const DAILY_BONUS_CURRENCY = DAILY_REWARD.currency;

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

  assertSafeRewardGrant(DAILY_REWARD, "Daily claim");
  return creditCurrency({
    userId,
    type: "DAILY_BONUS",
    currency: DAILY_REWARD.currency,
    amount: DAILY_REWARD.amount,
    metadata: { source: "daily_bonus" },
  });
}
