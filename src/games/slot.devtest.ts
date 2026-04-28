import { exposedSlotConfigs, slotConfigs } from "./slotConfigs";
import { simulateSlot } from "./slotMath";
import { buyBonusDebit, buyBonusFeature, calculateHoldAndWinBonus, calculateNeonCascadeResult, calculateSlotResult, calculateWheelBonus, createHoldAndWinState, creditHoldAndWinBonus, creditPickBonus, spinSlot, stepHoldAndWinBonus } from "./slotEngine";
import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { User } from "../types";
import { clearRecentGames, getRecentGames, recordRecentGame } from "./recentGames";
import { dismissOnboarding, hasDismissedOnboarding } from "../app/onboarding";
import { frontierUiAssets, requiredFrontierUiAssetKeys } from "./frontierAssets";
import { getBonusChanceTier } from "./SlotMachine";
import { getSpinDuration, slotAnimation } from "./slotAnimation";
import { nextFreeSpinTotal } from "./slotSession";
import { getProgression, recordSpinProgress } from "../progression/progressionService";
import { claimStreak, getStreak, resetStreak } from "../streaks/streakService";
import { claimMission, getMissions, recordMissionEvent } from "../missions/missionService";
import { isFavorite, toggleFavorite } from "./favorites";
import { updateData } from "../lib/storage";

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
  id: "slot-test-user",
  email: "slot@test.local",
  username: "SlotTest",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
if (exposedSlotConfigs.length !== 1 || exposedSlotConfigs[0].id !== "frontier-fortune") {
  throw new Error("Expected only Frontier Fortune to be exposed.");
}
const requiredFrontierAssets = [
  "sun_hawk.png",
  "canyon_ram.png",
  "sand_fox.png",
  "crystal_scorpion.png",
  "desert_relic.png",
  "oasis_gem.png",
  "dust_spirit.png",
  "mirage_wild.png",
  "oasis_scatter.png",
  "coin_100.png",
  "coin_250.png",
  "coin_500.png",
  "coin_1000.png",
  "A.png",
  "K.png",
  "Q.png",
  "J.png",
  "10.png",
];
for (const filename of requiredFrontierAssets) {
  const assetPath = `/assets/symbols/frontier/${filename}`;
  if (!exposedSlotConfigs[0].symbols.some((symbol) => symbol.image === assetPath)) {
    throw new Error(`Missing Frontier Fortune symbol config asset: ${filename}`);
  }
}
if (exposedSlotConfigs[0].symbols.some((symbol) => !symbol.image)) {
  throw new Error("Expected exposed Frontier Fortune symbols to use image assets.");
}
const requiredUiAssetValues = new Set(Object.values(frontierUiAssets));
if (requiredFrontierUiAssetKeys.length !== 29 || requiredUiAssetValues.size !== 29) {
  throw new Error("Expected Frontier Fortune UI asset map to include every sliced asset and the source sheet.");
}
if (!frontierUiAssets.backgroundMobile.includes("/assets/ui/frontier/") || !frontierUiAssets.spinButton.includes("/assets/ui/frontier/")) {
  throw new Error("Expected Frontier Fortune UI assets to point at the sliced public asset folder.");
}
if (slotAnimation.normal.reelStopMs.length !== 5 || slotAnimation.fast.reelStopMs.length !== 5) {
  throw new Error("Expected animation config to define stop timing for all five reels.");
}
if (!slotAnimation.normal.reelStopMs.every((stopMs, index, stops) => index === 0 || stopMs > stops[index - 1])) {
  throw new Error("Expected normal spin reels to stop left-to-right.");
}
if (getSpinDuration("fast") >= getSpinDuration("normal") / 2) {
  throw new Error("Expected fast spin duration to be much shorter than normal spin.");
}
const bonusStateCheck: import("./slotAnimation").SlotAnimationState = "bonusRespinning";
if (bonusStateCheck !== "bonusRespinning") {
  throw new Error("Expected bonus respinning animation state to exist.");
}

const game = slotConfigs.find((candidate) => candidate.id === "neon-fortune") ?? slotConfigs[0];
const result = spinSlot({ user, game, currency: "GOLD", betAmount: game.minBet });
const transactions = getTransactions(user.id);

if (result.grid.length !== 5 || result.grid.some((reel) => reel.length !== 3)) {
  throw new Error("Expected slot result grid to be 5x3.");
}

if (!transactions.some((tx) => tx.type === "GAME_BET")) {
  throw new Error("Expected slot spin to create GAME_BET transaction.");
}
if (result.payout > 0 && !transactions.some((tx) => tx.type === "GAME_WIN")) {
  throw new Error("Expected winning slot spin to create GAME_WIN transaction.");
}

try {
  spinSlot({ user, game, currency: "GOLD", betAmount: 999999 });
  throw new Error("Expected oversized bet to fail.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum bet")) throw error;
}

const before = getBalance(user.id, "BONUS");
try {
  spinSlot({ user, game, currency: "BONUS", betAmount: game.minBet });
  throw new Error("Expected overdraft spin to fail.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Insufficient balance.") throw error;
}
if (getBalance(user.id, "BONUS") !== before) throw new Error("Overdraft spin changed balance.");

const forcedGrid = [
  ["lightning", "seven", "chip"],
  ["diamond", "seven", "bar"],
  ["chip", "seven", "diamond"],
  ["bar", "seven", "chip"],
  ["diamond", "seven", "lightning"],
];
const lineResult = calculateSlotResult(game, game.minBet, false, forcedGrid);
if (!lineResult.lineWins.some((win) => win.paylineId === "middle" && win.count === 5)) {
  throw new Error("Expected middle payline to calculate a 5-symbol win.");
}
if (lineResult.winningPositions.length !== 5) {
  throw new Error("Expected winning positions for middle payline.");
}

const cappedGame = { ...game, maxPayoutMultiplier: 1 };
const cappedResult = calculateSlotResult(cappedGame, game.minBet, false, forcedGrid);
if (cappedResult.payout > game.minBet || !cappedResult.capped) {
  throw new Error("Expected max payout cap to apply to oversized line wins.");
}

const betCountBeforeFreeSpin = getTransactions(user.id).filter((tx) => tx.type === "GAME_BET").length;
spinSlot({ user, game, currency: "GOLD", betAmount: game.minBet, freeSpin: true });
const betCountAfterFreeSpin = getTransactions(user.id).filter((tx) => tx.type === "GAME_BET").length;
if (betCountAfterFreeSpin !== betCountBeforeFreeSpin) {
  throw new Error("Expected free spin not to debit wallet or create GAME_BET.");
}

const freeSpinResult = calculateSlotResult(game, game.minBet, true, forcedGrid);
if (nextFreeSpinTotal(25, freeSpinResult) !== 25 + freeSpinResult.payout) {
  throw new Error("Expected free spin total helper to track wins.");
}

const pickBefore = getBalance(user.id, "GOLD");
creditPickBonus({ user, game, currency: "GOLD", award: 123 });
if (getBalance(user.id, "GOLD") !== pickBefore + 123) {
  throw new Error("Expected pick bonus award to credit wallet.");
}

const sim = simulateSlot(game, 1000, game.minBet);
if (!Number.isFinite(sim.observedRtp)) throw new Error("Simulation did not produce RTP.");
if (!Number.isFinite(sim.freeSpinTriggerRate) || !Number.isFinite(sim.pickBonusTriggerRate)) {
  throw new Error("Simulation did not produce bonus trigger rates.");
}
if (!Number.isFinite(sim.holdAndWinTriggerRate ?? 0) || !Number.isFinite(sim.wheelBonusTriggerRate ?? 0)) {
  throw new Error("Simulation did not produce premium bonus trigger rates.");
}

const frontier = slotConfigs.find((candidate) => candidate.id === "frontier-fortune");
if (!frontier) throw new Error("Expected Frontier Fortune config.");
if (getBonusChanceTier(frontier.minBet, frontier) !== "Low") {
  throw new Error("Expected minimum bet to show low bonus boost tier.");
}
if (getBonusChanceTier(frontier.maxBet, frontier) !== "Best") {
  throw new Error("Expected max bet to show best bonus boost tier.");
}
if (getBonusChanceTier(Math.round((frontier.minBet + frontier.maxBet) / 2), frontier) !== "Better") {
  throw new Error("Expected middle bet to show better bonus boost tier.");
}
const holdBonus = calculateHoldAndWinBonus(frontier, frontier.minBet);
if (!Number.isFinite(holdBonus.total) || holdBonus.respinRounds.length === 0) {
  throw new Error("Expected hold-and-win respins to calculate.");
}

const electric = slotConfigs.find((candidate) => candidate.id === "electric-millions");
if (!electric) throw new Error("Expected Electric Millions config.");
const wheel = calculateWheelBonus(electric, electric.minBet);
if (!Number.isFinite(wheel.payout) || wheel.payout <= 0) {
  throw new Error("Expected wheel bonus payout.");
}

const buyBonusUser: User = {
  ...user,
  id: "buy-bonus-test-user",
  email: "buy@test.local",
};
creditCurrency({ userId: buyBonusUser.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 500000 });
const buyTxBefore = getTransactions(buyBonusUser.id).length;
const buyResult = buyBonusFeature({ user: buyBonusUser, game: frontier, currency: "GOLD", betAmount: frontier.minBet });
const buyTransactions = getTransactions(buyBonusUser.id);
if (!buyTransactions.some((tx) => tx.type === "BUY_BONUS")) throw new Error("Expected buy bonus debit ledger entry.");
if (buyResult.payout > 0 && !buyTransactions.some((tx) => tx.type === "BONUS_WIN" || tx.type === "JACKPOT_WIN")) {
  throw new Error("Expected bonus win ledger entry.");
}
if (buyTransactions.length <= buyTxBefore) throw new Error("Expected buy bonus to add transactions.");
const debitOnlyUser: User = {
  ...user,
  id: "buy-bonus-debit-only-user",
  email: "buy-debit@test.local",
};
creditCurrency({ userId: debitOnlyUser.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 500000 });
const debitOnlyBefore = getTransactions(debitOnlyUser.id).filter((tx) => tx.type === "BUY_BONUS").length;
buyBonusDebit({ user: debitOnlyUser, game: frontier, currency: "GOLD", betAmount: frontier.minBet });
if (getTransactions(debitOnlyUser.id).filter((tx) => tx.type === "BUY_BONUS").length !== debitOnlyBefore + 1) {
  throw new Error("Expected buy bonus debit-only ledger entry.");
}

let holdState = createHoldAndWinState(frontier, frontier.minBet, 3);
if (holdState.respinsRemaining !== 3 || holdState.values.filter((value) => value !== null).length < 3) {
  throw new Error("Expected Hold and Win to start with locked coins and 3 respins.");
}
const resetCandidate = { ...holdState, values: holdState.values.map((value, index) => index < 10 ? value ?? frontier.minBet : null), respinsRemaining: 1, finished: false };
const originalRandom = Math.random;
const resetRolls = [0, 0, 0.99, 0.99, 0.99, 0.99];
Math.random = () => resetRolls.shift() ?? 0.99;
try {
  const stepped = stepHoldAndWinBonus(frontier, frontier.minBet, resetCandidate);
  if (stepped.lastNewCoins.length === 0 || stepped.respinsRemaining !== 3) {
    throw new Error("Expected new Hold and Win coins to reset respins to 3.");
  }
} finally {
  Math.random = originalRandom;
}
Math.random = () => 0.99;
try {
  const noCoinStep = stepHoldAndWinBonus(frontier, frontier.minBet, resetCandidate);
  if (noCoinStep.lastNewCoins.length !== 0 || noCoinStep.respinsRemaining !== resetCandidate.respinsRemaining - 1) {
    throw new Error("Expected no Hold and Win coins to reduce respins by 1.");
  }
} finally {
  Math.random = originalRandom;
}
for (let index = 0; index < 60 && !holdState.finished; index += 1) {
  holdState = stepHoldAndWinBonus(frontier, frontier.minBet, holdState);
}
if (!holdState.finished) throw new Error("Expected Hold and Win bonus to end.");
const holdCreditBefore = getTransactions(debitOnlyUser.id).filter((tx) => tx.type === "BONUS_WIN" || tx.type === "JACKPOT_WIN").length;
creditHoldAndWinBonus({ user: debitOnlyUser, game: frontier, currency: "GOLD", betAmount: frontier.minBet, state: holdState, buyBonus: true });
if (getTransactions(debitOnlyUser.id).filter((tx) => tx.type === "BONUS_WIN" || tx.type === "JACKPOT_WIN").length !== holdCreditBefore + 1) {
  throw new Error("Expected final Hold and Win credit ledger entry.");
}
if (!creditHoldAndWinBonus || !stepHoldAndWinBonus) {
  throw new Error("Expected Hold and Win mode helpers to exist.");
}
try {
  buyBonusFeature({ user, game: frontier, currency: "BONUS", betAmount: frontier.minBet });
  throw new Error("Expected buy bonus insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Insufficient balance.") throw error;
}

const xpBefore = getProgression(user.id).xp;
const progressResult = recordSpinProgress({ userId: user.id, wager: 500, won: 100, bonusTriggered: true });
if (getProgression(user.id).xp <= xpBefore) throw new Error("Expected XP to increase after spin.");
updateData((data) => {
  data.progression[user.id] = { ...getProgression(user.id), level: 1, xp: 999999 };
});
const levelTxBefore = getTransactions(user.id).filter((tx) => tx.type === "LEVEL_REWARD").length;
recordSpinProgress({ userId: user.id, wager: 500, won: 500, bonusTriggered: true });
if (getTransactions(user.id).filter((tx) => tx.type === "LEVEL_REWARD").length <= levelTxBefore) {
  throw new Error("Expected level-up to grant ledger reward.");
}

resetStreak(user.id);
claimStreak(user.id);
if (getStreak(user.id).currentStreakDays !== 1) throw new Error("Expected streak claim.");
updateData((data) => {
  data.streaks[user.id].lastClaimedAt = new Date(Date.now() - 49 * 36e5).toISOString();
  data.streaks[user.id].day = 4;
  data.streaks[user.id].currentStreakDays = 3;
});
claimStreak(user.id);
if (getStreak(user.id).currentStreakDays !== 1) throw new Error("Expected missed streak to reset.");

const completed = recordMissionEvent({
  userId: user.id,
  gameId: game.id,
  wager: 1000,
  won: 100,
  bonusTriggered: true,
  leveledUp: progressResult.leveledUp,
});
if (completed.length === 0 && !Object.values(getMissions(user.id)).some((mission) => mission.status === "CLAIMABLE")) {
  throw new Error("Expected mission progress or claimable state.");
}
updateData((data) => {
  const state = getMissions(user.id);
  state["daily-bonus"].status = "CLAIMABLE";
  state["daily-bonus"].progress = 1;
  data.missions[user.id] = state;
});
const missionTxBefore = getTransactions(user.id).filter((tx) => tx.type === "MISSION_REWARD").length;
claimMission(user.id, "daily-bonus");
if (getTransactions(user.id).filter((tx) => tx.type === "MISSION_REWARD").length <= missionTxBefore) {
  throw new Error("Expected mission reward ledger entry.");
}

if (isFavorite(user.id, game.id)) throw new Error("Favorite should start off.");
toggleFavorite(user.id, game.id);
if (!isFavorite(user.id, game.id)) throw new Error("Expected favorite toggle on.");
toggleFavorite(user.id, game.id);
if (isFavorite(user.id, game.id)) throw new Error("Expected favorite toggle off.");

const cascade = calculateNeonCascadeResult(game, game.minBet);
if (!Array.isArray(cascade.cascades)) throw new Error("Expected Neon cascade result.");

clearRecentGames();
recordRecentGame("neon-fortune");
recordRecentGame("pirate-plunder");
recordRecentGame("neon-fortune");
const recent = getRecentGames();
if (recent[0] !== "neon-fortune" || recent[1] !== "pirate-plunder" || recent.length !== 2) {
  throw new Error("Expected recently played tracking to de-dupe and order newest first.");
}

if (hasDismissedOnboarding(user.id)) throw new Error("Onboarding should start undisclosed.");
dismissOnboarding(user.id);
if (!hasDismissedOnboarding(user.id)) throw new Error("Expected onboarding dismissal to persist.");

console.log("slot.devtest passed");
