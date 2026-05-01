import { updateData } from "../lib/storage";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { CasinoData, User } from "../types";
import { blackjackConfig, crashConfig, diceConfig, rouletteConfig, treasureDigConfig } from "./configs";
import {
  acceptEvenMoneyBlackjack,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  createShoe,
  doubleDownBlackjack,
  hitBlackjack,
  handValue,
  resolveInsuranceBlackjack,
  splitBlackjack,
  startBlackjackRound,
  standBlackjack,
  visibleDealerValue,
} from "./blackjackEngine";
import { americanWheel, getRouletteInsideChipPosition, getRouletteWinningZones, resolveRouletteBet, resolveRouletteBets, rouletteBetKey } from "./rouletteEngine";
import { getDiceReturnMultiplier, resolveDiceBet } from "./diceEngine";
import { cashOutCrashRound, crashCrashRound, generateCrashPoint, getCrashMultiplier, startCrashRound } from "./crashEngine";
import { cashOutTreasureDigRound, createTreasureMultiplierTiles, createTreasureTrapIndexes, getTreasureDigMultiplier, getTreasurePotentialMaxMultiplier, pickTreasureTile, startTreasureDigRound } from "./treasureDigEngine";
import { assertTableBet } from "./ledger";
import { simulateTableGame } from "./tableMath";
import type { PlayingCard } from "./types";
import { blackjackCleanUxMarkers } from "./BlackjackPageClean";
import { rouletteUiMarkers } from "./RoulettePage";
import { overUnderUiMarkers } from "./DicePage";
import { crashUiMarkers } from "./CrashPage";
import { treasureDigUiMarkers } from "./TreasureDigPage";
import { CoinBurst, GameResultBanner, WinOverlay, feedbackUiMarkers } from "../feedback/components";
import {
  getFeedbackDebugCount,
  isSoundEnabled,
  playBet,
  playBigWin,
  playBlackjackWin,
  playBonus,
  playCrashCashOut,
  playCrashSound,
  playCrashTick,
  playCardDeal,
  playCardFlip,
  playChip,
  playClick,
  playDeal,
  playError,
  playLose,
  playPush,
  playSpin,
  playWin,
  resetFeedbackDebugCounts,
  setSoundEnabled,
} from "../feedback/feedbackService";

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

setSoundEnabled(true);
if (!isSoundEnabled() || localStorage.getItem("casino-feedback-sound-enabled") !== "true") {
  throw new Error("Expected sound toggle setting to persist.");
}
setSoundEnabled(false);
for (const feedback of [playClick, playBet, playDeal, playCardDeal, playCardFlip, playChip, playSpin, playWin, playBlackjackWin, playBigWin, playLose, playPush, playBonus, playCrashCashOut, playCrashSound, playCrashTick, playError]) {
  feedback();
}
resetFeedbackDebugCounts();
playCardDeal();
if (getFeedbackDebugCount("playCardDeal") !== 1) {
  throw new Error("Expected card deal feedback trigger to call playCardDeal.");
}
playCardFlip();
if (getFeedbackDebugCount("playCardFlip") !== 1) {
  throw new Error("Expected dealer flip feedback trigger to call playCardFlip.");
}
let audioContextCreations = 0;
(globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext = class {
  constructor() {
    audioContextCreations += 1;
  }
} as unknown as typeof AudioContext;
setSoundEnabled(false);
playCardDeal();
if (audioContextCreations !== 0) {
  throw new Error("Expected disabled sound toggle to prevent AudioContext creation.");
}
(globalThis as typeof globalThis & { AudioContext?: unknown }).AudioContext = class {
  constructor() {
    throw new Error("Audio unavailable");
  }
} as unknown as typeof AudioContext;
setSoundEnabled(true);
playCardDeal();
playCardFlip();
setSoundEnabled(false);
const bannerMarkup = renderToStaticMarkup(createElement(GameResultBanner, { tone: "win", title: "Win", amount: 125, message: "Paid" }));
if (!bannerMarkup.includes("game-result-banner") || !bannerMarkup.includes("Win")) {
  throw new Error("Expected shared win result banner to render.");
}
const overlayMarkup = renderToStaticMarkup(createElement(WinOverlay, { show: true, title: "Big Win", amount: 500, big: true }));
if (!overlayMarkup.includes("win-overlay") || !overlayMarkup.includes("coin-burst-shared")) {
  throw new Error("Expected shared win overlay to render with coin burst.");
}
const coinMarkup = renderToStaticMarkup(createElement(CoinBurst, { count: 4 }));
if (!coinMarkup.includes("coin-burst-shared")) {
  throw new Error("Expected shared coin burst to render.");
}

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

if (createShoe().length !== 416) throw new Error("Expected blackjack to use an 8-deck shoe by default.");
const dealerNaturalTenUp = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("10"), card("9"), card("K"), card("A")],
});
if (dealerNaturalTenUp.status !== "RESOLVED" || !dealerNaturalTenUp.dealerRevealed || dealerNaturalTenUp.result?.result !== "LOSS") {
  throw new Error("Expected dealer blackjack with 10-value upcard to auto reveal and resolve.");
}
const dealerNaturalPush = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("A"), card("K"), card("10"), card("A")],
});
if (dealerNaturalPush.result?.result !== "PUSH") {
  throw new Error("Expected dealer blackjack against player blackjack to push.");
}

const doubleBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length;
const doubleRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("5"), card("6"), card("9"), card("7"), card("10"), card("6")],
});
const doubledRound = doubleDownBlackjack(doubleRound, user.id);
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length !== doubleBefore + 2) {
  throw new Error("Expected double down to create second TABLE_BET.");
}
if (doubledRound.playerHands[0].cards.length !== 3 || !doubledRound.playerHands[0].doubled) {
  throw new Error("Expected double to give exactly one card.");
}
const lowDoubleUser = "low-double-user";
creditCurrency({ userId: lowDoubleUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100 });
const lowDoubleRound = startBlackjackRound({
  userId: lowDoubleUser,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("5"), card("6"), card("9"), card("7"), card("10"), card("6")],
});
if (canDoubleBlackjack(lowDoubleRound, lowDoubleUser)) throw new Error("Expected double to be blocked when balance cannot cover extra bet.");

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
const splitFirstStand = standBlackjack(split, user.id);
if (splitFirstStand.status !== "PLAYER_TURN" || splitFirstStand.activeHandIndex !== 1 || splitFirstStand.dealerRevealed) {
  throw new Error("Expected split play to advance active hand before dealer resolves.");
}
if (splitResolved.playerHands[0].result === splitResolved.playerHands[1].result) {
  throw new Error("Expected split hands to keep independent result objects.");
}

const nonPairRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("8"), card("9"), card("6"), card("10"), card("3"), card("2")],
});
if (canSplitBlackjack(nonPairRound, user.id)) throw new Error("Expected split to require matching ranks.");

const tenValueSplitRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("K"), card("Q"), card("6"), card("10"), card("3"), card("2")],
});
if (!canSplitBlackjack(tenValueSplitRound, user.id)) throw new Error("Expected same-value 10/J/Q/K split to be allowed.");

const doubleAfterSplitRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("8"), card("8"), card("6"), card("10"), card("3"), card("2"), card("9"), card("7")],
});
const doubleAfterSplit = splitBlackjack(doubleAfterSplitRound, user.id);
if (!canDoubleBlackjack(doubleAfterSplit, user.id)) throw new Error("Expected double to be available on a fresh split hand.");
const doubledSplit = doubleDownBlackjack(doubleAfterSplit, user.id);
if (!doubledSplit.playerHands[0].doubled || doubledSplit.playerHands[0].cards.length !== 3 || doubledSplit.playerHands[0].status !== "STOOD") {
  throw new Error("Expected double after split to draw one card and auto-stand that hand.");
}

const tripleSplitRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: Array.from({ length: 40 }, () => card("8")),
});
let resplitRound = tripleSplitRound;
for (let index = 1; index < blackjackConfig.maxSplitHands; index += 1) {
  if (!canSplitBlackjack(resplitRound, user.id)) throw new Error("Expected resplit to be allowed before maxSplitHands.");
  resplitRound = splitBlackjack(resplitRound, user.id);
}
if (resplitRound.playerHands.length !== blackjackConfig.maxSplitHands || canSplitBlackjack(resplitRound, user.id)) {
  throw new Error("Expected resplit to stop at maxSplitHands.");
}

const lowSplitUser = "low-split-user";
creditCurrency({ userId: lowSplitUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100 });
const lowSplitRound = startBlackjackRound({
  userId: lowSplitUser,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("8"), card("8"), card("6"), card("10"), card("3"), card("2")],
});
if (canSplitBlackjack(lowSplitRound, lowSplitUser)) throw new Error("Expected split to be blocked when balance cannot cover second hand.");

const insuranceRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("10"), card("8"), card("A"), card("9")],
});
if (!canOfferInsurance(insuranceRound)) throw new Error("Expected insurance offer on dealer Ace.");
const insured = resolveInsuranceBlackjack(insuranceRound, user.id, true);
if (insured.insuranceResult?.result !== "LOSS") {
  throw new Error("Expected insurance to lose when dealer does not have blackjack.");
}
const insuranceWinRound = {
  ...insuranceRound,
  dealerCards: [card("A"), card("K")],
  insuranceResolved: false,
};
const insuredWin = resolveInsuranceBlackjack(insuranceWinRound, user.id, true);
if (insuredWin.insuranceResult?.result !== "WIN" || insuredWin.insuranceResult.amountPaid !== 150) {
  throw new Error("Expected insurance to pay 2:1 plus insurance stake on dealer blackjack.");
}
const noInsuranceRound = startBlackjackRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("10"), card("8"), card("9"), card("K")],
});
if (canOfferInsurance(noInsuranceRound)) throw new Error("Expected insurance to require dealer Ace upcard.");

const lowInsuranceUser = "low-insurance-user";
creditCurrency({ userId: lowInsuranceUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100 });
const lowInsuranceRound = startBlackjackRound({
  userId: lowInsuranceUser,
  currency: "GOLD",
  betAmount: 100,
  deck: [card("10"), card("8"), card("A"), card("9")],
});
if (canOfferInsurance(lowInsuranceRound, blackjackConfig, lowInsuranceUser)) {
  throw new Error("Expected insurance offer to hide when half-bet cannot be covered.");
}
try {
  resolveInsuranceBlackjack(lowInsuranceRound, lowInsuranceUser, true);
  throw new Error("Expected insurance ledger debit to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
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
if (canOfferEvenMoney(noInsuranceRound)) throw new Error("Expected even money to require player blackjack against dealer Ace.");

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
const rouletteOdd = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "parity", value: "odd" }, outcome: 17 });
if (rouletteOdd.totalPaid !== 200) throw new Error("Expected odd roulette payout to include stake plus 1:1.");
const rouletteEvenZero = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "parity", value: "even" }, outcome: "0" });
if (rouletteEvenZero.won) throw new Error("Expected 0 to lose even outside bets.");
const rouletteHighDoubleZero = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "range", value: "high" }, outcome: "00" });
if (rouletteHighDoubleZero.won) throw new Error("Expected 00 to lose high outside bets.");
const rouletteLow = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "range", value: "low" }, outcome: 12 });
if (rouletteLow.totalPaid !== 200) throw new Error("Expected low roulette payout.");
const rouletteDozen = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "dozen", value: 2 }, outcome: 17 });
if (rouletteDozen.totalPaid !== 300) throw new Error("Expected dozen roulette payout.");
const rouletteColumn = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "column", value: 2 }, outcome: 17 });
if (rouletteColumn.totalPaid !== 300) throw new Error("Expected column roulette payout.");
const rouletteSplit = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "split", numbers: [17, 20] }, outcome: 17 });
if (rouletteSplit.totalPaid !== 1800) throw new Error("Expected split roulette payout.");
const rouletteZeroSplit = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "split", numbers: ["0", "00"] }, outcome: "00" });
if (rouletteZeroSplit.totalPaid !== 1800) throw new Error("Expected 0/00 split roulette payout.");
const rouletteStreet = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "street", numbers: [16, 17, 18] }, outcome: 17 });
if (rouletteStreet.totalPaid !== 1200) throw new Error("Expected street roulette payout.");
const rouletteCorner = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "corner", numbers: [16, 17, 19, 20] }, outcome: 17 });
if (rouletteCorner.totalPaid !== 900) throw new Error("Expected corner roulette payout.");
const rouletteSixLine = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "sixLine", numbers: [13, 14, 15, 16, 17, 18] }, outcome: 17 });
if (rouletteSixLine.totalPaid !== 600) throw new Error("Expected six-line roulette payout.");
const sixLinePosition = getRouletteInsideChipPosition({ kind: "sixLine", numbers: [13, 14, 15, 16, 17, 18] });
if (!sixLinePosition || sixLinePosition.top < 100 || sixLinePosition.coveredNumbers.length !== 6) {
  throw new Error("Expected six-line chip position to sit on the outside street border and cover six numbers.");
}
const rouletteBasket = resolveRouletteBet({ userId: user.id, currency: "GOLD", betAmount: 100, bet: { kind: "basket", numbers: ["0", "00", 1, 2, 3] }, outcome: "00" });
if (rouletteBasket.totalPaid !== 700) throw new Error("Expected American basket/top-line roulette payout.");
const expectedAmericanWheelStart = ["0", 28, 9, 26, 30, 11, 7, 20];
if (JSON.stringify(americanWheel.slice(0, expectedAmericanWheelStart.length)) !== JSON.stringify(expectedAmericanWheelStart) || americanWheel.length !== 38) {
  throw new Error("Expected American roulette wheel sequence with 0, 00, and 36 numbered pockets.");
}
const winningZoneKeys = new Set(getRouletteWinningZones(18).map(rouletteBetKey));
for (const key of ["straight:18", "color:red", "parity:even", "range:low", "dozen:2", "column:3"]) {
  if (!winningZoneKeys.has(key)) throw new Error(`Expected winning zones to include ${key}.`);
}

const betCountBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length;
const multiRoulette = resolveRouletteBets({
  userId: user.id,
  currency: "GOLD",
  outcome: 1,
  bets: [
    { id: "red", amount: 100, label: "Red", bet: { kind: "color", value: "red" } },
    { id: "straight1", amount: 100, label: "Straight 1", bet: { kind: "straight", value: 1 } },
  ],
});
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length !== betCountBefore + 1) {
  throw new Error("Expected roulette spin to debit total active bets once.");
}
if (multiRoulette.totalPaid !== 3800 || multiRoulette.net !== 3600 || multiRoulette.winningBetIds?.length !== 2) {
  throw new Error("Expected multi-bet roulette payout summary.");
}
try {
  resolveRouletteBets({
    userId: user.id,
    currency: "GOLD",
    outcome: 17,
    bets: [{ id: "too-high", amount: rouletteConfig.maxTotalBetGold + 1, label: "Too High", bet: { kind: "straight", value: 17 } }],
  });
  throw new Error("Expected roulette max total bet enforcement.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum total roulette bet")) throw error;
}

if (diceConfig.name !== "Over/Under" || diceConfig.theme.toLowerCase().includes("dice")) {
  throw new Error("Expected Dice table config to display as Over/Under.");
}

const diceMultiplier = getDiceReturnMultiplier("over", 50, diceConfig);
const diceBetCountBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length;
const diceWinCountBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_WIN").length;
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
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length !== diceBetCountBefore + 1) {
  throw new Error("Expected Over/Under roll to debit TABLE_BET.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_WIN").length !== diceWinCountBefore + 1) {
  throw new Error("Expected Over/Under win to credit TABLE_WIN.");
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
const lowOverUnderUser = "low-over-under-user";
creditCurrency({ userId: lowOverUnderUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: diceConfig.minBet - 1 });
try {
  resolveDiceBet({
    userId: lowOverUnderUser,
    currency: "GOLD",
    betAmount: diceConfig.minBet,
    direction: "over",
    target: 50,
    roll: 80,
  });
  throw new Error("Expected Over/Under roll to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
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

for (const gameId of ["blackjack", "roulette", "dice", "crash", "treasureDig"] as const) {
  const sim = simulateTableGame(gameId, 1000);
  if (!Number.isFinite(sim.observedRtp) || !Number.isFinite(sim.houseEdge)) {
    throw new Error(`Expected ${gameId} simulation to produce math stats.`);
  }
}

if (blackjackConfig.minBetGold !== 1 || rouletteConfig.minBetRealCentsPlaceholder !== 1 || diceConfig.minBetRealCentsPlaceholder !== 1 || crashConfig.minBetRealCentsPlaceholder !== 1 || treasureDigConfig.minBetRealCentsPlaceholder !== 1) {
  throw new Error("Expected table configs to preserve one-cent future placeholder minimums.");
}

if (
  !blackjackCleanUxMarkers.cleanPage ||
  !blackjackCleanUxMarkers.noChipSystem ||
  !blackjackCleanUxMarkers.numericBetControls ||
  !blackjackCleanUxMarkers.inlineInsurance ||
  !blackjackCleanUxMarkers.hiddenDealerCard ||
  !blackjackCleanUxMarkers.centeredMobileLayout ||
  !blackjackCleanUxMarkers.cardDealAnimation ||
  !blackjackCleanUxMarkers.dealerFlipAnimation ||
  !blackjackCleanUxMarkers.animationBlocksActions ||
  !blackjackCleanUxMarkers.compactSplitLayout ||
  !blackjackCleanUxMarkers.sharedResultBanner ||
  !blackjackCleanUxMarkers.sharedSoundToggle ||
  !blackjackCleanUxMarkers.cardDealSound ||
  !blackjackCleanUxMarkers.dealerFlipSound ||
  !blackjackCleanUxMarkers.chipSound
) {
  throw new Error("Expected clean blackjack UI markers for centered layout, animated cards, numeric betting, inline offers, hidden dealer card, and no chip system.");
}

if (
  !rouletteUiMarkers.americanBoard ||
  !rouletteUiMarkers.multipleActiveBets ||
  !rouletteUiMarkers.cssChips ||
  !rouletteUiMarkers.animatedWheel ||
  !rouletteUiMarkers.advancedInsideBets ||
  !rouletteUiMarkers.landscapeTable ||
  !rouletteUiMarkers.compactChipRow ||
  !rouletteUiMarkers.insideHelperRowRemoved ||
  !rouletteUiMarkers.zeroDoubleZeroBalanced ||
  !rouletteUiMarkers.doubleBetsAction ||
  !rouletteUiMarkers.sequencedAmericanWheel ||
  !rouletteUiMarkers.sharedResultBanner ||
  !rouletteUiMarkers.sharedSoundToggle ||
  !rouletteUiMarkers.winningBetGlow
) {
  throw new Error("Expected Roulette UI markers for American board, CSS chips, multi-bet slip, wheel animation, and advanced inside bets.");
}

if (
  overUnderUiMarkers.gameName !== "Over/Under" ||
  !overUnderUiMarkers.blackjackStyleHeader ||
  !overUnderUiMarkers.noBottomCurrencyDropdown ||
  !overUnderUiMarkers.compactBottomBetControls ||
  !overUnderUiMarkers.targetSlider ||
  !overUnderUiMarkers.possibleReturn ||
  !overUnderUiMarkers.resultAnimation ||
  !overUnderUiMarkers.mobileOneScreenLayout ||
  !overUnderUiMarkers.manualBetInput ||
  !overUnderUiMarkers.lastFiveResults ||
  !overUnderUiMarkers.sharedResultBanner ||
  !overUnderUiMarkers.sharedSoundToggle ||
  !overUnderUiMarkers.rollingNumberFlip
) {
  throw new Error("Expected Over/Under UI markers for header, currency toggle, compact betting, manual input, last five, payout, animation, and mobile layout.");
}

const crashLow = generateCrashPoint(0, crashConfig);
const crashMid = generateCrashPoint(0.52, crashConfig);
const crashHigh = generateCrashPoint(0.98, crashConfig);
if (crashLow !== 1 || crashMid <= 1 || crashHigh <= crashMid || crashHigh > crashConfig.maxCrashPoint) {
  throw new Error("Expected Crash exponential distribution to produce bounded increasing crash points.");
}
if (getCrashMultiplier(0) !== 1 || getCrashMultiplier(6000) <= getCrashMultiplier(1000)) {
  throw new Error("Expected Crash multiplier to rise over time.");
}

const crashBetCountBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length;
const crashWinCountBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_WIN").length;
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const crashGoldBefore = getBalance(user.id, "GOLD");
const crashRound = startCrashRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  crashPoint: 3,
  now: 1000,
});
if (getBalance(user.id, "GOLD") !== crashGoldBefore - 100) {
  throw new Error("Expected Crash start to deduct bet from balance.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length !== crashBetCountBefore + 1) {
  throw new Error("Expected Crash start to create TABLE_BET.");
}
const crashCashOut = cashOutCrashRound({ round: crashRound, userId: user.id, multiplier: 2.5, now: 2400 });
if (crashCashOut.status !== "CASHED_OUT" || crashCashOut.totalPaid !== 250) {
  throw new Error("Expected Crash cash out before crash to pay bet times multiplier.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_WIN").length !== crashWinCountBefore + 1) {
  throw new Error("Expected Crash cash out to create TABLE_WIN.");
}
const crashLossRound = startCrashRound({
  userId: user.id,
  currency: "BONUS",
  betAmount: 100,
  crashPoint: 1.5,
  now: 3000,
});
const crashLoss = crashCrashRound({ round: crashLossRound, userId: user.id, multiplier: 1.5, now: 3600 });
if (crashLoss.status !== "CRASHED" || crashLoss.totalPaid !== 0 || !getTransactions(user.id).some((tx) => tx.type === "TABLE_LOSS" && tx.metadata?.tableGameId === "crash")) {
  throw new Error("Expected Crash before cash out to lose with no payout.");
}
const crashTooLateRound = startCrashRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  crashPoint: 2,
  now: 4000,
});
const crashTooLate = cashOutCrashRound({ round: crashTooLateRound, userId: user.id, multiplier: 2.01, now: 4800 });
if (crashTooLate.status !== "CRASHED" || crashTooLate.totalPaid !== 0) {
  throw new Error("Expected late Crash cash out to resolve as a crash loss.");
}
const lowCrashUser = "low-crash-user";
creditCurrency({ userId: lowCrashUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: crashConfig.minBet - 1 });
try {
  startCrashRound({ userId: lowCrashUser, currency: "GOLD", betAmount: crashConfig.minBet, crashPoint: 2 });
  throw new Error("Expected Crash start to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}

if (
  crashUiMarkers.gameName !== "Crash" ||
  !crashUiMarkers.goldBonusToggle ||
  !crashUiMarkers.liveMultiplier ||
  !crashUiMarkers.risingGraph ||
  !crashUiMarkers.multiplierPopThresholds ||
  !crashUiMarkers.crashShakeFlash ||
  !crashUiMarkers.cashOutAnytime ||
  !crashUiMarkers.lastFiveResults ||
  !crashUiMarkers.sharedResultBanner ||
  !crashUiMarkers.sharedSoundToggle ||
  !crashUiMarkers.compactBottomBetControls
) {
  throw new Error("Expected Crash UI markers for multiplier, graph, cash out, crash feedback, sound, currency, and compact betting.");
}

const treasureMultiplierOne = getTreasureDigMultiplier({ safePicks: 1, trapCount: 3 });
const treasureMultiplierTwo = getTreasureDigMultiplier({ safePicks: 2, trapCount: 3 });
if (treasureMultiplierOne !== 1 || treasureMultiplierTwo <= treasureMultiplierOne) {
  throw new Error("Expected Treasure Dig multiplier curve to rise using probability and house edge.");
}
const treasureSurvivalTwo = (22 / 25) * (21 / 24);
if (treasureSurvivalTwo * treasureMultiplierTwo > 0.85) {
  throw new Error("Expected Treasure Dig base multiplier math to leave room for rare boost tile RTP.");
}
const deterministicTraps = createTreasureTrapIndexes({ trapCount: 3, random: () => 0, config: treasureDigConfig });
if (deterministicTraps.length !== 3 || new Set(deterministicTraps).size !== 3) {
  throw new Error("Expected Treasure Dig trap generation to create unique trap tiles.");
}
const deterministicBoosts = createTreasureMultiplierTiles({ trapIndexes: [0, 1, 2], random: () => 0.99, config: treasureDigConfig });
if (deterministicBoosts.length !== 1 || deterministicBoosts.some((tile) => [0, 1, 2].includes(tile.index))) {
  throw new Error("Expected Treasure Dig multiplier tiles to be safe, variable boost tiles.");
}
if (treasureDigConfig.minBet !== 1 || treasureDigConfig.maxTraps !== 24) {
  throw new Error("Expected Treasure Dig to allow 1 coin bets and 1-24 traps.");
}
const oneTrapMax = getTreasurePotentialMaxMultiplier({ trapCount: 1 });
const twentyFourTrapMax = getTreasurePotentialMaxMultiplier({ trapCount: 24 });
if (oneTrapMax !== twentyFourTrapMax) {
  throw new Error("Expected Treasure Dig max base win to match between 1 trap full-clear and 24 traps one-pick.");
}
if (getTreasurePotentialMaxMultiplier({ trapCount: 16 }) > oneTrapMax) {
  throw new Error("Expected Treasure Dig displayed max win to stay on the base mine curve, not stacked boost jackpots.");
}
if (getTreasureDigMultiplier({ safePicks: 1, trapCount: 24 }) === getTreasureDigMultiplier({ safePicks: 1, trapCount: 4 })) {
  throw new Error("Expected Treasure Dig 1-24 trap settings to use different payout curves.");
}

creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const treasureBetCountBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length;
const treasureWinCountBefore = getTransactions(user.id).filter((tx) => tx.type === "TABLE_WIN").length;
const treasureGoldBefore = getBalance(user.id, "GOLD");
const treasureRound = startTreasureDigRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  trapCount: 3,
  trapIndexes: [0, 1, 2],
  multiplierTiles: [{ index: 4, value: 5 }],
});
if (getBalance(user.id, "GOLD") !== treasureGoldBefore - 100) {
  throw new Error("Expected Treasure Dig start to deduct bet from balance.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_BET").length !== treasureBetCountBefore + 1) {
  throw new Error("Expected Treasure Dig start to create TABLE_BET.");
}
const treasureSafeOne = pickTreasureTile({ round: treasureRound, userId: user.id, tileIndex: 3 });
const treasureSafeTwo = pickTreasureTile({ round: treasureSafeOne, userId: user.id, tileIndex: 4 });
if (treasureSafeTwo.status !== "RUNNING" || treasureSafeTwo.currentMultiplier <= treasureSafeOne.currentMultiplier || treasureSafeTwo.boostMultiplier !== 5) {
  throw new Error("Expected Treasure Dig safe picks and boost tiles to increase multiplier.");
}
const treasureCashOut = cashOutTreasureDigRound({ round: treasureSafeTwo, userId: user.id });
if (treasureCashOut.status !== "CASHED_OUT" || treasureCashOut.totalPaid !== Math.round(100 * treasureSafeTwo.currentMultiplier)) {
  throw new Error("Expected Treasure Dig cash out to pay bet times multiplier.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "TABLE_WIN").length !== treasureWinCountBefore + 1) {
  throw new Error("Expected Treasure Dig cash out to create TABLE_WIN.");
}
let oneTrapSixPickRound = startTreasureDigRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  trapCount: 1,
  trapIndexes: [24],
  multiplierTiles: [],
});
for (const tileIndex of [0, 1, 2, 3, 4, 5]) {
  oneTrapSixPickRound = pickTreasureTile({ round: oneTrapSixPickRound, userId: user.id, tileIndex });
}
const oneTrapSixPickCashOut = cashOutTreasureDigRound({ round: oneTrapSixPickRound, userId: user.id });
if ((oneTrapSixPickCashOut.totalPaid ?? 0) <= 100 || oneTrapSixPickRound.currentMultiplier <= 1) {
  throw new Error("Expected six safe Treasure Dig picks with one trap to pay above the original bet.");
}
const treasureTrapRound = startTreasureDigRound({
  userId: user.id,
  currency: "BONUS",
  betAmount: 100,
  trapCount: 3,
  trapIndexes: [0, 1, 2],
  multiplierTiles: [{ index: 4, value: 50 }],
});
const treasureLoss = pickTreasureTile({ round: treasureTrapRound, userId: user.id, tileIndex: 0 });
if (treasureLoss.status !== "TRAPPED" || treasureLoss.totalPaid !== 0 || !getTransactions(user.id).some((tx) => tx.type === "TABLE_LOSS" && tx.metadata?.tableGameId === "treasureDig")) {
  throw new Error("Expected Treasure Dig trap to lose bet and create TABLE_LOSS.");
}
const lowTreasureUser = "low-treasure-user";
try {
  startTreasureDigRound({ userId: lowTreasureUser, currency: "GOLD", betAmount: treasureDigConfig.minBet, trapCount: 3, trapIndexes: [0, 1, 2], multiplierTiles: [{ index: 4, value: 2 }] });
  throw new Error("Expected Treasure Dig start to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}
if (
  treasureDigUiMarkers.gameName !== "Treasure Dig" ||
  !treasureDigUiMarkers.goldBonusToggle ||
  !treasureDigUiMarkers.fiveByFiveGrid ||
  !treasureDigUiMarkers.trapCountPicker ||
  !treasureDigUiMarkers.multiplierMathRtpCapped ||
  !treasureDigUiMarkers.tileFlipAnimation ||
  !treasureDigUiMarkers.treasureGlow ||
  !treasureDigUiMarkers.trapExplosionShake ||
  !treasureDigUiMarkers.cashOutAnytime ||
  !treasureDigUiMarkers.possiblePayout ||
  !treasureDigUiMarkers.potentialMaxWin ||
  !treasureDigUiMarkers.variableMultiplierTiles ||
  !treasureDigUiMarkers.sharedSoundToggle ||
  !treasureDigUiMarkers.revealBoardOnFinish ||
  !treasureDigUiMarkers.compactFinishedResult ||
  !treasureDigUiMarkers.compactBottomBetControls
) {
  throw new Error("Expected Treasure Dig UI markers for grid, risk, multiplier, cash out, feedback, and compact betting.");
}

console.log("tableGames.devtest passed");
