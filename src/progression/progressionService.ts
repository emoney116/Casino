import { updateData, readData } from "../lib/storage";
import { creditCurrency } from "../wallet/walletService";
import type { PlayerProgression } from "../types";

export function xpForLevel(level: number) {
  return Math.round(250 * Math.pow(level, 1.35));
}

export function levelReward(level: number) {
  return 300 + level * 75;
}

export function levelBoostReward(level: number) {
  return level % 5 === 0 ? 2 : 1;
}

export function defaultProgression(userId: string): PlayerProgression {
  return {
    userId,
    level: 1,
    xp: 0,
    lifetimeSpins: 0,
    lifetimeWins: 0,
    lifetimeWagered: 0,
    lifetimeWon: 0,
    biggestWin: 0,
    currentStreakDays: 0,
    boosts: {},
  };
}

export function getProgression(userId: string) {
  const existing = readData().progression[userId];
  return existing ?? defaultProgression(userId);
}

export function recordSpinProgress(input: {
  userId: string;
  wager: number;
  won: number;
  bonusTriggered: boolean;
}) {
  let leveledUp = false;
  let newLevel = 1;
  updateData((data) => {
    const progress = data.progression[input.userId] ?? defaultProgression(input.userId);
    progress.lifetimeSpins += 1;
    progress.lifetimeWagered += input.wager;
    progress.lifetimeWon += input.won;
    progress.biggestWin = Math.max(progress.biggestWin, input.won);
    progress.lastActiveAt = new Date().toISOString();
    if (input.won > 0) progress.lifetimeWins += 1;

    progress.xp += 8 + Math.floor(input.wager / 100) + Math.floor(input.won / 200) + (input.won > 0 ? 15 : 0) + (input.bonusTriggered ? 25 : 0);
    while (progress.xp >= xpForLevel(progress.level + 1)) {
      progress.level += 1;
      leveledUp = true;
    }
    newLevel = progress.level;
    progress.boosts ??= {};
    if (leveledUp) {
      progress.boosts["bonus-coin-boost"] = (progress.boosts["bonus-coin-boost"] ?? 0) + levelBoostReward(newLevel);
    }
    data.progression[input.userId] = progress;
  });

  if (leveledUp) {
    creditCurrency({
      userId: input.userId,
      type: "LEVEL_REWARD",
      currency: "BONUS",
      amount: levelReward(newLevel),
      metadata: { level: newLevel, boosts: { "bonus-coin-boost": levelBoostReward(newLevel) }, note: "Virtual level-up reward only." },
    });
  }

  return { leveledUp, level: newLevel, reward: leveledUp ? levelReward(newLevel) : 0, boosts: leveledUp ? levelBoostReward(newLevel) : 0 };
}

export function setProgressionStreak(userId: string, streakDays: number) {
  updateData((data) => {
    const progress = data.progression[userId] ?? defaultProgression(userId);
    progress.currentStreakDays = streakDays;
    data.progression[userId] = progress;
  });
}
