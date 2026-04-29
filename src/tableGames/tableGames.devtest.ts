import { updateData } from "../lib/storage";
import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { CasinoData, User } from "../types";
import { blackjackConfig, diceConfig, rouletteConfig } from "./configs";
import {
  acceptEvenMoneyBlackjack,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  doubleDownBlackjack,
  hitBlackjack,
  handValue,
  resolveInsuranceBlackjack,
  splitBlackjack,
  startBlackjackRound,
  standBlackjack,
  visibleDealerValue,
} from "./blackjackEngine";
import { resolveRouletteBet } from "./rouletteEngine";
import { getDiceReturnMultiplier, resolveDiceBet } from "./diceEngine";
import { assertTableBet } from "./ledger";
import { simulateTableGame } from "./tableMath";
import type { PlayingCard } from "./types";
import { blackjackInlineUxMarkers } from "./BlackjackPage";

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

function card(rank: PlayingCard["rank"], suit: PlayingCard["suit"] = "S"): PlayingCard {
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
if (blackjack.dealerRevealed || visibleDealerValue(blackjack) !== 9) {
  throw new Error("Expected dealer hole card to stay hidden before resolution.");
}
if (!canDoubleBlackjack(blackjack, user.id)) throw new Error("Expected double to be legal on first two cards.");
const blackjackHit = hitBlackjack(blackjack, user.id);
if (blackjackHit.playerCards.length !== 3) throw new Error("Expected hit to draw a card.");
if (canDoubleBlackjack(blackjackHit, user.id)) throw new Error("Expected double to be unavailable after hit.");
const blackjackSettled = standBlackjack(blackjack, user.id);
if (!blackjackSettled.result || blackjackSettled.status !== "RESOLVED") {
  throw new Error("Expected stand to resolve blackjack.");
}
if (!blackjackSettled.dealerRevealed) throw new Error("Expected dealer hole card to reveal after stand.");
if (getTransactions(user.id).length <= blackjackBefore) throw new Error("Expected blackjack ledger entries.");

try {
  startBlackjackRound({ userId: user.id, currency: "GOLD", betAmount: 0, deck: [card("10"), card("8"), card("9"), card("7")] });
  throw new Error("Expected deal to require valid bet.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Minimum bet")) throw error;
}

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

const splitRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("8"), card("8"), card("6"), card("10"), card("3"), card("2"), card("10")],
});
if (!canSplitBlackjack(splitRound, user.id)) throw new Error("Expected split to be legal on same rank.");
const split = splitBlackjack(splitRound, user.id);
if (split.playerHands.length !== 2 || split.totalBet !== 200) throw new Error("Expected split to create two hands and second bet.");
const splitResolved = standBlackjack(standBlackjack(split, user.id), user.id);
if (splitResolved.status !== "RESOLVED" || splitResolved.playerHands.some((hand) => !hand.result)) {
  throw new Error("Expected split hands to resolve separately.");
}

const insuranceRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("10"), card("8"), card("A"), card("K")],
});
if (!canOfferInsurance(insuranceRound)) throw new Error("Expected insurance offer on dealer Ace.");
const insured = resolveInsuranceBlackjack(insuranceRound, user.id, true);
if (insured.insuranceResult?.result !== "WIN" || insured.insuranceResult.amountPaid !== 150) {
  throw new Error("Expected insurance to pay 2:1 plus insurance stake on dealer blackjack.");
}

const evenMoneyRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("A"), card("K"), card("A"), card("9")],
});
if (!canOfferEvenMoney(evenMoneyRound)) throw new Error("Expected even money offer for blackjack against dealer Ace.");
const evenMoney = acceptEvenMoneyBlackjack(evenMoneyRound, user.id);
if (evenMoney.result?.result !== "WIN" || evenMoney.result.amountPaid !== 200) {
  throw new Error("Expected even money to pay 1:1 and end hand.");
}

const natural = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("A"), card("K"), card("9"), card("8")],
});
if (natural.result?.amountPaid !== 250) {
  throw new Error("Expected blackjack to pay configured 3:2 plus stake.");
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

if (blackjackConfig.minBetGold !== 1 || rouletteConfig.minBetRealCentsPlaceholder !== 1 || diceConfig.minBetRealCentsPlaceholder !== 1) {
  throw new Error("Expected table configs to preserve one-cent future placeholder minimums.");
}

if (
  !blackjackInlineUxMarkers.inlineInsurance ||
  !blackjackInlineUxMarkers.inlineEvenMoney ||
  !blackjackInlineUxMarkers.chipStack ||
  !blackjackInlineUxMarkers.cssChips ||
  !blackjackInlineUxMarkers.compactTable ||
  !blackjackInlineUxMarkers.fixedMobileActions ||
  !blackjackInlineUxMarkers.integratedHeader
) {
  throw new Error("Expected blackjack mobile UX markers for inline offers, CSS chips, compact table, and fixed actions.");
}

console.log("tableGames.devtest passed");
