import { exposedSlotConfigs, slotConfigs } from "./slotConfigs";
import { getMathWarnings, simulateSlot } from "./slotMath";
import { buyBonusDebit, buyBonusFeature, calculateDirectFeature, calculateFreeSpinsBonus, calculateHoldAndWinBonus, calculateNeonCascadeResult, calculateSlotResult, calculateWheelBonus, createGoldRushBonusTriggerGrid, createGoldRushShowdownBoostGrid, createHoldAndWinState, creditHoldAndWinBonus, creditPickBonus, debitGoldRushBonusBuy, generateGrid, getBonusBuyCost, getBonusBuyPayoutBetAmount, getGoldRushBonusBuyCost, getGoldRushFreeSpinInitialInteriorColumns, getSpinCost, spinSlot, stepHoldAndWinBonus } from "./slotEngine";
import { creditCurrency, getBalance, getTransactions } from "../wallet/walletService";
import type { User } from "../types";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { clearRecentGames, getRecentGames, recordRecentGame } from "./recentGames";
import { dismissOnboarding, hasDismissedOnboarding } from "../app/onboarding";
import { frontierUiAssets, requiredFrontierUiAssetKeys } from "./frontierAssets";
import { GoldRushMineClashFinalPanel, GoldRushMineClashGridOverlay, chargedRelicCrackEvent, frontierEntryLoadingMessages, frontierFeatureIntroCards, frontierIntroAssets, frontierTurboBypassesAnimation, frontierWheelSpinMs, getBetOptions, getBonusBoostMenuOptions, getBonusChanceTier, getBuyBonusCost, getCoinDisplayLabels, getDefaultBetAmount, getFrontierAnticipationState, getFrontierBetModalLayout, getFrontierCollectorPlacement, getFrontierEBoostIconAsset, getFrontierEntryPhase, getFrontierFeatureIntroPreference, getFrontierLoadingMessage, getFrontierMainControlActions, getFrontierReelAction, getFrontierSpinAnimationMode, getFrontierWheelDrama, getFrontierWheelPrizeClass, getFrontierWheelResultAction, getFrontierWheelSegmentDisplayLabel, getGoldRushFreeSpinDisplayInterior, getGoldRushMineClashArea, getGoldRushMineClashDisplayMultipliers, getGoldRushMineClashSegments, getJackpotBadgeLabels, getNextFrontierSpinSpeed, getNextFrontierStickyWildPositions, getPaylineOverlayPoints, getTreasurePotChargeLevel, getTreasurePotVisualState, getWheelLandingDegrees, getWheelSectionLabels, goldRushFxAssets, setFrontierFeatureIntroPreference } from "./SlotMachine";
import { getReelStopSchedule, getSpinDuration, slotAnimation } from "./slotAnimation";
import { nextFreeSpinTotal } from "./slotSession";
import { feedbackUiMarkers } from "../feedback/components";
import { setSoundEnabled } from "../feedback/feedbackService";
import { getProgression, recordSpinProgress } from "../progression/progressionService";
import { claimStreak, getStreak, resetStreak } from "../streaks/streakService";
import { claimMission, getMissions, recordMissionEvent } from "../missions/missionService";
import { isFavorite, toggleFavorite } from "./favorites";
import { updateData } from "../lib/storage";
import { canClaimLowBalanceOffer, claimLowBalanceOffer, claimPromotion, getMostPlayedGames, getRetentionState, recordRetentionRound, resetRetention } from "../retention/retentionService";
import type { SlotSpinResult } from "./types";
import { ExpansionBonusOverlay } from "./ExpansionBonusOverlay";
import { calculateExpansionBonus, getExpansionFramePositions, getExpansionTriggerPositions, selectExpansionFrame } from "./expansionBonus";
import { GoldRushFeatureToast, GoldRushWinOverlay, getGoldRushAudioDebugCount, getGoldRushWinOverlayDuration, getGoldRushWinTier, goldRushAudioManifest, goldRushSoundEventConfig, playGoldRushSound, resetGoldRushAudioDebugCounts } from "./goldRushFeedback";

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
if (!exposedSlotConfigs.some((candidate) => candidate.id === "frontier-fortune") || !exposedSlotConfigs.some((candidate) => candidate.id === "gold-rush-showdown")) {
  throw new Error("Expected Frontier Fortune and Gold Rush Showdown to be exposed.");
}
const exposedFrontier = exposedSlotConfigs.find((candidate) => candidate.id === "frontier-fortune");
if (!exposedFrontier) throw new Error("Expected exposed Frontier Fortune config.");
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
  if (!exposedFrontier.symbols.some((symbol) => symbol.image === assetPath)) {
    throw new Error(`Missing Frontier Fortune symbol config asset: ${filename}`);
  }
}
if (exposedFrontier.symbols.some((symbol) => !symbol.image)) {
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
if (!feedbackUiMarkers.winOverlay || !feedbackUiMarkers.coinBurst || !feedbackUiMarkers.screenShake) {
  throw new Error("Expected shared Frontier feedback components to be available.");
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

const goldRush = slotConfigs.find((candidate) => candidate.id === "gold-rush-showdown");
if (!goldRush) throw new Error("Expected Gold Rush Showdown config.");
if (!goldRush.visual.logoImage?.includes("title-logo")) {
  throw new Error("Expected Gold Rush Showdown to expose its title logo for shared game surfaces.");
}
if (goldRush.jackpotLabels) {
  throw new Error("Expected Gold Rush Showdown to omit header jackpot badges.");
}
if (getBetOptions(goldRush, "GOLD")[0] !== 10 || getBetOptions(goldRush, "BONUS")[0] !== 0.1) {
  throw new Error("Expected Gold Rush Showdown to use configured Gold and Sweeps bet ladders.");
}
const goldUser: User = { ...user, id: "gold-rush-test-user", email: "gold-rush@test.local" };
creditCurrency({ userId: goldUser.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100000 });
const goldBetTxBefore = getTransactions(goldUser.id).filter((tx) => tx.type === "GAME_BET").length;
spinSlot({ user: goldUser, game: goldRush, currency: "GOLD", betAmount: goldRush.minBet });
if (getTransactions(goldUser.id).filter((tx) => tx.type === "GAME_BET").length !== goldBetTxBefore + 1) {
  throw new Error("Expected Gold Rush Showdown spin to create a GAME_BET ledger entry.");
}
try {
  spinSlot({ user: goldUser, game: goldRush, currency: "GOLD", betAmount: goldRush.minBet / 2 });
  throw new Error("Expected Gold Rush below-min bet to fail.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Minimum bet")) throw error;
}
try {
  spinSlot({ user: goldUser, game: goldRush, currency: "GOLD", betAmount: goldRush.maxBet + 1 });
  throw new Error("Expected Gold Rush above-max bet to fail.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Maximum bet")) throw error;
}
const goldBonusBefore = getBalance(goldUser.id, "BONUS");
try {
  spinSlot({ user: goldUser, game: goldRush, currency: "BONUS", betAmount: goldRush.minBet });
  throw new Error("Expected Gold Rush overdraft spin to fail.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Insufficient balance.") throw error;
}
if (getBalance(goldUser.id, "BONUS") !== goldBonusBefore) throw new Error("Gold Rush overdraft changed balance.");
if (goldRush.reelCount !== 6 || goldRush.rowCount !== 4 || goldRush.paylines.some((payline) => payline.rows.length !== 6 || payline.rows.some((row) => row < 0 || row > 3))) {
  throw new Error("Expected Gold Rush Showdown to use a real 6x4 reel grid with 6-column paylines.");
}
const generatedGoldGrid = generateGrid(goldRush);
if (generatedGoldGrid.length !== 6 || generatedGoldGrid.some((reel) => reel.length !== 4)) {
  throw new Error("Expected Gold Rush generated spins to fill all 6 columns and 4 rows.");
}
const forcedVsRandom = Math.random;
Math.random = () => 0.999999;
let forcedVsGrid: string[][];
try {
  forcedVsGrid = generateGrid(goldRush);
} finally {
  Math.random = forcedVsRandom;
}
if (forcedVsGrid.some((reel) => reel.filter((symbol) => symbol === "vs_mine_clash").length > 1)) {
  throw new Error("Expected Gold Rush generated reels to cap VS symbols at one per reel.");
}
const goldStopSchedule = getReelStopSchedule("normal", goldRush.reelCount);
if (goldStopSchedule.length !== 6 || goldStopSchedule[5] <= goldStopSchedule[4]) {
  throw new Error("Expected Gold Rush sixth reel to receive a Frontier-style staggered stop time.");
}
const goldLineGrid = [
  ["10", "K", "treasure_chest", "J"],
  ["K", "Q", "treasure_chest", "A"],
  ["Q", "10", "treasure_chest", "K"],
  ["J", "Q", "treasure_chest", "10"],
  ["10", "K", "treasure_chest", "Q"],
  ["A", "J", "treasure_chest", "K"],
];
const goldLineResult = calculateSlotResult(goldRush, 100, false, goldLineGrid);
if (!goldLineResult.lineWins.some((win) => win.paylineId === "middle-low" && win.symbol === "treasure_chest" && win.count === 6 && win.positions.some((position) => position.reel === 5 && position.row === 2))) {
  throw new Error("Expected Gold Rush 6-column payline to calculate through the sixth reel.");
}
const goldRushRenderedSymbols = ["10", "J", "Q", "K", "A", "pickaxe", "lantern", "mine_cart", "dynamite", "gold_nugget", "blue_diamond", "treasure_chest", "mine_scatter", "vs_mine_clash"];
goldRushRenderedSymbols.forEach((symbolId) => {
  const symbol = goldRush.symbols.find((candidate) => candidate.id === symbolId);
  if (!symbol?.image) throw new Error(`Expected Gold Rush symbol ${symbolId} to use a rendered image asset.`);
});
if (goldRush.specialSymbols?.wild !== "wild") {
  throw new Error("Expected Gold Rush to reserve the wild id for VS multiplier transforms.");
}
if (goldRush.symbols.some((symbol) => symbol.kind === "wild" || symbol.id === "wild")) {
  throw new Error("Expected Gold Rush base reels to exclude regular wild symbols.");
}
if (goldRush.freeSpins.stickyWilds) {
  throw new Error("Expected Gold Rush free spins to avoid sticky wilds while Mine Clash tuning is pending.");
}
const threeJackGrid = [
  ["J", "Q", "K", "A"],
  ["J", "K", "A", "Q"],
  ["J", "A", "Q", "K"],
  ["Q", "10", "K", "A"],
  ["A", "Q", "10", "K"],
  ["K", "A", "Q", "10"],
];
const threeJackResult = calculateSlotResult(goldRush, 0.1, false, threeJackGrid);
const threeJackTopWin = threeJackResult.lineWins.find((win) => win.paylineId === "top" && win.symbol === "J");
if (!threeJackTopWin || Math.abs(threeJackTopWin.payout - 0.01) > 0.0001) {
  throw new Error(`Expected 0.10 bet with 3 J symbols to pay 0.01, got ${threeJackTopWin?.payout}.`);
}
const threeTenGrid = [
  ["Q", "Q", "10", "10"],
  ["mine_cart", "Q", "10", "A"],
  ["lantern", "lantern", "10", "K"],
  ["Q", "mine_cart", "blue_diamond", "pickaxe"],
  ["10", "dynamite", "10", "mine_cart"],
  ["mine_cart", "J", "10", "10"],
];
const threeTenResult = calculateSlotResult(goldRush, 100, false, threeTenGrid);
const threeTenMiddleLowWin = threeTenResult.lineWins.find((win) => win.paylineId === "middle-low" && win.symbol === "10");
if (!threeTenMiddleLowWin || threeTenMiddleLowWin.count !== 3 || threeTenMiddleLowWin.payout !== 8) {
  throw new Error(`Expected screenshot-style 3x 10s on the lower mine run to pay 8, got ${JSON.stringify(threeTenMiddleLowWin)}.`);
}
const sixTreasureWin = goldLineResult.lineWins.find((win) => win.paylineId === "middle-low" && win.symbol === "treasure_chest");
if (!sixTreasureWin || sixTreasureWin.payout !== 2500) {
  throw new Error(`Expected 6 treasure chests to pay 25x total bet, got ${sixTreasureWin?.payout}.`);
}
const goldBottomLineGrid = [
  ["10", "K", "treasure_chest", "blue_diamond"],
  ["K", "Q", "treasure_chest", "blue_diamond"],
  ["Q", "10", "treasure_chest", "blue_diamond"],
  ["J", "Q", "treasure_chest", "blue_diamond"],
  ["10", "K", "treasure_chest", "blue_diamond"],
  ["A", "J", "treasure_chest", "blue_diamond"],
];
const goldBottomLineResult = calculateSlotResult(goldRush, 100, false, goldBottomLineGrid);
const sixDiamondBottomWin = goldBottomLineResult.lineWins.find((win) => win.paylineId === "bottom" && win.symbol === "blue_diamond");
if (!sixDiamondBottomWin || sixDiamondBottomWin.count !== 6 || sixDiamondBottomWin.payout !== 1600 || !sixDiamondBottomWin.positions.some((position) => position.reel === 5 && position.row === 3)) {
  throw new Error(`Expected bottom-row Diamond win to pay through reel 6, got ${JSON.stringify(sixDiamondBottomWin)}.`);
}
const bottomPayline = goldRush.paylines.find((payline) => payline.id === "bottom");
if (!bottomPayline) throw new Error("Expected Gold Rush bottom payline config.");
const bottomOverlayPoints = getPaylineOverlayPoints(bottomPayline, sixDiamondBottomWin.positions);
if (!bottomOverlayPoints.startsWith("50,350") || !bottomOverlayPoints.endsWith("550,350")) {
  throw new Error(`Expected bottom payline overlay to draw from reel 1 bottom to reel 6 bottom, got ${bottomOverlayPoints}.`);
}
const goldThreeScatterGrid = [
  ["mine_scatter", "10", "J", "A"],
  ["A", "mine_scatter", "Q", "K"],
  ["K", "10", "mine_scatter", "J"],
  ["Q", "J", "A", "10"],
  ["10", "K", "Q", "A"],
  ["J", "Q", "K", "10"],
];
const goldFourScatterGrid = [
  ["mine_scatter", "10", "J", "A"],
  ["A", "mine_scatter", "Q", "K"],
  ["K", "10", "mine_scatter", "J"],
  ["Q", "mine_scatter", "A", "10"],
  ["10", "K", "Q", "A"],
  ["J", "Q", "K", "10"],
];
const goldFiveScatterGrid = [
  ["mine_scatter", "10", "J", "A"],
  ["A", "mine_scatter", "Q", "K"],
  ["K", "10", "mine_scatter", "J"],
  ["Q", "mine_scatter", "A", "10"],
  ["10", "K", "mine_scatter", "A"],
  ["J", "Q", "K", "10"],
];
if (calculateSlotResult(goldRush, 100, false, goldThreeScatterGrid).freeSpinsAwarded !== 10) throw new Error("Expected 3 Gold Rush scatters to award 10 free spins.");
const fourScatterTrigger = calculateSlotResult(goldRush, 100, false, goldFourScatterGrid);
if (fourScatterTrigger.freeSpinsAwarded !== 10 || fourScatterTrigger.goldRush?.freeSpinsTrigger?.initialInteriorColumns !== 3) {
  throw new Error("Expected 4 Gold Rush Bonus symbols to award 10 free spins with a 3x4 starting interior.");
}
const fiveScatterTrigger = calculateSlotResult(goldRush, 100, false, goldFiveScatterGrid);
if (fiveScatterTrigger.freeSpinsAwarded !== 10 || fiveScatterTrigger.goldRush?.freeSpinsTrigger?.initialInteriorColumns !== 3) {
  throw new Error("Expected 5 Gold Rush Bonus symbols to use Super Free Spins start rules.");
}
if (calculateSlotResult(goldRush, 100, true, goldThreeScatterGrid).freeSpinsAwarded !== 0) {
  throw new Error("Expected Gold Rush Bonus symbols during free spins to collect into the meter instead of nested retriggering.");
}
const cappedGoldFreeSpins = calculateFreeSpinsBonus(goldRush, 100, 30);
if (cappedGoldFreeSpins.spinsAwarded > 30 || cappedGoldFreeSpins.spinsPlayed > 30) {
  throw new Error("Expected Gold Rush free spin retriggers to respect the 30-spin cap.");
}
if (getGoldRushBonusBuyCost(goldRush, 0.1, "bonus-plus-spins") !== 0.3 || getGoldRushBonusBuyCost(goldRush, 0.1, "showdown-spin") !== 5 || getGoldRushBonusBuyCost(goldRush, 0.1, "buy-bonus") !== 10 || getGoldRushBonusBuyCost(goldRush, 0.1, "buy-super-bonus") !== 30) {
  throw new Error("Expected Gold Rush bonus buy costs to scale as 3x, 50x, 100x, and 300x bet.");
}
if (goldRush.goldRushBonusBuys?.options.some((option) => !option.image)) {
  throw new Error("Expected Gold Rush bonus buy options to provide image assets.");
}
if (
  getGoldRushWinTier(100, 100) !== "small" ||
  getGoldRushWinTier(500, 100) !== "nice" ||
  getGoldRushWinTier(1500, 100) !== "big" ||
  getGoldRushWinTier(5000, 100) !== "mega" ||
  getGoldRushWinTier(15000, 100) !== "epic" ||
  getGoldRushWinOverlayDuration("epic") !== 3500
) {
  throw new Error("Expected Gold Rush win overlays to classify win tiers from bet multipliers.");
}
const goldRushSmallWinOverlayMarkup = renderToStaticMarkup(createElement(GoldRushWinOverlay, {
  result: { ...goldLineResult, payout: 120, winTier: "SMALL" },
  betAmount: 100,
  currencyLabel: "GC",
  onDismiss: () => undefined,
}));
if (!goldRushSmallWinOverlayMarkup.includes("Small Win")) {
  throw new Error("Expected Gold Rush small win overlay to render at 1x+ bet.");
}
const goldRushWinOverlayMarkup = renderToStaticMarkup(createElement(GoldRushWinOverlay, {
  result: { ...goldLineResult, payout: 1500, winTier: "BIG" },
  betAmount: 100,
  currencyLabel: "GC",
  onDismiss: () => undefined,
}));
if (!goldRushWinOverlayMarkup.includes("gold-rush-win-overlay") || !goldRushWinOverlayMarkup.includes("Big Win")) {
  throw new Error("Expected Gold Rush to render a premium slot-specific win overlay.");
}
const goldRushFeatureToastMarkup = renderToStaticMarkup(createElement(GoldRushFeatureToast, {
  title: "Bonus Boost",
  primary: "+2 Spins",
  secondary: "Interior 3x4",
}));
if (!goldRushFeatureToastMarkup.includes("gold-rush-feature-toast") || !goldRushFeatureToastMarkup.includes("Interior 3x4")) {
  throw new Error("Expected Gold Rush feature toasts for interior growth and meter hits.");
}
const displayInterior = getGoldRushFreeSpinDisplayInterior(goldRush, 4, 5);
if (displayInterior.startColumn !== 2 || displayInterior.columns !== 4 || displayInterior.rowCount !== 4) {
  throw new Error("Expected Gold Rush free-spin display interior to clamp start without pre-selecting the next spin frame.");
}
if (!goldRushAudioManifest.music_loop.includes("gold-rush-showdown/audio") || !goldRushSoundEventConfig.vs_expand.duckMusic) {
  throw new Error("Expected Gold Rush audio manifest and feature sound metadata.");
}
resetGoldRushAudioDebugCounts();
setSoundEnabled(false);
if (playGoldRushSound("spin_start")) {
  throw new Error("Expected muted Gold Rush audio helper to skip playback.");
}
if (getGoldRushAudioDebugCount("spin_start") !== 1) {
  throw new Error("Expected Gold Rush audio helper to track missing-safe sound hooks.");
}
setSoundEnabled(false);
if (getGoldRushFreeSpinInitialInteriorColumns(goldRush, 3) !== 2 || getGoldRushFreeSpinInitialInteriorColumns(goldRush, 4) !== 3) {
  throw new Error("Expected Gold Rush Free Spins to start at 2x4 for 3 Bonus and 3x4 for 4 Bonus.");
}
const forcedBuyGrid = createGoldRushBonusTriggerGrid(goldRush, 3);
if (forcedBuyGrid.flat().filter((symbol) => symbol === "mine_scatter").length !== 3) {
  throw new Error("Expected Buy Bonus forced spin to land exactly 3 Bonus symbols.");
}
const forcedSuperGrid = createGoldRushBonusTriggerGrid(goldRush, 4);
if (forcedSuperGrid.flat().filter((symbol) => symbol === "mine_scatter").length !== 4) {
  throw new Error("Expected Buy Super Bonus forced spin to land exactly 4 Bonus symbols.");
}
const showdownForced = createGoldRushShowdownBoostGrid(goldRush);
if (!showdownForced.interior || showdownForced.interior.columns < 2 || showdownForced.grid.flat().filter((symbol) => symbol === "vs_mine_clash").length < 1) {
  throw new Error("Expected Showdown Spin to force at least one VS and a 2x4 interior.");
}
const goldRushBuyUser: User = { ...user, id: "gold-rush-buy-test-user", email: "gold-rush-buy@test.local" };
creditCurrency({ userId: goldRushBuyUser.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 1000 });
const goldRushBuyBalance = getBalance(goldRushBuyUser.id, "GOLD");
debitGoldRushBonusBuy({ user: goldRushBuyUser, game: goldRush, currency: "GOLD", betAmount: 10, bonusType: "bonus-plus-spins" });
const goldRushBoostDebit = getTransactions(goldRushBuyUser.id).find((tx) => tx.type === "BUY_BONUS" && tx.metadata.bonusType === "bonus-plus-spins");
if (!goldRushBoostDebit || goldRushBoostDebit.metadata.action !== "boost-buy" || Math.abs(goldRushBuyBalance - getBalance(goldRushBuyUser.id, "GOLD") - 30) > 0.001) {
  throw new Error("Expected Gold Rush boost buy to debit through BUY_BONUS ledger metadata.");
}
const prepaidBoostResult = spinSlot({ user: goldRushBuyUser, game: goldRush, currency: "GOLD", betAmount: 10, spinMode: "GOLD_RUSH_BONUS_BOOST", prepaidWager: 30 });
if (prepaidBoostResult.wager !== 30) {
  throw new Error("Expected armed Gold Rush boost spin to consume the prepaid wager without another displayed cost.");
}
try {
  debitGoldRushBonusBuy({ user, game: goldRush, currency: "BONUS", betAmount: 0.1, bonusType: "buy-bonus" });
  throw new Error("Expected Gold Rush bonus buy insufficient balance.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Insufficient balance.") throw error;
}
const growthFreeSpins = calculateFreeSpinsBonus(goldRush, 100, 10, 2);
if (growthFreeSpins.finalInteriorColumns < 2 || growthFreeSpins.finalInteriorColumns > 6 || growthFreeSpins.spinsAwarded < 10) {
  throw new Error("Expected Gold Rush Free Spins to track interior growth and awarded spins safely.");
}
if (goldRush.expansionBonus?.mechanic !== "mine-clash") {
  throw new Error("Expected Gold Rush expansion bonus to use Mine Clash.");
}
const fixedMineClashConfig = {
  ...goldRush.expansionBonus,
  frameWidths: [{ width: 2, weight: 1 }],
  mineClash: {
    goldMiner: { min: 2, max: 2, weight: 1 },
    diamondMiner: { min: 2, max: 2, weight: 0 },
    rareBoost: { multiplier: 50, chance: 0 },
  },
} as NonNullable<typeof goldRush.expansionBonus>;
const mineTriggerPositions = getExpansionTriggerPositions([
  ["10", "10", "J", "A"],
  ["A", "K", "Q", "J"],
  ["K", "vs_mine_clash", "J", "Q"],
  ["Q", "J", "A", "10"],
  ["10", "K", "Q", "A"],
  ["J", "Q", "K", "10"],
], "vs_mine_clash");
if (mineTriggerPositions.length !== 1) {
  throw new Error("Expected VS trigger detection to find one Mine Clash symbol.");
}
const selectedFrame = selectExpansionFrame(goldRush, [{ reel: 4, row: 1 }], {
  ...fixedMineClashConfig,
  frameWidths: [{ width: 3, weight: 1 }],
});
if (selectedFrame.width !== 3 || selectedFrame.startReel !== 3) {
  throw new Error(`Expected frame size to clamp around the trigger, got ${selectedFrame.startReel}/${selectedFrame.width}.`);
}
const directMineClash = calculateExpansionBonus(goldRush, 100, [{ reel: 2, row: 1 }], fixedMineClashConfig);
if (directMineClash.sourceFeature !== "mine-clash" || directMineClash.mineClash?.winner !== "gold" || directMineClash.multiplier !== 2) {
  throw new Error("Expected weighted Mine Clash config to select the Gold Miner 2x outcome.");
}
if ((directMineClash.transformedPositions?.length ?? 0) !== getExpansionFramePositions(directMineClash.frame!).length) {
  throw new Error("Expected Mine Clash transformed positions to match the selected frame.");
}
const fixedGoldRushVs = {
  ...goldRush.goldRushVs!,
  duelTiers: [
    {
      id: "gold-gold" as const,
      label: "Gold vs Gold",
      weight: 1,
      winner: "gold" as const,
      multipliers: [{ multiplier: 2, weight: 1 }],
    },
  ],
};
const mineClashTestGame = {
  ...goldRush,
  expansionBonus: fixedMineClashConfig,
  goldRushVs: fixedGoldRushVs,
  goldRushInterior: { ...goldRush.goldRushInterior!, appearanceChance: 0 },
};
const inactiveVsGrid = [
  ["J", "Q", "K", "A"],
  ["Q", "K", "A", "J"],
  ["K", "A", "J", "Q"],
  ["A", "J", "Q", "K"],
  ["vs_mine_clash", "10", "J", "A"],
  ["10", "Q", "K", "J"],
];
const inactiveVsResult = calculateSlotResult(mineClashTestGame, 100, false, inactiveVsGrid);
if (inactiveVsResult.triggeredExpansionBonus || inactiveVsResult.goldRush?.vsActive) {
  throw new Error("Expected VS to stay inactive when a column transform cannot create or complete a line pay.");
}
if ((inactiveVsResult.goldRush?.inactiveVsPositions.length ?? 0) !== 1 || inactiveVsResult.payout !== inactiveVsResult.goldRush?.baseLinePayout) {
  throw new Error("Expected inactive VS metadata to retain the VS position without extra pay.");
}
const mineClashGrid = [
  ["J", "Q", "K", "A"],
  ["J", "K", "A", "Q"],
  ["vs_mine_clash", "A", "Q", "K"],
  ["Q", "10", "J", "A"],
  ["A", "Q", "10", "K"],
  ["K", "A", "Q", "10"],
];
const mineClashResult = calculateSlotResult(mineClashTestGame, 100, false, mineClashGrid);
if (!mineClashResult.triggeredExpansionBonus || !mineClashResult.expansionBonus) {
  throw new Error("Expected VS symbol to trigger Mine Clash.");
}
if (mineClashResult.expansionBonus.sourceFeature !== "mine-clash" || mineClashResult.goldRush?.vsType !== "normal-column") {
  throw new Error("Expected Mine Clash to create multiplier wild transformed positions.");
}
if ((mineClashResult.expansionBonus.transformedPositions?.length ?? 0) !== 4 || new Set(mineClashResult.expansionBonus.transformedPositions?.map((position) => position.reel)).size !== 1) {
  throw new Error("Expected normal Mine Clash to transform all 4 rows in the active VS column only.");
}
if (!mineClashResult.lineWins.some((win) => win.paylineId === "top" && win.symbol === "J" && Math.abs(win.multiplier - 0.2) < 0.0001)) {
  throw new Error("Expected Mine Clash multiplier wilds to participate in payline evaluation.");
}
if (mineClashResult.expansionBonus.payout !== mineClashResult.payout) {
  throw new Error("Expected Mine Clash payout metadata to match the transformed line payout.");
}
const normalVsArea = getGoldRushMineClashArea(mineClashResult, goldRush.reelCount, goldRush.rowCount);
if (normalVsArea.areaType !== "column" || normalVsArea.width !== 1 || normalVsArea.rowSpan !== 4 || normalVsArea.startReel !== 2) {
  throw new Error(`Expected normal VS grid overlay to cover one full-height column, got ${JSON.stringify(normalVsArea)}.`);
}
if (mineClashResult.goldRush?.activeColumns?.count !== 1 || mineClashResult.goldRush.activeRows?.count !== 4 || !mineClashResult.goldRush.vsCandidateMultipliers || mineClashResult.goldRush.vsWinningMultiplier !== 2 || mineClashResult.goldRush.vsWinnerSide !== "gold") {
  throw new Error("Expected normal VS metadata to include active bounds, candidate multipliers, and one winning multiplier.");
}
const normalGridOverlayMarkup = renderToStaticMarkup(createElement(GoldRushMineClashGridOverlay, {
  result: mineClashResult,
  reelCount: goldRush.reelCount,
  rowCount: goldRush.rowCount,
  onComplete: () => undefined,
}));
if (!normalGridOverlayMarkup.includes("gold-rush-grid-clash-overlay") || normalGridOverlayMarkup.includes("expansion-bonus-overlay") || normalGridOverlayMarkup.includes("aria-modal")) {
  throw new Error("Expected Mine Clash to render as a grid-local overlay, not a full-screen modal.");
}
if (
  !goldRushFxAssets.mineClashImpactPop.includes("mine-clash-impact-pop") ||
  !goldRushFxAssets.mineClashChamber.includes("mine-clash-chamber") ||
  !goldRushFxAssets.goldMinerPortrait.includes("gold-miner-portrait") ||
  !goldRushFxAssets.diamondMinerPortrait.includes("diamond-miner-portrait") ||
  !normalGridOverlayMarkup.includes("mine-clash-impact-pop") ||
  !normalGridOverlayMarkup.includes("mine-clash-chamber") ||
  !normalGridOverlayMarkup.includes("gold-miner-portrait")
) {
  throw new Error("Expected Mine Clash grid overlay to use raster chamber, impact, and tier-appropriate miner portrait FX assets.");
}
if ((normalGridOverlayMarkup.match(/Gold Miner/g) ?? []).length < 2 || normalGridOverlayMarkup.includes("Diamond Miner")) {
  throw new Error("Expected Gold vs Gold Mine Clash display to show two gold miners, not a weak diamond opponent.");
}
if (!normalGridOverlayMarkup.includes("--clash-width:1") || !normalGridOverlayMarkup.includes("--clash-row-span:4")) {
  throw new Error("Expected normal VS overlay style variables to match one column and four rows.");
}
const normalDisplayMultipliers = getGoldRushMineClashDisplayMultipliers(mineClashResult);
if (normalDisplayMultipliers.gold === normalDisplayMultipliers.diamond || normalDisplayMultipliers.gold !== mineClashResult.goldRush?.vsWinningMultiplier || normalDisplayMultipliers.diamondLabel !== "Gold Miner") {
  throw new Error("Expected Mine Clash duel display to show distinct visual multipliers while preserving the winning multiplier.");
}
const goldDiamondMineClashResult: SlotSpinResult = {
  ...mineClashResult,
  goldRush: {
    ...mineClashResult.goldRush!,
    vsTier: "gold-diamond",
    vsWinnerSide: "diamond",
    vsWinningMultiplier: 6,
    vsCandidateMultipliers: { gold: 3, diamond: 6 },
    mineClashColumns: mineClashResult.goldRush!.mineClashColumns?.map((column) => ({
      ...column,
      tier: "gold-diamond" as const,
      winner: "diamond" as const,
      multiplier: 6,
      goldMultiplier: 3,
      diamondMultiplier: 6,
    })),
    activeSegments: mineClashResult.goldRush!.activeSegments?.map((segment) => ({
      ...segment,
      tier: "gold-diamond" as const,
      winner: "diamond" as const,
      multiplier: 6,
      goldMultiplier: 3,
      diamondMultiplier: 6,
    })),
  },
  expansionBonus: mineClashResult.expansionBonus
    ? {
      ...mineClashResult.expansionBonus,
      vsTier: "gold-diamond",
      vsWinnerSide: "diamond",
      vsWinningMultiplier: 6,
      vsCandidateMultipliers: { gold: 3, diamond: 6 },
      mineClashColumns: mineClashResult.expansionBonus.mineClashColumns?.map((column) => ({
        ...column,
        tier: "gold-diamond" as const,
        winner: "diamond" as const,
        multiplier: 6,
        goldMultiplier: 3,
        diamondMultiplier: 6,
      })),
      activeSegments: mineClashResult.expansionBonus.activeSegments?.map((segment) => ({
        ...segment,
        tier: "gold-diamond" as const,
        winner: "diamond" as const,
        multiplier: 6,
        goldMultiplier: 3,
        diamondMultiplier: 6,
      })),
      mineClash: {
        ...mineClashResult.expansionBonus.mineClash!,
        winner: "diamond",
        goldMultiplier: 3,
        diamondMultiplier: 6,
      },
    }
    : undefined,
};
const goldDiamondDisplay = getGoldRushMineClashDisplayMultipliers(goldDiamondMineClashResult);
const goldDiamondOverlayMarkup = renderToStaticMarkup(createElement(GoldRushMineClashGridOverlay, {
  result: goldDiamondMineClashResult,
  reelCount: goldRush.reelCount,
  rowCount: goldRush.rowCount,
  onComplete: () => undefined,
}));
if (goldDiamondDisplay.diamond <= goldDiamondDisplay.gold || goldDiamondDisplay.diamondLabel !== "Diamond Miner" || !goldDiamondOverlayMarkup.includes("diamond-miner-portrait")) {
  throw new Error("Expected Gold vs Diamond Mine Clash display to show a stronger diamond miner candidate.");
}
const finalColumnPanelMarkup = renderToStaticMarkup(createElement(GoldRushMineClashFinalPanel, {
  result: mineClashResult,
  reelCount: goldRush.reelCount,
  rowCount: goldRush.rowCount,
}));
if (!finalColumnPanelMarkup.includes("gold-rush-final-clash-panel") || !finalColumnPanelMarkup.includes("area-column") || !finalColumnPanelMarkup.includes("width-1") || !finalColumnPanelMarkup.includes("--clash-width:1") || !finalColumnPanelMarkup.includes("mine-clash-chamber")) {
  throw new Error("Expected completed normal Mine Clash to render one connected winner column with chamber background.");
}
if ((finalColumnPanelMarkup.match(/vs-mine-clash/g) ?? []).length > 0) {
  throw new Error("Expected completed normal Mine Clash to avoid repeating VS symbols in every transformed cell.");
}
[1, 2, 3, 4, 5, 6].forEach((width) => {
  const areaResult = {
    ...mineClashResult,
    goldRush: {
      ...mineClashResult.goldRush!,
      activeColumns: { start: 0, count: width },
      activeAreaType: width === 1 ? "column" as const : "interior" as const,
      vsType: width === 1 ? "normal-column" as const : "interior" as const,
      activeSegments: [{
        type: width === 1 ? "column" as const : "interior" as const,
        startReel: 0,
        width,
        rowStart: 0,
        rowCount: 4,
        winner: "gold" as const,
        multiplier: 2,
        tier: "gold-gold" as const,
        goldMultiplier: 2,
        diamondMultiplier: 4,
        transformedPositions: Array.from({ length: width * 4 }, (_, index) => ({ reel: Math.floor(index / 4), row: index % 4 })),
      }],
    },
    expansionBonus: {
      ...mineClashResult.expansionBonus!,
      frame: { startReel: 0, width, rowStart: 0, rowCount: 4, reelCount: 6 },
      activeSegments: [{
        type: width === 1 ? "column" as const : "interior" as const,
        startReel: 0,
        width,
        rowStart: 0,
        rowCount: 4,
        winner: "gold" as const,
        multiplier: 2,
        tier: "gold-gold" as const,
        goldMultiplier: 2,
        diamondMultiplier: 4,
        transformedPositions: Array.from({ length: width * 4 }, (_, index) => ({ reel: Math.floor(index / 4), row: index % 4 })),
      }],
    },
  };
  const overlayForWidth = renderToStaticMarkup(createElement(GoldRushMineClashGridOverlay, {
    result: areaResult,
    reelCount: goldRush.reelCount,
    rowCount: goldRush.rowCount,
    onComplete: () => undefined,
  }));
  const finalForWidth = renderToStaticMarkup(createElement(GoldRushMineClashFinalPanel, {
    result: areaResult,
    reelCount: goldRush.reelCount,
    rowCount: goldRush.rowCount,
  }));
  if (!overlayForWidth.includes(`width-${width}`) || !overlayForWidth.includes(`--clash-width:${width}`) || !overlayForWidth.includes("mine-clash-chamber")) {
    throw new Error(`Expected Mine Clash grid overlay to expose width-${width} chamber sizing.`);
  }
  if (!finalForWidth.includes(`width-${width}`) || !finalForWidth.includes(`--clash-width:${width}`) || !finalForWidth.includes("mine-clash-chamber")) {
    throw new Error(`Expected Mine Clash final panel to expose width-${width} chamber sizing.`);
  }
  if (!finalForWidth.includes('class="final-miner-avatar"') || !finalForWidth.includes('data-center-anchor="true"')) {
    throw new Error(`Expected Mine Clash final panel width-${width} to render a centered winner miner anchor.`);
  }
});
const adjacentVsGrid = [
  ["vs_mine_clash", "Q", "K", "A"],
  ["vs_mine_clash", "K", "A", "Q"],
  ["J", "A", "Q", "K"],
  ["J", "10", "J", "A"],
  ["A", "Q", "10", "K"],
  ["K", "A", "Q", "10"],
];
const adjacentVsResult = calculateSlotResult(mineClashTestGame, 100, false, adjacentVsGrid);
if (adjacentVsResult.goldRush?.vsType !== "normal-column" || (adjacentVsResult.goldRush.activeVsPositions?.length ?? 0) !== 2) {
  throw new Error("Expected adjacent VS reels to activate together when both are needed for the left-to-right connection.");
}
if ((adjacentVsResult.goldRush?.mineClashColumns?.length ?? 0) !== 2 || new Set(adjacentVsResult.goldRush.transformedPositions?.map((position) => position.reel)).size !== 2) {
  throw new Error("Expected each active adjacent VS reel to get its own Mine Clash column result.");
}
if (adjacentVsResult.goldRush?.mineClashColumns?.some((column) => column.goldMultiplier === column.diamondMultiplier)) {
  throw new Error("Expected each Mine Clash column to expose distinct gold and diamond visual multipliers.");
}
if (!adjacentVsResult.lineWins.some((win) => win.paylineId === "top" && win.symbol === "J" && win.count === 4 && Math.abs(win.multiplier - 1) < 0.0001)) {
  throw new Error("Expected adjacent VS column multipliers to add safely on the line they complete.");
}
const adjacentVsArea = getGoldRushMineClashArea(adjacentVsResult, goldRush.reelCount, goldRush.rowCount);
const adjacentVsSegments = getGoldRushMineClashSegments(adjacentVsResult, goldRush.reelCount, goldRush.rowCount);
if (adjacentVsArea.startReel !== 0 || adjacentVsArea.width !== 1 || adjacentVsArea.rowSpan !== 4 || adjacentVsSegments.length !== 2 || adjacentVsSegments.some((segment) => segment.width !== 1 || segment.areaType !== "column")) {
  throw new Error(`Expected adjacent VS overlay to keep two separate active column segments, got ${JSON.stringify(adjacentVsSegments)}.`);
}
const adjacentFinalMarkup = renderToStaticMarkup(createElement(GoldRushMineClashFinalPanel, {
  result: adjacentVsResult,
  reelCount: goldRush.reelCount,
  rowCount: goldRush.rowCount,
}));
if ((adjacentFinalMarkup.match(/gold-rush-final-clash-panel/g)?.length ?? 0) !== 2 || adjacentFinalMarkup.includes("--clash-width:2")) {
  throw new Error("Expected multi-column Mine Clash final panel to render separate winner columns instead of one connected frame.");
}
const gappedVsGrid = [
  ["vs_mine_clash", "Q", "K", "A"],
  ["J", "K", "A", "Q"],
  ["vs_mine_clash", "A", "Q", "K"],
  ["J", "10", "J", "A"],
  ["A", "Q", "10", "K"],
  ["K", "A", "Q", "10"],
];
const gappedVsResult = calculateSlotResult(mineClashTestGame, 100, false, gappedVsGrid);
const gappedVsSegments = getGoldRushMineClashSegments(gappedVsResult, goldRush.reelCount, goldRush.rowCount);
if (
  gappedVsResult.goldRush?.vsType !== "normal-column" ||
  gappedVsSegments.length !== 2 ||
  gappedVsSegments[0].startReel !== 0 ||
  gappedVsSegments[1].startReel !== 2 ||
  gappedVsSegments.some((segment) => segment.width !== 1)
) {
  throw new Error(`Expected gapped VS reels to run separate 1x4 Mine Clash segments without filling reel 2, got ${JSON.stringify(gappedVsSegments)}.`);
}
if (!gappedVsResult.lineWins.some((win) => win.paylineId === "top" && win.symbol === "J" && win.count === 4)) {
  throw new Error("Expected separated gapped VS columns to still evaluate as wilds for the completed top line.");
}
const screenshotVsGrid = [
  ["pickaxe", "gold_nugget", "K", "blue_diamond"],
  ["J", "vs_mine_clash", "Q", "Q"],
  ["lantern", "lantern", "A", "vs_mine_clash"],
  ["K", "10", "blue_diamond", "gold_nugget"],
  ["Q", "J", "J", "K"],
  ["10", "10", "Q", "J"],
];
const screenshotVsResult = calculateSlotResult(mineClashTestGame, 100, false, screenshotVsGrid);
if (screenshotVsResult.goldRush?.vsType !== "normal-column" || (screenshotVsResult.goldRush.activeVsPositions?.length ?? 0) !== 2) {
  throw new Error("Expected offset VS reels in columns 2 and 3 to activate when both full columns create left-to-right pays.");
}
if (
  !screenshotVsResult.lineWins.some((win) => win.paylineId === "bottom" && win.symbol === "blue_diamond" && win.count === 3) ||
  !screenshotVsResult.lineWins.some((win) => win.paylineId === "diag-down" && win.symbol === "pickaxe" && win.count === 3)
) {
  throw new Error("Expected the offset VS screenshot board to produce payline wins after both columns become multiplier wilds.");
}
const existingBottomLineVsGrid = [
  ["gold_nugget", "lantern", "Q", "Q"],
  ["Q", "A", "A", "Q"],
  ["Q", "dynamite", "vs_mine_clash", "Q"],
  ["dynamite", "Q", "K", "A"],
  ["10", "mine_cart", "treasure_chest", "lantern"],
  ["Q", "gold_nugget", "lantern", "10"],
];
const existingBottomLineVsResult = calculateSlotResult(mineClashTestGame, 100, false, existingBottomLineVsGrid);
if (existingBottomLineVsResult.goldRush?.vsType !== "normal-column" || existingBottomLineVsResult.goldRush.activeVsPosition?.reel !== 2) {
  throw new Error("Expected a VS column to activate when it turns an existing bottom-row line into a multiplier-wild line.");
}
const boostedBottomQ = existingBottomLineVsResult.lineWins.find((win) => win.paylineId === "bottom" && win.symbol === "Q");
if (!boostedBottomQ || boostedBottomQ.count !== 3 || Math.abs(boostedBottomQ.multiplier - 0.24) > 0.0001 || boostedBottomQ.payout !== 24) {
  throw new Error(`Expected bottom-row Q line to use the activated VS multiplier wild, got ${JSON.stringify(boostedBottomQ)}.`);
}
const multiVsGrid = [
  ["J", "Q", "K", "A"],
  ["J", "K", "A", "Q"],
  ["vs_mine_clash", "A", "Q", "K"],
  ["Q", "10", "J", "A"],
  ["vs_mine_clash", "Q", "10", "K"],
  ["K", "A", "Q", "10"],
];
const multiVsResult = calculateSlotResult(mineClashTestGame, 100, false, multiVsGrid);
if (multiVsResult.goldRush?.vsType !== "normal-column" || (multiVsResult.goldRush.mineClashColumns?.length ?? 0) !== 1) {
  throw new Error("Expected Gold Rush to leave non-contributing VS reels inactive even when another VS column pays.");
}
const fullInteriorGame = {
  ...mineClashTestGame,
  goldRushInterior: {
    ...goldRush.goldRushInterior!,
    appearanceChance: 1,
    sizes: [{ columns: 6, weight: 1 }],
  },
};
const interiorVsGrid = [
  ["J", "Q", "K", "A"],
  ["J", "K", "A", "Q"],
  ["vs_mine_clash", "A", "Q", "K"],
  ["Q", "10", "J", "A"],
  ["vs_mine_clash", "Q", "10", "K"],
  ["K", "A", "Q", "10"],
];
const interiorVsResult = calculateSlotResult(fullInteriorGame, 100, false, interiorVsGrid);
if (interiorVsResult.goldRush?.interior?.columns !== 6 || interiorVsResult.goldRush.interior.rowCount !== 4 || interiorVsResult.goldRush.interior.startColumn !== 0) {
  throw new Error("Expected Gold Rush interior board to cover a valid full-height 2-6 column range.");
}
if (interiorVsResult.goldRush?.vsType !== "interior" || (interiorVsResult.goldRush.transformedPositions?.length ?? 0) !== 24) {
  throw new Error("Expected VS inside the interior to transform every covered grid position.");
}
if (interiorVsResult.goldRush.activeVsPosition?.reel !== 2 || interiorVsResult.goldRush.activeVsPosition?.row !== 0) {
  throw new Error("Expected multiple interior VS symbols to resolve deterministically by reel then row.");
}
const focusedInteriorGame = {
  ...mineClashTestGame,
  goldRushInterior: {
    ...goldRush.goldRushInterior!,
    appearanceChance: 1,
    sizes: [{ columns: 3, weight: 1 }],
  },
};
const focusedInteriorGrid = [
  ["vs_mine_clash", "Q", "K", "A"],
  ["Q", "K", "A", "Q"],
  ["K", "A", "Q", "K"],
  ["J", "10", "J", "A"],
  ["A", "Q", "10", "K"],
  ["K", "A", "Q", "10"],
];
const focusedInteriorRandom = Math.random;
let focusedInteriorRoll = 0;
Math.random = () => [0.99, 0, 0.1, 0.1][focusedInteriorRoll++] ?? 0.1;
let focusedInteriorResult: ReturnType<typeof calculateSlotResult>;
try {
  focusedInteriorResult = calculateSlotResult(focusedInteriorGame, 100, false, focusedInteriorGrid);
} finally {
  Math.random = focusedInteriorRandom;
}
if (focusedInteriorResult.goldRush?.vsType !== "interior" || focusedInteriorResult.goldRush.activeColumns?.start !== 0 || focusedInteriorResult.goldRush.activeColumns.count !== 3 || (focusedInteriorResult.goldRush.transformedPositions?.length ?? 0) !== 12) {
  throw new Error("Expected focused interior VS to transform all positions in reels 1-3.");
}
if (!focusedInteriorResult.lineWins.some((win) => win.paylineId === "top" && win.symbol === "J" && win.count === 4 && win.positions.some((position) => position.reel === 3))) {
  throw new Error("Expected reels 1-3 interior wilds to connect through reel 4 on a left-to-right payline.");
}
const interiorPlusOutsideGame = {
  ...mineClashTestGame,
  goldRushInterior: {
    ...goldRush.goldRushInterior!,
    appearanceChance: 1,
    sizes: [{ columns: 2, weight: 1 }],
  },
};
const interiorPlusOutsideGrid = [
  ["vs_mine_clash", "Q", "K", "A"],
  ["Q", "K", "A", "Q"],
  ["J", "A", "Q", "K"],
  ["vs_mine_clash", "10", "J", "A"],
  ["J", "Q", "10", "K"],
  ["J", "A", "Q", "10"],
];
const interiorPlusOutsideRandom = Math.random;
let interiorPlusOutsideRoll = 0;
Math.random = () => [0.99, 0, 0, 0.1, 0.1, 0.1, 0.1][interiorPlusOutsideRoll++] ?? 0.1;
let interiorPlusOutsideResult: ReturnType<typeof calculateSlotResult>;
try {
  interiorPlusOutsideResult = calculateSlotResult(interiorPlusOutsideGame, 100, false, interiorPlusOutsideGrid);
} finally {
  Math.random = interiorPlusOutsideRandom;
}
if (
  interiorPlusOutsideResult.goldRush?.vsType !== "interior" ||
  (interiorPlusOutsideResult.goldRush.activeVsPositions?.length ?? 0) !== 2
) {
  throw new Error("Expected an active interior VS to include a contributing outside VS column as a separate Mine Clash segment.");
}
const interiorPlusOutsideSegments = getGoldRushMineClashSegments(interiorPlusOutsideResult, goldRush.reelCount, goldRush.rowCount);
if (
  interiorPlusOutsideSegments.length !== 2 ||
  !interiorPlusOutsideSegments.some((segment) => segment.areaType === "interior" && segment.startReel === 0 && segment.width === 2) ||
  !interiorPlusOutsideSegments.some((segment) => segment.areaType === "column" && segment.startReel === 3 && segment.width === 1)
) {
  throw new Error(`Expected interior plus outside VS to render as separate 2x4 and 1x4 segments, got ${JSON.stringify(interiorPlusOutsideSegments)}.`);
}
if (!interiorPlusOutsideResult.goldRush.mineClashColumns?.some((column) => column.reel === 3) || (interiorPlusOutsideResult.goldRush.transformedPositions?.filter((position) => position.reel === 3).length ?? 0) !== 4) {
  throw new Error("Expected the outside VS reel to receive its own column multiplier while the interior remains active.");
}
if (!interiorPlusOutsideResult.lineWins.some((win) => win.paylineId === "top" && win.symbol === "J" && win.count === 6)) {
  throw new Error("Expected interior wilds plus the outside VS column to connect the full top payline.");
}
const interiorPlusColumnFiveGame = {
  ...mineClashTestGame,
  goldRushInterior: {
    ...goldRush.goldRushInterior!,
    appearanceChance: 1,
    sizes: [{ columns: 4, weight: 1 }],
  },
};
const interiorPlusColumnFiveGrid = [
  ["vs_mine_clash", "Q", "K", "A"],
  ["Q", "K", "A", "Q"],
  ["K", "A", "Q", "K"],
  ["A", "10", "J", "A"],
  ["vs_mine_clash", "Q", "10", "K"],
  ["J", "A", "Q", "10"],
];
const interiorPlusColumnFiveRandom = Math.random;
let interiorPlusColumnFiveRoll = 0;
Math.random = () => [0.99, 0, 0, 0.1, 0.1, 0.1, 0.1][interiorPlusColumnFiveRoll++] ?? 0.1;
let interiorPlusColumnFiveResult: ReturnType<typeof calculateSlotResult>;
try {
  interiorPlusColumnFiveResult = calculateSlotResult(interiorPlusColumnFiveGame, 100, false, interiorPlusColumnFiveGrid);
} finally {
  Math.random = interiorPlusColumnFiveRandom;
}
if (
  interiorPlusColumnFiveResult.goldRush?.vsType !== "interior" ||
  !interiorPlusColumnFiveResult.goldRush.mineClashColumns?.some((column) => column.reel === 4) ||
  !interiorPlusColumnFiveResult.goldRush.activeVsPositions?.some((position) => position.reel === 4)
) {
  throw new Error("Expected a VS on column 5 to activate when it participates in the interior-transformed payline.");
}
const interiorPlusColumnFiveSegments = getGoldRushMineClashSegments(interiorPlusColumnFiveResult, goldRush.reelCount, goldRush.rowCount);
if (
  !interiorPlusColumnFiveSegments.some((segment) => segment.areaType === "interior" && segment.width === 4) ||
  !interiorPlusColumnFiveSegments.some((segment) => segment.areaType === "column" && segment.startReel === 4 && segment.width === 1)
) {
  throw new Error(`Expected column 5 VS to stay visually separate from the 4x4 interior, got ${JSON.stringify(interiorPlusColumnFiveSegments)}.`);
}
if (!interiorPlusColumnFiveResult.lineWins.some((win) => win.paylineId === "top" && win.symbol === "J" && win.count === 6)) {
  throw new Error("Expected column 5 VS to extend the interior Mine Clash payline through reel 6.");
}
const interiorVsArea = getGoldRushMineClashArea(interiorVsResult, goldRush.reelCount, goldRush.rowCount);
if (interiorVsArea.areaType !== "interior" || interiorVsArea.startReel !== 0 || interiorVsArea.width !== 6 || interiorVsArea.rowSpan !== 4) {
  throw new Error(`Expected interior VS grid overlay to cover the active interior and four rows, got ${JSON.stringify(interiorVsArea)}.`);
}
const interiorGridOverlayMarkup = renderToStaticMarkup(createElement(GoldRushMineClashGridOverlay, {
  result: interiorVsResult,
  reelCount: goldRush.reelCount,
  rowCount: goldRush.rowCount,
  onComplete: () => undefined,
}));
if (!interiorGridOverlayMarkup.includes("area-interior") || !interiorGridOverlayMarkup.includes("--clash-width:6") || interiorGridOverlayMarkup.includes("expansion-bonus-overlay")) {
  throw new Error("Expected interior Mine Clash to render inside the reel grid with interior bounds only.");
}
const finalInteriorPanelMarkup = renderToStaticMarkup(createElement(GoldRushMineClashFinalPanel, {
  result: interiorVsResult,
  reelCount: goldRush.reelCount,
  rowCount: goldRush.rowCount,
}));
if (!finalInteriorPanelMarkup.includes("gold-rush-final-clash-panel") || !finalInteriorPanelMarkup.includes("area-interior") || !finalInteriorPanelMarkup.includes("--clash-width:6")) {
  throw new Error("Expected completed interior Mine Clash to render one connected interior winner panel.");
}
const overlayMarkup = renderToStaticMarkup(createElement(ExpansionBonusOverlay, {
  open: true,
  theme: { title: "Gold Rush Showdown", introLabel: "Mine Clash", accent: "#f59e0b", secondary: "#38bdf8", panel: "#241006" },
  triggerPositions: mineClashResult.expansionBonus.triggerPositions,
  result: mineClashResult.expansionBonus,
  config: goldRush.expansionBonus,
  betAmount: 100,
  onComplete: () => undefined,
}));
if (!overlayMarkup.includes("Mine Clash") || !overlayMarkup.includes("mine-clash-overlay")) {
  throw new Error("Expected ExpansionBonusOverlay to mount with Mine Clash content.");
}
const closedOverlayMarkup = renderToStaticMarkup(createElement(ExpansionBonusOverlay, {
  open: false,
  theme: { title: "Gold Rush Showdown", accent: "#f59e0b", secondary: "#ef4444", panel: "#241006" },
  triggerPositions: mineClashResult.expansionBonus.triggerPositions,
  result: mineClashResult.expansionBonus,
  config: goldRush.expansionBonus,
  betAmount: 100,
  onComplete: () => undefined,
}));
if (closedOverlayMarkup.includes("expansion-bonus-overlay")) {
  throw new Error("Expected ExpansionBonusOverlay to unmount cleanly when closed.");
}
const goldSimulationRandom = Math.random;
let goldSimulationSeed = 4242;
Math.random = () => {
  goldSimulationSeed = (goldSimulationSeed * 1664525 + 1013904223) % 4294967296;
  return goldSimulationSeed / 4294967296;
};
let goldSim: ReturnType<typeof simulateSlot>;
try {
  goldSim = simulateSlot(goldRush, 80000, 100);
} finally {
  Math.random = goldSimulationRandom;
}
if (goldSim.observedRtp >= 0.95) {
  throw new Error(`Expected Gold Rush Showdown RTP simulation to stay under 95%, got ${goldSim.observedRtp}.`);
}
if (goldSim.observedRtp < 0.75) {
  throw new Error(`Expected Gold Rush Showdown RTP simulation to stay non-broken before tuning, got ${goldSim.observedRtp}.`);
}
if (!Number.isFinite(goldSim.mineClashTriggerRate ?? NaN) || !Number.isFinite(goldSim.averageMineClashPayout ?? NaN) || !Number.isFinite(goldSim.multiplierWildEv ?? NaN) || !Number.isFinite(goldSim.freeSpinsAveragePayout ?? NaN)) {
  throw new Error("Expected Gold Rush simulation to report Mine Clash, multiplier wild, and free spins EV.");
}
const goldRushBuyRtps = [
  goldSim.bonusPlusSpinsRtp,
  goldSim.showdownSpinRtp,
  goldSim.buyBonusRtp3,
  goldSim.buyBonusRtp4,
].filter((value): value is number => Number.isFinite(value));
if (goldRushBuyRtps.some((value) => value >= goldSim.observedRtp)) {
  throw new Error(`Expected Gold Rush base RTP to sit above buy/boost RTPs, got base ${goldSim.observedRtp} modes ${goldRushBuyRtps.join(", ")}.`);
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
if (getBetOptions(frontier, "GOLD").some((value) => value < frontier.minBet || value > frontier.maxBet)) {
  throw new Error("Expected bet menu options to stay inside game limits.");
}
if (!getBetOptions(frontier, "GOLD").includes(100000) || !getBetOptions(frontier, "BONUS").includes(10)) {
  throw new Error("Expected Frontier currency-specific bet ladders to include requested max sizes.");
}
if (getDefaultBetAmount(frontier, "GOLD") !== 10 || getDefaultBetAmount(frontier, "BONUS") !== 0.1) {
  throw new Error("Expected Frontier currency switches to land on each currency's first configured bet.");
}
if (getBuyBonusCost(250, frontier) !== getBonusBuyCost(frontier, 250, "HOLD_AND_WIN")) {
  throw new Error("Expected displayed buy bonus cost helper to match configured multiplier.");
}
if (frontier.maxPayoutMultiplier !== 1000 || frontier.maxBet !== 100000) {
  throw new Error("Expected Frontier max win cap and bet range to match remap.");
}
if (!frontier.holdAndWin?.coinValueMultipliers.includes(0.1) || !frontier.holdAndWin.coinValueMultipliers.includes(3)) {
  throw new Error("Expected Frontier Hold and Win coin multipliers to use bet multipliers.");
}
if (frontier.holdAndWin.majorMultiplier !== 50 || frontier.holdAndWin.minorMultiplier !== 10 || frontier.holdAndWin.miniMultiplier !== 5 || frontier.holdAndWin.grandMultiplier !== 1000) {
  throw new Error("Expected Frontier jackpot multipliers to use the remapped values.");
}
const jackpotBadges = getJackpotBadgeLabels(frontier);
if (!jackpotBadges.some((badge) => badge.label === "Grand" && badge.value === frontier.jackpotLabels?.Grand) || !jackpotBadges.some((badge) => badge.label === "Major" && badge.value === "50x")) {
  throw new Error("Expected jackpot UI labels to read from Frontier config.");
}
const coinDisplay = getCoinDisplayLabels(frontier);
if (coinDisplay.reel.some((label) => /^\d{2,}$/.test(label)) || !coinDisplay.holdAndWin.includes("0.1x") || !coinDisplay.holdAndWin.includes("Major")) {
  throw new Error("Expected coin display labels to use multipliers and jackpot names, not stale coin amounts.");
}
const bonusMenu = getBonusBoostMenuOptions(frontier, 0.1, "BONUS");
if (bonusMenu.length !== 4 || !bonusMenu.some((option) => option.label === "Buy Hold & Win" && option.cost === 10) || !bonusMenu.some((option) => option.label === "Buy Wheel Bonus" && option.cost === 8)) {
  throw new Error("Expected Bonus/Boost menu to include all four options with Sweeps buy costs.");
}
if (getBonusBuyCost(frontier, 0.1, "HOLD_AND_WIN", "BONUS") !== 10 || getBonusBuyCost(frontier, 0.1, "WHEEL_BONUS", "BONUS") !== 8) {
  throw new Error("Expected Sweeps bonus buy costs to be 10 SC for Hold & Win and 8 SC for Wheel at 0.10 bet.");
}
if (getBonusBuyCost(frontier, 10, "HOLD_AND_WIN", "GOLD") !== 1000 || getBonusBuyCost(frontier, 10, "WHEEL_BONUS", "GOLD") !== 800) {
  throw new Error("Expected Gold bonus buy costs to match Sweeps multipliers: 100x Hold & Win and 80x Wheel.");
}
for (const sweepsBet of getBetOptions(frontier, "BONUS")) {
  if (Math.abs(getBonusBuyCost(frontier, sweepsBet, "HOLD_AND_WIN", "BONUS") - sweepsBet * 100) > 0.001) {
    throw new Error("Expected Sweeps Hold & Win buy cost to scale from the 0.10 bet as 100x bet.");
  }
  if (Math.abs(getBonusBuyCost(frontier, sweepsBet, "WHEEL_BONUS", "BONUS") - sweepsBet * 80) > 0.001) {
    throw new Error("Expected Sweeps Wheel buy cost to scale from the 0.10 bet as 80x bet.");
  }
}
for (const goldBet of getBetOptions(frontier, "GOLD")) {
  if (Math.abs(getBonusBuyCost(frontier, goldBet, "HOLD_AND_WIN", "GOLD") - goldBet * 100) > 0.001) {
    throw new Error("Expected Gold Hold & Win buy cost to scale as 100x bet.");
  }
  if (Math.abs(getBonusBuyCost(frontier, goldBet, "WHEEL_BONUS", "GOLD") - goldBet * 80) > 0.001) {
    throw new Error("Expected Gold Wheel buy cost to scale as 80x bet.");
  }
}
function simulateCurrencyBonusBuyRtp(featureType: "HOLD_AND_WIN" | "WHEEL_BONUS", betAmount: number, currency: "GOLD" | "BONUS", samples = 3000) {
  let paid = 0;
  let wagered = 0;
  const previousRandom = Math.random;
  let seed = featureType === "HOLD_AND_WIN" ? 77 : 177;
  seed += currency === "GOLD" ? 1000 : 0;
  Math.random = () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };
  try {
    for (let index = 0; index < samples; index += 1) {
      const payoutBetAmount = getBonusBuyPayoutBetAmount(frontier!, betAmount, featureType, currency);
      const feature = calculateDirectFeature(frontier!, payoutBetAmount, featureType);
      paid += Math.min(feature.bonusPayout, betAmount * frontier!.maxPayoutMultiplier);
      wagered += getBonusBuyCost(frontier!, betAmount, featureType, currency);
    }
  } finally {
    Math.random = previousRandom;
  }
  return paid / wagered;
}
const sweepsBuyRandom = Math.random;
let sweepsBuySeed = 77;
Math.random = () => {
  sweepsBuySeed = (sweepsBuySeed * 1664525 + 1013904223) % 4294967296;
  return sweepsBuySeed / 4294967296;
};
try {
  const sweepsHoldBuyRtp = simulateCurrencyBonusBuyRtp("HOLD_AND_WIN", 0.1, "BONUS");
  const sweepsWheelBuyRtp = simulateCurrencyBonusBuyRtp("WHEEL_BONUS", 0.1, "BONUS");
  const goldHoldBuyRtp = simulateCurrencyBonusBuyRtp("HOLD_AND_WIN", 10, "GOLD");
  const goldWheelBuyRtp = simulateCurrencyBonusBuyRtp("WHEEL_BONUS", 10, "GOLD");
  if (
    sweepsHoldBuyRtp < 0.85 || sweepsHoldBuyRtp > 0.95 ||
    sweepsWheelBuyRtp < 0.85 || sweepsWheelBuyRtp > 0.95 ||
    goldHoldBuyRtp < 0.85 || goldHoldBuyRtp > 0.95 ||
    goldWheelBuyRtp < 0.85 || goldWheelBuyRtp > 0.95
  ) {
    throw new Error(`Expected Gold/Sweeps buy bonus RTPs to stay 85-95%, got SC Hold ${sweepsHoldBuyRtp} SC Wheel ${sweepsWheelBuyRtp} GC Hold ${goldHoldBuyRtp} GC Wheel ${goldWheelBuyRtp}.`);
  }
} finally {
  Math.random = sweepsBuyRandom;
}
if (bonusMenu.filter((option) => option.label.includes("Boost")).length !== 2) {
  throw new Error("Expected boost actions to live in the Bonus/Boost menu.");
}
const mainActions = getFrontierMainControlActions();
if (mainActions.includes("Gold Boost") || mainActions.includes("Scatter Boost") || mainActions.includes("Bonus") || mainActions.includes("E-Boost") || !mainActions.includes("Speed") || getFrontierReelAction() !== "E-Boost") {
  throw new Error("Expected boost actions to stay inside the reel E-Boost icon and speed to live in the main controls.");
}
if (!getFrontierEBoostIconAsset().endsWith("/assets/ui/money-lightning/primary_256.svg") || !getFrontierEBoostIconAsset("active").endsWith("/assets/ui/money-lightning/neon_256.svg")) {
  throw new Error("Expected Frontier E-Boost to render the money-lightning primary icon with a neon active asset.");
}
if (getFrontierEntryPhase(frontier.id, false, false, false) !== "loading") {
  throw new Error("Expected Frontier Fortune to render a loading screen before assets are ready.");
}
if (getFrontierEntryPhase(frontier.id, true, false, false) !== "intro" || frontierFeatureIntroCards.length !== 2) {
  throw new Error("Expected Frontier Fortune to render the feature intro after loading.");
}
if (!frontierFeatureIntroCards[0].detail.includes("Gold coins lock in place.") || !frontierFeatureIntroCards[1].detail.includes("Land oasis scatters.")) {
  throw new Error("Expected Frontier intro cards to use the short mobile-safe feature copy.");
}
if (!frontierIntroAssets.bg.endsWith("ff_intro_bg_blurred_canyon_1080x1920.png") || frontierIntroAssets.logo !== frontierUiAssets.titleLogo || !frontierIntroAssets.holdIcon.endsWith("/assets/ui/money-lightning/primary_256.svg")) {
  throw new Error("Expected Frontier intro to use separated pro intro assets, not the composed preview.");
}
if (Object.values(frontierIntroAssets).some((asset) => asset.includes("ff_intro_preview_composed") || asset.includes("ff_intro_text_tap_to_continue"))) {
  throw new Error("Expected Frontier intro text to render in HTML and the preview to remain unused.");
}
if (getFrontierEntryPhase(frontier.id, true, true, false) !== "game") {
  throw new Error("Expected tapping continue to enter the Frontier Fortune game.");
}
if (getFrontierEntryPhase(frontier.id, true, true, true, true) !== "intro") {
  throw new Error("Expected the in-game feature menu to reopen the Frontier Fortune intro.");
}
if (getFrontierLoadingMessage(0) !== frontierEntryLoadingMessages[0] || getFrontierLoadingMessage(48) !== "Loading bonuses..." || getFrontierLoadingMessage(100) !== "Preparing reels...") {
  throw new Error("Expected Frontier loading progress to advance through premium loading messages.");
}
setFrontierFeatureIntroPreference(true, globalThis.localStorage);
if (!getFrontierFeatureIntroPreference(globalThis.localStorage) || getFrontierEntryPhase(frontier.id, true, false, true) !== "game") {
  throw new Error("Expected Frontier don't-show-again preference to persist and skip the intro.");
}
setFrontierFeatureIntroPreference(false, globalThis.localStorage);
if (getFrontierFeatureIntroPreference(globalThis.localStorage)) {
  throw new Error("Expected Frontier intro preference to clear when don't-show-again is disabled.");
}
if (frontier.coinCollector?.maxCoins !== 5) {
  throw new Error("Expected collector display to use a compact 1-5 charge model.");
}
const betModalLayout = getFrontierBetModalLayout(getBetOptions(frontier, "GOLD"));
if (betModalLayout.role !== "dialog" || betModalLayout.maxWidth !== "90vw" || betModalLayout.columns !== 3 || !betModalLayout.values.includes(1000)) {
  throw new Error("Expected Frontier bet selector to render as a centered 3-column modal within the viewport.");
}
if (getNextFrontierSpinSpeed("NORMAL") !== "FAST" || getNextFrontierSpinSpeed("FAST") !== "TURBO" || getNextFrontierSpinSpeed("TURBO") !== "NORMAL") {
  throw new Error("Expected Frontier speed toggle to cycle Normal -> Fast -> Turbo -> Normal.");
}
if (getFrontierSpinAnimationMode("NORMAL") !== "normal" || getFrontierSpinAnimationMode("FAST") !== "fast" || getFrontierSpinAnimationMode("TURBO") !== "fast") {
  throw new Error("Expected Frontier speed modes to map to existing animation timings.");
}
if (!frontierTurboBypassesAnimation("TURBO") || frontierTurboBypassesAnimation("FAST")) {
  throw new Error("Expected Turbo mode, and only Turbo mode, to bypass reel animation.");
}
const potVisual = getTreasurePotVisualState(3, 5, false, 2);
if (getFrontierCollectorPlacement() !== "above-reels") {
  throw new Error("Expected Charged Relic collector to render above the reels.");
}
if (getTreasurePotChargeLevel(0, 5) !== "empty" || getTreasurePotChargeLevel(1, 5) !== "low" || getTreasurePotChargeLevel(3, 5) !== "medium" || getTreasurePotChargeLevel(4, 5) !== "high" || getTreasurePotChargeLevel(5, 5) !== "full") {
  throw new Error("Expected Charged Relic charge levels to map empty, low, medium, high, and full.");
}
if (potVisual.level !== 3 || potVisual.chargeLevel !== "medium" || potVisual.coins.filter(Boolean).length !== 3 || potVisual.flyingCoins.length !== 2 || !potVisual.collecting || potVisual.scale <= 1 || potVisual.glow <= 0) {
  throw new Error("Expected Charged Relic visual state to grow and energize as coins collect.");
}
const triggeredPotVisual = getTreasurePotVisualState(5, 5, true, 1);
if (!triggeredPotVisual.reset || triggeredPotVisual.burstCoins.length === 0 || triggeredPotVisual.chargeLevel !== "full") {
  throw new Error("Expected Charged Relic trigger state to run the burst animation at full charge.");
}
if (!chargedRelicCrackEvent(1, 0.05) || chargedRelicCrackEvent(1, 0.5) || chargedRelicCrackEvent(0, 0.01)) {
  throw new Error("Expected Charged Relic crack/surge animation to be a coin-hit-only random visual event.");
}
if (frontier.payoutTable.some((rule) => rule.count < 3)) {
  throw new Error("Expected Frontier Fortune line pays to start at 3 symbols, with no 2-symbol payouts.");
}
const wheelSections = getWheelSectionLabels(frontier);
for (const section of ["2x", "5x", "10x", "15x", "Mini x2", "Minor x2", "Major x2", "Hold & Win", "Super Hold & Win", "10 Free Spins", "15 Free Spins", "20 Free Spins"]) {
  if (!wheelSections.includes(section)) throw new Error(`Expected Wheel Bonus section ${section}.`);
}
if (wheelSections.includes("3x") || wheelSections.includes("8x")) {
  throw new Error("Expected Frontier Wheel Bonus to remove weak 3x/8x filler sections.");
}
const featureWheelIndexes = wheelSections
  .map((label, index) => ({ label, index }))
  .filter((entry) => getFrontierWheelPrizeClass(entry.label) === "feature")
  .map((entry) => entry.index);
for (const index of featureWheelIndexes) {
  const previous = (index - 1 + wheelSections.length) % wheelSections.length;
  const next = (index + 1) % wheelSections.length;
  if (featureWheelIndexes.includes(previous) || featureWheelIndexes.includes(next)) {
    throw new Error("Expected Frontier Wheel feature prizes to be spread out between regular prizes.");
  }
}
if (frontierWheelSpinMs < 5000 || !getFrontierWheelSegmentDisplayLabel("10 Free Spins").includes("\n") || getFrontierWheelDrama(wheelSections, "5x") !== "near-miss") {
  throw new Error("Expected Frontier Wheel to use a slower click-to-spin presentation with readable labels and near-miss drama.");
}
if (getWheelLandingDegrees(wheelSections, "Major x2") === getWheelLandingDegrees(wheelSections, "2x")) {
  throw new Error("Expected wheel visual result mapping to land different segments at different pointer angles.");
}
const wheelRandom = Math.random;
function randomForFrontierWheelSegment(label: string) {
  const segments = frontier!.wheelBonus?.segments ?? [];
  const total = segments.reduce((sum, segment) => sum + segment.weight, 0);
  let before = 0;
  for (const segment of segments) {
    if (segment.label === label) return (before + segment.weight / 2) / total;
    before += segment.weight;
  }
  throw new Error(`Missing Frontier wheel segment ${label}.`);
}
Math.random = () => randomForFrontierWheelSegment("10 Free Spins");
try {
  const freeSpinWheel = calculateWheelBonus(frontier, 100);
  if (freeSpinWheel.freeSpinsAwarded !== 10 || freeSpinWheel.payout !== 0) {
    throw new Error("Expected Wheel Bonus free-spin segment to award 10 free spins without an immediate multiplier payout.");
  }
  if (getFrontierWheelResultAction({ wheelBonus: freeSpinWheel } as SlotSpinResult) !== "Start 10 Free Spins") {
    throw new Error("Expected Wheel Bonus result action to identify free-spin starts.");
  }
} finally {
  Math.random = wheelRandom;
}
Math.random = () => randomForFrontierWheelSegment("Hold & Win");
try {
  const holdWheel = calculateWheelBonus(frontier, 100);
  if (holdWheel.featureTrigger !== "HOLD_AND_WIN" || getFrontierWheelResultAction({ wheelBonus: holdWheel } as SlotSpinResult) !== "Start Hold & Win") {
    throw new Error("Expected Wheel Bonus Hold & Win segment to route into Hold & Win.");
  }
} finally {
  Math.random = wheelRandom;
}
Math.random = () => randomForFrontierWheelSegment("Super Hold & Win");
try {
  const superHoldWheel = calculateWheelBonus(frontier, 100);
  if (superHoldWheel.featureTrigger !== "SUPER_HOLD_AND_WIN" || getFrontierWheelResultAction({ wheelBonus: superHoldWheel } as SlotSpinResult) !== "Start Super Hold & Win") {
    throw new Error("Expected Wheel Bonus Super Hold & Win segment to route into the super hold path.");
  }
} finally {
  Math.random = wheelRandom;
}
if (getBonusBuyPayoutBetAmount(frontier, 0.1, "WHEEL_BONUS", "BONUS") !== 0.1 || getBonusBuyPayoutBetAmount(frontier, 0.1, "HOLD_AND_WIN", "BONUS") <= 0.1) {
  throw new Error("Expected Sweeps Wheel Bonus to use the spin bet as its payout basis while Hold & Win keeps its buy-basis tuning.");
}
const wheelSpinBasis = calculateWheelBonus({ ...frontier, wheelBonus: { triggerCount: 3, segments: [{ label: "2x", multiplier: 2, weight: 1 }] } }, 0.1);
const wheelBuyBasis = calculateWheelBonus({ ...frontier, wheelBonus: { triggerCount: 3, segments: [{ label: "2x", multiplier: 2, weight: 1 }] } }, getBonusBuyPayoutBetAmount(frontier, 0.1, "WHEEL_BONUS", "BONUS"));
const wheelMajorBasis = calculateWheelBonus({ ...frontier, wheelBonus: { triggerCount: 3, segments: [{ label: "Major x2", multiplier: 100, weight: 1, jackpotLabel: "Major" }] } }, 0.1);
if (wheelSpinBasis.payout !== 0.2 || wheelBuyBasis.payout !== 0.2 || wheelMajorBasis.payout !== 10) {
  throw new Error(`Expected Wheel multipliers to pay from the bet size: 2x = 0.20 and Major x2 = 10.00 on 0.10, got ${wheelSpinBasis.payout}, ${wheelBuyBasis.payout}, ${wheelMajorBasis.payout}.`);
}
const sweepsHoldPayoutBasis = getBonusBuyPayoutBetAmount(frontier, 0.1, "HOLD_AND_WIN", "BONUS");
const sweepsHoldState = createHoldAndWinState(frontier, sweepsHoldPayoutBasis, 6);
if (sweepsHoldState.betAmount !== sweepsHoldPayoutBasis || sweepsHoldState.values.filter((value) => value !== null).length !== 6) {
  throw new Error("Expected bought Sweeps Hold & Win to start from the configured payout basis and six coins.");
}
const simulationRandom = Math.random;
let simulationSeed = 42;
Math.random = () => {
  simulationSeed = (simulationSeed * 1664525 + 1013904223) % 4294967296;
  return simulationSeed / 4294967296;
};
let frontierSim: ReturnType<typeof simulateSlot>;
try {
  frontierSim = simulateSlot(frontier, 30000, 100);
} finally {
  Math.random = simulationRandom;
}
for (const mode of ["NORMAL", "GOLD_BOOST", "SCATTER_BOOST", "BUY_HOLD_AND_WIN", "BUY_WHEEL_BONUS"] as const) {
  if (!frontierSim.modeResults?.[mode] || !Number.isFinite(frontierSim.modeResults[mode]?.observedRtp)) {
    throw new Error(`Expected admin simulation to report ${mode}.`);
  }
}
const wheelBuyRtp = frontierSim.modeResults?.BUY_WHEEL_BONUS?.observedRtp ?? 0;
const holdBuyRtp = frontierSim.modeResults?.BUY_HOLD_AND_WIN?.observedRtp ?? 0;
const normalRtp = frontierSim.modeResults?.NORMAL?.observedRtp ?? 0;
const goldBoostRtp = frontierSim.modeResults?.GOLD_BOOST?.observedRtp ?? 0;
const scatterBoostRtp = frontierSim.modeResults?.SCATTER_BOOST?.observedRtp ?? 0;
if (normalRtp < 0.85 || normalRtp > 0.95) {
  throw new Error(`Expected normal Frontier Fortune RTP to stay between 85% and 95% after line-pay tuning, got ${normalRtp}.`);
}
if (goldBoostRtp < 0.85 || goldBoostRtp > 0.95 || scatterBoostRtp < 0.8 || scatterBoostRtp > 0.95) {
  throw new Error(`Expected Frontier boost RTPs to stay in guarded demo ranges, got Gold ${goldBoostRtp} Scatter ${scatterBoostRtp}.`);
}
if (holdBuyRtp < 0.85 || holdBuyRtp > 0.95) {
  throw new Error(`Expected Buy Hold & Win RTP to stay between 85% and 95%, got ${holdBuyRtp}.`);
}
if (wheelBuyRtp < 0.88 || wheelBuyRtp > 0.93) {
  throw new Error(`Expected Buy Wheel Bonus RTP to tune around 88-93%, got ${wheelBuyRtp}.`);
}
if (frontierSim.observedRtp >= 0.95) {
  throw new Error(`Expected full Frontier Fortune RTP impact to stay under 95%, got ${frontierSim.observedRtp}.`);
}
if (getMathWarnings(frontier, frontierSim).some((warning) => warning.includes("above 95"))) {
  throw new Error("Expected Frontier test simulation modes to stay under configured RTP warnings.");
}
const lowAceGrid = [
  ["10", "A", "J"],
  ["K", "A", "Q"],
  ["Q", "A", "10"],
  ["J", "K", "Q"],
  ["10", "Q", "J"],
];
const lowAceResult = calculateSlotResult(frontier, 0.1, false, lowAceGrid);
const lowAceLine = lowAceResult.lineWins.find((win) => win.paylineId === "middle" && win.symbol === "A");
if (!lowAceLine || lowAceLine.count !== 3 || lowAceLine.payout !== 0.02) {
  throw new Error(`Expected a 0.10 SC bet with a 3-A line to pay 0.02, got ${lowAceLine?.payout}.`);
}
for (let index = 0; index < 200; index += 1) {
  if (generateGrid(frontier, "NORMAL", true).flat().some((symbol) => symbol === "10" || symbol === "J")) {
    throw new Error("Expected Frontier free spins to remove lowest-value 10/J symbols from generated grids.");
  }
}
const holdBonus = calculateHoldAndWinBonus(frontier, frontier.minBet);
if (!Number.isFinite(holdBonus.total) || holdBonus.respinRounds.length === 0) {
  throw new Error("Expected hold-and-win respins to calculate.");
}
const originalCoinRandom = Math.random;
const coinRolls = [0 / 15, 1 / 15, 2 / 15, 3 / 15, 4 / 15, 5 / 15, 0, 0, 0, 0, 0, 0];
Math.random = () => coinRolls.shift() ?? 0;
try {
  const sixTenthCoins = createHoldAndWinState(frontier, 100, 6);
  if (Math.round(sixTenthCoins.total) !== 60) {
    throw new Error("Expected six 0.1x Hold and Win coins on a 100 bet to total 60.");
  }
} finally {
  Math.random = originalCoinRandom;
}
const frontierScatterGrid = [
  ["oasis_scatter", "10", "J"],
  ["A", "oasis_scatter", "Q"],
  ["K", "10", "oasis_scatter"],
  ["Q", "J", "A"],
  ["10", "K", "Q"],
];
const forcedWheel = calculateSlotResult(frontier, 100, false, frontierScatterGrid);
if (!forcedWheel.triggeredWheelBonus || !forcedWheel.wheelBonus) {
  throw new Error("Expected 3 Frontier Oasis Scatters to trigger Wheel Bonus.");
}
const forcedFreeSpinRetrigger = calculateSlotResult(frontier, 100, true, frontierScatterGrid);
if (forcedFreeSpinRetrigger.triggeredWheelBonus || forcedFreeSpinRetrigger.freeSpinsAwarded !== 5) {
  throw new Error("Expected 3 scatters during Frontier free spins to retrigger +5 spins without nesting another wheel.");
}
const stickyGrid = [
  ["mirage_wild", "10", "J"],
  ["A", "K", "Q"],
  ["K", "10", "J"],
  ["Q", "J", "A"],
  ["10", "K", "Q"],
];
const stickyResult = calculateSlotResult(frontier, 100, true, stickyGrid);
const stickyPositions = getNextFrontierStickyWildPositions(frontier, stickyResult, [], 4);
if (!stickyPositions.includes(0) || getNextFrontierStickyWildPositions(frontier, stickyResult, stickyPositions, 0).length !== 0) {
  throw new Error("Expected sticky wilds to persist during Frontier free spins and reset when the round ends.");
}
const freeSpinRound = calculateFreeSpinsBonus(frontier, 100, 10);
if (freeSpinRound.spinsAwarded > (frontier.freeSpins.maxSpins ?? 30) || freeSpinRound.spinsPlayed > (frontier.freeSpins.maxSpins ?? 30)) {
  throw new Error("Expected Frontier free spins retriggers to respect the configured cap.");
}
const wheelMultiplier = calculateWheelBonus(frontier, 100);
if (wheelMultiplier.payout !== Math.round(wheelMultiplier.multiplier * 100)) {
  throw new Error("Expected Wheel Bonus payout to match the landed bet multiplier.");
}
const anticipationState = getFrontierAnticipationState([
  ["coin_100", "coin_100", "10"],
  ["coin_100", "coin_100", "A"],
  ["coin_100", "J", "Q"],
  ["10", "K", "Q"],
  ["A", "J", "10"],
], frontier);
if (!anticipationState.active) {
  throw new Error("Expected anticipation state to trigger with many early coins.");
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
const wheelBuyUser: User = { ...user, id: "wheel-buy-test-user", email: "wheel-buy@test.local" };
creditCurrency({ userId: wheelBuyUser.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 500000 });
const wheelBuyResult = buyBonusFeature({ user: wheelBuyUser, game: frontier, currency: "GOLD", betAmount: frontier.minBet, featureType: "WHEEL_BONUS" });
const wheelBuyDebit = getTransactions(wheelBuyUser.id).find((tx) => tx.type === "BUY_BONUS");
if (!wheelBuyResult.triggeredWheelBonus || !wheelBuyDebit || Math.abs(wheelBuyDebit.amount) !== getBonusBuyCost(frontier, frontier.minBet, "WHEEL_BONUS")) {
  throw new Error("Expected Buy Wheel Bonus to debit the configured cost and return a wheel result.");
}
const debitOnlyUser: User = {
  ...user,
  id: "buy-bonus-debit-only-user",
  email: "buy-debit@test.local",
};
creditCurrency({ userId: debitOnlyUser.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 500000 });
const debitOnlyBefore = getTransactions(debitOnlyUser.id).filter((tx) => tx.type === "BUY_BONUS").length;
const debitBalanceBefore = getBalance(debitOnlyUser.id, "GOLD");
buyBonusDebit({ user: debitOnlyUser, game: frontier, currency: "GOLD", betAmount: frontier.minBet });
if (getTransactions(debitOnlyUser.id).filter((tx) => tx.type === "BUY_BONUS").length !== debitOnlyBefore + 1) {
  throw new Error("Expected buy bonus debit-only ledger entry.");
}
if (Math.abs((debitBalanceBefore - getBalance(debitOnlyUser.id, "GOLD")) - getBuyBonusCost(frontier.minBet, frontier)) > 0.001) {
  throw new Error("Expected BUY_BONUS ledger debit to match displayed buy bonus cost.");
}
const boostUser: User = { ...user, id: "boost-test-user", email: "boost@test.local" };
creditCurrency({ userId: boostUser.id, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 500000 });
const boostBefore = getBalance(boostUser.id, "GOLD");
const boostResult = spinSlot({ user: boostUser, game: frontier, currency: "GOLD", betAmount: 100, spinMode: "GOLD_BOOST" });
if (boostResult.wager !== getSpinCost(frontier, 100, "GOLD_BOOST") || boostBefore - getBalance(boostUser.id, "GOLD") < boostResult.wager - boostResult.payout) {
  throw new Error("Expected Gold Boost to debit the boosted displayed cost.");
}
const scatterBoostResult = calculateSlotResult(frontier, 100, false, undefined, "SCATTER_BOOST");
if (scatterBoostResult.wager !== 100) {
  throw new Error("Expected Scatter Boost math to preserve payout bet basis before ledger cost.");
}
const collectorRolls = [0];
Math.random = () => collectorRolls.shift() ?? 0;
try {
  const collectorResult = calculateSlotResult(frontier, 100, false, [
    ["coin_100", "10", "J"],
    ["A", "coin_100", "Q"],
    ["K", "10", "J"],
    ["Q", "J", "A"],
    ["10", "K", "Q"],
  ]);
  if (!collectorResult.triggeredCoinCollector || !collectorResult.triggeredHoldAndWin) {
    throw new Error("Expected coin collector to be able to trigger Hold and Win.");
  }
} finally {
  Math.random = originalCoinRandom;
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

resetRetention(user.id);
const retentionTxBefore = getTransactions(user.id).filter((tx) => tx.type === "RETENTION_REWARD").length;
recordRetentionRound({ userId: user.id, gameId: "frontier-fortune", wager: 100, won: 0, multiplier: 0 });
recordRetentionRound({ userId: user.id, gameId: "blackjack", wager: 100, won: 200, multiplier: 2 });
recordRetentionRound({ userId: user.id, gameId: "crash", wager: 100, won: 250, multiplier: 2.5 });
if (getRetentionState(user.id).dailyGameIds.length !== 3) {
  throw new Error("Expected retention state to track distinct daily games.");
}
if (getTransactions(user.id).filter((tx) => tx.type === "RETENTION_REWARD").length !== retentionTxBefore + 1) {
  throw new Error("Expected game switching retention reward to credit once.");
}
recordRetentionRound({ userId: user.id, gameId: "treasureDig", wager: 100, won: 0, multiplier: 0 });
if (getTransactions(user.id).filter((tx) => tx.type === "RETENTION_REWARD").length !== retentionTxBefore + 1) {
  throw new Error("Expected game switching reward to prevent duplicate daily claims.");
}
const mostPlayed = getMostPlayedGames(user.id, 1);
if (mostPlayed.length !== 1 || mostPlayed[0].plays < 1) {
  throw new Error("Expected most-played game tracking.");
}
const multiplierMission = getMissions(user.id)["daily-multiplier"];
if (!multiplierMission || multiplierMission.status === "ACTIVE") {
  throw new Error("Expected multiplier mission progress from retention rounds.");
}

const lowBalanceUser = { ...user, id: "low-balance-retention-user", email: "low-retention@test.local" };
updateData((data) => {
  data.users.push(lowBalanceUser);
  data.walletBalances[lowBalanceUser.id] = { GOLD: 0, BONUS: 0 };
});
if (!canClaimLowBalanceOffer(lowBalanceUser.id)) throw new Error("Expected low balance offer to be available.");
claimLowBalanceOffer(lowBalanceUser.id);
if (!getTransactions(lowBalanceUser.id).some((tx) => tx.type === "RETENTION_REWARD" && tx.metadata.source === "low_balance_offer")) {
  throw new Error("Expected low balance offer to credit via ledger.");
}
try {
  claimLowBalanceOffer(lowBalanceUser.id);
  throw new Error("Expected low balance offer to block duplicate daily claims.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("not available")) throw error;
}
const promoTxBefore = getTransactions(user.id).filter((tx) => tx.type === "PROMO_REWARD").length;
claimPromotion(user.id, "bonus-2x");
if (getTransactions(user.id).filter((tx) => tx.type === "PROMO_REWARD").length !== promoTxBefore + 1) {
  throw new Error("Expected promotion reward to credit via ledger.");
}
try {
  claimPromotion(user.id, "bonus-2x");
  throw new Error("Expected promotion reward to block duplicate daily claims.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("not available")) throw error;
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
