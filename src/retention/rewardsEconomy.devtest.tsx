import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/ToastContext";
import { missionDefs } from "../missions/missionDefs";
import { claimMission, getMissions } from "../missions/missionService";
import {
  DAILY_REWARD,
  MAX_STANDARD_SC_REWARD,
  STREAK_REWARD_CAP_DAY,
  STREAK_REWARDS,
  assertSafeRewardGrant,
  getStreakRewardBlockForDay,
  getStreakRewardForDay,
} from "./rewardConfig";
import { RewardsPage } from "./RewardsPage";
import { claimStreak, getStreak, streakRewards } from "../streaks/streakService";
import type { CasinoData, User } from "../types";
import { claimDailyBonus } from "../wallet/dailyBonusService";
import { getBalance, getTransactions } from "../wallet/walletService";
import { readData, updateData } from "../lib/storage";

const memory: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key) => memory[key] ?? null,
  setItem: (key, value) => {
    memory[key] = value;
  },
  removeItem: (key) => {
    delete memory[key];
  },
  clear: () => {
    Object.keys(memory).forEach((key) => delete memory[key]);
  },
  key: (index) => Object.keys(memory)[index] ?? null,
  get length() {
    return Object.keys(memory).length;
  },
} as Storage;

const user: User = {
  id: "rewards-test-user",
  email: "rewards@test.local",
  username: "RewardsTester",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

function seedData() {
  const seed: Partial<CasinoData> = {
    users: [{ ...user }],
    passwordRecords: {},
    sessions: [{ userId: user.id, createdAt: new Date().toISOString() }],
    walletBalances: { [user.id]: { GOLD: 1000, BONUS: 0 } },
    transactions: [],
    progression: {},
    streaks: {},
    missions: {},
    favorites: {},
    retention: {},
    redemptionRequests: [],
    kycStatuses: {},
    eligibilityFlags: {},
  };
  localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));
}

function countOccurrences(value: string, needle: string) {
  return value.split(needle).length - 1;
}

seedData();

if (DAILY_REWARD.currency !== "GOLD") {
  throw new Error("Daily claim should award GC by default.");
}

for (const mission of missionDefs) {
  if (mission.rewardCurrency === "BONUS" && mission.rewardAmount > MAX_STANDARD_SC_REWARD && !mission.promoApproved) {
    throw new Error(`Mission ${mission.id} grants too much SC.`);
  }
}

for (const reward of STREAK_REWARDS) {
  if (reward.bonus > MAX_STANDARD_SC_REWARD) {
    throw new Error(`Streak day ${reward.day} grants too much SC.`);
  }
}

if (STREAK_REWARDS.length !== STREAK_REWARD_CAP_DAY) {
  throw new Error("Streak rewards should span the configured capped reward tier.");
}

if (STREAK_REWARDS[6].bonus !== 0.02 || STREAK_REWARDS[6].gold !== 5000) {
  throw new Error("Day 7 streak should grant 0.02 SC plus 5,000 GC.");
}

if (STREAK_REWARDS[13].bonus !== 0.05 || STREAK_REWARDS[13].gold !== 10000) {
  throw new Error("Day 14 streak should use the controlled week-two jackpot.");
}

if (getStreakRewardForDay(21).bonus !== 0.1 || getStreakRewardForDay(28).bonus !== 0.25 || getStreakRewardForDay(35).bonus !== 0.5) {
  throw new Error("Streak SC rewards should ramp slowly through long-term weekly jackpots.");
}

if (STREAK_REWARDS[STREAK_REWARD_CAP_DAY - 1].bonus !== 1 || STREAK_REWARDS.some((reward) => reward.bonus > 1)) {
  throw new Error("Streak SC rewards should cap at 1.00 SC.");
}

if (getStreakRewardForDay(STREAK_REWARD_CAP_DAY + 7).bonus !== 1 || getStreakRewardForDay(STREAK_REWARD_CAP_DAY + 7).gold !== STREAK_REWARDS[STREAK_REWARD_CAP_DAY - 1].gold) {
  throw new Error("Post-cap jackpot rewards should continue at the capped tier.");
}

if (getStreakRewardBlockForDay(STREAK_REWARD_CAP_DAY + 1)[0].day !== STREAK_REWARD_CAP_DAY + 1) {
  throw new Error("Post-cap streak calendar should keep incrementing day numbers.");
}

try {
  assertSafeRewardGrant({ currency: "BONUS", amount: 1.01 }, "Unsafe test reward");
  throw new Error("Expected large standard SC reward to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("must be explicit promos")) throw error;
}

const originalWarn = console.warn;
let promoWarning = "";
console.warn = (message?: unknown) => {
  promoWarning = String(message ?? "");
};
assertSafeRewardGrant({ currency: "BONUS", amount: 1.01, promoApproved: true }, "Promo test reward");
console.warn = originalWarn;
if (!promoWarning.includes("must be explicit promos")) {
  throw new Error("Expected explicit promos above 1 SC to be flagged.");
}

const markup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(RewardsPage, { onWallet: () => undefined }) }),
  ),
);

for (const required of ["Daily Reward", "Streak", "Daily Missions", "0/4"]) {
  if (!markup.includes(required)) throw new Error(`Expected Rewards page to render ${required}.`);
}

if (!markup.includes("Day 1")) {
  throw new Error("Daily reward hero should show the active streak day.");
}

for (const removed of ["Mystery crate", "Recent rewards", "Activity", "Wallet", "Wallet snapshot"]) {
  if (markup.includes(removed)) throw new Error(`Rewards page should not render ${removed}.`);
}

for (const staleCopy of ["Daily claimed", ">Done<"]) {
  if (markup.includes(staleCopy)) throw new Error(`Rewards page should not render stale copy ${staleCopy}.`);
}

for (const complianceCopy of ["Prototype mode. Redemptions are not currently enabled.", "Gold Coins have no cash value."]) {
  if (countOccurrences(markup, complianceCopy) !== 1) {
    throw new Error(`Rewards page should render compliance copy exactly once: ${complianceCopy}`);
  }
}

for (const asset of ["daily-emblem.png", "claim-reward.png", "reward-chest.png", "reward-gc.png", "mission-badge.png", "mission-multiplier.png", "bonus-reward.png", "streak-flame.png", "streak-locked.png", "streak-jackpot.png"]) {
  if (!markup.includes(asset)) throw new Error(`Rewards page should render raster asset ${asset}.`);
}

for (const repeated of ["Claim 1,000 GC", "Claim 2,500 GC", "Reward: 2,500 GC"]) {
  if (markup.includes(repeated)) throw new Error(`Rewards page should not repeat ${repeated}.`);
}

if (!markup.includes("Finish 5 rounds today.") || !markup.includes("2,500") || !markup.includes("Claim")) {
  throw new Error("Rewards missions should keep task context, a single reward chip, and a simple claim action.");
}

if (markup.includes("rewards-streak-claim")) {
  throw new Error("Streak claim should be handled by the calendar rows, not a separate claim button.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 2,
    currentStreakDays: 1,
    lastClaimedAt: new Date().toISOString(),
  };
});
const claimedMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(RewardsPage, { onWallet: () => undefined }) }),
  ),
);
if (!claimedMarkup.includes("Day 2") || !claimedMarkup.includes("Claimed • Resets in") || !claimedMarkup.includes("h ")) {
  throw new Error("Claimed streak state should show the next daily reward day and clean reset pill.");
}
if (claimedMarkup.includes("Daily claimed") || claimedMarkup.includes(">Done<")) {
  throw new Error("Claimed streak state should not show stale Daily claimed or Done copy.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 7,
    currentStreakDays: 6,
    lastClaimedAt: new Date(Date.now() - 24 * 36e5).toISOString(),
  };
});
const daySevenMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(RewardsPage, { onWallet: () => undefined }) }),
  ),
);
if (!daySevenMarkup.includes("sc_reference") || !daySevenMarkup.includes("Day 7 - 5,000 GC + 0.02 SC")) {
  throw new Error("Day 7 streak should render the SC reward icon and compact reward line.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 8,
    currentStreakDays: 7,
    lastClaimedAt: new Date().toISOString(),
  };
});
const dayEightMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(RewardsPage, { onWallet: () => undefined }) }),
  ),
);
if (!dayEightMarkup.includes("Day 8 - 2,000 GC") || !dayEightMarkup.includes("Day 14 - 10,000 GC + 0.05 SC")) {
  throw new Error("After day 7, Rewards should show the doubled day 8-14 streak block.");
}
if (dayEightMarkup.includes("Day 1 - 1,000 GC")) {
  throw new Error("Day 8-14 streak block should replace the day 1-7 calendar.");
}

seedData();
claimDailyBonus(user.id);
const dailyTx = getTransactions(user.id).find((tx) => tx.type === "DAILY_BONUS");
if (!dailyTx || dailyTx.currency !== "GOLD" || dailyTx.amount !== 1000 || getBalance(user.id, "BONUS") !== 0) {
  throw new Error("Daily claim should credit 1,000 GC and no SC.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 7,
    currentStreakDays: 6,
    lastClaimedAt: new Date(Date.now() - 24 * 36e5).toISOString(),
  };
});
claimStreak(user.id);
const daySevenTx = getTransactions(user.id).filter((tx) => tx.type === "STREAK_REWARD");
if (!daySevenTx.some((tx) => tx.currency === "BONUS" && tx.amount === 0.02) || !daySevenTx.some((tx) => tx.currency === "GOLD" && tx.amount === 5000)) {
  throw new Error("Day 7 streak should credit tiny SC and GC.");
}
if (getStreak(user.id).day !== 8) {
  throw new Error("Day 7 streak should advance into day 8, not reset.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 14,
    currentStreakDays: 13,
    lastClaimedAt: new Date(Date.now() - 24 * 36e5).toISOString(),
  };
});
claimStreak(user.id);
const dayFourteenTx = getTransactions(user.id).filter((tx) => tx.type === "STREAK_REWARD");
if (!dayFourteenTx.some((tx) => tx.currency === "BONUS" && tx.amount === 0.05) || !dayFourteenTx.some((tx) => tx.currency === "GOLD" && tx.amount === 10000)) {
  throw new Error("Day 14 streak should credit the controlled week-two jackpot.");
}
if (getStreak(user.id).day !== 15) {
  throw new Error("Day 14 streak should advance into day 15.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: STREAK_REWARD_CAP_DAY,
    currentStreakDays: STREAK_REWARD_CAP_DAY - 1,
    lastClaimedAt: new Date(Date.now() - 24 * 36e5).toISOString(),
  };
});
claimStreak(user.id);
const maxDayTx = getTransactions(user.id).filter((tx) => tx.type === "STREAK_REWARD");
if (!maxDayTx.some((tx) => tx.currency === "BONUS" && tx.amount === 1)) {
  throw new Error("Final configured streak day should credit exactly 1.00 SC.");
}
if (getStreak(user.id).day !== STREAK_REWARD_CAP_DAY + 1) {
  throw new Error("Final capped streak day should advance into the next day, not reset.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: STREAK_REWARD_CAP_DAY + 7,
    currentStreakDays: STREAK_REWARD_CAP_DAY + 6,
    lastClaimedAt: new Date(Date.now() - 24 * 36e5).toISOString(),
  };
});
claimStreak(user.id);
const postCapTx = getTransactions(user.id).filter((tx) => tx.type === "STREAK_REWARD");
if (!postCapTx.some((tx) => tx.currency === "BONUS" && tx.amount === 1) || !postCapTx.some((tx) => tx.currency === "GOLD" && tx.amount === STREAK_REWARDS[STREAK_REWARD_CAP_DAY - 1].gold)) {
  throw new Error("Post-cap jackpot day should keep paying the capped 1.00 SC jackpot tier.");
}
if (getStreak(user.id).day !== STREAK_REWARD_CAP_DAY + 8) {
  throw new Error("Post-cap streak days should keep incrementing.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 49,
    currentStreakDays: 48,
    lastClaimedAt: new Date(Date.now() - 24 * 36e5).toISOString(),
  };
});
claimStreak(user.id);
const dayFortyNineTx = getTransactions(user.id).filter((tx) => tx.type === "STREAK_REWARD");
if (!dayFortyNineTx.some((tx) => tx.currency === "BONUS" && tx.amount === 1) || getStreak(user.id).day !== 50) {
  throw new Error("Day 49 should keep the capped jackpot and advance to day 50.");
}

updateData((data) => {
  data.streaks[user.id].lastClaimedAt = new Date(Date.now() - 24 * 36e5).toISOString();
});
claimStreak(user.id);
const persistedDayFifty = readData().streaks[user.id];
if (persistedDayFifty.day !== 51 || persistedDayFifty.currentStreakDays !== 50 || !persistedDayFifty.lastClaimedAt) {
  throw new Error("Post-day-49 streak timeline should persist through the storage layer.");
}
const dayFiftyTx = getTransactions(user.id).find((tx) => tx.type === "STREAK_REWARD" && tx.metadata?.day === 50);
if (!dayFiftyTx || dayFiftyTx.currency !== "GOLD" || dayFiftyTx.amount !== 32000) {
  throw new Error("Day 50 should continue with the capped non-jackpot reward tier.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 7000,
    currentStreakDays: 6999,
    lastClaimedAt: new Date(Date.now() - 24 * 36e5).toISOString(),
  };
});
claimStreak(user.id);
const daySevenThousandTx = getTransactions(user.id).filter((tx) => tx.type === "STREAK_REWARD");
if (!daySevenThousandTx.some((tx) => tx.currency === "BONUS" && tx.amount === 1) || getStreak(user.id).day !== 7001) {
  throw new Error("Very long streak timelines should keep capped jackpots and continue incrementing.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: STREAK_REWARD_CAP_DAY + 1,
    currentStreakDays: STREAK_REWARD_CAP_DAY,
    lastClaimedAt: new Date().toISOString(),
  };
});
const postCapMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(RewardsPage, { onWallet: () => undefined }) }),
  ),
);
if (!postCapMarkup.includes(`Day ${STREAK_REWARD_CAP_DAY + 1} - 32,000 GC`) || !postCapMarkup.includes(`Day ${STREAK_REWARD_CAP_DAY + 7} - 160,000 GC + 1 SC`)) {
  throw new Error("Post-cap Rewards UI should show the continued day block at the capped reward tier.");
}
if (postCapMarkup.includes("Day 1 - 1,000 GC")) {
  throw new Error("Post-cap Rewards UI should not wrap back to day 1.");
}

seedData();
updateData((data) => {
  data.streaks[user.id] = {
    userId: user.id,
    day: 7001,
    currentStreakDays: 7000,
    lastClaimedAt: new Date().toISOString(),
  };
});
const longRunMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(RewardsPage, { onWallet: () => undefined }) }),
  ),
);
if (!longRunMarkup.includes("Day 7001 - 32,000 GC") || !longRunMarkup.includes("Day 7007 - 160,000 GC + 1 SC")) {
  throw new Error("Rewards UI should support long-running streak day blocks.");
}

seedData();
updateData((data) => {
  const state = getMissions(user.id);
  state["daily-rounds"].status = "CLAIMABLE";
  state["daily-rounds"].progress = 5;
  data.missions[user.id] = state;
});
claimMission(user.id, "daily-rounds");
const missionTx = getTransactions(user.id).find((tx) => tx.type === "MISSION_REWARD");
if (!missionTx || missionTx.currency !== "GOLD" || missionTx.amount !== 2500) {
  throw new Error("Daily missions should credit GC, not large SC.");
}

if (streakRewards !== STREAK_REWARDS) {
  throw new Error("Streak service should use centralized rewards config.");
}

console.log("rewardsEconomy.devtest passed");
