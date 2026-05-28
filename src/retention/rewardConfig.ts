import type { Currency } from "../types";

export interface RewardGrant {
  currency: Currency;
  amount: number;
  promoApproved?: boolean;
}

export interface StreakRewardConfig {
  day: number;
  gold: number;
  bonus: number;
  promoApproved?: boolean;
}

export const MAX_STANDARD_SC_REWARD = 1;

export const DAILY_REWARD: RewardGrant = {
  currency: "GOLD",
  amount: 1000,
};

export const STREAK_REWARD_CYCLE_LENGTH = 7;

const BASE_STREAK_WEEK: StreakRewardConfig[] = [
  { day: 1, gold: 1000, bonus: 0 },
  { day: 2, gold: 1500, bonus: 0 },
  { day: 3, gold: 2000, bonus: 0 },
  { day: 4, gold: 2500, bonus: 0 },
  { day: 5, gold: 3000, bonus: 0 },
  { day: 6, gold: 5000, bonus: 0 },
  { day: 7, gold: 5000, bonus: 0.02 },
];

export const STREAK_JACKPOT_SC_BY_WEEK = [0.02, 0.05, 0.1, 0.25, 0.5, MAX_STANDARD_SC_REWARD];
export const STREAK_REWARD_CAP_CYCLE_INDEX = STREAK_JACKPOT_SC_BY_WEEK.length - 1;
export const STREAK_REWARD_CAP_DAY = (STREAK_REWARD_CAP_CYCLE_INDEX + 1) * STREAK_REWARD_CYCLE_LENGTH;
export const MAX_STREAK_DAYS = STREAK_REWARD_CAP_DAY;

export const STREAK_REWARDS: StreakRewardConfig[] = Array.from(
  { length: STREAK_REWARD_CAP_DAY },
  (_, index) => getStreakRewardForDay(index + 1),
);

export const REWARDS_VISIBLE_MISSION_IDS = [
  "daily-rounds",
  "daily-wins",
  "daily-multiplier",
  "daily-games",
];

export function assertSafeRewardGrant(reward: RewardGrant, source: string) {
  if (!Number.isFinite(reward.amount) || reward.amount < 0) {
    throw new Error(`${source} has an invalid reward amount.`);
  }

  if (reward.amount === 0 || reward.currency !== "BONUS" || reward.amount <= MAX_STANDARD_SC_REWARD) return;

  const message = `${source} grants ${reward.amount} SC. Rewards above ${MAX_STANDARD_SC_REWARD} SC must be explicit promos.`;
  if (!reward.promoApproved) throw new Error(message);
  console.warn(message);
}

export function getRewardGrantLabel(reward: RewardGrant) {
  return reward.currency === "BONUS" ? "SC" : "GC";
}

export function getStreakRewardGrants(reward: StreakRewardConfig): RewardGrant[] {
  return [
    { currency: "GOLD", amount: reward.gold },
    { currency: "BONUS", amount: reward.bonus, promoApproved: reward.promoApproved },
  ].filter((grant) => grant.amount > 0) as RewardGrant[];
}

export function getStreakRewardForDay(day: number): StreakRewardConfig {
  const safeDay = normalizeRewardDay(day);
  const cycleIndex = Math.floor((safeDay - 1) / STREAK_REWARD_CYCLE_LENGTH);
  const cappedCycleIndex = Math.min(cycleIndex, STREAK_REWARD_CAP_CYCLE_INDEX);
  const base = BASE_STREAK_WEEK[(safeDay - 1) % STREAK_REWARD_CYCLE_LENGTH];
  const multiplier = 2 ** cappedCycleIndex;
  const jackpotBonus = base.bonus > 0 ? STREAK_JACKPOT_SC_BY_WEEK[cappedCycleIndex] : 0;

  return {
    day: safeDay,
    gold: base.gold * multiplier,
    bonus: Math.min(MAX_STANDARD_SC_REWARD, roundRewardAmount(jackpotBonus)),
  };
}

export function getStreakRewardBlockForDay(day: number) {
  const safeDay = normalizeRewardDay(day);
  const blockStart = Math.floor((safeDay - 1) / STREAK_REWARD_CYCLE_LENGTH) * STREAK_REWARD_CYCLE_LENGTH + 1;
  return Array.from({ length: STREAK_REWARD_CYCLE_LENGTH }, (_, index) => getStreakRewardForDay(blockStart + index));
}

function normalizeRewardDay(day: number) {
  if (!Number.isFinite(day)) return 1;
  return Math.max(Math.round(day), 1);
}

function roundRewardAmount(amount: number) {
  return Math.round(amount * 100) / 100;
}
