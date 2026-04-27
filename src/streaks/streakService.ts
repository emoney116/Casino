import { readData, updateData } from "../lib/storage";
import { creditCurrency } from "../wallet/walletService";
import { setProgressionStreak } from "../progression/progressionService";

export const streakRewards = [
  { day: 1, bonus: 1000, gold: 0 },
  { day: 2, bonus: 1250, gold: 0 },
  { day: 3, bonus: 1500, gold: 0 },
  { day: 4, bonus: 2000, gold: 0 },
  { day: 5, bonus: 2500, gold: 0 },
  { day: 6, bonus: 3500, gold: 0 },
  { day: 7, bonus: 5000, gold: 500 },
];

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

  updateData((data) => {
    const current = data.streaks[userId] ?? { userId, day: 1, currentStreakDays: 0 };
    const missed = hoursSince(current.lastClaimedAt) > 48;
    const claimDay = missed ? 1 : current.day;
    reward = streakRewards[claimDay - 1];
    nextStreakDays = missed ? 1 : current.currentStreakDays + 1;
    data.streaks[userId] = {
      userId,
      day: claimDay === 7 ? 1 : claimDay + 1,
      currentStreakDays: nextStreakDays,
      lastClaimedAt: new Date().toISOString(),
    };
  });

  creditCurrency({ userId, type: "STREAK_REWARD", currency: "BONUS", amount: reward.bonus, metadata: { day: reward.day } });
  if (reward.gold > 0) {
    creditCurrency({ userId, type: "STREAK_REWARD", currency: "GOLD", amount: reward.gold, metadata: { day: reward.day } });
  }
  setProgressionStreak(userId, nextStreakDays);
  return reward;
}

export function resetStreak(userId: string) {
  updateData((data) => {
    delete data.streaks[userId];
  });
  setProgressionStreak(userId, 0);
}
