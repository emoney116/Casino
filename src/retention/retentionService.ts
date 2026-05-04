import { readData, updateData } from "../lib/storage";
import { recordMissionEvent } from "../missions/missionService";
import { recordSpinProgress } from "../progression/progressionService";
import type { RetentionState } from "../types";
import { creditCurrency, getBalance } from "../wallet/walletService";

const LOW_BALANCE_THRESHOLD = 250;
const LOW_BALANCE_REWARD = 1200;
const SWITCH_REWARD = 900;

export const promotionDefs = [
  { id: "bonus-2x", title: "2x Sweeps Coins", reward: 2000, durationMinutes: 1440 },
  { id: "limited-reward", title: "Limited Time Reward", reward: 1500, durationMinutes: 90 },
];

function dayKey(date = new Date()) {
  return date.toISOString().slice(0, 10);
}

function expiredDaily(resetAt?: string) {
  if (!resetAt) return true;
  return new Date(resetAt).toDateString() !== new Date().toDateString();
}

function freshRetention(userId: string): RetentionState {
  return {
    userId,
    dailyGameIds: [],
    dailyGameResetAt: new Date().toISOString(),
    mostPlayed: {},
    lowBalanceClaims: {},
    promotionClaims: {},
  };
}

export function getRetentionState(userId: string): RetentionState {
  const current = readData().retention[userId] ?? freshRetention(userId);
  if (!expiredDaily(current.dailyGameResetAt)) return current;
  return { ...current, dailyGameIds: [], dailyGameRewardClaimedAt: undefined, dailyGameResetAt: new Date().toISOString() };
}

export function recordRetentionRound(input: {
  userId: string;
  gameId: string;
  wager: number;
  won: number;
  bonusTriggered?: boolean;
  multiplier?: number;
}) {
  const progress = recordSpinProgress({
    userId: input.userId,
    wager: input.wager,
    won: input.won,
    bonusTriggered: Boolean(input.bonusTriggered),
  });
  const completed = recordMissionEvent({
    userId: input.userId,
    gameId: input.gameId,
    wager: input.wager,
    won: input.won,
    bonusTriggered: Boolean(input.bonusTriggered),
    leveledUp: progress.leveledUp,
    multiplier: input.multiplier,
  });
  const switchReward = recordGameSwitchProgress(input.userId, input.gameId, input.wager, input.won);
  return { progress, completed, switchReward };
}

export function recordGameSwitchProgress(userId: string, gameId: string, wager = 0, won = 0) {
  let shouldReward = false;
  updateData((data) => {
    const state = data.retention[userId] ?? freshRetention(userId);
    if (expiredDaily(state.dailyGameResetAt)) {
      state.dailyGameIds = [];
      state.dailyGameRewardClaimedAt = undefined;
      state.dailyGameResetAt = new Date().toISOString();
    }
    if (!state.dailyGameIds.includes(gameId)) state.dailyGameIds.push(gameId);
    const stats = state.mostPlayed[gameId] ?? { plays: 0, wins: 0, wagered: 0, won: 0, lastPlayedAt: new Date().toISOString() };
    stats.plays += 1;
    stats.wins += won > 0 ? 1 : 0;
    stats.wagered += wager;
    stats.won += won;
    stats.lastPlayedAt = new Date().toISOString();
    state.mostPlayed[gameId] = stats;
    shouldReward = state.dailyGameIds.length >= 3 && !state.dailyGameRewardClaimedAt;
    if (shouldReward) state.dailyGameRewardClaimedAt = new Date().toISOString();
    data.retention[userId] = state;
  });

  if (!shouldReward) return null;
  return creditCurrency({
    userId,
    type: "RETENTION_REWARD",
    currency: "BONUS",
    amount: SWITCH_REWARD,
    metadata: { source: "game_switching", distinctGames: 3 },
  });
}

export function getMostPlayedGames(userId: string, limit = 3) {
  return Object.entries(getRetentionState(userId).mostPlayed)
    .sort(([, a], [, b]) => b.plays - a.plays)
    .slice(0, limit)
    .map(([gameId, stats]) => ({ gameId, ...stats }));
}

export function isLowBalance(userId: string) {
  const balances = getBalance(userId);
  return balances.GOLD + balances.BONUS <= LOW_BALANCE_THRESHOLD;
}

export function canClaimLowBalanceOffer(userId: string) {
  if (!isLowBalance(userId)) return false;
  const claimed = getRetentionState(userId).lowBalanceClaims[dayKey()];
  return !claimed;
}

export function claimLowBalanceOffer(userId: string) {
  if (!canClaimLowBalanceOffer(userId)) throw new Error("Low balance offer is not available.");
  updateData((data) => {
    const state = data.retention[userId] ?? freshRetention(userId);
    state.lowBalanceClaims[dayKey()] = { claimedAt: new Date().toISOString() };
    data.retention[userId] = state;
  });
  return creditCurrency({
    userId,
    type: "RETENTION_REWARD",
    currency: "BONUS",
    amount: LOW_BALANCE_REWARD,
    metadata: { source: "low_balance_offer", virtualOnly: true },
  });
}

export function getActivePromotions(now = new Date()) {
  const dayStart = new Date(now);
  dayStart.setHours(0, 0, 0, 0);
  return promotionDefs.map((promo, index) => {
    const startsAt = new Date(dayStart.getTime() + index * 2 * 36e5);
    const endsAt = new Date(startsAt.getTime() + promo.durationMinutes * 60_000);
    return { ...promo, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), active: now >= startsAt && now <= endsAt };
  });
}

export function canClaimPromotion(userId: string, promoId: string) {
  const promo = getActivePromotions().find((candidate) => candidate.id === promoId);
  if (!promo?.active) return false;
  return !getRetentionState(userId).promotionClaims[`${promoId}:${dayKey()}`];
}

export function claimPromotion(userId: string, promoId: string) {
  const promo = getActivePromotions().find((candidate) => candidate.id === promoId);
  if (!promo || !canClaimPromotion(userId, promoId)) throw new Error("Promotion is not available.");
  updateData((data) => {
    const state = data.retention[userId] ?? freshRetention(userId);
    state.promotionClaims[`${promoId}:${dayKey()}`] = { claimedAt: new Date().toISOString() };
    data.retention[userId] = state;
  });
  return creditCurrency({
    userId,
    type: "PROMO_REWARD",
    currency: "BONUS",
    amount: promo.reward,
    metadata: { source: promo.id, title: promo.title, virtualOnly: true },
  });
}

export function resetRetention(userId: string) {
  updateData((data) => {
    delete data.retention[userId];
  });
}
