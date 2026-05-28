import { updateData } from "../lib/storage";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { CasinoData, User } from "../types";
import { blackjackConfig, crashConfig, diceConfig, emberStackTableConfig, lavaRunTableConfig, rouletteConfig, tableGameConfigs, treasureDigConfig } from "./configs";
import {
  acceptEvenMoneyBlackjack,
  canDoubleBlackjack,
  canOfferEvenMoney,
  canOfferInsurance,
  canSplitBlackjack,
  createShoe,
  declineEvenMoneyBlackjack,
  doubleDownBlackjack,
  getBlackjackBetLimits,
  hitBlackjack,
  handValue,
  resolveInsuranceBlackjack,
  splitBlackjack,
  startBlackjackRound,
  standBlackjack,
  visibleDealerValue,
} from "./blackjackEngine";
import {
  blackjackActionsDisabled,
  blackjackAnimationConfig,
  dealerDisplayTotal,
  dealerRevealAnimationMs,
  hitAnimationMs,
  initialDealAnimationMs,
  initialDealSequence,
} from "./blackjackAnimations";
import { americanWheel, getRouletteInsideChipPosition, getRouletteWinningZones, resolveRouletteBet, resolveRouletteBets, rouletteBetKey } from "./rouletteEngine";
import { getDiceChance, getDiceReturnMultiplier, resolveDiceBet } from "./diceEngine";
import { cashOutCrashRound, crashCrashRound, generateCrashPoint, getCrashMultiplier, startCrashRound } from "./crashEngine";
import { cashOutTreasureDigRound, createTreasureMultiplierTiles, createTreasureTrapIndexes, getTreasureDigMultiplier, getTreasurePotentialMaxMultiplier, pickTreasureTile, startTreasureDigRound } from "./treasureDigEngine";
import { applyBrickBreakStep, brickBreakBonusConfig, createBrickBreakHitList, createBrickBreakReplaySteps, createBrickBreakShowcases, generateBrickBreakResult, getBrickBreakBetLimits, isBrickExposed, pickBrickBreakOutcome, simulateBrickBreakBonus } from "./brickBreakBonusEngine";
import { getBalloonPopBetLimits } from "./balloonPopEngine";
import { cashOutLavaRunRound, createLavaRunBoard, getLavaRunBetLimits, getLavaRunCashoutEvByStep, getLavaRunFairMultiplier, getLavaRunMultiplierCurve, getLavaRunStepCapMultiplier, getLavaRunTheoreticalRtp, lavaRunConfig, pickLavaRunTile, simulateLavaRun, simulateLavaRunStrategy, startLavaRunRound, type LavaRunRisk } from "./lavaRunEngine";
import { attemptEmberStackCpuStack, canCashOutEmberStackRound, cashOutEmberStackRound, continueEmberStackRound, emberStackConfig, emberStackRiskOrder, getEmberStackBaseMultiplier, getEmberStackBetLimits, getEmberStackCameraOffset, getEmberStackCashoutAmount, getEmberStackCpuSuccessChance, getEmberStackCycleMs, getEmberStackMaxWinMultiplier, getEmberStackNextMultiplier, getEmberStackPlatformX, getEmberStackSpeedForLevel, pickEmberStackCpuOutcome, simulateEmberStack, startEmberStackRound, type EmberStackSimulationStrategy } from "./emberStackEngine";
import { assertTableBet } from "./ledger";
import { simulateTableGame } from "./tableMath";
import type { PlayingCard } from "./types";
import { blackjackCleanUxMarkers } from "./BlackjackPageClean";
import {
  ChipSelector,
  ChipStack,
  CurrentBetsSummary,
  RouletteLastFiveNumbers,
  RouletteWheel,
  getBetAnchor,
  getNextRouletteHistory,
  getRouletteBoardBetsForLifecycle,
  getRouletteLastWinAmount,
  getRouletteResultOverlayCopy,
  getRouletteWheelMotion,
  getRouletteWheelPocketIndex,
  getRouletteWheelTargetRotation,
  isRouletteInteractionLocked,
  rouletteResultTiming,
  rouletteSpinLifecycleStates,
  rouletteUiMarkers,
  shouldShowRouletteBetFlash,
  shouldShowRouletteResultOverlay,
  shouldShowRouletteSettledBets,
  shouldShowRouletteWinningZones,
} from "./RoulettePage";
import { overUnderUiMarkers } from "./DicePage";
import { crashUiMarkers } from "./CrashPage";
import { treasureDigUiMarkers } from "./TreasureDigPage";
import { brickBreakBonusUiMarkers } from "./BrickBreakBonusPage";
import { formatLavaRunMultiplier, getLavaRunAvatarTarget, getLavaRunCameraWindow, getLavaRunMultiplierTier, getLavaRunPlatformVisual, getLavaRunVisualIntensity, isLavaRunPlatformClickable, lavaRunAnimationTimings, lavaRunUiMarkers, shouldRevealLavaRunBoardState } from "./LavaRunPage";
import { emberStackAnimationTimings, emberStackAssetManifest, emberStackUiMarkers, formatEmberStackMultiplier, getEmberStackBoardHudRows, getEmberStackBoardMood, getEmberStackCutLineStyle, getEmberStackCutStyle, getEmberStackMultiplierMilestone, getEmberStackOutcomeVisualState, getEmberStackParticleStyle, getEmberStackPlatformClass, getEmberStackPlatformStyle, getEmberStackPlatformTier, getEmberStackQualityCopy, getEmberStackRoundStatusCopy, getEmberStackRowMarkerStyle } from "./EmberStackPage";
import { sortTableGames, tableGameSortOptions } from "./TableGamesPage";
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
  playEmberStackBust,
  playEmberStackCashout,
  playEmberStackCombo,
  playEmberStackCut,
  playEmberStackFall,
  playEmberStackMove,
  playEmberStackLock,
  playEmberStackMultiplier,
  playEmberStackPerfect,
  playLavaRunBigWin,
  playLavaRunBust,
  playLavaRunCashout,
  playLavaRunMultiplier,
  playLavaRunSafe,
  playLavaRunSelect,
  playLavaRunStart,
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
for (const feedback of [playClick, playBet, playDeal, playCardDeal, playCardFlip, playChip, playSpin, playWin, playBlackjackWin, playBigWin, playLose, playPush, playBonus, playCrashCashOut, playCrashSound, playCrashTick, playEmberStackMove, playEmberStackLock, playEmberStackCut, playEmberStackFall, playEmberStackPerfect, playEmberStackCombo, playEmberStackMultiplier, playEmberStackCashout, playEmberStackBust, playLavaRunStart, playLavaRunSelect, playLavaRunSafe, playLavaRunBust, playLavaRunMultiplier, playLavaRunCashout, playLavaRunBigWin, playError]) {
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

function bjDeck(player: [PlayingCard, PlayingCard], dealer: [PlayingCard, PlayingCard], draws: PlayingCard[] = []) {
  return [player[0], player[1], dealer[0], dealer[1], ...draws];
}

function deterministicBlackjackConfig(overrides: Partial<typeof blackjackConfig> = {}) {
  return { ...blackjackConfig, dealerAdvantageAssistRate: 0, ...overrides };
}

function seedBlackjackUser(userId: string, balances: { GOLD?: number; BONUS?: number }) {
  updateData((data) => {
    data.users.push({
      ...user,
      id: userId,
      email: `${userId}@test.local`,
      username: userId,
    });
    data.walletBalances[userId] = {
      GOLD: balances.GOLD ?? 0,
      BONUS: balances.BONUS ?? 0,
    };
  });
}

function blackjackTransactions(userId: string, type?: "TABLE_BET" | "TABLE_WIN" | "TABLE_PUSH" | "TABLE_LOSS" | "TABLE_REFUND") {
  const transactions = getTransactions(userId);
  return type ? transactions.filter((transaction) => transaction.type === type) : transactions;
}

const blackjackGoldLimits = getBlackjackBetLimits("GOLD");
const blackjackSweepstakesLimits = getBlackjackBetLimits("BONUS");
if (
  blackjackGoldLimits.minBet !== 1 ||
  blackjackGoldLimits.maxBet !== 1000000 ||
  blackjackSweepstakesLimits.minBet !== 0.01 ||
  blackjackSweepstakesLimits.maxBet !== 200
) {
  throw new Error("Expected Blackjack initial bet limits to be GC 1-1,000,000 and SC 0.01-200.");
}

const blackjackLimitConfig = deterministicBlackjackConfig();
seedBlackjackUser("bj-limit-user", { GOLD: 3000000, BONUS: 500 });
try {
  startBlackjackRound({ userId: "bj-limit-user", currency: "GOLD", betAmount: 0.5, deck: bjDeck([card("10"), card("8")], [card("9"), card("7")]), config: blackjackLimitConfig });
  throw new Error("Expected GC deal below min to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Minimum GC bet")) throw error;
}
try {
  startBlackjackRound({ userId: "bj-limit-user", currency: "GOLD", betAmount: 1000001, deck: bjDeck([card("10"), card("8")], [card("9"), card("7")]), config: blackjackLimitConfig });
  throw new Error("Expected GC deal above max to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum GC bet")) throw error;
}
try {
  startBlackjackRound({ userId: "bj-limit-user", currency: "BONUS", betAmount: 0.009, deck: bjDeck([card("10"), card("8")], [card("9"), card("7")]), config: blackjackLimitConfig });
  throw new Error("Expected SC deal below min to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Minimum SC bet")) throw error;
}
try {
  startBlackjackRound({ userId: "bj-limit-user", currency: "BONUS", betAmount: 201, deck: bjDeck([card("10"), card("8")], [card("9"), card("7")]), config: blackjackLimitConfig });
  throw new Error("Expected SC deal above max to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum SC bet")) throw error;
}
try {
  startBlackjackRound({ userId: "bj-empty-user", currency: "GOLD", betAmount: 1, deck: bjDeck([card("10"), card("8")], [card("9"), card("7")]), config: blackjackLimitConfig });
  throw new Error("Expected deal to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}
const maxBetRound = startBlackjackRound({
  userId: "bj-limit-user",
  currency: "GOLD",
  betAmount: blackjackGoldLimits.maxBet,
  deck: bjDeck([card("5"), card("6")], [card("9"), card("7")], [card("10"), card("6")]),
  config: blackjackLimitConfig,
});
if (getBalance("bj-limit-user", "GOLD") !== 2000000 || blackjackTransactions("bj-limit-user", "TABLE_BET").filter((tx) => tx.metadata?.action === "deal").length !== 1) {
  throw new Error("Expected max GC deal to debit the initial bet exactly once.");
}
if (!canDoubleBlackjack(maxBetRound, "bj-limit-user", blackjackLimitConfig)) {
  throw new Error("Expected double to remain available on a max initial Blackjack bet when balance covers the extra wager.");
}
const maxBetDouble = doubleDownBlackjack(maxBetRound, "bj-limit-user", blackjackLimitConfig);
if (maxBetDouble.totalBet !== 2000000 || getBalance("bj-limit-user", "GOLD") < 0) {
  throw new Error("Expected max-bet double to add one extra table bet without a negative balance.");
}

seedBlackjackUser("bj-edge-user", { GOLD: 100000, BONUS: 1000 });
const edgeConfig = deterministicBlackjackConfig();
const betOnceBefore = getBalance("bj-edge-user", "GOLD");
const betOnceRound = startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("10"), card("8")], [card("9"), card("7")]), config: edgeConfig });
if (getBalance("bj-edge-user", "GOLD") !== betOnceBefore - 100 || blackjackTransactions("bj-edge-user", "TABLE_BET").filter((tx) => tx.metadata?.action === "deal").length !== 1) {
  throw new Error("Expected initial Blackjack deal to create one bet debit.");
}
const nextRound = startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("9"), card("9")], [card("8"), card("8")]), config: edgeConfig });
if (nextRound.id === betOnceRound.id || nextRound.dealerRevealed || nextRound.playerHands.length !== 1 || nextRound.playerHands[0].cards.length !== 2) {
  throw new Error("Expected a new Blackjack round to reset dealer/player state cleanly.");
}

const fractionalNatural = startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 25, deck: bjDeck([card("A"), card("K")], [card("9"), card("8")]), config: edgeConfig });
if (fractionalNatural.result?.amountPaid !== 62.5 || fractionalNatural.playerHands[0].result?.profit !== 37.5) {
  throw new Error("Expected 3:2 Blackjack payout to preserve fractional half-bet payouts.");
}
const tenUpcardNatural = startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("A"), card("K")], [card("10"), card("6")], [card("10")]), config: edgeConfig });
if (tenUpcardNatural.result?.amountPaid !== 250 || tenUpcardNatural.dealerCards.length !== 2 || !tenUpcardNatural.playerHands[0].result?.transactions.some((tx) => tx.metadata?.blackjack)) {
  throw new Error("Expected natural blackjack to pay 3:2 without drawing dealer cards after a non-blackjack ten upcard.");
}
const scNatural = startBlackjackRound({ userId: "bj-edge-user", currency: "BONUS", betAmount: 0.01, deck: bjDeck([card("A"), card("K")], [card("9"), card("8")]), config: edgeConfig });
if (scNatural.result?.amountPaid !== 0.03 || getBalance("bj-edge-user", "BONUS") <= 999.99) {
  throw new Error("Expected SC Blackjack min-bet payout to preserve cents.");
}

const dealerAceBlackjack = startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("10"), card("8")], [card("A"), card("K")]), config: edgeConfig });
if (dealerAceBlackjack.status !== "PLAYER_TURN" || dealerAceBlackjack.dealerRevealed || !canOfferInsurance(dealerAceBlackjack, edgeConfig, "bj-edge-user")) {
  throw new Error("Expected dealer Ace blackjack to offer insurance before reveal.");
}
const declinedInsurance = resolveInsuranceBlackjack(dealerAceBlackjack, "bj-edge-user", false, edgeConfig);
if (declinedInsurance.status !== "RESOLVED" || declinedInsurance.result?.result !== "LOSS" || !declinedInsurance.dealerRevealed) {
  throw new Error("Expected declining insurance against dealer blackjack to reveal and resolve.");
}
const aceBlackjackPushOffer = startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("A"), card("K")], [card("A"), card("Q")]), config: edgeConfig });
if (!canOfferEvenMoney(aceBlackjackPushOffer, edgeConfig) || aceBlackjackPushOffer.status !== "PLAYER_TURN") {
  throw new Error("Expected player blackjack against dealer Ace to offer even money before reveal.");
}
const declinedEvenMoney = declineEvenMoneyBlackjack(aceBlackjackPushOffer, "bj-edge-user", edgeConfig);
if (declinedEvenMoney.status !== "RESOLVED" || declinedEvenMoney.result?.result !== "PUSH") {
  throw new Error("Expected declining even money against dealer blackjack to resolve as a push.");
}
const acceptedEvenMoneyEdge = acceptEvenMoneyBlackjack(
  startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("A"), card("K")], [card("A"), card("9")]), config: edgeConfig }),
  "bj-edge-user",
  edgeConfig,
);
if (acceptedEvenMoneyEdge.result?.amountPaid !== 200 || acceptedEvenMoneyEdge.status !== "RESOLVED") {
  throw new Error("Expected even money acceptance to pay 1:1 and resolve immediately.");
}

const dealerHitsBelow17 = standBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("10"), card("8")], [card("10"), card("6")], [card("5")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
if (dealerHitsBelow17.dealerCards.length !== 3 || handValue(dealerHitsBelow17.dealerCards).total !== 21) {
  throw new Error("Expected dealer to hit below 17.");
}
const dealerHard17 = standBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("10"), card("8")], [card("10"), card("7")], [card("5")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
if (dealerHard17.dealerCards.length !== 2 || handValue(dealerHard17.dealerCards).total !== 17) {
  throw new Error("Expected dealer to stand on hard 17.");
}
const dealerSoft17Hit = standBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("10"), card("8")], [card("6"), card("A")], [card("2")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
if (dealerSoft17Hit.dealerCards.length !== 3 || handValue(dealerSoft17Hit.dealerCards).total !== 19) {
  throw new Error("Expected dealer to hit soft 17 when configured.");
}
const dealerSoft17Stand = standBlackjack(startBlackjackRound({
  userId: "bj-edge-user",
  currency: "GOLD",
  betAmount: 100,
  deck: bjDeck([card("10"), card("8")], [card("6"), card("A")], [card("2")]),
  config: deterministicBlackjackConfig({ dealerHitsSoft17: false }),
}), "bj-edge-user", deterministicBlackjackConfig({ dealerHitsSoft17: false }));
if (dealerSoft17Stand.dealerCards.length !== 2 || handValue(dealerSoft17Stand.dealerCards).total !== 17) {
  throw new Error("Expected dealer to stand on soft 17 when configured.");
}
const playerBustNoDealerDraw = hitBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("10"), card("6")], [card("10"), card("6")], [card("9"), card("5")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
if (playerBustNoDealerDraw.status !== "RESOLVED" || playerBustNoDealerDraw.dealerCards.length !== 2 || playerBustNoDealerDraw.result?.result !== "LOSS") {
  throw new Error("Expected player bust to reveal dealer without drawing extra dealer cards.");
}
const hitAfterResolvedCount = blackjackTransactions("bj-edge-user").length;
const hitAfterResolved = hitBlackjack(playerBustNoDealerDraw, "bj-edge-user", edgeConfig);
if (hitAfterResolved !== playerBustNoDealerDraw || blackjackTransactions("bj-edge-user").length !== hitAfterResolvedCount) {
  throw new Error("Expected hit after round completion to be a no-op with no ledger entries.");
}

const doubleWin = doubleDownBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("5"), card("6")], [card("10"), card("6")], [card("10"), card("6")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
if (doubleWin.playerHands[0].cards.length !== 3 || doubleWin.playerHands[0].result?.amountPaid !== 400 || doubleWin.result?.result !== "WIN") {
  throw new Error("Expected double win to draw once, auto-stand, and pay on the doubled wager.");
}
const doubleLoss = doubleDownBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("5"), card("6")], [card("10"), card("9")], [card("2")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
if (doubleLoss.playerHands[0].result?.amountPaid !== 0 || doubleLoss.result?.result !== "LOSS") {
  throw new Error("Expected double loss to lose both wagers.");
}
const doublePush = doubleDownBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("5"), card("6")], [card("10"), card("6")], [card("10"), card("5")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
if (doublePush.playerHands[0].result?.amountPaid !== 200 || doublePush.result?.result !== "PUSH") {
  throw new Error("Expected double push to return the doubled stake.");
}

let splitBustWin = splitBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 100, deck: bjDeck([card("8"), card("8")], [card("10"), card("6")], [card("K"), card("3"), card("10"), card("10"), card("10")]), config: edgeConfig }), "bj-edge-user", edgeConfig);
splitBustWin = hitBlackjack(splitBustWin, "bj-edge-user", edgeConfig);
if (splitBustWin.activeHandIndex !== 1 || splitBustWin.playerHands[0].status !== "BUST" || splitBustWin.playerHands[1].status !== "ACTIVE") {
  throw new Error("Expected one busted split hand to advance without affecting the other hand.");
}
splitBustWin = hitBlackjack(splitBustWin, "bj-edge-user", edgeConfig);
splitBustWin = standBlackjack(splitBustWin, "bj-edge-user", edgeConfig);
if (splitBustWin.playerHands[0].result?.result !== "LOSS" || splitBustWin.playerHands[1].result?.result !== "WIN" || splitBustWin.result?.result !== "PUSH") {
  throw new Error("Expected split settlement to combine one loss and one win safely.");
}
const splitBlackjackTwentyOne = standBlackjack(standBlackjack(splitBlackjack(startBlackjackRound({
  userId: "bj-edge-user",
  currency: "GOLD",
  betAmount: 100,
  deck: bjDeck([card("A"), card("A")], [card("9"), card("7")], [card("K"), card("Q"), card("2")]),
  config: edgeConfig,
}), "bj-edge-user", edgeConfig), "bj-edge-user", edgeConfig), "bj-edge-user", edgeConfig);
if (splitBlackjackTwentyOne.playerHands.some((hand) => !hand.result || hand.result.amountPaid !== 200 || hand.result.transactions.some((tx) => tx.metadata?.blackjack))) {
  throw new Error("Expected 21 after split to pay as a regular win, not a natural blackjack.");
}
const splitDealerBust = standBlackjack(standBlackjack(splitBlackjack(startBlackjackRound({
  userId: "bj-edge-user",
  currency: "GOLD",
  betAmount: 100,
  deck: bjDeck([card("9"), card("9")], [card("10"), card("6")], [card("2"), card("3"), card("10")]),
  config: edgeConfig,
}), "bj-edge-user", edgeConfig), "bj-edge-user", edgeConfig), "bj-edge-user", edgeConfig);
if (splitDealerBust.playerHands.some((hand) => hand.result?.result !== "WIN") || splitDealerBust.result?.amountPaid !== 400) {
  throw new Error("Expected dealer bust to pay every non-busted split hand.");
}

const insuranceTaken = startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 25, deck: bjDeck([card("10"), card("8")], [card("A"), card("9")]), config: edgeConfig });
const insuranceBalanceBefore = getBalance("bj-edge-user", "GOLD");
const insuranceNoBlackjack = resolveInsuranceBlackjack(insuranceTaken, "bj-edge-user", true, edgeConfig);
if (insuranceNoBlackjack.insuranceBet !== 12.5 || insuranceNoBlackjack.insuranceResult?.result !== "LOSS" || getBalance("bj-edge-user", "GOLD") !== insuranceBalanceBefore - 12.5) {
  throw new Error("Expected insurance to debit exactly half the bet and lose when dealer has no blackjack.");
}
const insuranceTxCount = blackjackTransactions("bj-edge-user").length;
const insuranceAgain = resolveInsuranceBlackjack(insuranceNoBlackjack, "bj-edge-user", true, edgeConfig);
if (insuranceAgain !== insuranceNoBlackjack || blackjackTransactions("bj-edge-user").length !== insuranceTxCount) {
  throw new Error("Expected insurance to be unavailable after resolving once.");
}
const insuranceWin = resolveInsuranceBlackjack(startBlackjackRound({ userId: "bj-edge-user", currency: "GOLD", betAmount: 25, deck: bjDeck([card("10"), card("8")], [card("A"), card("K")]), config: edgeConfig }), "bj-edge-user", true, edgeConfig);
if (insuranceWin.insuranceResult?.amountPaid !== 37.5 || insuranceWin.result?.result !== "LOSS") {
  throw new Error("Expected insurance blackjack to pay 2:1 plus insurance stake while main hand resolves separately.");
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
if (blackjackAnimationConfig.initialDealDelayMs < 300 || blackjackAnimationConfig.initialDealDelayMs > 500) {
  throw new Error("Expected blackjack initial deal delay to stay within the requested 300-500ms table cadence.");
}
if (JSON.stringify(initialDealSequence) !== JSON.stringify(["player-card-1", "dealer-upcard", "player-card-2", "dealer-hole-card"])) {
  throw new Error("Expected blackjack initial deal animation to follow player, dealer, player, dealer order.");
}
if (!blackjackActionsDisabled(true, false)) {
  throw new Error("Expected blackjack actions to be disabled during initial deal animation.");
}
if (initialDealAnimationMs() < blackjackAnimationConfig.initialDealDelayMs * 3 + blackjackAnimationConfig.cardSlideMs) {
  throw new Error("Expected initial deal lock to include all card slides.");
}
if (!canDoubleBlackjack(blackjack, user.id)) throw new Error("Expected double to be legal on first two cards.");
const blackjackHit = hitBlackjack(blackjack, user.id);
if (blackjackHit.playerCards.length !== 3) throw new Error("Expected hit to draw a card.");
if (!blackjackActionsDisabled(true, false) || hitAnimationMs() < blackjackAnimationConfig.cardSlideMs) {
  throw new Error("Expected hit to wait for card animation before re-enabling actions.");
}
if (canDoubleBlackjack(blackjackHit, user.id)) throw new Error("Expected double to be unavailable after hit.");
const blackjackSettled = standBlackjack(blackjack, user.id);
if (!blackjackSettled.result || blackjackSettled.status !== "RESOLVED") {
  throw new Error("Expected stand to resolve blackjack.");
}
if (!blackjackSettled.dealerRevealed) throw new Error("Expected dealer hole card to reveal after stand.");
if (dealerDisplayTotal(blackjackSettled, false) !== visibleDealerValue({ ...blackjackSettled, dealerRevealed: false })) {
  throw new Error("Expected dealer total to stay hidden until the hole-card flip finishes.");
}
if (dealerDisplayTotal(blackjackSettled, true) !== handValue(blackjackSettled.dealerCards).total) {
  throw new Error("Expected dealer total to reveal after the hole-card flip finishes.");
}
if (dealerRevealAnimationMs(blackjack.dealerCards.length, blackjackSettled.dealerCards.length) < blackjackAnimationConfig.flipMs) {
  throw new Error("Expected dealer draw sequence to resolve after hole-card flip and draw animations.");
}
if (getTransactions(user.id).length <= blackjackBefore) throw new Error("Expected blackjack ledger entries.");

try {
  startBlackjackRound({ userId: user.id, currency: "GOLD", betAmount: 0, deck: [card("10"), card("8"), card("9"), card("7")] });
  throw new Error("Expected deal to require valid bet.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Minimum GC bet")) throw error;
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
const lowInsuranceTxCount = getTransactions(lowInsuranceUser).length;
const lowInsuranceBalance = getBalance(lowInsuranceUser, "GOLD");
const lowInsuranceBlocked = resolveInsuranceBlackjack(lowInsuranceRound, lowInsuranceUser, true);
if (lowInsuranceBlocked.insuranceResolved || getTransactions(lowInsuranceUser).length !== lowInsuranceTxCount || getBalance(lowInsuranceUser, "GOLD") !== lowInsuranceBalance) {
  throw new Error("Expected insurance to be blocked without a ledger debit when half-bet cannot be covered.");
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
for (const [outcome, index] of [["0", 0], [28, 1], [7, 6], ["00", 19]] as Array<["0" | "00" | number, number]>) {
  if (getRouletteWheelPocketIndex(outcome) !== index) throw new Error(`Expected roulette wheel pocket index ${index} for ${outcome}.`);
}
if (getRouletteWheelTargetRotation(7) !== -(6 * (360 / americanWheel.length))) throw new Error("Expected roulette wheel target rotation to align 7 under the ball.");
const settledWheelMotion = getRouletteWheelMotion(7, 1);
if (Math.round(settledWheelMotion.ballX) !== 50 || settledWheelMotion.ballY >= 35) throw new Error("Expected settled roulette ball to land visibly on the upper pocket track.");
const spinningWheelMarkup = renderToStaticMarkup(createElement(RouletteWheel, { outcome: 7, spinning: true, showLabel: false }));
if (!spinningWheelMarkup.includes("roulette-ball-layer") || !spinningWheelMarkup.includes("roulette-ball")) throw new Error("Expected roulette wheel to render a visible independent ball layer.");
const settledWheelMarkup = renderToStaticMarkup(createElement(RouletteWheel, { outcome: 7, spinning: false, showLabel: false }));
if (!settledWheelMarkup.includes("roulette-winning-pocket-glow") || !settledWheelMarkup.includes("data-pocket-index=\"6\"")) throw new Error("Expected settled roulette wheel to glow the winning pocket.");
if (rouletteSpinLifecycleStates.join(",") !== "idle,betting,spinning,ballSettling,resultReveal,chipResolution,readyNextSpin") {
  throw new Error("Expected Roulette UI to expose the full spin lifecycle state machine.");
}
if (
  !isRouletteInteractionLocked("spinning") ||
  !isRouletteInteractionLocked("resultReveal") ||
  isRouletteInteractionLocked("readyNextSpin") ||
  !shouldShowRouletteSettledBets("resultReveal") ||
  shouldShowRouletteSettledBets("readyNextSpin") ||
  !shouldShowRouletteWinningZones("resultReveal") ||
  shouldShowRouletteWinningZones("ballSettling") ||
  !shouldShowRouletteResultOverlay("chipResolution")
) {
  throw new Error("Expected Roulette lifecycle helpers to gate betting, chips, zones, and overlay correctly.");
}
if (rouletteResultTiming.numberHighlightMs !== 800 || rouletteResultTiming.resultOverlayMs < 1600 || rouletteResultTiming.resultOverlayMs > 2500) {
  throw new Error("Expected Roulette result timing to keep the board readable before clearing chips.");
}
const historyOnce = getNextRouletteHistory([28, 9, "0", "00", 14], 7);
if (JSON.stringify(historyOnce) !== JSON.stringify([7, 28, 9, "0", "00"])) {
  throw new Error("Expected Roulette Last 5 history to contain only landed numbers, newest first, and update once.");
}
const lastFiveMarkup = renderToStaticMarkup(createElement(RouletteLastFiveNumbers, { values: historyOnce }));
if (!lastFiveMarkup.includes("data-result-value=\"7\"") || lastFiveMarkup.includes("Straight") || lastFiveMarkup.includes("Split")) {
  throw new Error("Expected Roulette Last 5 markup to show landed number chips only, never bet detail rows.");
}
const sampleRouletteBets = [
  { id: "loss-red", amount: 25, label: "Red", bet: { kind: "color", value: "red" } },
  { id: "win-straight", amount: 25, label: "Straight 7", bet: { kind: "straight", value: 7 } },
] as any[];
const currentBetsMarkup = renderToStaticMarkup(createElement(CurrentBetsSummary, { bets: sampleRouletteBets }));
if (!currentBetsMarkup.includes("Current Bets") || !currentBetsMarkup.includes("Red") || !currentBetsMarkup.includes("Straight 7") || currentBetsMarkup.includes("data-result-value")) {
  throw new Error("Expected Roulette Current Bets summary to stay separate from Last 5 landed results.");
}
const noCurrentBetsMarkup = renderToStaticMarkup(createElement(CurrentBetsSummary, { bets: [] }));
if (!noCurrentBetsMarkup.includes("No active bets.")) {
  throw new Error("Expected Roulette Current Bets summary to show an empty state after resolution clears.");
}
if (
  getRouletteBoardBetsForLifecycle([], [...sampleRouletteBets], "resultReveal").length !== 2 ||
  getRouletteBoardBetsForLifecycle([], [...sampleRouletteBets], "chipResolution").length !== 2 ||
  getRouletteBoardBetsForLifecycle([], [...sampleRouletteBets], "readyNextSpin").length !== 0
) {
  throw new Error("Expected Roulette settled chips to remain visible through result reveal and clear only for the next spin.");
}
const winningChipMarkup = renderToStaticMarkup(createElement(ChipStack, { bets: [sampleRouletteBets[1]], winningIds: new Set(["win-straight"]), resolutionState: "resultReveal", currency: "GOLD" }));
if (!winningChipMarkup.includes("board-chip") || !winningChipMarkup.includes("win") || !winningChipMarkup.includes("data-resolution=\"resultReveal\"")) {
  throw new Error("Expected Roulette winning chip stack to pulse during result reveal.");
}
const losingChipMarkup = renderToStaticMarkup(createElement(ChipStack, { bets: [sampleRouletteBets[0]], winningIds: new Set<string>(), resolutionState: "chipResolution", currency: "GOLD" }));
if (!losingChipMarkup.includes("lose") || !losingChipMarkup.includes("data-resolution=\"chipResolution\"")) {
  throw new Error("Expected Roulette losing chip stack to fade only during chip resolution.");
}
const selectedChipMarkup = renderToStaticMarkup(createElement(ChipSelector, { chips: [1, 5, 25, 100], selectedChip: 25, currency: "GOLD", disabled: false, onSelect: () => undefined }));
if (!selectedChipMarkup.includes("roulette-chip chip-emerald active")) {
  throw new Error("Expected Roulette selected chip to render a premium active chip state.");
}
const straightAnchor = getBetAnchor({ kind: "straight", value: 7 });
const outsideAnchor = getBetAnchor({ kind: "color", value: "red" });
const splitAnchor = getBetAnchor({ kind: "split", numbers: [16, 19] });
const streetAnchor = getBetAnchor({ kind: "street", numbers: [34, 35, 36] });
const sixStreetAnchor = getBetAnchor({ kind: "sixLine", numbers: [31, 32, 33, 34, 35, 36] });
const cornerAnchor = getBetAnchor({ kind: "corner", numbers: [10, 11, 13, 14] });
if (
  straightAnchor.mode !== "straightCenter" ||
  outsideAnchor.mode !== "buttonCenter" ||
  splitAnchor.mode !== "splitMidpoint" ||
  streetAnchor.mode !== "streetEdge" ||
  sixStreetAnchor.mode !== "sixStreetEdge" ||
  cornerAnchor.mode !== "cornerIntersection" ||
  straightAnchor.measurement !== "domRect"
) {
  throw new Error("Expected Roulette bet anchors to describe measured DOM centers, lines, and intersections for chip placement.");
}
if (
  Math.round(splitAnchor.logical?.left ?? 0) !== 50 ||
  Math.round(streetAnchor.logical?.top ?? 0) !== 100 ||
  Math.round(sixStreetAnchor.logical?.left ?? 0) !== Math.round(11 * (100 / 12))
) {
  throw new Error("Expected Roulette split, street, and six-street anchors to use the correct midpoint or street edge.");
}
const overlayWinCopy = getRouletteResultOverlayCopy({ outcome: 28, color: "black", won: true, totalPaid: 450, totalWagered: 225, net: 225, settlement: {} } as any);
if (overlayWinCopy.heading !== "28 Black" || overlayWinCopy.status !== "Won 450" || overlayWinCopy.net !== "Net +225" || overlayWinCopy.totalWon !== "Total Won 450") {
  throw new Error("Expected Roulette result overlay copy to include winning number, color, won, and net result.");
}
const overlayLossCopy = getRouletteResultOverlayCopy({ outcome: 12, color: "red", won: false, totalPaid: 0, totalWagered: 25, net: -25, settlement: {} } as any);
if (overlayLossCopy.heading !== "12 Red" || overlayLossCopy.status !== "No win" || overlayLossCopy.net !== "Net -25") {
  throw new Error("Expected Roulette result overlay copy to describe losses cleanly.");
}
if (
  getRouletteLastWinAmount(null) !== 0 ||
  getRouletteLastWinAmount({ outcome: 12, color: "red", won: false, totalPaid: 0, totalWagered: 25, net: -25, settlement: {} } as any) !== 0 ||
  getRouletteLastWinAmount({ outcome: 28, color: "black", won: true, totalPaid: 450, totalWagered: 225, net: 225, settlement: {} } as any) !== 225
) {
  throw new Error("Expected Roulette Last Win stat to clamp losses to 0 and show positive net wins.");
}
if (shouldShowRouletteBetFlash("betting", "Split 16/19") || shouldShowRouletteBetFlash("spinning", "Split 16/19") || shouldShowRouletteBetFlash("readyNextSpin", null)) {
  throw new Error("Expected Roulette placement popups to stay hidden while chip and zone feedback handle betting.");
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
const diceExactMultiplier = getDiceReturnMultiplier("exact", 50, diceConfig);
if (getDiceChance("exact", 50) !== 0.01 || Math.abs(diceExactMultiplier - 93) > 0.000001) {
  throw new Error("Expected exact Over/Under pick to pay 93x after demo edge.");
}
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
const diceExactWin = resolveDiceBet({
  userId: user.id,
  currency: "BONUS",
  betAmount: 10,
  direction: "exact",
  target: 50,
  roll: 50,
});
if (!diceExactWin.won || diceExactWin.totalPaid !== 10 * diceExactMultiplier) {
  throw new Error("Expected exact Over/Under pick to win only on the target number.");
}
const diceExactLoss = resolveDiceBet({
  userId: user.id,
  currency: "BONUS",
  betAmount: 10,
  direction: "exact",
  target: 50,
  roll: 49,
});
if (diceExactLoss.won || diceExactLoss.totalPaid !== 0) {
  throw new Error("Expected exact Over/Under pick to lose off the target number.");
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

for (const gameId of ["blackjack", "roulette", "dice", "crash", "treasureDig", "brickBreakBonus"] as const) {
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
  !rouletteUiMarkers.winningBetGlow ||
  !rouletteUiMarkers.explicitSpinLifecycle ||
  !rouletteUiMarkers.delayedChipResolution ||
  !rouletteUiMarkers.lastFiveLandedNumbersOnly ||
  !rouletteUiMarkers.temporaryBetLabelsOnly ||
  !rouletteUiMarkers.premiumCssChips ||
  !rouletteUiMarkers.resultOverlayBreakdown ||
  !rouletteUiMarkers.measuredBetAnchors ||
  !rouletteUiMarkers.currentBetsSeparated ||
  !rouletteUiMarkers.cleanRasterChipBase ||
  !rouletteUiMarkers.subtleWheelLightingOnly ||
  !rouletteUiMarkers.lastWinStat ||
  !rouletteUiMarkers.cssTableGameSpinButton ||
  !rouletteUiMarkers.clean2dWheelPresentation ||
  !rouletteUiMarkers.persistentLastResultHighlights ||
  !rouletteUiMarkers.noBetSpinError
) {
  throw new Error("Expected Roulette UI markers for American board, premium chips, delayed resolution, Last 5 landed numbers, and advanced inside bets.");
}

if (
  overUnderUiMarkers.gameName !== "Over/Under" ||
  !overUnderUiMarkers.blackjackStyleHeader ||
  !overUnderUiMarkers.noBottomCurrencyDropdown ||
  !overUnderUiMarkers.compactBottomBetControls ||
  !overUnderUiMarkers.targetSlider ||
  overUnderUiMarkers.possibleReturn ||
  !overUnderUiMarkers.lastWinStat ||
  !overUnderUiMarkers.noWinChanceStat ||
  !overUnderUiMarkers.resultAnimation ||
  !overUnderUiMarkers.mobileOneScreenLayout ||
  !overUnderUiMarkers.manualBetInput ||
  !overUnderUiMarkers.lastFiveResults ||
  !overUnderUiMarkers.sharedResultBanner ||
  !overUnderUiMarkers.sharedSoundToggle ||
  !overUnderUiMarkers.rollingNumberFlip ||
  !overUnderUiMarkers.exactTargetPick ||
  !overUnderUiMarkers.noPickComparisonSymbols ||
  !overUnderUiMarkers.infoBesideGameName ||
  !overUnderUiMarkers.rulesInfoModal
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
const crashMaxWinRound = startCrashRound({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  crashPoint: crashConfig.maxCrashPoint,
  now: 5000,
});
const crashMaxWin = cashOutCrashRound({ round: crashMaxWinRound, userId: user.id, multiplier: crashConfig.maxCrashPoint, now: 26000 });
if (crashMaxWin.status !== "CASHED_OUT" || crashMaxWin.cashOutMultiplier !== crashConfig.maxCrashPoint || crashMaxWin.totalPaid !== 100 * crashConfig.maxCrashPoint) {
  throw new Error("Expected Crash to auto cash out at the 100x max win ceiling instead of crashing.");
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
  !crashUiMarkers.compactBottomBetControls ||
  !crashUiMarkers.crashPointMarker ||
  !crashUiMarkers.hundredXGraphScale ||
  !crashUiMarkers.autoCashoutAtMaxWin
) {
  throw new Error("Expected Crash UI markers for multiplier, graph, cash out, crash feedback, 100x scale, sound, currency, and compact betting.");
}

const treasureMultiplierOne = getTreasureDigMultiplier({ safePicks: 1, trapCount: 3 });
const treasureMultiplierTwo = getTreasureDigMultiplier({ safePicks: 2, trapCount: 3 });
if (treasureMultiplierOne <= 1 || treasureMultiplierTwo <= treasureMultiplierOne) {
  throw new Error("Expected Treasure Dig multiplier curve to rise using probability and house edge.");
}
const treasureSurvivalTwo = (22 / 25) * (21 / 24);
if (treasureSurvivalTwo * treasureMultiplierTwo > 0.93) {
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
if (treasureDigConfig.minBet !== 20 || treasureDigConfig.maxTraps !== 24) {
  throw new Error("Expected Treasure Dig to allow 20 coin bets and 1-24 traps.");
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

const brickSequence = [0.999, 0.2, 0.34, 0.48, 0.62, 0.76, 0.9, 0.1, 0.4, 0.8];
let brickCursor = 0;
const brickRandom = () => brickSequence[brickCursor++ % brickSequence.length];
if (pickBrickBreakOutcome(() => 0, brickBreakBonusConfig) !== 0) {
  throw new Error("Expected Brick Break Bonus lowest RNG bucket to bust.");
}
if (pickBrickBreakOutcome(() => 0.9999, brickBreakBonusConfig) !== 50) {
  throw new Error("Expected Brick Break Bonus highest RNG bucket to reach very rare 50x outcome.");
}
const brickHits = createBrickBreakHitList({ betAmount: 100, desiredMultiplier: 2, random: brickRandom });
const brickHitTotal = brickHits.reduce((sum, hit) => sum + hit.amount, 0);
if (brickHits.length === 0 || brickHitTotal !== 200) {
  throw new Error("Expected broken Brick Break Bonus bricks to add to the generated total.");
}
if (new Set(brickHits.map((hit) => hit.brickIndex)).size !== brickHits.length) {
  throw new Error("Expected Brick Break Bonus hit list to use unique bricks.");
}
const brokenBrickIndexes: number[] = [];
for (const hit of brickHits) {
  if (!isBrickExposed(hit.brickIndex, brokenBrickIndexes)) {
    throw new Error("Expected Brick Break Bonus hit sequence to target only exposed bricks.");
  }
  brokenBrickIndexes.push(hit.brickIndex);
}
if (isBrickExposed(0, []) || !isBrickExposed(24, [])) {
  throw new Error("Expected top Brick Break Bonus bricks to stay blocked until lower column bricks are broken.");
}
if (!isBrickExposed(0, [6, 12, 18, 24])) {
  throw new Error("Expected top Brick Break Bonus brick to become exposed after below bricks break.");
}
if (!brickHits.some((hit) => hit.breakType === "full") || !createBrickBreakHitList({ betAmount: 100, desiredMultiplier: 0.5 }).every((hit) => hit.breakType === "partial")) {
  throw new Error("Expected Brick Break Bonus hits to include understandable full and partial break types.");
}
const oneXBrickSpread = createBrickBreakHitList({ betAmount: 10, desiredMultiplier: 1, random: () => 0 });
if (oneXBrickSpread.length < 4 || oneXBrickSpread.reduce((sum, hit) => sum + hit.amount, 0) !== 10) {
  throw new Error("Expected Brick Break Bonus to split some payouts into multiple small prize bricks without changing payout.");
}
const explosiveBrickHits = createBrickBreakHitList({ betAmount: 100, desiredMultiplier: 5, random: () => 0 });
const explosiveSource = explosiveBrickHits.find((hit) => hit.effect === "explosive");
const explosiveBlastHits = explosiveBrickHits.filter((hit) => hit.effect === "blast");
if (!explosiveSource || explosiveBlastHits.length === 0 || explosiveBrickHits.reduce((sum, hit) => sum + hit.amount, 0) !== 500) {
  throw new Error("Expected rare Brick Break Bonus explosive brick to break nearby bricks without adding payout beyond the selected outcome.");
}
const explosiveSteps = createBrickBreakReplaySteps(explosiveBrickHits);
const explosiveFinalStep = explosiveSteps.find((step) => step.brickId === explosiveSource.id && step.revealsPrize);
if (!explosiveFinalStep || explosiveFinalStep.blastBrickIndexes.length !== explosiveBlastHits.length) {
  throw new Error("Expected explosive Brick Break Bonus replay step to destroy adjacent blast bricks.");
}
const explosiveReplayTotal = explosiveSteps.reduce((sum, step) => applyBrickBreakStep(sum, step), 0);
if (explosiveReplayTotal !== 500) {
  throw new Error("Expected explosive Brick Break Bonus replay payout to preserve RTP-accounted total.");
}
const multiHitBrick = { id: "test-brick", brickIndex: 24, multiplier: 5, amount: 500, bonusBall: false, effect: "normal" as const, breakType: "full" as const, hitsRequired: 3 };
if (multiHitBrick.hitsRequired !== 3) {
  throw new Error("Expected rare Brick Break Bonus bricks to require multiple cracks.");
}
const multiSteps = createBrickBreakReplaySteps([multiHitBrick]);
if (multiSteps.length !== multiHitBrick.hitsRequired || multiSteps[0].hpAfter !== multiHitBrick.hitsRequired - 1 || multiSteps.at(-1)?.hpAfter !== 0) {
  throw new Error("Expected Brick Break Bonus brick hp to decrease on each hit.");
}
if (multiSteps.slice(0, -1).some((step) => step.revealsPrize || step.prizeAmount > 0) || !multiSteps.at(-1)?.revealsPrize) {
  throw new Error("Expected Brick Break Bonus prize to reveal only after the final crack.");
}
let runningBrickTotal = 0;
for (const step of multiSteps) runningBrickTotal = applyBrickBreakStep(runningBrickTotal, step);
if (runningBrickTotal !== multiHitBrick.amount) {
  throw new Error("Expected Brick Break Bonus running total to update after the final break.");
}
const fourCrackBrick = { ...multiHitBrick, id: "test-brick-4", multiplier: 50, amount: 5000, hitsRequired: 4 };
const fourCrackSteps = createBrickBreakReplaySteps([fourCrackBrick]);
if (fourCrackSteps.length !== 4 || fourCrackSteps.at(-1)?.crackLevel !== 4) {
  throw new Error("Expected Brick Break Bonus to support up to four obvious crack stages.");
}
const brickShowcases = createBrickBreakShowcases({
  betAmount: 100,
  hitList: brickHits,
  totalPaid: brickHitTotal,
  random: () => 0.99,
});
if (brickShowcases.length !== 30 - brickHits.length) {
  throw new Error("Expected Brick Break Bonus post-round showcase to reveal a value on every unbroken brick.");
}
if (!brickShowcases.some((showcase) => showcase.multiplier === 50 && showcase.kind === "jackpotTease")) {
  throw new Error("Expected Brick Break Bonus post-round showcase to include readable high multiplier teases.");
}
if (brickShowcases.some((showcase) => brickHits.some((hit) => hit.brickIndex === showcase.brickIndex))) {
  throw new Error("Expected Brick Break Bonus showcase bricks to stay separate from paid hit bricks.");
}
if (brickShowcases.reduce((sum, showcase) => sum + showcase.amount, 0) + brickHitTotal === brickHitTotal) {
  throw new Error("Expected Brick Break Bonus showcase values to be visible tease values.");
}
const brickSim = simulateBrickBreakBonus(100000);
if (brickSim.observedRtp > 0.95 || brickBreakBonusConfig.targetRtp > 0.95) {
  throw new Error("Expected Brick Break Bonus RTP simulation and target to stay under 95%.");
}
if (!Number.isFinite(brickSim.averagePayout) || !Number.isFinite(brickSim.bustRate) || !Number.isFinite(brickSim.averageBricksHit)) {
  throw new Error("Expected Brick Break Bonus simulation to expose admin stats.");
}
const brickGoldLimits = getBrickBreakBetLimits("GOLD");
const brickSweepstakesLimits = getBrickBreakBetLimits("BONUS");
const balloonGoldLimits = getBalloonPopBetLimits("GOLD");
const balloonSweepstakesLimits = getBalloonPopBetLimits("BONUS");
if (
  brickGoldLimits.minBet !== balloonGoldLimits.minBet ||
  brickGoldLimits.maxBet !== balloonGoldLimits.maxBet ||
  brickSweepstakesLimits.minBet !== balloonSweepstakesLimits.minBet ||
  brickSweepstakesLimits.maxBet !== balloonSweepstakesLimits.maxBet
) {
  throw new Error("Expected Brick Break Bonus bet limits to match Balloon Pop.");
}
if (brickBreakBonusConfig.maxPayout < brickBreakBonusConfig.maxBetGold * brickBreakBonusConfig.maxWinMultiplier) {
  throw new Error("Expected Brick Break Bonus payout cap to preserve max-bet RTP.");
}
const brickBetCountBefore = getTransactions(user.id).filter((tx) => tx.type === "ARCADE_BET").length;
const brickWinCountBefore = getTransactions(user.id).filter((tx) => tx.type === "ARCADE_WIN").length;
creditCurrency({ userId: user.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const brickGoldBefore = getBalance(user.id, "GOLD");
const brickRound = generateBrickBreakResult({
  userId: user.id,
  currency: "GOLD",
  betAmount: 100,
  random: () => 0.999,
});
const replayPayout = brickRound.replaySteps.reduce((sum, step) => applyBrickBreakStep(sum, step), 0);
if (replayPayout !== brickRound.totalPaid) {
  throw new Error("Expected Brick Break Bonus replay steps to match predetermined payout.");
}
if (brickRound.showcaseBricks.reduce((sum, showcase) => sum + showcase.amount, 0) + replayPayout === brickRound.totalPaid) {
  throw new Error("Expected Brick Break Bonus post-round showcase to not alter predetermined payout.");
}
if (brickRound.boardBricks.length !== 30) {
  throw new Error("Expected Brick Break Bonus to generate a full per-round brick layout.");
}
if (!brickRound.boardBricks.some((brick) => brick.multiplier <= 0.5) || !brickRound.boardBricks.some((brick) => brick.multiplier >= 25)) {
  throw new Error("Expected Brick Break Bonus round layout to mix low and high value brick colors.");
}
if (brickRound.boardBricks.some((brick) => brick.kind === "paid" && !brickRound.hitList.some((hit) => hit.brickIndex === brick.brickIndex))) {
  throw new Error("Expected Brick Break Bonus paid board bricks to match the revealed hit list.");
}
if (getBalance(user.id, "GOLD") !== brickGoldBefore - 100 + brickRound.totalPaid) {
  throw new Error("Expected Brick Break Bonus play to debit bet and credit payout through wallet ledger.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "ARCADE_BET").length !== brickBetCountBefore + 1) {
  throw new Error("Expected Brick Break Bonus play to create ARCADE_BET.");
}
if (brickRound.totalPaid > 0 && getTransactions(user.id).filter((tx) => tx.type === "ARCADE_WIN").length !== brickWinCountBefore + 1) {
  throw new Error("Expected Brick Break Bonus payout to create ARCADE_WIN.");
}
if (brickRound.totalPaid > brickRound.betAmount * brickBreakBonusConfig.maxWinMultiplier) {
  throw new Error("Expected Brick Break Bonus payout to never exceed max cap.");
}
const brickBust = generateBrickBreakResult({
  userId: user.id,
  currency: "BONUS",
  betAmount: 100,
  random: () => 0,
});
if (brickBust.totalPaid !== 0 || !brickBust.bust || brickBust.transactions.some((tx) => tx.type === "ARCADE_WIN")) {
  throw new Error("Expected Brick Break Bonus bust to lose wager without crediting a win.");
}
const lowBrickUser = "low-brick-break-user";
creditCurrency({ userId: lowBrickUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: brickBreakBonusConfig.minBet / 2 });
try {
  generateBrickBreakResult({ userId: lowBrickUser, currency: "GOLD", betAmount: brickBreakBonusConfig.minBet });
  throw new Error("Expected Brick Break Bonus to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}
if (
  brickBreakBonusUiMarkers.gameName !== "Brick Break" ||
  !brickBreakBonusUiMarkers.goldBonusToggle ||
  !brickBreakBonusUiMarkers.noSkillAutoplay ||
  !brickBreakBonusUiMarkers.cpuPaddle ||
  !brickBreakBonusUiMarkers.deterministicReplay ||
  !brickBreakBonusUiMarkers.colorCodedBrickValues ||
  !brickBreakBonusUiMarkers.activeBrickValueLabelsHidden ||
  !brickBreakBonusUiMarkers.runningWinningsMeter ||
  !brickBreakBonusUiMarkers.bottomToTopBreakOrder ||
  !brickBreakBonusUiMarkers.stagedBrickBreaks ||
  !brickBreakBonusUiMarkers.readableBrickInterior ||
  !brickBreakBonusUiMarkers.ballTargetsActiveBrick ||
  !brickBreakBonusUiMarkers.configurableAnimationSpeeds ||
  !brickBreakBonusUiMarkers.exposedBrickRule ||
  !brickBreakBonusUiMarkers.prizeRevealAfterFinalCrack ||
  !brickBreakBonusUiMarkers.actualMultiplierBricks ||
  !brickBreakBonusUiMarkers.explosiveBrickTier ||
  !brickBreakBonusUiMarkers.explosiveBrickBlast ||
  !brickBreakBonusUiMarkers.explosiveBlastRtpAccounted ||
  !brickBreakBonusUiMarkers.jackpotBrickTier ||
  !brickBreakBonusUiMarkers.postRoundShowcase ||
  !brickBreakBonusUiMarkers.postRoundAllBrickValues ||
  !brickBreakBonusUiMarkers.noBadBeatCopy ||
  !brickBreakBonusUiMarkers.highMultiplierTeases ||
  !brickBreakBonusUiMarkers.fourCrackStages ||
  !brickBreakBonusUiMarkers.crackStageImages ||
  !brickBreakBonusUiMarkers.postRoundBrokenContrast ||
  !brickBreakBonusUiMarkers.obviousCpuMiss ||
  !brickBreakBonusUiMarkers.compactBottomBetControls ||
  !brickBreakBonusUiMarkers.sharedInfoButton ||
  !brickBreakBonusUiMarkers.rtpUnder95Warning ||
  !brickBreakBonusUiMarkers.sharedSoundToggle
) {
  throw new Error("Expected Brick Break Bonus UI markers for no-skill autoplay, color-coded brick values, replay, rare brick tiers, currency, RTP, and compact betting.");
}

const removedLegacyGameId = ["hot", "Drop"].join("");
const removedLegacyGameName = ["Hot", "Drop"].join(" ");
if (tableGameConfigs.some((game) => game.id === removedLegacyGameId || game.name === removedLegacyGameName)) {
  throw new Error("Expected removed legacy lobby card to be absent from table game configs.");
}
if (!tableGameConfigs.some((game) => game.id === "lavaRun" && game.name === "Lava Run")) {
  throw new Error("Expected Lava Run lobby card to be registered.");
}
if (!lavaRunTableConfig.artwork?.includes("/assets/branding/game-logos/lava_run_logo.png")) {
  throw new Error("Expected Lava Run lobby card to use the branded raster logo.");
}
if (tableGameSortOptions.map((option) => option.key).join(",") !== "name,popular,recent") {
  throw new Error("Expected table games lobby sort controls to support name, popular, and recent ordering.");
}
if (sortTableGames(tableGameConfigs, "name", "asc")[0].name !== "Balloon Pop" || sortTableGames(tableGameConfigs, "name", "desc")[0].name !== "Treasure Dig") {
  throw new Error("Expected table games lobby name sorting to support ascending and descending order.");
}
if (sortTableGames(tableGameConfigs, "popular", "desc")[0].id !== "safecracker" || sortTableGames(tableGameConfigs, "recent", "desc")[0].id !== "safecracker") {
  throw new Error("Expected table games lobby popular and recent sorting to put the newest featured arcade game first when descending.");
}
if (sortTableGames(tableGameConfigs, "recent", "asc")[0].id !== "blackjack") {
  throw new Error("Expected table games lobby recent sorting to support oldest-first order.");
}

const lavaRunGoldLimits = getLavaRunBetLimits("GOLD");
const lavaRunSweepstakesLimits = getLavaRunBetLimits("BONUS");
if (
  lavaRunGoldLimits.minBet !== 1 ||
  lavaRunGoldLimits.maxBet !== 1000000 ||
  lavaRunSweepstakesLimits.minBet !== 0.01 ||
  lavaRunSweepstakesLimits.maxBet !== 200
) {
  throw new Error("Expected Lava Run bet limits to be GC 1-1,000,000 and SC 0.01-200.");
}
try {
  startLavaRunRound({ userId: user.id, currency: "GOLD", betAmount: 0.5, risk: "low" });
  throw new Error("Expected Lava Run GC bet below minimum to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Minimum GC bet")) throw error;
}
try {
  startLavaRunRound({ userId: user.id, currency: "BONUS", betAmount: 201, risk: "medium" });
  throw new Error("Expected Lava Run SC bet above maximum to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum SC bet")) throw error;
}
try {
  startLavaRunRound({ userId: "low-lava-run-user", currency: "GOLD", betAmount: 1, risk: "high" });
  throw new Error("Expected Lava Run to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}

function assertClose(actual: number, expected: number, message: string, tolerance = 0.000001) {
  if (Math.abs(actual - expected) > tolerance) {
    throw new Error(`${message} Expected ${expected}, received ${actual}.`);
  }
}

const lavaRunExpectedMath = {
  low: { choicesPerRow: 2, rtpFactor: 0.94, maxWinMultiplier: 100, capRampExponent: 0.8, opening: [1.88, 3.76, 7.52, 15.04, 30.08, 60.16, 75.42, 83.81, 91.99, 100] },
  medium: { choicesPerRow: 3, rtpFactor: 0.93, maxWinMultiplier: 250, capRampExponent: 0.8, opening: [2.79, 8.37, 25.11, 75.33, 144.01, 166.47, 188.18, 209.29, 229.87, 250] },
  high: { choicesPerRow: 4, rtpFactor: 0.92, maxWinMultiplier: 500, capRampExponent: 0.8, opening: [3.68, 14.72, 58.88, 235.52, 287.6, 332.6, 376.12, 418.41, 459.66, 500] },
} as const satisfies Record<LavaRunRisk, { choicesPerRow: number; rtpFactor: number; maxWinMultiplier: number; capRampExponent: number; opening: number[] }>;

for (const riskLevel of ["low", "medium", "high"] as LavaRunRisk[]) {
  const profile = lavaRunConfig.riskProfiles[riskLevel];
  const board = createLavaRunBoard(riskLevel, () => 0);
  const curve = getLavaRunMultiplierCurve(riskLevel, 100);
  const cashoutEvByStep = getLavaRunCashoutEvByStep(riskLevel, 100);
  const expectedMath = lavaRunExpectedMath[riskLevel];
  if (
    profile.choicesPerRow !== expectedMath.choicesPerRow ||
    profile.safeTilesPerRow !== 1 ||
    profile.safeProbability !== 1 / expectedMath.choicesPerRow ||
    profile.rtpFactor !== expectedMath.rtpFactor ||
    profile.maxWinMultiplier !== expectedMath.maxWinMultiplier ||
    profile.capRampExponent !== expectedMath.capRampExponent
  ) {
    throw new Error(`Expected Lava Run ${riskLevel} to use exactly 1 safe tile per row.`);
  }
  if (board.length !== profile.maxSteps || board.some((row) => row.tiles.length !== profile.choicesPerRow)) {
    throw new Error(`Expected Lava Run ${riskLevel} board to create ${profile.choicesPerRow} clickable tiles per row.`);
  }
  if (board.some((row) => row.tiles.filter((tile) => tile === "safe").length !== 1 || row.tiles.filter((tile) => tile === "lava").length !== profile.choicesPerRow - 1)) {
    throw new Error(`Expected Lava Run ${riskLevel} board rows to reveal 1 safe tile and the rest lava.`);
  }
  if (curve.length !== profile.maxSteps) throw new Error(`Expected Lava Run ${riskLevel} curve to include every step.`);
  if (curve.some((multiplier, index) => multiplier < 1 || (index > 0 && multiplier < curve[index - 1]))) {
    throw new Error(`Expected Lava Run ${riskLevel} curve to increase safely.`);
  }
  if (curve.at(-1)! > profile.maxWinMultiplier) {
    throw new Error(`Expected Lava Run ${riskLevel} multiplier curve to respect profile max win cap.`);
  }
  for (const [openingIndex, expectedMultiplier] of expectedMath.opening.entries()) {
    if (curve[openingIndex] !== expectedMultiplier) {
      throw new Error(`Expected Lava Run ${riskLevel} step ${openingIndex + 1} opening multiplier to be ${expectedMultiplier}x.`);
    }
  }
  for (let cashoutStep = 1; cashoutStep <= profile.maxSteps; cashoutStep += 1) {
    const ev = cashoutEvByStep[cashoutStep - 1];
    const cumulativeSurvivalProbability = Math.pow(profile.safeProbability, cashoutStep);
    const fairMultiplier = 1 / cumulativeSurvivalProbability;
    const expectedUncappedMultiplier = Math.floor(fairMultiplier * profile.rtpFactor * 100) / 100;
    const expectedStepCapMultiplier = getLavaRunStepCapMultiplier(riskLevel, cashoutStep, 100);
    const expectedMultiplier = Math.min(expectedUncappedMultiplier, expectedStepCapMultiplier);
    const theoreticalRtp = getLavaRunTheoreticalRtp(riskLevel, cashoutStep, 100);
    assertClose(getLavaRunFairMultiplier(riskLevel, cashoutStep), fairMultiplier, `Expected Lava Run ${riskLevel} fair multiplier to match cumulative survival probability.`);
    assertClose(ev.cumulativeSurvivalProbability, cumulativeSurvivalProbability, `Expected Lava Run ${riskLevel} cumulative survival probability to match lane count.`);
    assertClose(ev.fairMultiplier, fairMultiplier, `Expected Lava Run ${riskLevel} EV fair multiplier to match formula.`);
    assertClose(ev.uncappedMultiplier, expectedUncappedMultiplier, `Expected Lava Run ${riskLevel} uncapped display multiplier to use fair multiplier times RTP factor.`);
    assertClose(ev.maxMultiplierCap, profile.maxWinMultiplier, `Expected Lava Run ${riskLevel} max multiplier cap to match risk config.`);
    assertClose(ev.stepCapMultiplier, expectedStepCapMultiplier, `Expected Lava Run ${riskLevel} step cap to ramp toward the final cap.`);
    assertClose(curve[cashoutStep - 1], expectedMultiplier, `Expected Lava Run ${riskLevel} display multiplier to apply max cap.`);
    assertClose(ev.theoreticalRtp, theoreticalRtp, `Expected Lava Run ${riskLevel} EV RTP to match theoretical helper.`);
    if (cashoutStep < profile.maxSteps && curve[cashoutStep - 1] >= profile.maxWinMultiplier) {
      throw new Error(`Expected Lava Run ${riskLevel} to reach the final cap only on step ${profile.maxSteps}.`);
    }
    if (cashoutStep === profile.maxSteps && curve[cashoutStep - 1] !== profile.maxWinMultiplier) {
      throw new Error(`Expected Lava Run ${riskLevel} step ${profile.maxSteps} to land on the final cap.`);
    }
    if (theoreticalRtp > profile.rtpFactor + 0.0001 || theoreticalRtp > 0.95) {
      throw new Error(`Expected Lava Run ${riskLevel} step ${cashoutStep} RTP to stay under risk target and below 95%.`);
    }
  }
  if (!cashoutEvByStep.some((step) => step.capped)) {
    throw new Error(`Expected Lava Run ${riskLevel} late-step multipliers to show the effect of max caps.`);
  }
}
if (
  formatLavaRunMultiplier(getLavaRunMultiplierCurve("low", 100)[0]) !== "1.88x" ||
  formatLavaRunMultiplier(getLavaRunMultiplierCurve("medium", 100)[4]) !== "144x" ||
  formatLavaRunMultiplier(getLavaRunMultiplierCurve("high", 100)[4]) !== "287.6x" ||
  formatLavaRunMultiplier(getLavaRunMultiplierCurve("high", 100)[9]) !== "500x"
) {
  throw new Error("Expected Lava Run displayed next multipliers to match the configured curve with readable rounding.");
}
if (
  lavaRunConfig.riskProfiles.low.choicesPerRow !== 2 ||
  lavaRunConfig.riskProfiles.medium.choicesPerRow !== 3 ||
  lavaRunConfig.riskProfiles.high.choicesPerRow !== 4 ||
  lavaRunConfig.riskProfiles.low.safeTilesPerRow !== 1 ||
  lavaRunConfig.riskProfiles.medium.safeTilesPerRow !== 1 ||
  lavaRunConfig.riskProfiles.high.safeTilesPerRow !== 1
) {
  throw new Error("Expected Lava Run risk layouts to use 2/3/4 platform choices with one safe tile per row.");
}
const lavaRunCameraStart = getLavaRunCameraWindow({ currentStep: 0, maxSteps: 10 });
const lavaRunCameraMid = getLavaRunCameraWindow({ currentStep: 4, maxSteps: 10 });
const lavaRunCameraResolved = getLavaRunCameraWindow({ currentStep: 8, finalStep: 8, maxSteps: 10, resolved: true });
if (lavaRunCameraStart.steps.join(",") !== "0,1,2") {
  throw new Error("Expected Lava Run side camera to open on the first three future steps.");
}
if (lavaRunCameraMid.steps.includes(0) || lavaRunCameraMid.steps.join(",") !== "3,4,5") {
  throw new Error("Expected Lava Run completed steps to drift off-screen left as the side camera advances.");
}
if (lavaRunCameraResolved.steps.join(",") !== "7,8,9") {
  throw new Error("Expected Lava Run resolved reveal to keep the nearby side-scrolling canyon section visible.");
}
if (lavaRunCameraStart.steps.length > 3 || lavaRunCameraMid.steps.length > 3 || lavaRunCameraResolved.steps.length > 3) {
  throw new Error("Expected Lava Run to emphasize only the current and next few canyon steps.");
}
if (
  !isLavaRunPlatformClickable({ stepIndex: 2, activeStep: 2, status: "RUNNING" }) ||
  isLavaRunPlatformClickable({ stepIndex: 3, activeStep: 2, status: "RUNNING" }) ||
  isLavaRunPlatformClickable({ stepIndex: 2, activeStep: 2, status: "RUNNING", pendingReveal: true }) ||
  isLavaRunPlatformClickable({ stepIndex: 2, activeStep: 2, status: "BUST" }) ||
  isLavaRunPlatformClickable({ stepIndex: 2, activeStep: 2, status: "CASHED_OUT" })
) {
  throw new Error("Expected Lava Run to allow clicks only on the unlocked active step.");
}
if (shouldRevealLavaRunBoardState("RUNNING") || !shouldRevealLavaRunBoardState("BUST") || !shouldRevealLavaRunBoardState("CASHED_OUT")) {
  throw new Error("Expected Lava Run board reveal state only after bust or cashout.");
}
if (
  lavaRunAnimationTimings.suspenseMs < 250 ||
  lavaRunAnimationTimings.suspenseMs > 450 ||
  lavaRunAnimationTimings.jumpMs < 300 ||
  lavaRunAnimationTimings.jumpMs > 450 ||
  lavaRunAnimationTimings.bustMs < 600 ||
  lavaRunAnimationTimings.bustMs > 900 ||
  lavaRunAnimationTimings.cashoutMs < 900 ||
  lavaRunAnimationTimings.cashoutMs > 1400
) {
  throw new Error("Expected Lava Run animation pacing to stay fast and replayable.");
}
const lavaRunVisualCurveBefore = getLavaRunMultiplierCurve("high", 100).join(",");
const lowPlatformVisualA = getLavaRunPlatformVisual({ risk: "low", stepIndex: 0, choiceIndex: 0 });
const lowPlatformVisualB = getLavaRunPlatformVisual({ risk: "low", stepIndex: 0, choiceIndex: 1 });
const highPlatformVisual = getLavaRunPlatformVisual({ risk: "high", stepIndex: 7, choiceIndex: 3 });
const lavaRunEarlyVisual = getLavaRunVisualIntensity({ stepIndex: 1, maxSteps: 10, multiplier: 5 });
const lavaRunMidVisual = getLavaRunVisualIntensity({ stepIndex: 5, maxSteps: 10, multiplier: 12 });
const lavaRunLateVisual = getLavaRunVisualIntensity({ stepIndex: 9, maxSteps: 10, multiplier: 55 });
if (
  lowPlatformVisualA.offsetX === lowPlatformVisualB.offsetX &&
  lowPlatformVisualA.offsetY === lowPlatformVisualB.offsetY &&
  lowPlatformVisualA.tilt === lowPlatformVisualB.tilt
) {
  throw new Error("Expected Lava Run platform visuals to stagger lanes away from a static grid.");
}
if (Math.abs(lowPlatformVisualA.offsetX) > 28 || Math.abs(highPlatformVisual.offsetY) > 22 || highPlatformVisual.scale > 1.02) {
  throw new Error("Expected Lava Run visual offsets to stay readable and high-risk platforms to stay tighter.");
}
if (lavaRunEarlyVisual.zone !== "early" || lavaRunMidVisual.zone !== "mid" || lavaRunLateVisual.zone !== "late" || lavaRunLateVisual.heat <= lavaRunEarlyVisual.heat) {
  throw new Error("Expected Lava Run visual intensity to escalate by step without changing math.");
}
if (getLavaRunMultiplierTier(9.99) !== "base" || getLavaRunMultiplierTier(10) !== "tier-10" || getLavaRunMultiplierTier(25) !== "tier-25" || getLavaRunMultiplierTier(50) !== "tier-50") {
  throw new Error("Expected Lava Run multiplier glow tiers at 10x, 25x, and 50x.");
}
if (lavaRunVisualCurveBefore !== getLavaRunMultiplierCurve("high", 100).join(",")) {
  throw new Error("Expected Lava Run visual-only escalation helpers to leave payout math unchanged.");
}

const lavaRunUser = "lava-run-user";
creditCurrency({ userId: lavaRunUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const lavaRunGoldBefore = getBalance(lavaRunUser, "GOLD");
const lavaRunRound = startLavaRunRound({ userId: lavaRunUser, currency: "GOLD", betAmount: 100, risk: "medium", random: () => 0 });
if (getBalance(lavaRunUser, "GOLD") !== lavaRunGoldBefore - 100) {
  throw new Error("Expected Lava Run start to deduct the bet immediately.");
}
if (lavaRunRound.board.some((row) => row.tiles.length !== 3 || row.tiles.filter((tile) => tile === "safe").length !== 1)) {
  throw new Error("Expected Lava Run Medium rounds to create 3 lanes with exactly one safe tile per row.");
}
const lavaRunBetTx = lavaRunRound.transactions.find((tx) => tx.type === "TABLE_BET");
if (!lavaRunBetTx || lavaRunBetTx.metadata?.game !== "lava-run" || lavaRunBetTx.metadata?.risk !== "medium" || lavaRunBetTx.metadata?.bet !== 100) {
  throw new Error("Expected Lava Run bet metadata to include game, risk, and bet.");
}
const lavaRunSafeStep = pickLavaRunTile({ round: lavaRunRound, userId: lavaRunUser, choiceIndex: lavaRunRound.board[0].safeChoiceIndex });
if (lavaRunSafeStep.status !== "RUNNING" || lavaRunSafeStep.stepsCompleted !== 1 || lavaRunSafeStep.currentMultiplier <= 1) {
  throw new Error("Expected Lava Run safe step to advance to the next row and increase multiplier.");
}
const lavaRunCashBefore = getBalance(lavaRunUser, "GOLD");
const lavaRunCashout = cashOutLavaRunRound({ round: lavaRunSafeStep, userId: lavaRunUser });
if (lavaRunCashout.status !== "CASHED_OUT" || lavaRunCashout.totalPaid !== Number((lavaRunSafeStep.betAmount * lavaRunSafeStep.currentMultiplier).toFixed(2))) {
  throw new Error("Expected Lava Run cashout to pay bet times current multiplier.");
}
if (getBalance(lavaRunUser, "GOLD") !== lavaRunCashBefore + lavaRunCashout.totalPaid) {
  throw new Error("Expected Lava Run cashout to credit winnings through the wallet ledger.");
}
const lavaRunWinTx = lavaRunCashout.transactions.find((tx) => tx.type === "TABLE_WIN");
if (
  !lavaRunWinTx ||
  lavaRunWinTx.metadata?.game !== "lava-run" ||
  lavaRunWinTx.metadata?.risk !== "medium" ||
  lavaRunWinTx.metadata?.stepsCompleted !== 1 ||
  lavaRunWinTx.metadata?.result !== "cashout" ||
  !Array.isArray(lavaRunWinTx.metadata?.path) ||
  !Array.isArray(lavaRunWinTx.metadata?.reveals) ||
  lavaRunWinTx.metadata.reveals.length !== lavaRunCashout.maxSteps
) {
  throw new Error("Expected Lava Run win metadata to include game, risk, result, path choices, and full-board reveals.");
}

const lavaRunBustUser = "lava-run-bust-user";
creditCurrency({ userId: lavaRunBustUser, type: "ADMIN_ADJUSTMENT", currency: "BONUS", amount: 20 });
const lavaRunBustStart = startLavaRunRound({ userId: lavaRunBustUser, currency: "BONUS", betAmount: 1, risk: "high", random: () => 0 });
const lavaRunBustBalance = getBalance(lavaRunBustUser, "BONUS");
const lavaRunBust = pickLavaRunTile({ round: lavaRunBustStart, userId: lavaRunBustUser, choiceIndex: 3 });
if (lavaRunBust.status !== "BUST" || lavaRunBust.totalPaid !== 0 || lavaRunBust.finalMultiplier !== 0 || getBalance(lavaRunBustUser, "BONUS") !== lavaRunBustBalance) {
  throw new Error("Expected Lava Run lava bust to end the round with no payout.");
}
if (!lavaRunBust.transactions.some((tx) => tx.type === "TABLE_LOSS" && tx.metadata?.game === "lava-run" && tx.metadata?.result === "bust")) {
  throw new Error("Expected Lava Run bust to record zero-win ledger metadata.");
}
const lavaRunLossTx = lavaRunBust.transactions.find((tx) => tx.type === "TABLE_LOSS");
if (!Array.isArray(lavaRunLossTx?.metadata?.reveals) || lavaRunLossTx.metadata.reveals.length !== lavaRunBust.maxSteps) {
  throw new Error("Expected Lava Run bust metadata to reveal the full board.");
}
const lavaRunSafeAvatar = getLavaRunAvatarTarget(lavaRunSafeStep);
const lavaRunPendingAvatar = getLavaRunAvatarTarget(lavaRunSafeStep, { stepIndex: lavaRunSafeStep.stepsCompleted, choiceIndex: 0 });
const lavaRunCashoutAvatar = getLavaRunAvatarTarget(lavaRunCashout);
const lavaRunBustAvatar = getLavaRunAvatarTarget(lavaRunBust);
if (
  !lavaRunSafeAvatar ||
  lavaRunSafeAvatar.stepIndex !== 0 ||
  lavaRunSafeAvatar.choiceIndex !== lavaRunRound.board[0].safeChoiceIndex ||
  lavaRunSafeAvatar.state !== "safe"
) {
  throw new Error("Expected Lava Run avatar target to move to the selected safe platform after a safe step.");
}
if (!lavaRunPendingAvatar || lavaRunPendingAvatar.stepIndex !== 1 || lavaRunPendingAvatar.state !== "pending") {
  throw new Error("Expected Lava Run pending reveal to lock the tapped platform before resolving.");
}
if (!lavaRunCashoutAvatar || lavaRunCashoutAvatar.state !== "escaped" || lavaRunCashout.status !== "CASHED_OUT") {
  throw new Error("Expected Lava Run cashout to expose an escaped avatar/result state.");
}
if (!lavaRunBustAvatar || lavaRunBustAvatar.state !== "bust" || lavaRunBust.status !== "BUST") {
  throw new Error("Expected Lava Run bust to expose a falling avatar/result state.");
}

const lavaRunCapUser = "lava-run-cap-user";
creditCurrency({ userId: lavaRunCapUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: lavaRunConfig.maxBetGold });
let lavaRunCapRound = startLavaRunRound({ userId: lavaRunCapUser, currency: "GOLD", betAmount: lavaRunConfig.maxBetGold, risk: "high", random: () => 0 });
for (let step = 0; step < lavaRunCapRound.maxSteps; step += 1) {
  lavaRunCapRound = pickLavaRunTile({ round: lavaRunCapRound, userId: lavaRunCapUser, choiceIndex: lavaRunCapRound.board[step].safeChoiceIndex });
}
const lavaRunCappedCashout = cashOutLavaRunRound({ round: lavaRunCapRound, userId: lavaRunCapUser });
if (!lavaRunCappedCashout.capped || lavaRunCappedCashout.totalPaid > lavaRunConfig.maxPayout || lavaRunCappedCashout.totalPaid !== Number((lavaRunCappedCashout.betAmount * (lavaRunCappedCashout.finalMultiplier ?? 0)).toFixed(2))) {
  throw new Error("Expected Lava Run max win cap to be respected while preserving payout math.");
}
if (getBalance(lavaRunCapUser, "GOLD") < 0) {
  throw new Error("Expected Lava Run never to create a negative wallet balance.");
}

for (const riskLevel of ["low", "medium", "high"] as LavaRunRisk[]) {
  for (let cashoutStep = 1; cashoutStep <= lavaRunConfig.riskProfiles[riskLevel].maxSteps; cashoutStep += 1) {
    const sim = simulateLavaRun(riskLevel, 50000, 10, cashoutStep);
    if (sim.theoreticalRtp > 0.95 || sim.observedRtp > 0.95) {
      throw new Error(`Expected Lava Run ${riskLevel} step ${cashoutStep} RTP simulation to stay under 95%.`);
    }
    if (sim.cashoutEvByStep.length !== lavaRunConfig.riskProfiles[riskLevel].maxSteps || typeof sim.hitRate !== "number" || typeof sim.averageMultiplier !== "number" || typeof sim.maxMultiplierObserved !== "number" || typeof sim.multiplierCapHitRate !== "number") {
      throw new Error(`Expected Lava Run ${riskLevel} simulation output to include EV by step, hit rate, average multiplier, max multiplier, and cap effects.`);
    }
    if (cashoutStep === 1 && (sim.biggestWin <= 0 || sim.hitRate <= 0 || sim.bustRate <= 0 || sim.averagePayout <= 0 || sim.maxMultiplierObserved <= 0)) {
      throw new Error(`Expected Lava Run ${riskLevel} simulation to report wins, hit rate, busts, and average payout.`);
    }
  }
  for (const strategy of ["conservative", "balanced", "aggressive", "random"] as const) {
    const sim = simulateLavaRunStrategy(riskLevel, strategy, 50000, 10);
    if (sim.strategy !== strategy || sim.theoreticalRtp > 0.95 || sim.observedRtp > 0.95) {
      throw new Error(`Expected Lava Run ${riskLevel} ${strategy} strategy simulation to stay under 95% RTP.`);
    }
    if (sim.hitRate + sim.bustRate < 0.999 || sim.hitRate + sim.bustRate > 1.001) {
      throw new Error(`Expected Lava Run ${riskLevel} ${strategy} hit rate and bust rate to reconcile.`);
    }
  }
}
const lavaRunTableSim = simulateTableGame("lavaRun", 50000);
if (lavaRunTableSim.observedRtp > 0.95 || lavaRunTableConfig.houseEdgeTarget < 0.05) {
  throw new Error("Expected Lava Run table simulation and config target to stay under 95% RTP.");
}
if (
  lavaRunUiMarkers.gameName !== "Lava Run" ||
  !lavaRunUiMarkers.goldBonusToggle ||
  !lavaRunUiMarkers.deterministicStepReveal ||
  !lavaRunUiMarkers.exactOneSafeLanePerRow ||
  !lavaRunUiMarkers.jumpRightToContinue ||
  !lavaRunUiMarkers.continueButtonRemoved ||
  !lavaRunUiMarkers.visibleStageRevealAfterRound ||
  !lavaRunUiMarkers.resetAfterResolvedRound ||
  !lavaRunUiMarkers.noPickTextOnTiles ||
  !lavaRunUiMarkers.sideScrollingCamera ||
  !lavaRunUiMarkers.completedStepsLeaveScreen ||
  !lavaRunUiMarkers.futureStepsSpawnRight ||
  !lavaRunUiMarkers.futureMultipliersVisible ||
  !lavaRunUiMarkers.currentAndNextStepsOnly ||
  !lavaRunUiMarkers.suspenseBeforeReveal ||
  !lavaRunUiMarkers.platformTapLocksChoice ||
  !lavaRunUiMarkers.inactiveFuturePlatformsDisabled ||
  !lavaRunUiMarkers.singleAvatarPosition ||
  !lavaRunUiMarkers.cashoutEscapedState ||
  !lavaRunUiMarkers.resultBlocksPlatformClicks ||
  !lavaRunUiMarkers.animationPacingTargets ||
  !lavaRunUiMarkers.floatingPlatformScene ||
  !lavaRunUiMarkers.organicPlatformStagger ||
  !lavaRunUiMarkers.cameraPushOnAdvance ||
  !lavaRunUiMarkers.visualOnlyEscalation ||
  !lavaRunUiMarkers.highMultiplierIntensity ||
  !lavaRunUiMarkers.emberParticleLayer ||
  !lavaRunUiMarkers.cashoutPayoutCountUp ||
  !lavaRunUiMarkers.environmentEscalatesByStep ||
  !lavaRunUiMarkers.riskSelector ||
  !lavaRunUiMarkers.currentMultiplierMeter ||
  !lavaRunUiMarkers.nextMultiplierMeter ||
  !lavaRunUiMarkers.cashOutAnytimeAfterSafeStep ||
  !lavaRunUiMarkers.noPhysicsEngine ||
  !lavaRunUiMarkers.platformRevealGlow ||
  !lavaRunUiMarkers.lavaBustBurst ||
  !lavaRunUiMarkers.avatarHop ||
  !lavaRunUiMarkers.rasterPlatformAssets ||
  !lavaRunUiMarkers.maxWinCapRespected ||
  !lavaRunUiMarkers.rtpUnder95Warning ||
  !lavaRunUiMarkers.sharedSoundToggle ||
  !lavaRunUiMarkers.compactBottomBetControls ||
  !lavaRunUiMarkers.ledgerMetadataIncludesPath
) {
  throw new Error("Expected Lava Run UI markers for simple path progression, controls, animations, RTP, and ledger metadata.");
}

if (!tableGameConfigs.some((game) => game.id === "emberStack" && game.name === "Ember Stack")) {
  throw new Error("Expected Ember Stack lobby card to be registered.");
}
if (!emberStackTableConfig.artwork?.includes("/assets/branding/game-logos/ember_stack_logo.png")) {
  throw new Error("Expected Ember Stack lobby card to use the card-fit raster branding logo.");
}
const emberGoldLimits = getEmberStackBetLimits("GOLD");
const emberSweepstakesLimits = getEmberStackBetLimits("BONUS");
if (
  emberGoldLimits.minBet !== 1 ||
  emberGoldLimits.maxBet !== 1000000 ||
  emberSweepstakesLimits.minBet !== 0.01 ||
  emberSweepstakesLimits.maxBet !== 500
) {
  throw new Error("Expected Ember Stack bet limits to be GC 1-1,000,000 and SC 0.01-500.");
}
if (emberStackConfig.name !== "Ember Stack" || emberStackConfig.slug !== "ember-stack" || emberStackConfig.id !== "emberStack") {
  throw new Error("Expected Ember Stack config to carry the new game identity.");
}
const expectedEmberCurves = {
  low: [1.04, 1.1, 1.18, 1.3, 1.48, 1.72, 2.05, 2.45, 3.1, 4, 5.5, 8],
  medium: [1.15, 1.42, 2.05, 3.4, 6, 12, 22.5, 40, 70, 110, 160, 220, 300, 400],
  high: [1.35, 2.5, 5.5, 12, 25, 50, 90, 150, 250, 400, 650, 1000, 1500, 2500, 4000, 5000],
} as const;
for (const riskLevel of emberStackRiskOrder) {
  expectedEmberCurves[riskLevel].forEach((multiplier, index) => {
    assertClose(getEmberStackBaseMultiplier(index + 1, riskLevel), multiplier, `Expected Ember Stack ${riskLevel} level ${index + 1} multiplier to match the requested curve.`);
  });
}
if (
  emberStackConfig.riskProfiles.low.maxWinMultiplier !== 8 ||
  emberStackConfig.riskProfiles.medium.maxWinMultiplier !== 400 ||
  emberStackConfig.riskProfiles.high.maxWinMultiplier !== 5000 ||
  getEmberStackMaxWinMultiplier("high", emberStackConfig.maxBetGold) !== 5000 ||
  getEmberStackBaseMultiplier(99, "high") !== 5000
) {
  throw new Error("Expected Ember Stack multiplier curves to cap at 8x, 400x, and 5000x by risk without a payout-size cap.");
}
if (getEmberStackBaseMultiplier(10, "medium") < 100 || getEmberStackBaseMultiplier(6, "high") <= getEmberStackBaseMultiplier(6, "medium") || getEmberStackBaseMultiplier(6, "medium") <= getEmberStackBaseMultiplier(6, "low")) {
  throw new Error("Expected Ember Stack progression to reach 100x+ and scale by risk.");
}
if (getEmberStackSpeedForLevel("low", 0) >= getEmberStackSpeedForLevel("medium", 0) || getEmberStackSpeedForLevel("high", 5) <= getEmberStackSpeedForLevel("high", 1)) {
  throw new Error("Expected Ember Stack speed to increase by risk and progression.");
}
if (formatEmberStackMultiplier(1.234) !== "1.23x" || formatEmberStackMultiplier(42) !== "42x") {
  throw new Error("Expected Ember Stack multiplier formatting to be readable.");
}

function emberSequenceRandom(values: number[]) {
  let index = 0;
  return () => values[index++] ?? 0.5;
}

const emberMotionUser = "ember-stack-motion-user";
creditCurrency({ userId: emberMotionUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const emberMotionRound = startEmberStackRound({ userId: emberMotionUser, currency: "GOLD", betAmount: 10, risk: "medium", random: () => 0 });
const emberBase = emberMotionRound.tower[0];
if (!emberMotionRound.activePlatform || emberMotionRound.choiceAvailable || emberBase.width !== emberStackConfig.riskProfiles.medium.startingWidth || emberMotionRound.activePlatform.width !== emberBase.width || emberBase.x <= 0) {
  throw new Error("Expected Ember Stack to start with a centered CPU-controlled block ready to animate.");
}
const emberCycleMs = getEmberStackCycleMs(emberMotionRound.activePlatform);
assertClose(getEmberStackPlatformX(emberMotionRound.activePlatform, 0), getEmberStackPlatformX(emberMotionRound.activePlatform, emberCycleMs), "Expected Ember Stack moving platform to loop cleanly.");
if (getEmberStackPlatformX(emberMotionRound.activePlatform, emberCycleMs / 2) <= getEmberStackPlatformX(emberMotionRound.activePlatform, 0)) {
  throw new Error("Expected Ember Stack moving platform to slide across the board with eased direction changes.");
}
const lowCpuChance = getEmberStackCpuSuccessChance({ risk: "low", stackCount: 0, currentMultiplier: 1, platformWidth: emberStackConfig.riskProfiles.low.startingWidth });
const mediumCpuChance = getEmberStackCpuSuccessChance({ risk: "medium", stackCount: 0, currentMultiplier: 1, platformWidth: emberStackConfig.riskProfiles.medium.startingWidth });
const highCpuChance = getEmberStackCpuSuccessChance({ risk: "high", stackCount: 0, currentMultiplier: 1, platformWidth: emberStackConfig.riskProfiles.high.startingWidth });
if (lowCpuChance <= mediumCpuChance || mediumCpuChance <= highCpuChance || pickEmberStackCpuOutcome({ risk: "high", stackCount: 0, currentMultiplier: 1, platformWidth: emberStackConfig.riskProfiles.high.startingWidth, random: emberSequenceRandom([1]) }) !== "miss") {
  throw new Error("Expected Ember Stack CPU success chance to be risk-controlled with miss outcomes.");
}

const emberGood = attemptEmberStackCpuStack({ round: emberMotionRound, random: emberSequenceRandom([0, 0.25, 0, 0]) });
if (emberGood.status !== "RUNNING" || !emberGood.choiceAvailable || emberGood.stackCount !== 1 || emberGood.lastQuality !== "good" || !emberGood.lastCut || emberGood.lastCut.width <= 0 || emberGood.tower[1].width >= emberBase.width) {
  throw new Error("Expected Ember Stack CPU to resolve a good stack, slice overhang, and pause for player decision.");
}
if (!emberGood.activePlatform || emberGood.activePlatform.width !== emberGood.tower[1].width) {
  throw new Error("Expected Ember Stack remaining platform width to become the next moving platform width.");
}
assertClose(emberGood.lastLockX ?? 0, emberGood.lastCut.x, "Expected Ember Stack good CPU lock position to line up with the visible trimmed piece.");
assertClose(emberGood.lastCut.width, emberBase.width - emberGood.tower[1].width, "Expected Ember Stack good cut width to match the visual width loss.");
assertClose(emberGood.tower[1].x, emberBase.x, "Expected Ember Stack good locked block to sit on the remaining overlap.");
if (emberGood.currentMultiplier <= 1 || emberGood.lastParticles.length === 0 || !canCashOutEmberStackRound(emberGood)) {
  throw new Error("Expected Ember Stack successful stack to increase multiplier and emit impact particles.");
}

const emberPerfectStart = startEmberStackRound({ userId: emberMotionUser, currency: "GOLD", betAmount: 10, risk: "medium", random: () => 0 });
const emberPerfect = attemptEmberStackCpuStack({ round: emberPerfectStart, random: emberSequenceRandom([0, 0, 0.5, 0]) });
if (emberPerfect.lastQuality !== "perfect" || emberPerfect.perfectCombo !== 1 || Math.abs(emberPerfect.currentMultiplier - getEmberStackBaseMultiplier(1, "medium")) > 0.000001 || emberPerfect.tower[1].width < emberPerfectStart.tower[0].width) {
  throw new Error("Expected Ember Stack perfect stack to restore width, build combo, and keep the multiplier on the requested curve.");
}
const emberBad = attemptEmberStackCpuStack({ round: emberPerfectStart, random: emberSequenceRandom([0, 0.95, 0, 0]) });
if (emberBad.lastQuality !== "bad" || !emberBad.choiceAvailable || emberBad.tower[1].width >= emberGood.tower[1].width) {
  throw new Error("Expected Ember Stack bad CPU stack to keep running with a major width reduction.");
}
if (!emberBad.lastCut || emberBad.lastCut.width <= emberGood.lastCut.width) {
  throw new Error("Expected Ember Stack bad CPU stack to visibly lose more width than a good stack.");
}
const emberMiss = attemptEmberStackCpuStack({ round: emberPerfectStart, random: emberSequenceRandom([1, 0, 0]) });
if (emberMiss.status !== "BUST" || emberMiss.currentMultiplier !== 0 || emberMiss.lastCut?.side !== "full") {
  throw new Error("Expected Ember Stack CPU miss to bust and drop the moving block.");
}
assertClose(emberMiss.lastLockX ?? 0, emberMiss.lastCut?.x ?? 0, "Expected Ember Stack miss lock position to match the falling full block.");
if (getEmberStackRoundStatusCopy(emberMiss) !== "BUST" || getEmberStackQualityCopy("perfect") !== "PERFECT") {
  throw new Error("Expected Ember Stack result copy to clearly describe CPU bust and perfect states.");
}

const emberStyle = getEmberStackPlatformStyle(emberGood.tower[1], getEmberStackCameraOffset(emberGood.stackCount));
if (!String(emberStyle["--ember-platform-left" as keyof typeof emberStyle]).includes("%") || !String(emberStyle["--ember-platform-bottom" as keyof typeof emberStyle]).includes("px")) {
  throw new Error("Expected Ember Stack platform styles to use board-relative mobile sizing.");
}
const emberPlatformClass = getEmberStackPlatformClass(emberPerfect.tower[1], emberPerfect);
if (!emberPlatformClass.includes("top-lock") || !emberPlatformClass.includes("quality-perfect") || !emberPlatformClass.includes("tier-bottom")) {
  throw new Error("Expected Ember Stack locked platform class to visually match the chosen CPU outcome and level color tier.");
}
const emberCutStyle = getEmberStackCutStyle(emberGood.lastCut!, getEmberStackCameraOffset(emberGood.stackCount));
if (!String(emberCutStyle["--ember-cut-width" as keyof typeof emberCutStyle]).includes("%")) {
  throw new Error("Expected Ember Stack cut piece style to expose falling overhang dimensions.");
}
const emberCutLineStyle = getEmberStackCutLineStyle(emberGood.lastCut!, getEmberStackCameraOffset(emberGood.stackCount));
if (!String(emberCutLineStyle["--ember-cut-line-left" as keyof typeof emberCutLineStyle]).includes("%") || !String(emberCutLineStyle["--ember-cut-line-bottom" as keyof typeof emberCutLineStyle]).includes("px")) {
  throw new Error("Expected Ember Stack cut line animation to align with the trimmed overhang.");
}
const emberParticleStyle = getEmberStackParticleStyle(emberGood.lastParticles[0]);
if (!String(emberParticleStyle["--ember-particle-delay" as keyof typeof emberParticleStyle]).includes("ms")) {
  throw new Error("Expected Ember Stack particles to expose staggered impact timing.");
}
const emberVisualState = getEmberStackOutcomeVisualState(emberGood);
if (emberVisualState.quality !== "good" || !emberVisualState.hasCut || !emberVisualState.hasChoice || emberVisualState.milestone !== "base") {
  throw new Error("Expected Ember Stack visual outcome state to track CPU stack quality, cut flow, and decision state.");
}
const emberHudRows = getEmberStackBoardHudRows(emberGood, getEmberStackNextMultiplier(emberGood));
const emberLowHudRows = getEmberStackBoardHudRows(null, getEmberStackBaseMultiplier(1, "low"), undefined, "low");
const emberHighHudRows = getEmberStackBoardHudRows(null, getEmberStackBaseMultiplier(1, "high"), undefined, "high");
if (
  emberHudRows.length !== expectedEmberCurves.medium.length ||
  emberLowHudRows.length !== expectedEmberCurves.low.length ||
  emberHighHudRows.length !== expectedEmberCurves.high.length ||
  !emberHudRows.some((row) => row.state === "current") ||
  !emberHudRows.some((row) => row.state === "next") ||
  emberHudRows.at(-1)?.multiplier !== 400 ||
  emberHighHudRows.at(-1)?.multiplier !== 5000
) {
  throw new Error("Expected Ember Stack board HUD rows to expose every risk multiplier level beside the tower.");
}
const emberRowMarkerStyle = getEmberStackRowMarkerStyle(emberHudRows[0], getEmberStackCameraOffset(emberGood.stackCount));
if (!String(emberRowMarkerStyle["--ember-row-marker-bottom" as keyof typeof emberRowMarkerStyle]).includes("px")) {
  throw new Error("Expected Ember Stack row multiplier markers to use board-relative vertical positioning.");
}
if (getEmberStackCameraOffset(8) !== 0 || getEmberStackOutcomeVisualState({ ...emberGood, stackCount: 8 }).cameraOffset !== 0) {
  throw new Error("Expected Ember Stack board to stay fixed instead of camera-scrolling the tower.");
}
if (getEmberStackPlatformTier(1, "medium") !== "bottom" || getEmberStackPlatformTier(6, "medium") !== "middle" || getEmberStackPlatformTier(12, "medium") !== "top") {
  throw new Error("Expected Ember Stack platform tiers to map lower, middle, and upper thirds to distinct colors.");
}
if (getEmberStackBoardMood(null).tier !== "base" || getEmberStackBoardMood({ ...emberPerfect, currentMultiplier: 120 }).tier !== "inferno" || getEmberStackMultiplierMilestone(10) !== "ten" || getEmberStackMultiplierMilestone(25) !== "twenty-five" || getEmberStackMultiplierMilestone(50) !== "fifty" || getEmberStackMultiplierMilestone(100) !== "hundred" || getEmberStackMultiplierMilestone(250) !== "two-fifty") {
  throw new Error("Expected Ember Stack board mood to escalate with progression.");
}
if (getEmberStackNextMultiplier(emberGood) <= emberGood.currentMultiplier) {
  throw new Error("Expected Ember Stack next multiplier to rise after a successful stack.");
}
const emberAssetValues = Object.values(emberStackAssetManifest);
if (
  emberAssetValues.length < 12 ||
  !emberAssetValues.every((asset) => asset.includes("/assets/ember-stack/") && asset.endsWith(".png")) ||
  !emberStackAssetManifest.greenPlatform.includes("platform-green.png") ||
  !emberStackAssetManifest.bluePlatform.includes("platform-blue.png") ||
  !emberStackAssetManifest.redPlatform.includes("platform-red.png")
) {
  throw new Error("Expected Ember Stack to use premium raster assets for board, platforms, FX, and logo.");
}

try {
  startEmberStackRound({ userId: user.id, currency: "GOLD", betAmount: 0.5, risk: "low" });
  throw new Error("Expected Ember Stack GC bet below minimum to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Minimum GC bet")) throw error;
}
try {
  startEmberStackRound({ userId: user.id, currency: "BONUS", betAmount: 501, risk: "medium" });
  throw new Error("Expected Ember Stack SC bet above maximum to be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum SC bet")) throw error;
}
try {
  startEmberStackRound({ userId: "low-ember-stack-user", currency: "GOLD", betAmount: 1, risk: "high" });
  throw new Error("Expected Ember Stack to block insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Insufficient")) throw error;
}

const emberUser = "ember-stack-user";
creditCurrency({ userId: emberUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const emberGoldBefore = getBalance(emberUser, "GOLD");
let emberRound = startEmberStackRound({ userId: emberUser, currency: "GOLD", betAmount: 100, risk: "medium", random: () => 0 });
if (getBalance(emberUser, "GOLD") !== emberGoldBefore - 100) {
  throw new Error("Expected Ember Stack start to deduct the bet immediately.");
}
emberRound = attemptEmberStackCpuStack({ round: emberRound, random: emberSequenceRandom([0, 0.25, 0, 0]) });
if (emberRound.status !== "RUNNING" || emberRound.currentMultiplier <= 1 || emberRound.stackCount !== 1 || !canCashOutEmberStackRound(emberRound)) {
  throw new Error("Expected Ember Stack CPU success to enable cashout and continue decisions.");
}
const emberContinued = continueEmberStackRound(emberRound);
if (emberContinued.choiceAvailable || emberContinued.lastMessage !== "CPU lining up the next block.") {
  throw new Error("Expected Ember Stack continue to arm the next CPU attempt.");
}
const emberSecondStack = attemptEmberStackCpuStack({ round: emberContinued, random: emberSequenceRandom([0, 0.25, 0, 0]) });
if (emberSecondStack.stackCount !== 2 || !emberSecondStack.choiceAvailable || emberSecondStack.currentMultiplier <= emberRound.currentMultiplier) {
  throw new Error("Expected Ember Stack continue to trigger the next CPU stack attempt.");
}
const emberCashBefore = getBalance(emberUser, "GOLD");
const emberCashout = cashOutEmberStackRound({ round: emberRound, userId: emberUser });
if (emberCashout.status !== "CASHED_OUT" || emberCashout.totalPaid !== getEmberStackCashoutAmount(emberRound)) {
  throw new Error("Expected Ember Stack cashout to pay bet times current multiplier with caps.");
}
if (getBalance(emberUser, "GOLD") !== emberCashBefore + emberCashout.totalPaid) {
  throw new Error("Expected Ember Stack cashout to credit winnings through the wallet ledger.");
}
const emberBetTx = emberRound.transactions.find((tx) => tx.type === "ARCADE_BET");
const emberWinTx = emberCashout.transactions.find((tx) => tx.type === "ARCADE_WIN");
if (!emberBetTx || emberBetTx.metadata?.game !== "ember-stack" || emberBetTx.metadata?.risk !== "medium" || emberBetTx.metadata?.bet !== 100) {
  throw new Error("Expected Ember Stack bet metadata to include game, risk, and bet.");
}
if (!emberWinTx || emberWinTx.metadata?.game !== "ember-stack" || emberWinTx.metadata?.result !== "cashout" || emberWinTx.metadata?.stacks !== emberCashout.stackCount || emberWinTx.metadata?.perfects !== emberCashout.perfectCount || typeof emberWinTx.metadata?.goodStacks !== "number") {
  throw new Error("Expected Ember Stack win metadata to include stack result details.");
}

const emberCapUser = "ember-stack-cap-user";
creditCurrency({ userId: emberCapUser, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: emberStackConfig.maxBetGold });
const emberCapRound = startEmberStackRound({ userId: emberCapUser, currency: "GOLD", betAmount: emberStackConfig.maxBetGold, risk: "high", random: () => 0 });
const emberMaxMultiplierCashout = cashOutEmberStackRound({ round: { ...emberCapRound, choiceAvailable: true, stackCount: 16, currentMultiplier: 5000, perfectCount: 4 }, userId: emberCapUser });
if (emberMaxMultiplierCashout.capped || emberMaxMultiplierCashout.totalPaid !== emberStackConfig.maxBetGold * 5000 || emberMaxMultiplierCashout.totalPaid <= emberStackConfig.maxPayout || emberMaxMultiplierCashout.currentMultiplier !== getEmberStackMaxWinMultiplier("high", emberStackConfig.maxBetGold)) {
  throw new Error("Expected Ember Stack to use the risk multiplier max without applying the absolute payout cap.");
}
const emberOverMultiplierCashout = cashOutEmberStackRound({ round: { ...emberCapRound, choiceAvailable: true, stackCount: 17, currentMultiplier: 9000, perfectCount: 4 }, userId: emberCapUser });
if (!emberOverMultiplierCashout.capped || emberOverMultiplierCashout.currentMultiplier !== 5000 || emberOverMultiplierCashout.totalPaid !== emberStackConfig.maxBetGold * 5000) {
  throw new Error("Expected Ember Stack to cap only at the risk max multiplier.");
}
if (getBalance(emberCapUser, "GOLD") < 0) {
  throw new Error("Expected Ember Stack never to create a negative wallet balance.");
}

for (const riskLevel of emberStackRiskOrder) {
  for (const strategy of ["random", "quick", "balanced", "greedy"] as EmberStackSimulationStrategy[]) {
    const sim = simulateEmberStack(riskLevel, 50000, 10, strategy);
    if (sim.observedRtp > 0.95 || sim.houseEdge < 0.05) {
      throw new Error(`Expected Ember Stack ${riskLevel} ${strategy} CPU RTP simulation to stay under 95%.`);
    }
    if (typeof sim.successRate !== "number" || typeof sim.bustRate !== "number" || typeof sim.averageCashoutEv !== "number" || typeof sim.maxWin !== "number" || sim.averageStacks <= 0 || typeof sim.cashoutRate !== "number") {
      throw new Error(`Expected Ember Stack ${riskLevel} ${strategy} simulation to report success, bust, EV, max win, cashout, and average stack stats.`);
    }
  }
}
const emberStackTableSim = simulateTableGame("emberStack", 50000);
if (emberStackTableSim.observedRtp > 0.95 || emberStackTableConfig.houseEdgeTarget < 0.05) {
  throw new Error("Expected Ember Stack table simulation and config target to stay below 95%.");
}
if (
  emberStackUiMarkers.gameName !== "Ember Stack" ||
  !emberStackUiMarkers.playheaterBranding ||
  !emberStackUiMarkers.goldBonusToggle ||
  !emberStackUiMarkers.riskSelector ||
  !emberStackUiMarkers.movingPlatformLoop ||
  !emberStackUiMarkers.noStopButton ||
  !emberStackUiMarkers.cpuRunStacking ||
  !emberStackUiMarkers.cashoutContinueDecision ||
  !emberStackUiMarkers.cleanSliceAnimation ||
  !emberStackUiMarkers.fallingCutPiece ||
  !emberStackUiMarkers.impactParticles ||
  !emberStackUiMarkers.perfectStackBonus ||
  !emberStackUiMarkers.perfectComboCounter ||
  !emberStackUiMarkers.widthRestoreOnPerfect ||
  !emberStackUiMarkers.shortStarterBlocks ||
  !emberStackUiMarkers.riskBasedCpuSuccessChances ||
  !emberStackUiMarkers.cpuOutcomePerfectGoodBadMiss ||
  !emberStackUiMarkers.premiumRasterAssets ||
  !emberStackUiMarkers.outcomeMatchedLockAnimation ||
  !emberStackUiMarkers.cutLineAnimation ||
  emberStackUiMarkers.cameraRiseVisual ||
  !emberStackUiMarkers.multiplierMilestones ||
  !emberStackUiMarkers.cashoutPayoutSequence ||
  !emberStackUiMarkers.bustShakeSequence ||
  !emberStackUiMarkers.noHeaderPlayheaterText ||
  !emberStackUiMarkers.noHeaderGemIcon ||
  !emberStackUiMarkers.infoBesideGameName ||
  !emberStackUiMarkers.balanceInBottomControls ||
  !emberStackUiMarkers.noStandaloneMeterBoxes ||
  !emberStackUiMarkers.boardIntegratedMultiplierHud ||
  !emberStackUiMarkers.rowMultiplierMarkers ||
  !emberStackUiMarkers.fullMultiplierLadder ||
  !emberStackUiMarkers.noBoardCashoutHeightStats ||
  !emberStackUiMarkers.noDecisionStatusPanel ||
  !emberStackUiMarkers.noResolvedResultStrip ||
  !emberStackUiMarkers.boardResolvedResultOverlay ||
  !emberStackUiMarkers.boardClickContinue ||
  !emberStackUiMarkers.simplifiedMultiplierHud ||
  emberStackUiMarkers.readableNextBlockMultiplier ||
  !emberStackUiMarkers.noBoardWideComboGlow ||
  !emberStackUiMarkers.rasterPlatformSprites ||
  !emberStackUiMarkers.singleBottomPlatform ||
  !emberStackUiMarkers.noInBlockMultiplierLabels ||
  !emberStackUiMarkers.nextMultiplierInTopHud ||
  !emberStackUiMarkers.fixedBoardNoCameraScroll ||
  !emberStackUiMarkers.tieredPlatformColors ||
  !emberStackUiMarkers.cleanArcadeStackerBackdrop ||
  !emberStackUiMarkers.noBackgroundBurstOnBust ||
  !emberStackUiMarkers.slowMissFallAnimation ||
  !emberStackUiMarkers.singleBustMessage ||
  !emberStackUiMarkers.cpuLockTimingMatchesOutcome ||
  !emberStackUiMarkers.nextBlockMovesDuringDecision ||
  emberStackUiMarkers.nextMultiplierOnMovingBlock ||
  !emberStackUiMarkers.multiplierCurve ||
  !emberStackUiMarkers.speedScalingByRiskAndProgression ||
  !emberStackUiMarkers.cpuSuccessChanceMath ||
  !emberStackUiMarkers.cpuSimulationReportsEv ||
  !emberStackUiMarkers.cpuRiskSimulations ||
  !emberStackUiMarkers.cpuRtpUnder95 ||
  !emberStackUiMarkers.mobileFirstBoardDominant ||
  !emberStackUiMarkers.sharedSoundToggle ||
  !emberStackUiMarkers.audioHooks ||
  !emberStackUiMarkers.stackerMechanicsOnly ||
  !emberStackUiMarkers.nonPhysicsTimingModel
) {
  throw new Error("Expected Ember Stack UI markers for CPU stacker gameplay, perfect combo, RTP controls, and mobile board dominance.");
}
if (
  emberStackAnimationTimings.cutMs < 500 ||
  emberStackAnimationTimings.cutMs > 900 ||
  emberStackAnimationTimings.cpuAttemptMs < 500 ||
  emberStackAnimationTimings.cpuAttemptMs > 900 ||
  emberStackAnimationTimings.lockMs < 120 ||
  emberStackAnimationTimings.lockMs > 260 ||
  emberStackAnimationTimings.perfectMs < 600 ||
  emberStackAnimationTimings.cashoutMs < 800 ||
  emberStackAnimationTimings.bustMs < 1200
) {
  throw new Error("Expected Ember Stack animation pacing to leave room for slice, perfect, cashout, and bust effects.");
}
console.log("tableGames.devtest passed");
