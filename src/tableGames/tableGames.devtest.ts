import { updateData } from "../lib/storage";
import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { CasinoData, User } from "../types";
import { blackjackConfig, diceConfig, rouletteConfig } from "./configs";
import { doubleDownBlackjack, hitBlackjack, handValue, startBlackjackRound, standBlackjack } from "./blackjackEngine";
import { resolveRouletteBet } from "./rouletteEngine";
import { getDiceReturnMultiplier, resolveDiceBet } from "./diceEngine";
import { assertTableBet } from "./ledger";
import { simulateTableGame } from "./tableMath";
import type { PlayingCard } from "./types";

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
  id: "table-test-user",
  email: "table@test.local",
  username: "TableTest",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user],
  passwordRecords: {},
  sessions: [],
  walletBalances: {},
  transactions: [],
  progression: {},
  streaks: {},
  missions: {},
  favorites: {},
};
localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100000 });
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "BONUS", amount: 100000 });

function card(rank: PlayingCard["rank"], suit: PlayingCard["suit"] = "♠"): PlayingCard {
  return { rank, suit };
}

const blackjackBefore = getTransactions(user.id).length;
const blackjack = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("10"), card("8"), card("9"), card("7"), card("2"), card("K")],
});
if (blackjack.status !== "PLAYER_TURN" || handValue(blackjack.playerCards).total !== 18) {
  throw new Error("Expected blackjack deal to create player turn.");
}
const blackjackHit = hitBlackjack(blackjack, user.id);
if (blackjackHit.playerCards.length !== 3) throw new Error("Expected hit to draw a card.");
const blackjackSettled = standBlackjack(blackjack, user.id);
if (!blackjackSettled.result || blackjackSettled.status !== "RESOLVED") {
  throw new Error("Expected stand to resolve blackjack.");
}
if (getTransactions(user.id).length <= blackjackBefore) throw new Error("Expected blackjack ledger entries.");

const pushRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("10"), card("8"), card("10"), card("8")],
});
const pushSettled = standBlackjack(pushRound, user.id);
if (pushSettled.result?.result !== "PUSH") throw new Error("Expected blackjack tie to push.");

const doubleBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length;
const doubleRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("5"), card("6"), card("9"), card("7"), card("10"), card("6")],
});
doubleDownBlackjack(doubleRound, user.id);
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length !== doubleBefore + 2) {
  throw new Error("Expected double down to create second TABLE_BET.");
}

const rouletteWin = resolveRouletteBet({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  bet: { kind: "color", value: "red" },
  outcome: 1,
});
if (!rouletteWin.won || rouletteWin.totalPaid !== 200) throw new Error("Expected red roulette bet to pay 1:1 plus stake.");
const rouletteStraight = resolveRouletteBet({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  bet: { kind: "straight", value: 17 },
  outcome: 17,
});
if (rouletteStraight.totalPaid !== 3600) throw new Error("Expected straight roulette payout to include stake plus 35:1.");

const diceMultiplier = getDiceReturnMultiplier("over", 50, diceConfig);
const diceWin = resolveDiceBet({
  userId: user.id,
  currency: "BONUS",
  betAmount: 100,
  direction: "over",
  target: 50,
  roll: 80,
});
if (!diceWin.won || Math.round(diceWin.totalPaid) !== Math.round(100 * diceMultiplier)) {
  throw new Error("Expected dice payout math to use probability minus edge.");
}
const diceLoss = resolveDiceBet({
  userId: user.id,
  currency: "BONUS",
  betAmount: 100,
  direction: "under",
  target: 50,
  roll: 80,
});
if (diceLoss.won || !getTransactions(user.id).some((tx) => tx.type === "TABLE_LOSS")) {
  throw new Error("Expected dice loss to create TABLE_LOSS event.");
}

try {
  assertTableBet(user.id, "GOLD", blackjackConfig.maxBet + 1, blackjackConfig);
  throw new Error("Expected max bet enforcement.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum bet")) throw error;
}

try {
  updateData((data) => {
    data.walletBalances[user.id].GOLD = 0;
  });
  resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: rouletteConfig.minBet, bet: { kind: "color", value: "black" } });
  throw new Error("Expected insufficient balance prevention.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}

const tableTypes = new Set(getTransactions(user.id).map((tx) => tx.type));
for (const type of ["TABLE_BET", "TABLE_WIN", "TABLE_PUSH", "TABLE_LOSS"]) {
  if (!tableTypes.has(type as never)) throw new Error(`Expected ${type} ledger entry.`);
}

for (const gameId of ["blackjack", "roulette", "dice"] as const) {
  const sim = simulateTableGame(gameId, 1000);
  if (!Number.isFinite(sim.observedRtp) || !Number.isFinite(sim.houseEdge)) {
    throw new Error(`Expected ${gameId} simulation to produce math stats.`);
  }
}

if (rouletteConfig.minBetRealCentsPlaceholder !== 1 || diceConfig.minBetRealCentsPlaceholder !== 1) {
  throw new Error("Expected table configs to preserve one-cent future placeholder minimums.");
}

console.log("tableGames.devtest passed");
