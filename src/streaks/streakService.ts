import { readData, updateData } from "../lib/storage";
import { creditCurrency } from "../wallet/walletService";
import { setProgressionStreak } from "../progression/progressionService";
import { STREAK_REWARDS, assertSafeRewardGrant, getStreakRewardForDay, getStreakRewardGrants } from "../retention/rewardConfig";
import { getRepository, mirrorToBackend } from "../repositories";
import type { DailyStreak } from "../types";

export const streakRewards = STREAK_REWARDS;

function hoursSince(value?: string) {
  if (!value) return Infinity;
  return (Date.now() - new Date(value).getTime()) / 36e5;
}

export function getStreak(userId: string) {
  return readData().streaks[userId] ?? { userId, day: 1, currentStreakDays: 0 };
}

export function canClaimStreak(userId: string) {
  const streak = getStreak(userId);
  return hoursSince(streak.lastClaimedAt) >= 20;
}

export function claimStreak(userId: string) {
  if (!canClaimStreak(userId)) throw new Error("Daily streak already claimed.");
  let reward = streakRewards[0];
  let nextStreakDays = 1;
  let savedStreak: DailyStreak | undefined;

  updateData((data) => {
    const current = data.streaks[userId] ?? { userId, day: 1, currentStreakDays: 0 };
    const missed = hoursSince(current.lastClaimedAt) > 48;
    const claimDay = missed ? 1 : normalizeStreakDay(current.day);
    reward = getStreakRewardForDay(claimDay);
    nextStreakDays = missed ? 1 : current.currentStreakDays + 1;
    savedStreak = {
      userId,
      day: claimDay + 1,
      currentStreakDays: nextStreakDays,
      lastClaimedAt: new Date().toISOString(),
    };
    data.streaks[userId] = savedStreak;
  });

  const streakSnapshot = savedStreak as DailyStreak;
  mirrorToBackend(async () => {
    await getRepository().syncStreak(streakSnapshot);
  });

  for (const grant of getStreakRewardGrants(reward)) {
    assertSafeRewardGrant(grant, `Streak day ${reward.day}`);
    creditCurrency({ userId, type: "STREAK_REWARD", currency: grant.currency, amount: grant.amount, metadata: { day: reward.day } });
  }
  setProgressionStreak(userId, nextStreakDays);
  return reward;
}

export function resetStreak(userId: string) {
  const resetSnapshot: DailyStreak = { userId, day: 1, currentStreakDays: 0 };
  updateData((data) => {
    delete data.streaks[userId];
  });
  mirrorToBackend(async () => {
    await getRepository().syncStreak(resetSnapshot);
  });
  setProgressionStreak(userId, 0);
}

function normalizeStreakDay(day: number) {
  if (!Number.isFinite(day)) return 1;
  return Math.max(Math.round(day), 1);
}
