import { ArrowLeft, Coins, Gauge, Info, Menu, Minus, Plus, RotateCw, ShoppingBag, Zap } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { getCurrencyShortName } from "../config/currencyConfig";
import type { Currency } from "../types";
import { creditCurrency, getBalance } from "../wallet/walletService";
import { nextSessionStats, emptySessionStats } from "../economy/sessionStats";
import { recordRetentionRound } from "../retention/retentionService";
import { isSoundEnabled, playBigWin, playBonus, playClick, playError, playExpansionHit, playLose, playMultiplierTick, playSpin, playWin } from "../feedback/feedbackService";
import { GameResultBanner, ScreenShake, SoundToggle, WinOverlay } from "../feedback/components";
import { BonusModal } from "./BonusModal";
import { GameLogo } from "./GameLogo";
import { ExpansionBonusOverlay } from "./ExpansionBonusOverlay";
import { Modal } from "../components/Modal";
import { PaytableModal } from "./PaytableModal";
import { frontierUiAssets } from "./frontierAssets";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { recordRecentGame } from "./recentGames";
import { getReelStopSchedule, getSpinDuration, slotAnimation } from "./slotAnimation";
import { nextFreeSpinTotal } from "./slotSession";
import { buyBonusDebit, buyBonusFeature, calculateWheelBonus, createGoldRushBonusTriggerGrid, createGoldRushShowdownBoostGrid, createHoldAndWinState, creditHoldAndWinBonus, creditPickBonus, debitGoldRushBonusBuy, generateGrid, getBonusBuyCost, getBonusBuyPayoutBetAmount, getGoldRushBonusBuyCost, getGoldRushBonusBuyOption, getGoldRushFreeSpinInitialInteriorColumns, getSpinCost, getStickyWildPositions, selectGoldRushInteriorStart, spinSlot, stepHoldAndWinBonus } from "./slotEngine";
import { SymbolTile } from "./SymbolTile";
import type { ReelVisualState, SlotAnimationState } from "./slotAnimation";
import type { BonusFeatureType, GoldRushBonusBuyType, GoldRushMineClashSegment, GoldRushSpinMetadata, HoldAndWinState, SlotConfig, SlotSpinResult, SpinMode } from "./types";
import { GoldRushFeatureToast, GoldRushWinOverlay, duckGoldRushMusic, getGoldRushWinTier, playGoldRushSound, startGoldRushMusic, stopGoldRushMusic } from "./goldRushFeedback";

type SlotUiState =
  | "Idle"
  | "Spinning"
  | "Evaluating"
  | "Win"
  | "Bonus Triggered"
  | "Free Spins"
  | "Pick Bonus"
  | "Hold And Win"
  | "Error/Insufficient Balance";

export type FrontierSpinSpeed = "NORMAL" | "FAST" | "TURBO";
export type FrontierEntryPhase = "loading" | "intro" | "game";
type FrontierWheelPhase = "ready" | "spinning" | "revealed";
type FrontierWheelReveal = {
  result: SlotSpinResult;
  phase: FrontierWheelPhase;
  bonusBetAmount: number;
  fromBuy: boolean;
};

type GoldRushArmedBoost = {
  type: Extract<GoldRushBonusBuyType, "bonus-plus-spins" | "showdown-spin">;
  label: string;
  cost: number;
  spinMode: SpinMode;
};

type GoldRushFreeSpinSession = {
  spinsRemaining: number;
  totalWin: number;
  spinsPlayed: number;
  initialSpins: number;
  interiorColumns: number;
  interiorStartColumn: number;
  bonusSymbolsCollected: number;
  collectThreshold: number;
  addedSpins: number;
  maxInteriorColumns: number;
  triggerSource: "natural" | "buy-bonus" | "buy-super-bonus";
  introOpen: boolean;
  summaryOpen: boolean;
  lastGrowth?: {
    addedSpins: number;
    columns: number;
  };
};

const FRONTIER_INTRO_SKIP_KEY = "frontier-fortune.skip-feature-intro";
export const frontierWheelSpinMs = 5800;

export const frontierEntryLoadingMessages = ["Loading symbols...", "Loading bonuses...", "Preparing reels..."] as const;

export const frontierIntroAssets = {
  bg: "/assets/ui/frontier-intro/ff_intro_bg_blurred_canyon_1080x1920.png",
  vignette: "/assets/ui/frontier-intro/ff_intro_overlay_vignette_1080x1920.png",
  rays: "/assets/ui/frontier-intro/ff_intro_overlay_soft_light_rays.png",
  embers: "/assets/ui/frontier-intro/ff_intro_overlay_embers.png",
  logo: frontierUiAssets.titleLogo,
  holdFrame: "/assets/ui/frontier-intro/ff_intro_card_frame_hold_win_red_gold.png",
  wheelFrame: "/assets/ui/frontier-intro/ff_intro_card_frame_wheel_bonus_green_gold.png",
  holdIcon: "/assets/ui/money-lightning/primary_256.svg",
  wheelIcon: "/assets/ui/frontier-intro/ff_intro_icon_wheel_bonus.png",
  relicAura: "/assets/ui/frontier-intro/ff_intro_center_relic_aura.png",
  relicSpirit: "/assets/ui/frontier-intro/ff_intro_center_relic_spirit.png",
  relicShadow: "/assets/ui/frontier-intro/ff_intro_center_shadow.png",
  ctaButton: "/assets/ui/frontier-intro/ff_intro_cta_button_gold_blank.png",
} as const;

export const frontierFeatureIntroCards = [
  {
    label: "Feature",
    title: "Hold & Win",
    detail: "Gold coins lock in place.\nNew coins reset respins.\nBuild the bonus total.",
  },
  {
    label: "Bonus",
    title: "Wheel Bonus",
    detail: "Land oasis scatters.\nSpin for boosts, jackpots,\nor Hold & Win.",
  },
] as const;

type FrontierStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

function safeFrontierStorage(storage?: FrontierStorage) {
  if (storage) return storage;
  try {
    return typeof globalThis.localStorage === "undefined" ? null : globalThis.localStorage;
  } catch {
    return null;
  }
}

export function getFrontierFeatureIntroPreference(storage?: FrontierStorage) {
  return safeFrontierStorage(storage)?.getItem(FRONTIER_INTRO_SKIP_KEY) === "1";
}

export function setFrontierFeatureIntroPreference(skip: boolean, storage?: FrontierStorage) {
  const target = safeFrontierStorage(storage);
  if (!target) return skip;
  if (skip) target.setItem(FRONTIER_INTRO_SKIP_KEY, "1");
  else target.removeItem(FRONTIER_INTRO_SKIP_KEY);
  return skip;
}

export function getFrontierEntryPhase(gameId: string, assetsReady: boolean, enteredGame: boolean, skipIntro: boolean, introReopened = false): FrontierEntryPhase {
  if (gameId !== "frontier-fortune") return "game";
  if (!assetsReady) return "loading";
  if (introReopened) return "intro";
  if (enteredGame || skipIntro) return "game";
  return "intro";
}

export function getFrontierLoadingMessage(progress: number) {
  const clamped = Math.max(0, Math.min(100, progress));
  const index = Math.min(frontierEntryLoadingMessages.length - 1, Math.floor((clamped / 100) * frontierEntryLoadingMessages.length));
  return frontierEntryLoadingMessages[index];
}

export const moneyLightningIconAssets = {
  primary: "/assets/ui/money-lightning/primary_256.svg",
  neon: "/assets/ui/money-lightning/neon_256.svg",
} as const;

export const goldRushFxAssets = {
  mineClashImpactPop: new URL("../assets/gold-rush-showdown/fx/mine-clash-impact-pop.png", import.meta.url).href,
  mineClashChamber: new URL("../assets/gold-rush-showdown/fx/mine-clash-chamber.png", import.meta.url).href,
  goldMinerPortrait: new URL("../assets/gold-rush-showdown/fx/gold-miner-portrait.png", import.meta.url).href,
  diamondMinerPortrait: new URL("../assets/gold-rush-showdown/fx/diamond-miner-portrait.png", import.meta.url).href,
} as const;

export function getFrontierEBoostIconAsset(state: "default" | "active" = "default") {
  return state === "active" ? moneyLightningIconAssets.neon : moneyLightningIconAssets.primary;
}

export function getPaylineOverlayPoints(
  payline: SlotConfig["paylines"][number],
  winPositions?: Array<{ reel: number; row: number }>,
) {
  const positions = winPositions?.length
    ? winPositions
    : payline.rows.map((row, reel) => ({ reel, row }));
  return positions.map((position) => `${position.reel * 100 + 50},${position.row * 100 + 50}`).join(" ");
}

export function getNextFrontierSpinSpeed(speed: FrontierSpinSpeed): FrontierSpinSpeed {
  if (speed === "NORMAL") return "FAST";
  if (speed === "FAST") return "TURBO";
  return "NORMAL";
}

export function getFrontierSpinAnimationMode(speed: FrontierSpinSpeed) {
  return speed === "NORMAL" ? "normal" : "fast";
}

export function frontierTurboBypassesAnimation(speed: FrontierSpinSpeed) {
  return speed === "TURBO";
}

export function getFrontierBetModalLayout(values: number[]) {
  return {
    role: "dialog",
    maxWidth: "90vw",
    columns: Math.min(3, Math.max(1, values.length)),
    values,
  };
}

export function getTreasurePotChargeLevel(coins: number, maxCoins = 5) {
  const level = Math.max(0, Math.min(maxCoins, coins));
  if (level <= 0) return "empty";
  if (level <= Math.ceil(maxCoins * 0.25)) return "low";
  if (level <= Math.ceil(maxCoins * 0.55)) return "medium";
  if (level < maxCoins) return "high";
  return "full";
}

export function getTreasurePotVisualState(coins: number, maxCoins = 5, triggered = false, collected = 0) {
  const level = Math.max(0, Math.min(maxCoins, coins));
  const collectedCount = Math.max(0, Math.min(maxCoins, collected));
  return {
    level,
    chargeLevel: getTreasurePotChargeLevel(level, maxCoins),
    coins: Array.from({ length: maxCoins }, (_, index) => index < level),
    flyingCoins: Array.from({ length: collectedCount }, (_, index) => index),
    burstCoins: triggered ? Array.from({ length: 8 }, (_, index) => index) : [],
    scale: 1 + level * 0.045,
    glow: level / Math.max(1, maxCoins),
    reset: triggered,
    collecting: collectedCount > 0,
  };
}

export function chargedRelicCrackEvent(coinHits: number, randomValue = Math.random()) {
  return coinHits > 0 && randomValue < 0.18;
}

function coinImageFor(value: number, betAmount: number) {
  const multiplier = betAmount > 0 ? value / betAmount : 0;
  if (multiplier >= 5) return "/assets/symbols/frontier/coin_1000.png";
  if (multiplier >= 2.5) return "/assets/symbols/frontier/coin_500.png";
  if (multiplier >= 1.5) return "/assets/symbols/frontier/coin_250.png";
  return "/assets/symbols/frontier/coin_100.png";
}

function coinLabelFor(value: number, betAmount: number) {
  const multiplier = betAmount > 0 ? value / betAmount : 0;
  if (multiplier >= 50) return "Major";
  if (multiplier >= 10) return "Minor";
  if (multiplier >= 5) return "Mini";
  return `${Number(multiplier.toFixed(2))}x`;
}

function FrontierLoadingScreen({ progress }: { progress: number }) {
  return (
    <div className="frontier-entry-screen frontier-loading-screen" role="status" aria-label="Frontier Fortune loading">
      <div className="frontier-entry-canyon" aria-hidden="true" />
      <div className="frontier-loading-panel">
        <img className="frontier-entry-logo" src={frontierUiAssets.titleLogo} alt="Frontier Fortune" />
        <div className="frontier-loading-coin" aria-hidden="true">
          <span />
        </div>
        <strong>{getFrontierLoadingMessage(progress)}</strong>
        <div className="frontier-loading-track" aria-hidden="true">
          <i style={{ width: `${Math.max(8, Math.min(100, progress))}%` }} />
        </div>
        <small>{Math.round(progress)}%</small>
      </div>
    </div>
  );
}

function GoldRushLoadingScreen({ progress, logo }: { progress: number; logo?: string }) {
  return (
    <div className="gold-rush-loading-screen" role="status" aria-label="Gold Rush Showdown loading">
      <div className="gold-rush-loading-panel">
        {logo ? <img className="gold-rush-loading-logo" src={logo} alt="Gold Rush Showdown" /> : <strong>Gold Rush Showdown</strong>}
        <span className="gold-rush-loading-orb" aria-hidden="true" />
        <b>{getFrontierLoadingMessage(progress)}</b>
        <div className="frontier-loading-track" aria-hidden="true">
          <i style={{ width: `${Math.max(8, Math.min(100, progress))}%` }} />
        </div>
        <small>{Math.round(progress)}%</small>
      </div>
    </div>
  );
}

function FrontierFeatureIntroScreen({
  onContinue,
}: {
  onContinue: () => void;
}) {
  return (
    <div className="frontier-entry-screen frontier-feature-intro" role="dialog" aria-modal="true" aria-label="Frontier Fortune features">
      <div className="frontier-intro-art-layers" aria-hidden="true">
        <img className="frontier-intro-bg" src={frontierIntroAssets.bg} alt="" />
        <img className="frontier-intro-rays" src={frontierIntroAssets.rays} alt="" />
        <img className="frontier-intro-embers" src={frontierIntroAssets.embers} alt="" />
        <img className="frontier-intro-vignette" src={frontierIntroAssets.vignette} alt="" />
      </div>
      <div className="frontier-intro-top">
        <img className="frontier-entry-logo frontier-intro-logo-pro" src={frontierIntroAssets.logo} alt="Frontier Fortune" />
      </div>
      <div className="frontier-intro-stage">
        <div className="frontier-relic-hero" aria-hidden="true">
          <img className="frontier-relic-aura" src={frontierIntroAssets.relicAura} alt="" />
          <img className="frontier-relic-spirit" src={frontierIntroAssets.relicSpirit} alt="" />
          <img className="frontier-relic-shadow" src={frontierIntroAssets.relicShadow} alt="" />
        </div>
        <div className="frontier-feature-card-row">
          <article className="frontier-feature-card hold">
            <img className="frontier-card-frame" src={frontierIntroAssets.holdFrame} alt="" aria-hidden="true" />
            <div className="frontier-card-copy">
              <span className="frontier-card-label">{frontierFeatureIntroCards[0].label}</span>
              <img className="frontier-card-icon" src={frontierIntroAssets.holdIcon} alt="" aria-hidden="true" />
              <h2>{frontierFeatureIntroCards[0].title}</h2>
              <p>{frontierFeatureIntroCards[0].detail}</p>
            </div>
          </article>
          <article className="frontier-feature-card wheel">
            <img className="frontier-card-frame" src={frontierIntroAssets.wheelFrame} alt="" aria-hidden="true" />
            <div className="frontier-card-copy">
              <span className="frontier-card-label">{frontierFeatureIntroCards[1].label}</span>
              <img className="frontier-card-icon" src={frontierIntroAssets.wheelIcon} alt="" aria-hidden="true" />
              <h2>{frontierFeatureIntroCards[1].title}</h2>
              <p>{frontierFeatureIntroCards[1].detail}</p>
            </div>
          </article>
        </div>
      </div>
      <div className="frontier-intro-actions">
        <button className="frontier-continue-button" onClick={onContinue}>
          <span>Tap to Continue</span>
        </button>
      </div>
    </div>
  );
}

export function getJackpotBadgeLabels(game: SlotConfig) {
  return (["Grand", "Major", "Minor", "Mini"] as const).map((label) => ({
    label,
    value: game.jackpotLabels?.[label] ?? `${game.maxPayoutMultiplier}x`,
  }));
}

export function getCoinDisplayLabels(game: SlotConfig) {
  return {
    reel: game.symbols.filter((symbol) => symbol.kind === "coin").map((symbol) => symbol.icon),
    holdAndWin: game.holdAndWin?.coinAwards?.map((award) => award.label) ?? [],
  };
}

export function getBonusBoostMenuOptions(game: SlotConfig, betAmount: number, currency: Currency) {
  return [
    {
      id: "buy-hold",
      label: "Buy Hold & Win",
      cost: getBonusBuyCost(game, betAmount, "HOLD_AND_WIN", currency),
      detail: "Starts Hold & Win with 6 coins",
    },
    {
      id: "buy-wheel",
      label: "Buy Wheel Bonus",
      cost: getBonusBuyCost(game, betAmount, "WHEEL_BONUS", currency),
      detail: "Spins the Wheel Bonus",
    },
    {
      id: "gold-boost",
      label: "Gold Boost",
      cost: getSpinCost(game, betAmount, "GOLD_BOOST"),
      detail: `+${Math.round(((game.boostSpins?.GOLD_BOOST?.costMultiplier ?? 1) - 1) * 100)}% cost, better coin chance`,
    },
    {
      id: "scatter-boost",
      label: "Scatter Boost",
      cost: getSpinCost(game, betAmount, "SCATTER_BOOST"),
      detail: `+${Math.round(((game.boostSpins?.SCATTER_BOOST?.costMultiplier ?? 1) - 1) * 100)}% cost, better scatter chance`,
    },
  ];
}

export function getFrontierMainControlActions() {
  return ["Feature Intro", "Speed", "Info", "Sound"];
}

export function getFrontierReelAction() {
  return "E-Boost";
}

export function getFrontierCollectorPlacement() {
  return "above-reels";
}

export function getWheelSectionLabels(game: SlotConfig) {
  return game.wheelBonus?.segments.map((segment) => segment.label) ?? [];
}

export function getWheelLandingDegrees(labels: string[], resultLabel?: string, rotations = 9) {
  const count = Math.max(1, labels.length);
  const index = Math.max(0, labels.findIndex((label) => label === resultLabel));
  const segmentAngle = 360 / count;
  const segmentCenter = index * segmentAngle + segmentAngle / 2;
  return rotations * 360 - segmentCenter;
}

export function getFrontierWheelSegmentDisplayLabel(label: string) {
  return label
    .replace(" Free Spins", "\nFree Spins")
    .replace("Hold & Win", "Hold\n& Win")
    .replace("Super ", "Super\n");
}

export function getFrontierWheelPrizeClass(label: string) {
  if (label.includes("Hold") || label.includes("Free Spins")) return "feature";
  if (label === "Major") return "major";
  if (["Mini", "Minor"].includes(label)) return "jackpot";
  if (label === "2x" || label === "5x") return "small";
  return "multiplier";
}

export function getFrontierWheelDrama(labels: string[], resultLabel?: string) {
  if (!resultLabel || labels.length === 0) return "standard";
  const index = labels.findIndex((label) => label === resultLabel);
  if (index < 0) return "standard";
  const isBig = (label: string) => getFrontierWheelPrizeClass(label) === "feature" || label === "Major";
  if (isBig(resultLabel)) return "big-bonus";
  const previous = labels[(index - 1 + labels.length) % labels.length];
  const next = labels[(index + 1) % labels.length];
  return isBig(previous) || isBig(next) ? "near-miss" : "standard";
}

export function getFrontierWheelResultAction(result?: SlotSpinResult | null) {
  const wheel = result?.wheelBonus;
  if (!wheel) return "Continue";
  if (wheel.featureTrigger) return wheel.featureTrigger === "SUPER_HOLD_AND_WIN" ? "Start Super Hold & Win" : "Start Hold & Win";
  if (wheel.freeSpinsAwarded) return `Start ${wheel.freeSpinsAwarded} Free Spins`;
  return "Continue";
}

export function getNextFrontierStickyWildPositions(game: SlotConfig, result: SlotSpinResult, current: number[], freeSpinsRemainingAfterSpin: number) {
  if (!game.freeSpins.stickyWilds || freeSpinsRemainingAfterSpin <= 0) return [];
  return getStickyWildPositions(game, result.grid, current);
}

type GoldRushGridPhase = "flash" | "expand" | "duel" | "clash" | "winner" | "final";

type GoldRushMineClashArea = {
  startReel: number;
  width: number;
  rowStart: number;
  rowSpan: number;
  reelCount: number;
  rowCount: number;
  areaType: "column" | "interior";
  winner?: "gold" | "diamond";
  multiplier?: number;
  tier?: GoldRushMineClashSegment["tier"];
  goldMultiplier?: number;
  diamondMultiplier?: number;
  triggerPosition?: { reel: number; row: number };
  transformedPositions?: Array<{ reel: number; row: number }>;
};

function normalizeGoldRushMineClashArea(segment: GoldRushMineClashSegment, reelCount: number, rowCount: number): GoldRushMineClashArea {
  const startReel = Math.max(0, Math.min(reelCount - 1, segment.startReel));
  const width = Math.max(1, Math.min(reelCount - startReel, segment.width));
  const rowStart = Math.max(0, Math.min(rowCount - 1, segment.rowStart));
  const rowSpan = Math.max(1, Math.min(rowCount - rowStart, segment.rowCount));
  return {
    startReel,
    width,
    rowStart,
    rowSpan,
    reelCount,
    rowCount,
    areaType: segment.type,
    winner: segment.winner,
    multiplier: segment.multiplier,
    tier: segment.tier,
    goldMultiplier: segment.goldMultiplier,
    diamondMultiplier: segment.diamondMultiplier,
    triggerPosition: segment.triggerPosition,
    transformedPositions: segment.transformedPositions,
  };
}

export function getGoldRushMineClashSegments(result: SlotSpinResult, reelCount: number, rowCount: number): GoldRushMineClashArea[] {
  const segments = result.goldRush?.activeSegments ?? result.expansionBonus?.activeSegments;
  if (segments?.length) {
    return segments.map((segment) => normalizeGoldRushMineClashArea(segment, reelCount, rowCount));
  }

  const frame = result.expansionBonus?.frame;
  const activeColumns = result.goldRush?.activeColumns;
  const activeRows = result.goldRush?.activeRows;
  const startReel = Math.max(0, Math.min(reelCount - 1, activeColumns?.start ?? frame?.startReel ?? result.goldRush?.activeVsPosition?.reel ?? 0));
  const width = Math.max(1, Math.min(reelCount - startReel, activeColumns?.count ?? frame?.width ?? 1));
  const rowStart = Math.max(0, Math.min(rowCount - 1, activeRows?.start ?? frame?.rowStart ?? 0));
  const rowSpan = Math.max(1, Math.min(rowCount - rowStart, activeRows?.count ?? frame?.rowCount ?? rowCount));
  return [{
    startReel,
    width,
    rowStart,
    rowSpan,
    reelCount,
    rowCount,
    areaType: result.goldRush?.activeAreaType ?? (result.goldRush?.vsType === "interior" ? "interior" : "column"),
    winner: result.goldRush?.vsWinnerSide ?? result.expansionBonus?.vsWinnerSide ?? result.expansionBonus?.mineClash?.winner,
    multiplier: result.goldRush?.vsWinningMultiplier ?? result.goldRush?.vsMultiplier ?? result.expansionBonus?.multiplier,
    tier: result.goldRush?.vsTier ?? result.expansionBonus?.vsTier,
    goldMultiplier: result.goldRush?.vsCandidateMultipliers?.gold ?? result.expansionBonus?.mineClash?.goldMultiplier,
    diamondMultiplier: result.goldRush?.vsCandidateMultipliers?.diamond ?? result.expansionBonus?.mineClash?.diamondMultiplier,
    triggerPosition: result.goldRush?.activeVsPosition ?? result.expansionBonus?.activeVsPosition,
    transformedPositions: result.goldRush?.transformedPositions ?? result.expansionBonus?.transformedPositions,
  }];
}

export function getGoldRushMineClashArea(result: SlotSpinResult, reelCount: number, rowCount: number) {
  return getGoldRushMineClashSegments(result, reelCount, rowCount)[0];
}

export function getGoldRushMineClashDisplayMultipliers(result: SlotSpinResult, area?: GoldRushMineClashArea) {
  const matchingColumn = area?.areaType === "column"
    ? (result.goldRush?.mineClashColumns ?? result.expansionBonus?.mineClashColumns ?? []).find((column) => column.reel === area.startReel)
    : undefined;
  const primaryColumn = matchingColumn ?? result.goldRush?.mineClashColumns?.[0] ?? result.expansionBonus?.mineClashColumns?.[0];
  const tier = area?.tier ?? primaryColumn?.tier ?? result.goldRush?.vsTier ?? result.expansionBonus?.vsTier ?? "gold-gold";
  const winner = area?.winner ?? primaryColumn?.winner ?? result.goldRush?.vsWinnerSide ?? result.expansionBonus?.vsWinnerSide ?? result.expansionBonus?.mineClash?.winner ?? "gold";
  const winningMultiplier = area?.multiplier ?? primaryColumn?.multiplier ?? result.goldRush?.vsWinningMultiplier ?? result.expansionBonus?.multiplier ?? 0;
  let gold = area?.goldMultiplier ?? primaryColumn?.goldMultiplier ?? result.goldRush?.vsCandidateMultipliers?.gold ?? result.expansionBonus?.mineClash?.goldMultiplier ?? winningMultiplier;
  let diamond = area?.diamondMultiplier ?? primaryColumn?.diamondMultiplier ?? result.goldRush?.vsCandidateMultipliers?.diamond ?? result.expansionBonus?.mineClash?.diamondMultiplier ?? winningMultiplier;
  const goldKind = tier === "diamond-diamond" ? "diamond" : "gold";
  const diamondKind = tier === "gold-gold" ? "gold" : "diamond";
  const goldLabel = goldKind === "diamond" ? "Diamond Miner" : "Gold Miner";
  const diamondLabel = diamondKind === "diamond" ? "Diamond Miner" : "Gold Miner";

  if (winner === "gold") gold = winningMultiplier;
  if (winner === "diamond") diamond = winningMultiplier;

  if (tier === "gold-diamond" && diamond <= gold) {
    gold = Math.max(2, diamond - 1);
  }

  if (gold === diamond) {
    if (winner === "gold") {
      diamond = winningMultiplier >= 6 ? winningMultiplier - 2 : winningMultiplier + 2;
    } else {
      gold = winningMultiplier >= 6 ? winningMultiplier - 2 : winningMultiplier + 2;
    }
  }

  return { gold, diamond, winning: winningMultiplier, winner, tier, goldKind, diamondKind, goldLabel, diamondLabel };
}

export function GoldRushMineClashGridOverlay({
  result,
  reelCount,
  rowCount,
  onComplete,
}: {
  result: SlotSpinResult;
  reelCount: number;
  rowCount: number;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState<GoldRushGridPhase>("flash");
  const [segmentIndex, setSegmentIndex] = useState(0);
  const onCompleteRef = useRef(onComplete);
  const segments = getGoldRushMineClashSegments(result, reelCount, rowCount);
  const area = segments[Math.min(segmentIndex, Math.max(0, segments.length - 1))] ?? getGoldRushMineClashArea(result, reelCount, rowCount);
  const displayMultipliers = getGoldRushMineClashDisplayMultipliers(result, area);
  const winner = displayMultipliers.winner;
  const goldMultiplier = displayMultipliers.gold;
  const diamondMultiplier = displayMultipliers.diamond;
  const winningMultiplier = displayMultipliers.winning;
  const goldPortrait = displayMultipliers.goldKind === "diamond" ? goldRushFxAssets.diamondMinerPortrait : goldRushFxAssets.goldMinerPortrait;
  const diamondPortrait = displayMultipliers.diamondKind === "diamond" ? goldRushFxAssets.diamondMinerPortrait : goldRushFxAssets.goldMinerPortrait;
  const transformedCount = area.transformedPositions?.length ?? result.goldRush?.transformedPositions?.length ?? result.expansionBonus?.transformedPositions?.length ?? 0;

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    setSegmentIndex(0);
    setPhase("flash");
  }, [result]);

  useEffect(() => {
    setPhase("flash");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const sequence: Array<{ phase: GoldRushGridPhase; delay: number }> = reducedMotion
      ? [
        { phase: "expand", delay: 120 },
        { phase: "duel", delay: 180 },
        { phase: "winner", delay: 240 },
        { phase: "final", delay: 220 },
      ]
      : [
        { phase: "expand", delay: 720 },
        { phase: "duel", delay: 1080 },
        { phase: "clash", delay: 1050 },
        { phase: "winner", delay: 1550 },
        { phase: "final", delay: 820 },
      ];
    let index = 0;
    const timers: number[] = [];
    playExpansionHit();
    playBonus();
    startGoldRushMusic();
    playGoldRushSound("vs_land");
    duckGoldRushMusic(reducedMotion ? 900 : 4200);
    const advance = () => {
      const next = sequence[index];
      if (!next) {
        timers.push(window.setTimeout(() => {
          if (segmentIndex < segments.length - 1) {
            setSegmentIndex((current) => current + 1);
          } else {
            onCompleteRef.current();
          }
        }, reducedMotion ? 220 : 720));
        return;
      }
      timers.push(window.setTimeout(() => {
        setPhase(next.phase);
        playMultiplierTick();
        if (next.phase === "expand") playGoldRushSound("vs_expand");
        else if (next.phase === "duel") playGoldRushSound("symbol_land");
        else if (next.phase === "clash") playGoldRushSound("clash_hit");
        else if (next.phase === "winner") playGoldRushSound("multiplier_reveal");
        else if (next.phase === "final") playGoldRushSound("symbol_land");
        index += 1;
        advance();
      }, next.delay));
    };
    advance();
    return () => timers.forEach((timer) => window.clearTimeout(timer));
  }, [result, segmentIndex, segments.length]);

  return (
    <div
      className={`gold-rush-grid-clash-overlay phase-${phase} area-${area.areaType} width-${area.width} winner-${winner}`}
      data-segment-index={segmentIndex}
      data-segment-count={segments.length}
      style={{
        "--clash-start": area.startReel,
        "--clash-width": area.width,
        "--clash-row-start": area.rowStart,
        "--clash-row-span": area.rowSpan,
        "--clash-reel-count": area.reelCount,
        "--clash-row-count": area.rowCount,
      } as React.CSSProperties}
      aria-label="Mine Clash resolving in reel grid"
    >
      <div className="gold-rush-grid-dim" aria-hidden="true" />
      <div className="gold-rush-clash-active-area" aria-hidden="true">
        <img className="mine-clash-chamber-art" src={goldRushFxAssets.mineClashChamber} alt="" />
        <img className="mine-clash-pop-art" src={goldRushFxAssets.mineClashImpactPop} alt="" />
        <span className="ore-line gold" />
        <span className="ore-line diamond" />
        <span className="clash-spark one" />
        <span className="clash-spark two" />
        <span className="clash-spark three" />
      </div>
      <div className="gold-rush-clash-content">
        <div className={`grid-miner-card gold side-${displayMultipliers.goldKind} ${winner === "gold" ? "winner" : "loser"}`}>
          <i className="grid-miner-avatar" aria-hidden="true">
            <img className="miner-portrait-art" src={goldPortrait} alt="" />
            <span className="miner-helmet" />
            <span className="miner-face" />
            <span className="miner-body" />
            <span className="miner-pickaxe" />
            <span className="miner-ore" />
          </i>
          <span>{displayMultipliers.goldLabel}</span>
          <strong>{goldMultiplier}x</strong>
          <em className="miner-meter"><i /></em>
        </div>
        <div className="grid-vs-core">
          <b>VS</b>
          <strong>{phase === "winner" || phase === "final" ? `${winningMultiplier}x` : "CLASH"}</strong>
        </div>
        {segments.length > 1 && (
          <div className="grid-column-multipliers" aria-hidden="true">
            <span className={`winner-${winner}`}>
              <i>{segmentIndex + 1}/{segments.length}</i>
              <b>{winningMultiplier}x</b>
            </span>
          </div>
        )}
        <div className={`grid-miner-card diamond side-${displayMultipliers.diamondKind} ${winner === "diamond" ? "winner" : "loser"}`}>
          <i className="grid-miner-avatar" aria-hidden="true">
            <img className="miner-portrait-art" src={diamondPortrait} alt="" />
            <span className="miner-helmet" />
            <span className="miner-face" />
            <span className="miner-body" />
            <span className="miner-pickaxe" />
            <span className="miner-ore" />
          </i>
          <span>{displayMultipliers.diamondLabel}</span>
          <strong>{diamondMultiplier}x</strong>
          <em className="miner-meter"><i /></em>
        </div>
        <em className="grid-clash-final-label">{transformedCount} multiplier wild positions</em>
      </div>
    </div>
  );
}

export function GoldRushMineClashFinalPanel({
  result,
  reelCount,
  rowCount,
}: {
  result: SlotSpinResult;
  reelCount: number;
  rowCount: number;
}) {
  const segments = getGoldRushMineClashSegments(result, reelCount, rowCount);
  return (
    <>
      {segments.map((area, index) => {
        const displayMultipliers = getGoldRushMineClashDisplayMultipliers(result, area);
        const winner = displayMultipliers.winner;
        const multiplier = displayMultipliers.winning;
        return (
          <div
            key={`${area.areaType}-${area.startReel}-${area.width}-${index}`}
            className={`gold-rush-final-clash-panel area-${area.areaType} width-${area.width} winner-${winner}`}
            data-segment-index={index}
            data-segment-count={segments.length}
            style={{
              "--clash-start": area.startReel,
              "--clash-width": area.width,
              "--clash-row-start": area.rowStart,
              "--clash-row-span": area.rowSpan,
              "--clash-reel-count": area.reelCount,
              "--clash-row-count": area.rowCount,
            } as React.CSSProperties}
            aria-label={`${winner === "diamond" ? "Diamond" : "Gold"} Miner ${multiplier}x multiplier wild`}
          >
            <img className="mine-clash-final-bg" src={goldRushFxAssets.mineClashChamber} alt="" aria-hidden="true" />
            <div className="final-miner-avatar" data-center-anchor="true" aria-hidden="true">
              <img className="miner-portrait-art" src={winner === "diamond" ? goldRushFxAssets.diamondMinerPortrait : goldRushFxAssets.goldMinerPortrait} alt="" />
              <span className="miner-helmet" />
              <span className="miner-face" />
              <span className="miner-body" />
              <span className="miner-pickaxe" />
              <span className="miner-ore" />
            </div>
            <div className="final-miner-copy">
              <span>{winner === "diamond" ? "Diamond Miner" : "Gold Miner"}</span>
              <strong>{multiplier}x</strong>
              <b>WILD</b>
            </div>
          </div>
        );
      })}
    </>
  );
}

export function getBonusChanceTier(betAmount: number, game: SlotConfig) {
  const range = Math.max(1, game.maxBet - game.minBet);
  const progress = (betAmount - game.minBet) / range;
  if (progress >= 0.68) return "Best";
  if (progress >= 0.28) return "Better";
  return "Low";
}

export function getBuyBonusCost(betAmount: number, game: SlotConfig) {
  return game.buyBonus?.enabled ? getBonusBuyCost(game, betAmount) : 0;
}

function getGoldRushBonusOptionDetail(type: GoldRushBonusBuyType) {
  switch (type) {
    case "bonus-plus-spins":
      return "Boosts Bonus symbols on the next paid spin. This is a one-spin boost and is consumed after you press Spin.";
    case "showdown-spin":
      return "Keeps Showdown Spin active until you turn it off. Each paid spin guarantees at least one VS symbol and an interior zone, but a win is not guaranteed.";
    case "buy-bonus":
      return "Immediately buys a trigger spin with 3 Bonus symbols, then starts 10 Free Spins with a 2x4 interior frame.";
    case "buy-super-bonus":
      return "Immediately buys a trigger spin with 4 Bonus symbols, then starts 10 Free Spins with a larger 3x4 interior frame.";
    default:
      return "";
  }
}

export function getGoldRushFreeSpinDisplayInterior(game: SlotConfig, columns: number, preferredStartColumn: number) {
  const safeColumns = Math.max(2, Math.min(game.reelCount, game.goldRushBonusBuys?.freeSpins.maxInteriorColumns ?? game.reelCount, columns));
  const startColumn = Math.max(0, Math.min(game.reelCount - safeColumns, preferredStartColumn));
  return { startColumn, columns: safeColumns, rowStart: 0, rowCount: game.rowCount };
}

export function getBetOptions(game: SlotConfig, currency?: Currency) {
  const configured = currency ? game.currencyBetOptions?.[currency] : undefined;
  if (configured?.length) return configured;
  const options = new Set<number>([game.minBet, game.maxBet]);
  for (let value = game.minBet; value <= game.maxBet; value += game.minBet) {
    options.add(value);
  }
  [100, 150, 200, 250, 300, 400, 500, 750, 1000].forEach((value) => {
    if (value >= game.minBet && value <= game.maxBet) options.add(value);
  });
  return [...options].sort((a, b) => a - b);
}

export function getDefaultBetAmount(game: SlotConfig, currency: Currency) {
  return getBetOptions(game, currency)[0] ?? game.minBet;
}

export function getFrontierAnticipationState(grid: string[][], game: SlotConfig) {
  const firstReels = grid.slice(0, Math.max(3, game.reelCount - 2)).flat();
  const coins = firstReels.filter((symbol) => symbol === game.specialSymbols?.coin).length;
  const scatters = firstReels.filter((symbol) => symbol === game.scatterSymbol).length;
  return { coins, scatters, active: coins >= 5 || scatters >= 2 };
}

export function SlotMachine({ game, onExit }: { game: SlotConfig; onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(getDefaultBetAmount(game, "GOLD"));
  const [spinMode, setSpinMode] = useState<SpinMode>("NORMAL");
  const [grid, setGrid] = useState(() => generateGrid(game));
  const [history, setHistory] = useState<SlotSpinResult[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [spinSpeed, setSpinSpeed] = useState<FrontierSpinSpeed>("NORMAL");
  const [sessionStats, setSessionStats] = useState(emptySessionStats);
  const [freeSpins, setFreeSpins] = useState(0);
  const [freeSpinTotal, setFreeSpinTotal] = useState(0);
  const [stickyWildPositions, setStickyWildPositions] = useState<number[]>([]);
  const [bonusMeter, setBonusMeter] = useState(0);
  const [collectorCoins, setCollectorCoins] = useState(0);
  const [collectorFeedback, setCollectorFeedback] = useState("");
  const [collectorAnimation, setCollectorAnimation] = useState({ key: 0, collected: 0, triggered: false, cracked: false, displayLevel: null as number | null });
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [buyBonusOpen, setBuyBonusOpen] = useState(false);
  const [goldRushBonusOpen, setGoldRushBonusOpen] = useState(false);
  const [bonusResult, setBonusResult] = useState<SlotSpinResult | null>(null);
  const [wheelReveal, setWheelReveal] = useState<FrontierWheelReveal | null>(null);
  const [uiState, setUiState] = useState<SlotUiState>("Idle");
  const [anticipating, setAnticipating] = useState(false);
  const [overlayResult, setOverlayResult] = useState<SlotSpinResult | null>(null);
  const [expansionOverlayResult, setExpansionOverlayResult] = useState<SlotSpinResult | null>(null);
  const [holdState, setHoldState] = useState<HoldAndWinState | null>(null);
  const [holdBought, setHoldBought] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [logoReady, setLogoReady] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [assetLoadProgress, setAssetLoadProgress] = useState(0);
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
  const [holdFeedback, setHoldFeedback] = useState("");
  const [animationState, setAnimationState] = useState<SlotAnimationState>("idle");
  const [reelStates, setReelStates] = useState<ReelVisualState[]>(() => Array.from({ length: game.reelCount }, () => "idle"));
  const [betMenuOpen, setBetMenuOpen] = useState(false);
  const [frontierSkipIntro, setFrontierSkipIntro] = useState(false);
  const [frontierEntryEntered, setFrontierEntryEntered] = useState(() => game.id !== "frontier-fortune");
  const [frontierIntroReopened, setFrontierIntroReopened] = useState(false);
  const [highlightedLineIndex, setHighlightedLineIndex] = useState(0);
  const [goldRushSpinInterior, setGoldRushSpinInterior] = useState<NonNullable<SlotSpinResult["goldRush"]>["interior"] | null>(null);
  const [goldRushArmedBoost, setGoldRushArmedBoost] = useState<GoldRushArmedBoost | null>(null);
  const [goldRushFreeSpinSession, setGoldRushFreeSpinSession] = useState<GoldRushFreeSpinSession | null>(null);
  const [goldRushBonusSelection, setGoldRushBonusSelection] = useState<GoldRushBonusBuyType | null>(null);

  if (!user) return null;
  const currentUser = user;
  const isGoldRush = game.id === "gold-rush-showdown";
  const balance = getBalance(currentUser.id, currency);
  const currencyLabel = getCurrencyShortName(currency);
  const inHoldAndWin = Boolean(holdState);
  const spinCost = goldRushArmedBoost ? goldRushArmedBoost.cost : getSpinCost(game, betAmount, spinMode);
  const goldRushSpinLocked = Boolean(goldRushFreeSpinSession?.introOpen || goldRushFreeSpinSession?.summaryOpen);
  const canSpin = assetsLoaded && !spinning && !inHoldAndWin && !expansionOverlayResult && !goldRushSpinLocked && (freeSpins > 0 || balance >= spinCost);
  const holdBuyCost = getBonusBuyCost(game, betAmount, "HOLD_AND_WIN", currency);
  const wheelBuyCost = getBonusBuyCost(game, betAmount, "WHEEL_BONUS", currency);
  const turbo = frontierTurboBypassesAnimation(spinSpeed);
  const lastResult = history[0];
  const scatterCount = grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
  const bonusCount = grid.flat().filter((symbol) => symbol === game.bonusSymbol).length;
  const betOptions = getBetOptions(game, currency);
  const titleLogo = game.visual.logoImage;
  const frontierEntryPhase = getFrontierEntryPhase(game.id, assetsLoaded, frontierEntryEntered, frontierSkipIntro, frontierIntroReopened);
  const showLastWin = !spinning && animationState !== "spinning";
  const goldRushVisualResult =
    isGoldRush && overlayResult?.gameId === game.id && overlayResult.expansionBonus?.sourceFeature === "mine-clash" ? overlayResult : lastResult;
  const resultForHighlights = isGoldRush ? goldRushVisualResult : lastResult;
  const goldRushLineWins = showLastWin && isGoldRush && !expansionOverlayResult ? resultForHighlights?.lineWins ?? [] : [];
  const currentGoldRushLineWin = goldRushLineWins.length > 0 ? goldRushLineWins[highlightedLineIndex % goldRushLineWins.length] : undefined;
  const activePaylines = new Set(
    showLastWin
      ? isGoldRush
        ? currentGoldRushLineWin ? [currentGoldRushLineWin.paylineId] : []
        : resultForHighlights?.lineWins.map((win) => win.paylineId) ?? []
      : [],
  );
  const goldRushLineHighlightKey = goldRushLineWins.map((win) => `${win.paylineId}:${win.symbol}:${win.count}:${win.payout}`).join("|");
  const goldRushLineBadgeStyle = currentGoldRushLineWin
    ? {
      "--line-badge-x": `${((currentGoldRushLineWin.positions.reduce((sum, position) => sum + position.reel, 0) / currentGoldRushLineWin.positions.length) + 0.5) / game.reelCount * 100}%`,
      "--line-badge-y": `${((currentGoldRushLineWin.positions.reduce((sum, position) => sum + position.row, 0) / currentGoldRushLineWin.positions.length) + 0.5) / game.rowCount * 100}%`,
    } as React.CSSProperties
    : undefined;
  const goldRushTransformedPositions = new Set(
    showLastWin && isGoldRush && !expansionOverlayResult
      ? (goldRushVisualResult?.goldRush?.transformedPositions ?? goldRushVisualResult?.expansionBonus?.transformedPositions ?? []).map((position) => `${position.reel}:${position.row}`)
      : [],
  );
  const goldRushFinalClashResult =
    showLastWin &&
    isGoldRush &&
    !expansionOverlayResult &&
    goldRushVisualResult?.expansionBonus?.sourceFeature === "mine-clash" &&
    goldRushTransformedPositions.size > 0
      ? goldRushVisualResult
      : null;
  const goldRushFreeSpinDisplayInterior = goldRushFreeSpinSession && freeSpins > 0
    ? getGoldRushFreeSpinDisplayInterior(game, goldRushFreeSpinSession.interiorColumns, goldRushFreeSpinSession.interiorStartColumn)
    : undefined;
  const goldRushInterior = isGoldRush
    ? spinning
      ? goldRushSpinInterior ?? goldRushFreeSpinDisplayInterior
      : showLastWin
        ? goldRushSpinInterior ?? goldRushVisualResult?.goldRush?.interior ?? goldRushFreeSpinDisplayInterior
        : goldRushFreeSpinDisplayInterior
    : undefined;
  const modeLabel =
    animationState === "bonusRespinning"
      ? "Respinning"
      : animationState === "bonusComplete"
        ? "Complete"
        : inHoldAndWin
          ? "Hold And Win"
          : uiState === "Spinning" || uiState === "Evaluating"
            ? spinSpeed === "TURBO"
              ? "Turbo Spin"
              : spinSpeed === "FAST"
                ? "Fast Spin"
                : "Normal Spin"
            : uiState;
  const treasurePotState = getTreasurePotVisualState(
    collectorAnimation.displayLevel ?? collectorCoins,
    game.coinCollector?.maxCoins ?? 5,
    collectorAnimation.triggered,
    collectorAnimation.collected,
  );
  const wheelSectionLabels = getWheelSectionLabels(game);
  const wheelDrama = wheelReveal ? getFrontierWheelDrama(wheelSectionLabels, wheelReveal.result.wheelBonus?.segment) : "standard";
  const speedLabel = spinSpeed === "NORMAL" ? "Normal" : spinSpeed === "FAST" ? "Fast" : isGoldRush ? "Instant" : "Turbo";
  const selectedGoldRushBonusOption = goldRushBonusSelection ? getGoldRushBonusBuyOption(game, goldRushBonusSelection) : undefined;
  const selectedGoldRushBonusCost = selectedGoldRushBonusOption ? getGoldRushBonusBuyCost(game, betAmount, selectedGoldRushBonusOption.type) : 0;
  const goldRushOverlayTier = overlayResult && isGoldRush ? getGoldRushWinTier(overlayResult.payout, betAmount) : "none";

  useEffect(() => {
    setHighlightedLineIndex(0);
    if (!isGoldRush || !showLastWin || goldRushLineWins.length <= 1) return undefined;
    const timer = window.setInterval(() => {
      setHighlightedLineIndex((index) => (index + 1) % goldRushLineWins.length);
    }, 950);
    return () => window.clearInterval(timer);
  }, [goldRushLineHighlightKey, goldRushLineWins.length, isGoldRush, showLastWin]);

  useEffect(() => {
    setBetAmount(getDefaultBetAmount(game, "GOLD"));
    setGrid(generateGrid(game));
    setHistory([]);
    setFreeSpins(0);
    setFreeSpinTotal(0);
    setStickyWildPositions([]);
    setBonusMeter(0);
    setCollectorCoins(0);
    setCollectorFeedback("");
    setCollectorAnimation({ key: 0, collected: 0, triggered: false, cracked: false, displayLevel: null });
    setSpinMode("NORMAL");
    setSpinSpeed("NORMAL");
    setUiState("Idle");
    setOverlayResult(null);
    setExpansionOverlayResult(null);
    setHoldState(null);
    setHoldBought(false);
    setHoldFeedback("");
    setAnimationState("idle");
    setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
    setBetMenuOpen(false);
    setGoldRushBonusOpen(false);
    setGoldRushBonusSelection(null);
    setGoldRushSpinInterior(null);
    setGoldRushArmedBoost(null);
    setGoldRushFreeSpinSession(null);
    setWheelReveal(null);
    setFrontierSkipIntro(false);
    setFrontierEntryEntered(game.id !== "frontier-fortune");
    setFrontierIntroReopened(false);
  }, [game]);

  useEffect(() => {
    setBetAmount(getDefaultBetAmount(game, currency));
  }, [currency, game]);

  useEffect(() => {
    if (!isGoldRush) return undefined;
    const timer = window.setInterval(() => {
      if (!isSoundEnabled()) stopGoldRushMusic();
    }, 250);
    return () => {
      window.clearInterval(timer);
      stopGoldRushMusic();
    };
  }, [isGoldRush]);

  useEffect(() => {
    setGoldRushArmedBoost((current) => {
      if (!current) return current;
      const option = getGoldRushBonusBuyOption(game, current.type);
      if (!option?.spinMode) return null;
      return {
        ...current,
        label: option.label,
        cost: getGoldRushBonusBuyCost(game, betAmount, current.type),
        spinMode: option.spinMode,
      };
    });
  }, [betAmount, game]);

  useEffect(() => {
    if (!isGoldRush || !goldRushFreeSpinSession?.lastGrowth) return undefined;
    const timer = window.setTimeout(() => {
      setGoldRushFreeSpinSession((current) => current ? { ...current, lastGrowth: undefined } : current);
    }, 1850);
    return () => window.clearTimeout(timer);
  }, [goldRushFreeSpinSession?.lastGrowth?.addedSpins, goldRushFreeSpinSession?.lastGrowth?.columns, isGoldRush]);

  useEffect(() => {
    let active = true;
    setAssetsLoaded(false);
    setAssetLoadProgress(0);
    const urls = [
      ...game.symbols.map((symbol) => symbol.image).filter((url): url is string => Boolean(url)),
      ...(game.visual.logoImage ? [game.visual.logoImage] : []),
      ...(game.goldRushBonusBuys?.options.map((option) => option.image).filter((url): url is string => Boolean(url)) ?? []),
      ...(game.id === "frontier-fortune" ? Object.values(frontierUiAssets) : []),
      ...(game.id === "frontier-fortune" ? Object.values(frontierIntroAssets) : []),
    ];
    const uniqueUrls = [...new Set(urls)];
    if (!uniqueUrls.length) {
      setAssetLoadProgress(100);
      setAssetsLoaded(true);
      return () => {
        active = false;
      };
    }
    let loadedCount = 0;
    const markLoaded = () => {
      loadedCount += 1;
      if (active) setAssetLoadProgress(Math.round((loadedCount / uniqueUrls.length) * 100));
    };
    Promise.all(
      uniqueUrls.map(
        (url) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.decoding = "async";
            image.onload = () => {
              markLoaded();
              resolve();
            };
            image.onerror = () => {
              markLoaded();
              resolve();
            };
            image.src = url;
          }),
      ),
    ).then(() => {
      if (active) {
        setAssetLoadProgress(100);
        setAssetsLoaded(true);
      }
    });
    const memory = "deviceMemory" in navigator ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) : 4;
    setLowPerformanceMode(memory <= 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    return () => {
      active = false;
    };
  }, [game]);

  useEffect(() => {
    if (!collectorAnimation.collected && !collectorAnimation.triggered && !collectorAnimation.cracked) return;
    const timeout = window.setTimeout(
      () =>
        setCollectorAnimation((current) =>
          current.key === collectorAnimation.key
            ? { key: current.key, collected: 0, triggered: false, cracked: false, displayLevel: null }
            : current,
        ),
      collectorAnimation.triggered ? 1100 : collectorAnimation.cracked ? 980 : 760,
    );
    return () => window.clearTimeout(timeout);
  }, [collectorAnimation.collected, collectorAnimation.cracked, collectorAnimation.displayLevel, collectorAnimation.key, collectorAnimation.triggered]);

  const overlayIsBig = overlayResult?.winTier === "BIG" || overlayResult?.winTier === "MEGA";

  function createGoldRushFreeSpinSession(triggerCount: number, source: GoldRushFreeSpinSession["triggerSource"]): GoldRushFreeSpinSession {
    const config = game.goldRushBonusBuys?.freeSpins;
    const interiorColumns = Math.max(2, Math.min(config?.maxInteriorColumns ?? game.reelCount, getGoldRushFreeSpinInitialInteriorColumns(game, triggerCount)));
    return {
      spinsRemaining: config?.initialSpins ?? 10,
      totalWin: 0,
      spinsPlayed: 0,
      initialSpins: config?.initialSpins ?? 10,
      interiorColumns,
      interiorStartColumn: selectGoldRushInteriorStart(game, interiorColumns),
      bonusSymbolsCollected: Math.max(0, triggerCount > 4 ? triggerCount - 4 : 0),
      collectThreshold: config?.collectThreshold ?? 3,
      addedSpins: config?.addedSpins ?? 2,
      maxInteriorColumns: config?.maxInteriorColumns ?? game.reelCount,
      triggerSource: source,
      introOpen: true,
      summaryOpen: false,
    };
  }

  function nextGoldRushInteriorStart(columns: number) {
    return selectGoldRushInteriorStart(game, columns);
  }

  function stepBet(direction: -1 | 1) {
    const index = betOptions.indexOf(betAmount);
    const nextIndex = Math.min(betOptions.length - 1, Math.max(0, (index >= 0 ? index : 0) + direction));
    setBetAmount(betOptions[nextIndex] ?? betAmount);
  }

  function continueFrontierEntry() {
    setFrontierFeatureIntroPreference(false);
    setFrontierSkipIntro(false);
    setFrontierEntryEntered(true);
    setFrontierIntroReopened(false);
    playClick();
  }

  function reopenFrontierIntro() {
    setFrontierIntroReopened(true);
    playClick();
  }

  useEffect(() => {
    if (!overlayResult) return;
    if (isGoldRush && overlayResult.gameId === "gold-rush-showdown" && overlayResult.payout > 0 && !overlayResult.triggeredExpansionBonus && goldRushOverlayTier !== "none") {
      return undefined;
    }
    const timeout = window.setTimeout(
      () => setOverlayResult(null),
      overlayResult.triggeredHoldAndWin && overlayResult.payout === 0 ? 1600 : overlayResult.winTier === "MEGA" ? 2800 : 2000,
    );
    return () => window.clearTimeout(timeout);
  }, [goldRushOverlayTier, isGoldRush, overlayResult]);

  function completeFrontierWheelSpin(reveal: FrontierWheelReveal) {
    const wheelBonus = reveal.result.wheelBonus;
    if (!wheelBonus || reveal.phase !== "ready") return;
    setWheelReveal({ ...reveal, phase: "spinning" });
    setAnimationState("bonusReveal");
    playSpin();
    window.setTimeout(() => {
      setWheelReveal((current) => current ? { ...current, phase: "revealed" } : current);
      if (wheelBonus.featureTrigger) {
        const superHold = wheelBonus.featureTrigger === "SUPER_HOLD_AND_WIN";
        setHoldState(createHoldAndWinState(game, reveal.bonusBetAmount, 6, superHold));
        setHoldBought(false);
        setHoldFeedback(superHold ? "SUPER HOLD AND WIN - ALL STARTING COINS OVER 2x" : "Wheel awarded Hold & Win with 6 starting coins.");
        setAnimationState("bonusIdle");
        setUiState("Hold And Win");
      } else if (wheelBonus.freeSpinsAwarded) {
        setFreeSpins(Math.min(game.freeSpins.maxSpins ?? 30, wheelBonus.freeSpinsAwarded));
        setFreeSpinTotal(0);
        setStickyWildPositions([]);
        setAnimationState("idle");
        setUiState("Free Spins");
      } else {
        setOverlayResult(reveal.result);
        setAnimationState("idle");
        setUiState("Win");
      }
    }, frontierWheelSpinMs);
  }

  function updateAfterSpin(result: SlotSpinResult, usedFreeSpin: boolean) {
    setGrid(result.grid);
    setHistory((current) => [result, ...current].slice(0, 8));
    const landedCoins = result.grid.flat().filter((symbol) => symbol === game.specialSymbols?.coin).length;
    const maxCollectorCoins = game.coinCollector?.maxCoins ?? 5;
    const collectAdd = game.coinCollector?.enabled && landedCoins > 0
      ? Math.min(game.coinCollector.maxCollect, Math.max(game.coinCollector.minCollect, landedCoins))
      : 0;
    const nextCollectorCoins = Math.min(maxCollectorCoins, collectorCoins + collectAdd);
    if (collectAdd > 0 || result.triggeredCoinCollector) {
      setCollectorAnimation({
        key: Date.now(),
        collected: collectAdd,
        triggered: Boolean(result.triggeredCoinCollector),
        cracked: chargedRelicCrackEvent(collectAdd),
        displayLevel: result.triggeredCoinCollector ? maxCollectorCoins : null,
      });
    }
    setCollectorCoins(result.triggeredCoinCollector && game.coinCollector?.resetOnTrigger ? 0 : nextCollectorCoins);
    setCollectorFeedback(
      result.triggeredCoinCollector
        ? "Collector Triggered"
        : collectAdd > 0
          ? `+${collectAdd} collector coin${collectAdd === 1 ? "" : "s"}`
          : "",
    );
    setBonusMeter((current) => (result.triggeredBonus ? 0 : Math.min(100, current + game.bonusFeature.meterPerSpin)));
    const freeSpinCap = game.freeSpins.maxSpins ?? 30;
    let freeSpinsAfterSpin = Math.max(0, freeSpins - (usedFreeSpin ? 1 : 0));
    let freeSpinsAfterAwards = Math.min(freeSpinCap, freeSpinsAfterSpin + result.freeSpinsAwarded);
    if (isGoldRush && usedFreeSpin && goldRushFreeSpinSession) {
      const collected = result.grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
      const previousThresholds = Math.floor(goldRushFreeSpinSession.bonusSymbolsCollected / goldRushFreeSpinSession.collectThreshold);
      const nextCollected = goldRushFreeSpinSession.bonusSymbolsCollected + collected;
      const nextThresholds = Math.floor(nextCollected / goldRushFreeSpinSession.collectThreshold);
      const thresholdsReached = Math.max(0, nextThresholds - previousThresholds);
      const addedSpins = Math.min(freeSpinCap - freeSpinsAfterSpin, thresholdsReached * goldRushFreeSpinSession.addedSpins);
      const nextColumns = Math.min(
        goldRushFreeSpinSession.maxInteriorColumns,
        goldRushFreeSpinSession.interiorColumns + thresholdsReached * (game.goldRushBonusBuys?.freeSpins.growColumns ?? 1),
      );
      const displayInterior = getGoldRushFreeSpinDisplayInterior(
        game,
        nextColumns,
        result.goldRush?.interior?.startColumn ?? goldRushFreeSpinSession.interiorStartColumn,
      );
      freeSpinsAfterAwards = Math.min(freeSpinCap, freeSpinsAfterSpin + addedSpins);
      const nextTotal = nextFreeSpinTotal(goldRushFreeSpinSession.totalWin, result);
      const nextSession: GoldRushFreeSpinSession = {
        ...goldRushFreeSpinSession,
        spinsRemaining: freeSpinsAfterAwards,
        totalWin: nextTotal,
        spinsPlayed: goldRushFreeSpinSession.spinsPlayed + 1,
        bonusSymbolsCollected: nextCollected,
        interiorColumns: nextColumns,
        interiorStartColumn: displayInterior.startColumn,
        introOpen: false,
        summaryOpen: freeSpinsAfterAwards === 0,
        lastGrowth: thresholdsReached > 0 ? { addedSpins, columns: nextColumns } : undefined,
      };
      setGoldRushFreeSpinSession(nextSession);
      setGoldRushSpinInterior(displayInterior);
      setFreeSpins(freeSpinsAfterAwards);
      setFreeSpinTotal(nextTotal);
      setStickyWildPositions([]);
      playGoldRushSound("free_spin_counter_tick");
      if (collected > 0) playGoldRushSound("meter_collect");
      if (thresholdsReached > 0) {
        playGoldRushSound("meter_threshold_hit");
        if (nextColumns > goldRushFreeSpinSession.interiorColumns) playGoldRushSound("interior_expand");
      }
    } else if (isGoldRush && !usedFreeSpin && result.triggeredFreeSpins) {
      const triggerCount = result.goldRush?.freeSpinsTrigger?.triggerCount ?? result.grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
      const source = result.goldRush?.freeSpinsTrigger?.source ?? "natural";
      const session = createGoldRushFreeSpinSession(triggerCount, source);
      const initialInteriorColumns = result.goldRush?.freeSpinsTrigger?.initialInteriorColumns;
      if (initialInteriorColumns) {
        session.interiorColumns = initialInteriorColumns;
        session.interiorStartColumn = nextGoldRushInteriorStart(initialInteriorColumns);
      }
      const sessionInterior = getGoldRushFreeSpinDisplayInterior(game, session.interiorColumns, session.interiorStartColumn);
      setGoldRushFreeSpinSession(session);
      setGoldRushSpinInterior(sessionInterior);
      setFreeSpins(session.spinsRemaining);
      setFreeSpinTotal(0);
      setStickyWildPositions([]);
      freeSpinsAfterAwards = session.spinsRemaining;
      playGoldRushSound("free_spins_start");
    } else if (usedFreeSpin || result.freeSpinsAwarded > 0) {
      setFreeSpins(freeSpinsAfterAwards);
      setStickyWildPositions(getNextFrontierStickyWildPositions(game, result, stickyWildPositions, freeSpinsAfterAwards));
      if (usedFreeSpin) setFreeSpinTotal((total) => nextFreeSpinTotal(total, result));
      if (!usedFreeSpin && result.freeSpinsAwarded > 0) setFreeSpinTotal(0);
    } else if (freeSpinsAfterAwards === 0 && stickyWildPositions.length > 0) {
      setStickyWildPositions([]);
    }
    if (result.triggeredWheelBonus) {
      setBonusResult(null);
      setWheelReveal({ result, phase: "ready", bonusBetAmount: betAmount, fromBuy: false });
      setOverlayResult(null);
      setAnimationState("bonusReveal");
    } else if (result.triggeredHoldAndWin) {
      setHoldState(createHoldAndWinState(game, betAmount, game.holdAndWin?.triggerCount ?? 6));
      setHoldBought(false);
      setHoldFeedback(result.triggeredCoinCollector ? "COIN COLLECTOR TRIGGERED - press RESPIN." : "Press RESPIN. New coins reset respins to 3.");
      setAnimationState("bonusIdle");
      setOverlayResult({
        ...result,
        payout: 0,
        winType: "HOLD_AND_WIN",
        winTier: "BIG",
      });
    } else if (result.triggeredExpansionBonus) {
      setBonusResult(null);
      setExpansionOverlayResult(result);
      setOverlayResult(null);
      setAnimationState("bonusReveal");
    } else if (result.triggeredBonus && !(isGoldRush && result.triggeredFreeSpins)) {
      setBonusResult(result);
      setOverlayResult(result.payout > 0 ? result : null);
      setAnimationState("idle");
    } else {
      setOverlayResult(result.payout > 0 ? result : null);
      setAnimationState(result.payout > 0 ? "settling" : "idle");
    }
    setUiState(
      result.triggeredWheelBonus
        ? "Bonus Triggered"
        : result.triggeredHoldAndWin
          ? "Hold And Win"
        : result.triggeredExpansionBonus
          ? "Bonus Triggered"
        : result.triggeredPickBonus
        ? "Pick Bonus"
        : result.triggeredFreeSpins
          ? "Bonus Triggered"
          : freeSpins > 0 || result.freeSpinsAwarded > 0
            ? "Free Spins"
            : result.payout > 0
              ? "Win"
              : "Idle",
    );
    refreshUser();
    recordRecentGame(game.id);
    recordRetentionRound({
      userId: currentUser.id,
      gameId: game.id,
      wager: result.wager,
      won: result.payout,
      bonusTriggered: result.triggeredBonus,
      multiplier: result.multiplier,
    });
    setSessionStats((stats) => nextSessionStats(stats, result.wager, result.payout));
    if (isGoldRush) {
      const bonusSymbols = result.grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
      const vsSymbols = result.grid.flat().filter((symbol) => symbol === game.expansionBonus?.triggerSymbol).length;
      if (bonusSymbols > 0) playGoldRushSound("bonus_land");
      if (vsSymbols > 0 && !result.triggeredExpansionBonus) playGoldRushSound("vs_land");
      if (result.triggeredExpansionBonus) playGoldRushSound("vs_expand");
      else if (result.payout > 0 && result.winTier !== "NONE") playGoldRushSound(result.winTier === "BIG" || result.winTier === "MEGA" ? "big_win_count_up" : "meter_collect");
    } else if (result.triggeredBonus) playBonus();
    else if (result.winTier === "BIG" || result.winTier === "MEGA") playBigWin();
    else if (result.payout > 0) playWin();
    else playLose();
  }

  function spin(modeOverride: SpinMode = spinMode) {
    const activeBoost = isGoldRush && freeSpins === 0 ? goldRushArmedBoost : null;
    const activeSpinMode = freeSpins > 0 ? "NORMAL" : activeBoost?.spinMode ?? modeOverride;
    const activeSpinCost = activeBoost?.cost ?? getSpinCost(game, betAmount, activeSpinMode);
    if (!spinning && !inHoldAndWin && freeSpins === 0 && balance < activeSpinCost) {
      setUiState("Error/Insufficient Balance");
      notify("Insufficient balance for this spin.", "error");
      playError();
      if (isGoldRush) playGoldRushSound("error_insufficient_balance");
      return;
    }
    if (!canSpin) {
      setUiState("Error/Insufficient Balance");
      playError();
      if (isGoldRush) playGoldRushSound("error_insufficient_balance");
      return;
    }

    setSpinning(true);
    if (isGoldRush) {
      startGoldRushMusic();
      playGoldRushSound("button_tap");
      playGoldRushSound("spin_start");
    } else {
      playClick();
      playSpin();
    }
    setUiState("Spinning");
    setAnimationState("spinning");
    setReelStates(Array.from({ length: game.reelCount }, () => "spinning"));
    setOverlayResult(null);
    setGoldRushSpinInterior(null);
    setAnticipating(false);
    const usedFreeSpin = freeSpins > 0;
    const showdownBoost = activeBoost?.type === "showdown-spin" ? createGoldRushShowdownBoostGrid(game) : undefined;
    const freeSpinInteriorOverride = isGoldRush && usedFreeSpin && goldRushFreeSpinSession
      ? { startColumn: nextGoldRushInteriorStart(goldRushFreeSpinSession.interiorColumns), columns: goldRushFreeSpinSession.interiorColumns, rowStart: 0, rowCount: game.rowCount }
      : undefined;
    if (freeSpinInteriorOverride) setGoldRushSpinInterior(freeSpinInteriorOverride);
    const mode = getFrontierSpinAnimationMode(spinSpeed);
    const timing = slotAnimation[mode];
    const stoppedReels = new Set<number>();
    let result: SlotSpinResult;
    try {
      if (activeBoost) {
        debitGoldRushBonusBuy({ user: currentUser, game, currency, betAmount, bonusType: activeBoost.type });
      }
      result = spinSlot({
        user: currentUser,
        game,
        currency,
        betAmount,
        freeSpin: usedFreeSpin,
        spinMode: activeSpinMode,
        stickyWildPositions: usedFreeSpin ? stickyWildPositions : undefined,
        forcedGrid: showdownBoost?.grid,
        prepaidWager: activeBoost?.cost,
        goldRushInteriorOverride: showdownBoost?.interior ?? freeSpinInteriorOverride,
      });
      if (isGoldRush) setGoldRushSpinInterior(result.goldRush?.interior ?? null);
      if (activeBoost?.type === "bonus-plus-spins") {
        setGoldRushArmedBoost(null);
        setSpinMode("NORMAL");
      }
    } catch (caught) {
      setSpinning(false);
      setAnimationState("idle");
      setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
      setUiState("Error/Insufficient Balance");
      notify(caught instanceof Error ? caught.message : "Spin failed.", "error");
      playError();
      if (isGoldRush) playGoldRushSound("error_insufficient_balance");
      return;
    }
    if (frontierTurboBypassesAnimation(spinSpeed)) {
      setGrid(result.grid);
      setUiState("Evaluating");
      setAnimationState("settling");
      setReelStates(Array.from({ length: game.reelCount }, () => "stopped"));
      if (isGoldRush) playGoldRushSound("reel_tick");
      updateAfterSpin(result, usedFreeSpin);
      setSpinning(false);
      setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
      if (!result.triggeredHoldAndWin) {
        setAnimationState("idle");
      }
      return;
    }
    const interval = window.setInterval(() => {
      const sample = generateGrid(game, activeSpinMode);
      setGrid((current) => current.map((reel, index) => (stoppedReels.has(index) ? reel : sample[index] ?? reel)));
    }, timing.cycleMs);
    window.setTimeout(() => {
      const anticipation = getFrontierAnticipationState(result.grid, game);
      setAnticipating(!turbo && anticipation.active && !result.triggeredBonus);
    }, timing.anticipationMs);
    getReelStopSchedule(mode, game.reelCount).forEach((stopMs, reelIndex) => {
      window.setTimeout(() => {
        stoppedReels.add(reelIndex);
        setGrid((current) => current.map((reel, index) => (index === reelIndex ? result.grid[index] ?? reel : reel)));
        setReelStates((states) => states.map((state, index) => (index === reelIndex ? "settling" : state)));
        if (isGoldRush) playGoldRushSound("reel_tick");
        window.setTimeout(() => {
          setReelStates((states) => states.map((state, index) => (index === reelIndex ? "stopped" : state)));
        }, timing.settleMs);
      }, stopMs);
    });
    window.setTimeout(() => {
      window.clearInterval(interval);
      setUiState("Evaluating");
      setAnimationState("settling");
      setAnticipating(false);
      window.setTimeout(() => {
        updateAfterSpin(result, usedFreeSpin);
        setSpinning(false);
        setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
        if (!result.triggeredHoldAndWin) {
          window.setTimeout(() => setAnimationState("idle"), timing.settleMs);
        }
      }, timing.evaluateMs);
    }, getSpinDuration(mode, game.reelCount) - timing.evaluateMs);
  }

  function resolveBuyBonus(featureType: BonusFeatureType) {
    const cost = getBonusBuyCost(game, betAmount, featureType, currency);
    let resolvedPayout = 0;
    try {
      if (!game.buyBonus?.enabled) throw new Error("Buy bonus is not available.");
      if (balance < cost) throw new Error("Insufficient balance.");
      setSpinning(true);
      setUiState("Bonus Triggered");
      setAnimationState("bonusReveal");
      if (featureType === "HOLD_AND_WIN") {
        const payoutBetAmount = getBonusBuyPayoutBetAmount(game, betAmount, featureType, currency);
        buyBonusDebit({ user: currentUser, game, currency, betAmount, featureType });
        setHoldState(createHoldAndWinState(game, payoutBetAmount, game.bonusBuys?.find((buy) => buy.featureType === "HOLD_AND_WIN")?.startingCoins ?? 6));
        setHoldBought(true);
        setHoldFeedback("Buy bonus started with 6 coins. New coins reset respins to 3.");
        setOverlayResult(null);
        setUiState("Hold And Win");
        window.setTimeout(() => setAnimationState("bonusIdle"), slotAnimation.bonus.revealMs);
      } else if (featureType === "WHEEL_BONUS" && game.id === "frontier-fortune") {
        const payoutBetAmount = getBonusBuyPayoutBetAmount(game, betAmount, featureType, currency);
        buyBonusDebit({ user: currentUser, game, currency, betAmount, featureType });
        const wheelBonus = calculateWheelBonus(game, payoutBetAmount);
        const payout = wheelBonus.payout;
        resolvedPayout = payout;
        const result: SlotSpinResult = {
          gameId: game.id,
          grid: generateGrid(game),
          wager: cost,
          payout,
          multiplier: betAmount > 0 ? payout / betAmount : 0,
          winType: "WHEEL_BONUS",
          winTier: payout >= betAmount * 20 ? "MEGA" : payout >= betAmount * 8 ? "BIG" : payout > 0 ? "SMALL" : "NONE",
          capped: false,
          lineWins: [],
          winningPositions: [],
          freeSpinsAwarded: wheelBonus.freeSpinsAwarded ?? 0,
          triggeredBonus: true,
          triggeredFreeSpins: Boolean(wheelBonus.freeSpinsAwarded),
          triggeredPickBonus: false,
          triggeredHoldAndWin: Boolean(wheelBonus.featureTrigger),
          triggeredWheelBonus: true,
          bonusPayout: payout,
          jackpotLabel: wheelBonus.jackpotLabel,
          wheelBonus,
        };
        if (payout > 0) {
          creditCurrency({
            userId: currentUser.id,
            type: result.jackpotLabel ? "JACKPOT_WIN" : "BONUS_WIN",
            currency,
            amount: payout,
            metadata: {
              gameId: game.id,
              gameName: game.name,
              featureType,
              betAmount,
              payoutBetAmount,
              wheelBonus,
              demoOnly: true,
            },
          });
        }
        setHistory((current) => [result, ...current].slice(0, 8));
        setWheelReveal({ result, phase: "ready", bonusBetAmount: payoutBetAmount, fromBuy: true });
        setOverlayResult(null);
        setUiState("Bonus Triggered");
      } else {
        const result = buyBonusFeature({ user: currentUser, game, currency, betAmount, featureType });
        resolvedPayout = result.payout;
        setHistory((current) => [result, ...current].slice(0, 8));
        setWheelReveal({ result, phase: "ready", bonusBetAmount: betAmount, fromBuy: true });
        setOverlayResult(null);
        setUiState("Win");
      }
      refreshUser();
      recordRecentGame(game.id);
      setSessionStats((stats) => nextSessionStats(stats, cost, resolvedPayout));
      playBonus();
    } catch (caught) {
      setUiState("Error/Insufficient Balance");
      notify(caught instanceof Error ? caught.message : "Bonus buy failed.", "error");
      playError();
    } finally {
      setBuyBonusOpen(false);
      setSpinning(false);
    }
  }

  function startBoostSpin(mode: Exclude<SpinMode, "NORMAL">) {
    setSpinMode(mode);
    window.setTimeout(() => spin(mode), 0);
  }

  function armGoldRushBoost(bonusType: Extract<GoldRushBonusBuyType, "bonus-plus-spins" | "showdown-spin">) {
    const option = getGoldRushBonusBuyOption(game, bonusType);
    if (!option?.spinMode) return;
    if (goldRushArmedBoost?.type === bonusType) {
      setGoldRushArmedBoost(null);
      setSpinMode("NORMAL");
      setGoldRushBonusSelection(null);
      notify(`${option.label} turned off.`, "info");
      playClick();
      playGoldRushSound("button_tap");
      return;
    }
    if (goldRushArmedBoost) {
      notify("Cancel the active boost before arming another option.", "error");
      playError();
      playGoldRushSound("error_insufficient_balance");
      return;
    }
    if (freeSpins > 0 || goldRushFreeSpinSession) {
      notify("Finish the current Free Spins round before buying a boost.", "error");
      playError();
      playGoldRushSound("error_insufficient_balance");
      return;
    }
    const cost = getGoldRushBonusBuyCost(game, betAmount, bonusType);
    try {
      if (balance < cost) throw new Error("Insufficient balance.");
      setGoldRushArmedBoost({ type: bonusType, label: option.label, cost, spinMode: option.spinMode });
      setSpinMode(option.spinMode);
      setGoldRushBonusOpen(false);
      setGoldRushBonusSelection(null);
      notify(`${option.label} ACTIVE. Press spin to use.`, "info");
      playBonus();
      startGoldRushMusic();
      playGoldRushSound(bonusType === "showdown-spin" ? "vs_land" : "bonus_land");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Boost buy failed.", "error");
      playError();
      playGoldRushSound("error_insufficient_balance");
    }
  }

  function confirmGoldRushBonusSelection() {
    const option = selectedGoldRushBonusOption;
    if (!option) return;
    if (goldRushArmedBoost && goldRushArmedBoost.type !== option.type) {
      notify("Turn off the active boost before choosing another option.", "error");
      playError();
      playGoldRushSound("error_insufficient_balance");
      return;
    }
    if (option.mode === "boost") {
      armGoldRushBoost(option.type as Extract<GoldRushBonusBuyType, "bonus-plus-spins" | "showdown-spin">);
      return;
    }
    buyGoldRushFreeSpins(option.type as Extract<GoldRushBonusBuyType, "buy-bonus" | "buy-super-bonus">);
  }

  function buyGoldRushFreeSpins(bonusType: Extract<GoldRushBonusBuyType, "buy-bonus" | "buy-super-bonus">) {
    const option = getGoldRushBonusBuyOption(game, bonusType);
    const forcedBonusSymbols = option?.forcedBonusSymbols;
    if (!forcedBonusSymbols) return;
    if (goldRushArmedBoost) {
      notify("Cancel the active boost before buying Free Spins.", "error");
      playError();
      playGoldRushSound("error_insufficient_balance");
      return;
    }
    const cost = getGoldRushBonusBuyCost(game, betAmount, bonusType);
    if (balance < cost) {
      notify("Insufficient balance.", "error");
      playError();
      playGoldRushSound("error_insufficient_balance");
      return;
    }
    try {
      debitGoldRushBonusBuy({ user: currentUser, game, currency, betAmount, bonusType });
      const forcedGrid = createGoldRushBonusTriggerGrid(game, forcedBonusSymbols);
      setGoldRushBonusOpen(false);
      setGoldRushBonusSelection(null);
      setSpinning(true);
      setUiState("Spinning");
      setAnimationState("spinning");
      setReelStates(Array.from({ length: game.reelCount }, () => "spinning"));
      setOverlayResult(null);
      setExpansionOverlayResult(null);
      startGoldRushMusic();
      playGoldRushSound("button_tap");
      playGoldRushSound("spin_start");
      const result = spinSlot({
        user: currentUser,
        game,
        currency,
        betAmount,
        forcedGrid,
        prepaidWager: cost,
      });
      if (result.goldRush?.freeSpinsTrigger) {
        result.goldRush.freeSpinsTrigger.source = bonusType;
        result.goldRush.freeSpinsTrigger.initialInteriorColumns = option.initialInteriorColumns ?? result.goldRush.freeSpinsTrigger.initialInteriorColumns;
      }
      const settle = frontierTurboBypassesAnimation(spinSpeed) ? 180 : 950;
      window.setTimeout(() => {
        setGrid(result.grid);
        setReelStates(Array.from({ length: game.reelCount }, () => "stopped"));
        setUiState("Evaluating");
        window.setTimeout(() => {
          updateAfterSpin(result, false);
          setSpinning(false);
          setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
          setAnimationState("idle");
        }, 280);
      }, settle);
      refreshUser();
      playBonus();
      playGoldRushSound("free_spins_start");
    } catch (caught) {
      setSpinning(false);
      setAnimationState("idle");
      setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
      notify(caught instanceof Error ? caught.message : "Bonus buy failed.", "error");
      playError();
      playGoldRushSound("error_insufficient_balance");
    }
  }

  function respinHoldAndWin() {
    if (!holdState || holdState.finished || bonusBusy) return;
    setBonusBusy(true);
    setAnimationState("bonusRespinning");
    setOverlayResult(null);
    setHoldFeedback("RESPINNING...");
    window.setTimeout(() => {
      const next = stepHoldAndWinBonus(game, betAmount, holdState);
      setHoldState(next);
      setAnimationState("bonusReveal");
      if (next.lastNewCoins.length > 0) {
        setHoldFeedback(`+${next.lastNewCoins.length} COIN${next.lastNewCoins.length === 1 ? "" : "S"} - NEW COINS LOCKED - RESPINS RESET TO 3`);
      } else {
        setHoldFeedback("NO NEW COINS");
      }
      if (next.finished) {
        setAnimationState("bonusComplete");
        try {
          creditHoldAndWinBonus({ user: currentUser, game, currency, betAmount, state: next, buyBonus: holdBought });
          const result: SlotSpinResult = {
            gameId: game.id,
            grid,
            wager: 0,
            payout: next.total,
            multiplier: betAmount > 0 ? next.total / betAmount : 0,
            winType: "HOLD_AND_WIN",
            winTier: next.total >= betAmount * 20 ? "MEGA" : next.total >= betAmount * 8 ? "BIG" : "SMALL",
            capped: next.total >= betAmount * game.maxPayoutMultiplier,
            lineWins: [],
            winningPositions: [],
            freeSpinsAwarded: 0,
            triggeredBonus: true,
            triggeredFreeSpins: false,
            triggeredPickBonus: false,
            triggeredHoldAndWin: true,
            bonusPayout: next.total,
            jackpotLabel: next.filledAll ? "Grand" : undefined,
          };
          setHistory((current) => [result, ...current].slice(0, 8));
          setOverlayResult(result);
          setUiState("Win");
          setHoldFeedback("HOLD AND WIN COMPLETE");
          refreshUser();
          setSessionStats((stats) => nextSessionStats(stats, 0, next.total));
          playBigWin();
          window.setTimeout(() => {
            setHoldState(null);
            setHoldBought(false);
            setHoldFeedback("");
            setAnimationState("idle");
          }, slotAnimation.bonus.completeHoldMs);
        } catch (caught) {
          notify(caught instanceof Error ? caught.message : "Bonus credit failed.", "error");
        }
      } else {
        window.setTimeout(() => setAnimationState("bonusIdle"), slotAnimation.bonus.revealMs);
      }
      setBonusBusy(false);
    }, slotAnimation.bonus.respinMs);
  }

  function closeHoldAndWin() {
    setHoldState(null);
    setHoldBought(false);
    setUiState("Idle");
    setAnimationState("idle");
  }

  if (frontierEntryPhase === "loading") {
    return (
      <section
        className={`slot-screen premium-slot-shell frontier frontier-entry-shell assets-loading ${lowPerformanceMode ? "low-performance" : ""}`}
        style={{ "--accent": game.visual.accent, "--secondary": game.visual.secondary, "--panel": game.visual.panel } as React.CSSProperties}
      >
        <FrontierLoadingScreen progress={assetLoadProgress} />
      </section>
    );
  }

  if (isGoldRush && !assetsLoaded) {
    return (
      <section
        className={`slot-screen premium-slot-shell gold-rush assets-loading ${lowPerformanceMode ? "low-performance" : ""}`}
        style={{ "--accent": game.visual.accent, "--secondary": game.visual.secondary, "--panel": game.visual.panel } as React.CSSProperties}
      >
        <GoldRushLoadingScreen progress={assetLoadProgress} logo={titleLogo} />
      </section>
    );
  }

  if (frontierEntryPhase === "intro" && !frontierIntroReopened) {
    return (
      <section
        className={`slot-screen premium-slot-shell frontier frontier-entry-shell assets-ready ${lowPerformanceMode ? "low-performance" : ""}`}
        style={{ "--accent": game.visual.accent, "--secondary": game.visual.secondary, "--panel": game.visual.panel } as React.CSSProperties}
      >
        <FrontierFeatureIntroScreen
          onContinue={continueFrontierEntry}
        />
      </section>
    );
  }

  return (
    <section
      className={`slot-screen premium-slot-shell ${game.visual.background ?? ""} ${inHoldAndWin ? "bonus-active" : ""} ${assetsLoaded ? "assets-ready" : "assets-loading"} ${lowPerformanceMode ? "low-performance" : ""} animation-${animationState}`}
      style={{ "--accent": game.visual.accent, "--secondary": game.visual.secondary, "--panel": game.visual.panel } as React.CSSProperties}
    >
      <div className="slot-header">
        <div className="game-heading">
          {onExit && (
            <button className="ghost-button icon-only game-back-button" onClick={onExit} title="Back to lobby">
              <ArrowLeft size={18} />
            </button>
          )}
          <GameLogo game={game} small />
          <div>
            {logoReady && titleLogo && <img className="frontier-title-logo" src={titleLogo} alt={game.name} onError={() => setLogoReady(false)} />}
            {(!logoReady || !titleLogo) && <p className="eyebrow">{game.theme}</p>}
            <h1 className={logoReady ? "asset-backed" : ""}>{game.name}</h1>
            <p className="muted">
              {game.waysToWin} | {game.volatility} Volatility | Stay Hot.
            </p>
          </div>
        </div>
        {!isGoldRush && <div className="slot-header-actions">
          <div className="header-jackpot-strip" aria-label={`${game.name} jackpots`}>
            {game.jackpotLabels ? (
              getJackpotBadgeLabels(game).map((jackpot) => (
                <strong key={jackpot.label}>
                  <span>
                    <em>{jackpot.label}</em>
                    <b>{jackpot.value}</b>
                  </span>
                </strong>
              ))
            ) : (
              <strong>
                <span>
                  <em>Max</em>
                  <b>{game.maxPayoutMultiplier}x</b>
                </span>
              </strong>
            )}
          </div>
        </div>}
      </div>
      {game.coinCollector?.enabled && (
        <div
          className={`charged-relic-collector charge-${treasurePotState.chargeLevel} ${treasurePotState.reset ? "triggered" : ""} ${treasurePotState.collecting ? "collecting" : ""} ${collectorAnimation.cracked ? "cracked" : ""}`}
          style={{ "--charge": treasurePotState.level, "--relic-scale": treasurePotState.scale, "--relic-glow": treasurePotState.glow } as React.CSSProperties}
          aria-label={`Charged Relic ${treasurePotState.level} of ${game.coinCollector?.maxCoins ?? 5}`}
          title={collectorFeedback || `Charged Relic ${treasurePotState.level} of ${game.coinCollector?.maxCoins ?? 5}`}
        >
          <span className="charged-relic-screen-glow" aria-hidden="true" />
          {treasurePotState.reset && <strong className="charged-relic-trigger-label">Relic Burst</strong>}
          {collectorAnimation.cracked && !treasurePotState.reset && <strong className="charged-relic-crack-label">Relic Surge</strong>}
          <div className="charged-relic-core" aria-hidden="true">
            <img className="charged-relic-shadow" src={frontierIntroAssets.relicShadow} alt="" />
            <img className="charged-relic-aura" src={frontierIntroAssets.relicAura} alt="" />
            <img className="charged-relic-spirit" src={frontierIntroAssets.relicSpirit} alt="" />
            <span className="charged-relic-eye left" />
            <span className="charged-relic-eye right" />
            <span className="charged-relic-crack left" />
            <span className="charged-relic-crack right" />
            <div className="charged-relic-beams">
              {treasurePotState.flyingCoins.map((index) => (
                <span
                  key={`${collectorAnimation.key}-${index}`}
                  style={{ "--beam-index": index, "--beam-x": `${(index - (treasurePotState.flyingCoins.length - 1) / 2) * 26}px` } as React.CSSProperties}
                />
              ))}
            </div>
            <div className="charged-relic-particles">
              {(collectorAnimation.cracked ? Array.from({ length: 10 }, (_, index) => index) : []).map((index) => (
                <span key={`${collectorAnimation.key}-crack-${index}`} style={{ "--particle-index": index } as React.CSSProperties} />
              ))}
            </div>
            <div className="charged-relic-burst">
              {treasurePotState.burstCoins.map((index) => (
                <span key={`${collectorAnimation.key}-burst-${index}`} style={{ "--burst-index": index } as React.CSSProperties} />
              ))}
            </div>
          </div>
        </div>
      )}

      <ScreenShake active={Boolean(overlayResult?.winTier === "MEGA")}>
      <div className="slot-board">
        <div className="slot-side-menu">
          <button className="ghost-button icon-only" onClick={reopenFrontierIntro} title="Feature Intro" aria-label="Feature Intro"><Menu size={18} /></button>
          <button className="ghost-button icon-only" onClick={() => setPaytableOpen(true)} title="Info"><Info size={18} /></button>
          <SoundToggle className="ghost-button icon-only" compact />
        </div>
        {isGoldRush && goldRushArmedBoost && (
          <div className="gold-rush-boost-armed" role="status">
            <strong>{goldRushArmedBoost.label} ACTIVE</strong>
            <span>{goldRushArmedBoost.type === "showdown-spin" ? "Guaranteed VS + Interior" : "Next spin boosted"}</span>
            <button
              type="button"
              onClick={() => {
                setGoldRushArmedBoost(null);
                setSpinMode("NORMAL");
              }}
            >
              Cancel
            </button>
          </div>
        )}
        {isGoldRush && goldRushFreeSpinSession && (
          <div className={`gold-rush-free-spins-hud ${goldRushFreeSpinSession.lastGrowth ? "grew" : ""}`} role="status">
            <strong>{goldRushFreeSpinSession.spinsRemaining} Free Spins</strong>
            <span>Win {formatCoins(goldRushFreeSpinSession.totalWin)}</span>
            <span>Interior {goldRushFreeSpinSession.interiorColumns}x4</span>
            <span>Bonus {goldRushFreeSpinSession.bonusSymbolsCollected % goldRushFreeSpinSession.collectThreshold}/{goldRushFreeSpinSession.collectThreshold}</span>
          </div>
        )}
        {isGoldRush && goldRushFreeSpinSession?.lastGrowth && (
          <GoldRushFeatureToast
            title="Bonus Boost"
            primary={`+${goldRushFreeSpinSession.lastGrowth.addedSpins} Spins`}
            secondary={`Interior ${goldRushFreeSpinSession.lastGrowth.columns}x4`}
            tone="mixed"
          />
        )}
        {!isGoldRush && (
          <div className={`slot-state-pill ${inHoldAndWin ? "bonus" : ""}`}>
            <span>{modeLabel}</span>
            {anticipating && <strong>{scatterCount >= 2 ? "Wheel close..." : "Coins close..."}</strong>}
            {lastResult?.holdAndWin && <strong>Hold and Win total {formatCoins(lastResult.holdAndWin.total)}</strong>}
            {lastResult?.wheelBonus && <strong>Wheel landed {lastResult.wheelBonus.segment}</strong>}
          </div>
        )}
        {holdState && (
          <div className="hold-bonus-panel">
            <div className="hold-bonus-banner">
              <strong>HOLD AND WIN</strong>
              <span>RESPINS REMAINING: {holdState.respinsRemaining}</span>
            </div>
            <div className="hold-bonus-total">
              <span>Bonus Total</span>
              <strong>{formatCoins(holdState.total)}</strong>
            </div>
            <p>{holdFeedback || "Press RESPIN. New coins reset respins to 3."}</p>
          </div>
        )}
        <div className={`reel-stage frontier-reel-stage ${lastResult?.payout ? "winning" : ""} ${anticipating ? "anticipating" : ""} ${holdState ? "hold-mode" : ""}`}>
          {holdState ? (
            <div className={`hold-and-win-board ${bonusBusy ? "respinning" : ""} ${holdState.finished ? "finished" : ""}`}>
              <div className="hold-grid">
                {holdState.values.map((value, index) => (
                  <div
                    className={`hold-cell ${value ? "locked" : ""} ${holdState.lastNewCoins.includes(index) ? "new" : ""}`}
                    style={{ "--reveal-delay": `${(index % game.reelCount) * 90 + Math.floor(index / game.reelCount) * 35}ms` } as React.CSSProperties}
                    key={index}
                  >
                    {value ? (
                      <>
                        <img src={coinImageFor(value, betAmount)} alt="" />
                        <strong>{coinLabelFor(value, betAmount)}</strong>
                        <small>{formatCoins(value)}</small>
                      </>
                    ) : (
                      <em>Spin</em>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <>
              {isGoldRush && goldRushInterior && (
                <div
                  className={`gold-rush-interior-frame ${resultForHighlights?.goldRush?.vsActive ? "active" : ""}`}
                  style={{
                    "--interior-start": goldRushInterior.startColumn,
                    "--interior-columns": goldRushInterior.columns,
                    "--interior-total-columns": game.reelCount,
                  } as React.CSSProperties}
                  aria-hidden="true"
                />
              )}
              {showLastWin && !expansionOverlayResult && resultForHighlights?.lineWins.length ? (
                <svg className="payline-overlay" viewBox={`0 0 ${game.reelCount * 100} ${game.rowCount * 100}`} preserveAspectRatio="none" aria-hidden="true">
                  {game.paylines.map((payline) => {
                    const points = getPaylineOverlayPoints(
                      payline,
                      isGoldRush && currentGoldRushLineWin?.paylineId === payline.id ? currentGoldRushLineWin.positions : undefined,
                    );
                    return <polyline className={activePaylines.has(payline.id) ? "active" : ""} points={points} key={payline.id} />;
                  })}
                </svg>
              ) : null}
              {isGoldRush && currentGoldRushLineWin && goldRushLineBadgeStyle && (
                <div className="payline-payout-badge" style={goldRushLineBadgeStyle} aria-hidden="true">
                  <span>{currentGoldRushLineWin.paylineName}</span>
                  <strong>+{formatCoins(currentGoldRushLineWin.payout)}</strong>
                </div>
              )}
              {Array.from({ length: game.rowCount }, (_, row) =>
                Array.from({ length: game.reelCount }, (_, reel) => {
                  const transformed = goldRushTransformedPositions.has(`${reel}:${row}`);
                  const symbolId = grid[reel]?.[row] ?? game.symbols[0].id;
                  const active = Boolean(
                    showLastWin &&
                    (resultForHighlights?.winningPositions.some((position) => position.reel === reel && position.row === row) ||
                    (resultForHighlights?.triggeredHoldAndWin && symbolId === game.bonusSymbol) ||
                    (resultForHighlights?.triggeredExpansionBonus && (symbolId === game.expansionBonus?.triggerSymbol || transformed)))
                  );
                  const sticky = freeSpins > 0 && stickyWildPositions.includes(row * game.reelCount + reel);
                  return (
                    <SymbolTile
                      game={game}
                      symbolId={symbolId}
                      active={active}
                      sticky={sticky}
                      reelState={reelStates[reel] ?? "idle"}
                      reelIndex={reel}
                      spinning={spinning && reelStates[reel] === "spinning"}
                      multiplierLabel={undefined}
                      multiplierWild={false}
                      winnerSide={undefined}
                      key={`${reel}-${row}`}
                    />
                  );
                }),
              )}
              {goldRushFinalClashResult && (
                <GoldRushMineClashFinalPanel result={goldRushFinalClashResult} reelCount={game.reelCount} rowCount={game.rowCount} />
              )}
            </>
          )}
            <WinOverlay
            show={Boolean(overlayResult && !isGoldRush && !(isGoldRush && overlayResult.expansionBonus?.sourceFeature === "mine-clash"))}
      title={overlayResult?.triggeredExpansionBonus ? (overlayResult.expansionBonus?.sourceFeature === "mine-clash" ? "Mine Clash Complete" : "Heist Showdown Complete") : overlayResult?.triggeredWheelBonus ? "WHEEL BONUS" : overlayResult?.triggeredHoldAndWin ? (overlayResult.payout > 0 ? "Hold And Win Complete" : "Bonus Triggered") : overlayResult?.winTier === "MEGA" ? "Mega Win" : overlayResult?.winTier === "BIG" ? "Big Win" : "Win"}
            amount={overlayResult?.payout ?? 0}
            big={overlayIsBig}
            bonus={Boolean(overlayResult?.triggeredBonus)}
            onDismiss={() => setOverlayResult(null)}
          >
            {overlayResult?.expansionBonus ? `${overlayResult.expansionBonus.multiplier}x multiplier wilds` : overlayResult?.wheelBonus ? `Wheel result: ${overlayResult.wheelBonus.segment}` : overlayResult?.holdAndWin ? `Respin rounds: ${overlayResult.holdAndWin.respinRounds.length}` : null}
          </WinOverlay>
          {isGoldRush && overlayResult && overlayResult.payout > 0 && goldRushOverlayTier !== "none" && !overlayResult.triggeredExpansionBonus && !overlayResult.triggeredFreeSpins && (
            <GoldRushWinOverlay
              result={overlayResult}
              betAmount={betAmount}
              currencyLabel={currencyLabel}
              onDismiss={() => setOverlayResult(null)}
            />
          )}
          {isGoldRush && expansionOverlayResult?.expansionBonus?.sourceFeature === "mine-clash" ? (
            <GoldRushMineClashGridOverlay
              result={expansionOverlayResult}
              reelCount={game.reelCount}
              rowCount={game.rowCount}
              onComplete={() => {
                setOverlayResult(null);
                setExpansionOverlayResult(null);
                setAnimationState("idle");
                setUiState(expansionOverlayResult.freeSpinsAwarded > 0 ? "Free Spins" : "Win");
              }}
            />
          ) : expansionOverlayResult?.expansionBonus && game.expansionBonus && (
            <ExpansionBonusOverlay
              open={Boolean(expansionOverlayResult)}
              theme={{
                title: game.name,
                introLabel: game.expansionBonus.labels?.intro,
                finalLabel: game.expansionBonus.labels?.final,
                accent: game.visual.accent,
                secondary: game.visual.secondary,
                panel: game.visual.panel,
              }}
              triggerPositions={expansionOverlayResult.expansionBonus.triggerPositions}
              result={expansionOverlayResult.expansionBonus}
              config={game.expansionBonus}
              betAmount={betAmount}
              onComplete={() => {
                setOverlayResult(expansionOverlayResult);
                setExpansionOverlayResult(null);
                setAnimationState("idle");
                setUiState(expansionOverlayResult.freeSpinsAwarded > 0 ? "Free Spins" : "Win");
              }}
            />
          )}
        </div>

        <div className="reel-bonus-action">
          {isGoldRush && !inHoldAndWin && (
            <button
              className="gold-rush-bonus-entry"
              disabled={spinning || Boolean(expansionOverlayResult)}
              onClick={() => {
                setGoldRushBonusOpen(true);
                playClick();
                startGoldRushMusic();
                playGoldRushSound("button_tap");
              }}
              type="button"
            >
              <span className="money-lightning-button-art" aria-hidden="true">
                <img className="money-lightning-icon primary" src={moneyLightningIconAssets.primary} alt="" />
                <img className="money-lightning-icon neon" src={moneyLightningIconAssets.neon} alt="" />
              </span>
            </button>
          )}
          {!isGoldRush && game.buyBonus?.enabled && !inHoldAndWin && (
            <button
              className="ghost-button icon-only eboost-control money-lightning-boost-control"
              disabled={spinning}
              onClick={() => setBuyBonusOpen(true)}
              title="E-Boost"
              aria-label="E-Boost"
            >
              <span className="money-lightning-button-art" aria-hidden="true">
                <img className="money-lightning-icon primary" src={moneyLightningIconAssets.primary} alt="" />
                <img className="money-lightning-icon neon" src={moneyLightningIconAssets.neon} alt="" />
              </span>
            </button>
          )}
        </div>

        <aside className="slot-controls card">
          <div className="slot-control-bar">
            <div className="control-readout">
              <span>Balance</span>
              <div className="balance-amount">
                <strong>{formatCoins(balance)}</strong>
                <small>{currencyLabel}</small>
              </div>
              <div className="last-win-readout" aria-label="Last win">
                <span>Last Win</span>
                <strong>{formatCoins(lastResult?.payout ?? 0)}</strong>
              </div>
              <div className="currency-mini">
                <button className={`gold ${currency === "GOLD" ? "active" : ""}`} disabled={inHoldAndWin} onClick={() => setCurrency("GOLD")}>GC</button>
                <button className={`sweeps ${currency === "BONUS" ? "active" : ""}`} disabled={inHoldAndWin} onClick={() => setCurrency("BONUS")}>SC</button>
              </div>
            </div>
            <div className="bet-readout">
              <span>{spinMode === "NORMAL" ? "Bet" : "Cost"}</span>
              <div>
                <button className="round-control" disabled={inHoldAndWin} onClick={() => stepBet(-1)}>
                  <Minus size={16} />
                </button>
                <button className="bet-amount-trigger" disabled={inHoldAndWin} onClick={() => setBetMenuOpen(true)}>
                  {formatCoins(betAmount)}
                </button>
                <button className="round-control" disabled={inHoldAndWin} onClick={() => stepBet(1)}>
                  <Plus size={16} />
                </button>
              </div>
              {spinMode !== "NORMAL" && <small>{formatCoins(spinCost)} total</small>}
            </div>
            <button
              className={`slot-main-action ${inHoldAndWin ? "respin" : ""} ${goldRushArmedBoost ? "boost-armed" : ""}`}
              disabled={inHoldAndWin ? bonusBusy || holdState?.finished : !canSpin}
              onClick={inHoldAndWin ? respinHoldAndWin : () => spin()}
            >
              {inHoldAndWin ? (bonusBusy ? "..." : <RotateCw size={42} />) : spinning ? "..." : <RotateCw size={42} />}
              <span>{inHoldAndWin ? "Respin" : assetsLoaded ? "Spin" : "Load"}</span>
            </button>
          </div>
          <div className="premium-control-icons">
            {!isGoldRush && (
              <button className="ghost-button icon-only" onClick={reopenFrontierIntro} title="Feature Intro" aria-label="Feature Intro">
                <Menu size={18} />
              </button>
            )}
            <button
              className={`ghost-button icon-only speed-control speed-${spinSpeed.toLowerCase()}`}
              onClick={() => setSpinSpeed((value) => getNextFrontierSpinSpeed(value))}
              title={`Speed: ${speedLabel}`}
              aria-label={`Speed ${speedLabel}`}
            >
              <Zap size={19} />
              {isGoldRush && (
                <>
                  <span className="speed-control-track" aria-hidden="true"><i /></span>
                </>
              )}
            </button>
            <button className="ghost-button icon-only" onClick={() => setPaytableOpen(true)} title="Info"><img src={frontierUiAssets.iconInfo} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><Info size={18} /></button>
            <SoundToggle className="ghost-button icon-only" compact />
          </div>
          <div className="segmented small">
            <button className={currency === "GOLD" ? "active" : ""} onClick={() => setCurrency("GOLD")}>
              Gold
            </button>
            <button className={currency === "BONUS" ? "active" : ""} onClick={() => setCurrency("BONUS")}>
              Sweeps
            </button>
          </div>
          <label>
            Bet Amount
            <input
              type="number"
              min={game.minBet}
              max={game.maxBet}
              step={game.minBet}
              value={betAmount}
              onChange={(event) => setBetAmount(Math.min(game.maxBet, Math.max(game.minBet, Number(event.target.value))))}
            />
          </label>
          <div className="quick-bets">
            {[game.minBet, game.minBet * 5, game.minBet * 10].filter((value) => value <= game.maxBet).map((value) => (
              <button className={betAmount === value ? "active" : ""} onClick={() => setBetAmount(value)} key={value}>
                {formatCoins(value)}
              </button>
            ))}
          </div>
          <div className="bet-stepper">
            <button className="ghost-button" onClick={() => setBetAmount(betOptions[0] ?? game.minBet)}>Min</button>
            <button className="ghost-button" onClick={() => stepBet(-1)}><Minus size={16} /></button>
            <button className="ghost-button" onClick={() => stepBet(1)}><Plus size={16} /></button>
            <button className="ghost-button" onClick={() => setBetAmount(betOptions[betOptions.length - 1] ?? game.maxBet)}>Max</button>
          </div>
          <div className="balance-line">Available: {formatCoins(balance)} {currency}</div>
          <div className="meter">
            <span>Bonus Tracker</span>
            <div><i style={{ width: `${bonusMeter}%` }} /></div>
          </div>
          {freeSpins > 0 && (
            <div className="free-spin-banner">
              <strong>{freeSpins} Free Spins</strong>
              <span>Total won: {formatCoins(freeSpinTotal)}</span>
            </div>
          )}
          <button className="spin-button" disabled={inHoldAndWin ? bonusBusy : !canSpin} onClick={inHoldAndWin ? respinHoldAndWin : () => spin()}>
            {inHoldAndWin ? (bonusBusy ? "Respinning" : "Respin") : !assetsLoaded ? "Loading assets" : spinning ? uiState : freeSpins > 0 ? "Free Spin" : spinMode === "NORMAL" ? "Spin" : `${game.boostSpins?.[spinMode]?.label ?? "Boost"} ${formatCoins(spinCost)}`}
          </button>
          {balance < spinCost && freeSpins === 0 && <div className="error-box">Balance is too low for this spin.</div>}
          {balance < game.minBet && freeSpins === 0 && (
            <button className="primary-button icon-button" onClick={() => notify("Open Wallet to get more demo coins.", "info")}>
              <ShoppingBag size={16} /> Get More Demo Coins
            </button>
          )}
          <div className="toggle-row">
            <button className={spinSpeed !== "NORMAL" ? "ghost-button active" : "ghost-button"} onClick={() => setSpinSpeed((value) => getNextFrontierSpinSpeed(value))}>
              <Zap size={15} /> {spinSpeed}
            </button>
            <SoundToggle className="ghost-button" />
          </div>
          <button className="ghost-button icon-button" disabled title="Auto Spin coming soon">
            <Gauge size={15} /> Auto Spin
          </button>
          <div className="session-stats">
            <span>Session</span>
            <strong>{sessionStats.spins} spins</strong>
            <small>Wagered {formatCoins(sessionStats.wagered)} · Net {formatCoins(sessionStats.won - sessionStats.wagered)}</small>
          </div>
        </aside>
      </div>
      </ScreenShake>
      {betMenuOpen && (
        <div className="frontier-bet-modal-backdrop" role="presentation" onClick={() => setBetMenuOpen(false)}>
          <section className="frontier-bet-modal" role="dialog" aria-modal="true" aria-label="Select bet amount" onClick={(event) => event.stopPropagation()}>
            <div className="frontier-bet-modal-header">
              <strong>Select Bet</strong>
              <button className="ghost-button icon-only" onClick={() => setBetMenuOpen(false)} aria-label="Close bet selector">x</button>
            </div>
            <div className="frontier-bet-modal-grid">
              {betOptions.map((value) => (
                <button
                  className={betAmount === value ? "active" : ""}
                  disabled={inHoldAndWin}
                  onClick={() => {
                    setBetAmount(value);
                    setBetMenuOpen(false);
                  }}
                  key={value}
                >
                  {formatCoins(value)}
                </button>
              ))}
            </div>
          </section>
        </div>
      )}
      {uiState === "Error/Insufficient Balance" && (
        <GameResultBanner tone="error" title="Unable to spin" message="Check your bet or available virtual coins." compact />
      )}

      {!isGoldRush && (
        <article className="card">
          <div className="section-title">
            <h2>Recent Spins</h2>
            <span>{lastResult ? `${lastResult.winType.replace("_", " ")}` : "No spins yet"}</span>
          </div>
          <div className="spin-history">
            {history.length === 0 ? (
              <div className="empty-state">Spin history will appear here.</div>
            ) : (
              history.map((spin, index) => (
                <div className="spin-row" key={`${spin.grid.flat().join("-")}-${index}`}>
                  <span>
                    {spin.winTier !== "NONE" ? `${spin.winTier} ` : ""}{spin.winType.replace("_", " ")} - {spin.lineWins.length} line{spin.lineWins.length === 1 ? "" : "s"}
                    {spin.cascades?.length ? ` - ${spin.cascades.length} cascades` : ""}
                    {spin.triggeredFreeSpins ? ` - ${spin.freeSpinsAwarded} free spins` : ""}
                    {spin.triggeredPickBonus ? " - pick bonus" : ""}
                    {spin.capped ? " - capped" : ""}
                  </span>
                  <strong className={spin.payout > 0 ? "positive" : "negative"}>
                    {spin.payout > 0 ? `+${formatCoins(spin.payout)}` : "Loss"}
                  </strong>
                </div>
              ))
            )}
          </div>
        </article>
      )}

      {paytableOpen && <PaytableModal game={game} onClose={() => setPaytableOpen(false)} />}
      {buyBonusOpen && (
        <Modal title="E-Boost" onClose={() => setBuyBonusOpen(false)}>
          <div className="modal-stack premium-bonus-modal">
            <div className="bonus-modal-token">
              <Coins size={36} />
            </div>
            <div className="bonus-boost-grid">
              <button className="notice-card bonus-cost-card" disabled={balance < holdBuyCost} onClick={() => resolveBuyBonus("HOLD_AND_WIN")}>
                <span className="bonus-card-icon coin" aria-hidden="true"><Coins size={18} /></span>
                <span className="bonus-card-heading">
                  <span>Buy Hold & Win</span>
                </span>
                <strong>{formatCoins(holdBuyCost)} {currencyLabel}</strong>
                <small>Starts Hold & Win with 6 coins and credits the final bonus win.</small>
              </button>
              <button className="notice-card bonus-cost-card" disabled={balance < wheelBuyCost} onClick={() => resolveBuyBonus("WHEEL_BONUS")}>
                <span className="bonus-card-icon wheel" aria-hidden="true"><RotateCw size={18} /></span>
                <span className="bonus-card-heading">
                  <span>Buy Wheel Bonus</span>
                </span>
                <strong>{formatCoins(wheelBuyCost)} {currencyLabel}</strong>
                <small>Opens the wheel screen and credits the landed result.</small>
              </button>
              <button className="notice-card bonus-cost-card" disabled={balance < getSpinCost(game, betAmount, "GOLD_BOOST")} onClick={() => startBoostSpin("GOLD_BOOST")}>
                <span className="bonus-card-icon coin" aria-hidden="true"><Coins size={18} /></span>
                <span className="bonus-card-heading">
                  <span>Gold Boost</span>
                </span>
                <strong>{formatCoins(getSpinCost(game, betAmount, "GOLD_BOOST"))} {currencyLabel}</strong>
                <small>+{Math.round(((game.boostSpins?.GOLD_BOOST?.costMultiplier ?? 1) - 1) * 100)}% cost, better coin chance.</small>
              </button>
              <button className="notice-card bonus-cost-card" disabled={balance < getSpinCost(game, betAmount, "SCATTER_BOOST")} onClick={() => startBoostSpin("SCATTER_BOOST")}>
                <span className="bonus-card-icon scatter" aria-hidden="true"><img src="/assets/symbols/frontier/oasis_scatter.png" alt="" /></span>
                <span className="bonus-card-heading">
                  <span>Scatter Boost</span>
                </span>
                <strong>{formatCoins(getSpinCost(game, betAmount, "SCATTER_BOOST"))} {currencyLabel}</strong>
                <small>+{Math.round(((game.boostSpins?.SCATTER_BOOST?.costMultiplier ?? 1) - 1) * 100)}% cost, better scatter chance.</small>
              </button>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setBuyBonusOpen(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
      {goldRushBonusOpen && (
        <Modal title="Gold Rush Bonus" onClose={() => {
          setGoldRushBonusOpen(false);
          setGoldRushBonusSelection(null);
        }}>
          <div className="modal-stack gold-rush-bonus-modal">
            <div className="gold-rush-bonus-options">
              {(game.goldRushBonusBuys?.options ?? []).map((option) => {
                const cost = getGoldRushBonusBuyCost(game, betAmount, option.type);
                const active = goldRushArmedBoost?.type === option.type;
                const unavailable = balance < cost && !active;
                return (
                  <button
                    className={`notice-card bonus-cost-card ${option.type === "buy-super-bonus" ? "super" : ""} ${goldRushBonusSelection === option.type ? "selected" : ""} ${active ? "armed" : ""}`}
                    type="button"
                    disabled={spinning || Boolean(expansionOverlayResult)}
                    onClick={() => {
                      setGoldRushBonusSelection(option.type);
                      playClick();
                      playGoldRushSound("button_tap");
                    }}
                    key={option.type}
                  >
                    <span className="bonus-card-art" aria-hidden="true">
                      {option.image ? <img src={option.image} alt="" /> : <Coins size={34} />}
                      {active && <em>ACTIVE</em>}
                    </span>
                    <span className="bonus-card-heading"><span>{option.label}</span></span>
                    <strong className={unavailable ? "unavailable" : ""}>{formatCoins(cost)} {currencyLabel}</strong>
                  </button>
                );
              })}
            </div>
            {selectedGoldRushBonusOption && (
              <section className="gold-rush-bonus-confirm" aria-live="polite">
                <div>
                  <span>{selectedGoldRushBonusOption.mode === "boost" ? "Spin Mode" : "Feature Buy"}</span>
                  <strong>{selectedGoldRushBonusOption.label}</strong>
                  <p>{getGoldRushBonusOptionDetail(selectedGoldRushBonusOption.type)}</p>
                </div>
                <div className="gold-rush-confirm-cost">
                  <span>Cost</span>
                  <strong>{formatCoins(selectedGoldRushBonusCost)} {currencyLabel}</strong>
                </div>
                {goldRushArmedBoost && goldRushArmedBoost.type !== selectedGoldRushBonusOption.type && (
                  <p className="gold-rush-boost-warning">{goldRushArmedBoost.label} ACTIVE. Turn it off before choosing another option.</p>
                )}
                {balance < selectedGoldRushBonusCost && !(goldRushArmedBoost?.type === selectedGoldRushBonusOption.type) && (
                  <p className="gold-rush-boost-warning">Balance is too low for this option.</p>
                )}
                <button
                  className="primary-button"
                  type="button"
                  disabled={
                    (balance < selectedGoldRushBonusCost && !(goldRushArmedBoost?.type === selectedGoldRushBonusOption.type)) ||
                    Boolean(goldRushArmedBoost && goldRushArmedBoost.type !== selectedGoldRushBonusOption.type)
                  }
                  onClick={confirmGoldRushBonusSelection}
                >
                  {goldRushArmedBoost?.type === selectedGoldRushBonusOption.type
                    ? "Turn Off"
                    : selectedGoldRushBonusOption.mode === "boost"
                      ? "Activate"
                      : "Confirm Buy"}
                </button>
              </section>
            )}
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => {
                setGoldRushBonusOpen(false);
                setGoldRushBonusSelection(null);
                playGoldRushSound("button_tap");
              }}>Close</button>
            </div>
          </div>
        </Modal>
      )}
      {wheelReveal && (
        <div
          className={`wheel-bonus-screen ${wheelReveal.phase} drama-${wheelDrama}`}
          role="dialog"
          aria-label="Wheel Bonus"
          style={{
            "--wheel-end": `${getWheelLandingDegrees(wheelSectionLabels, wheelReveal.result.wheelBonus?.segment)}deg`,
            "--segment-count": game.wheelBonus?.segments.length ?? 1,
            "--wheel-spin-ms": `${frontierWheelSpinMs}ms`,
          } as React.CSSProperties}
        >
          <div className="wheel-bonus-panel">
            <span>WHEEL BONUS</span>
            <div className="wheel-pointer" aria-hidden="true"><i /></div>
            <div className="wheel-disc">
              <div className="wheel-rim" aria-hidden="true">
                {Array.from({ length: 24 }, (_, index) => <span key={index} style={{ "--peg-index": index } as React.CSSProperties} />)}
              </div>
              <div className="wheel-segment-ring">
                {(game.wheelBonus?.segments ?? []).map((segment, index) => (
                  <i
                    style={{
                      "--segment-index": index,
                      "--segment-angle": `${360 / Math.max(1, game.wheelBonus?.segments.length ?? 1)}deg`,
                      "--label-angle": `${index * -360 / Math.max(1, game.wheelBonus?.segments.length ?? 1)}deg`,
                    } as React.CSSProperties}
                    className={`wheel-prize-${getFrontierWheelPrizeClass(segment.label)}`}
                    key={`${segment.label}-${index}`}
                  >
                    <em>{getFrontierWheelSegmentDisplayLabel(segment.label)}</em>
                  </i>
                ))}
              </div>
              <button
                className="wheel-center-spin"
                type="button"
                disabled={wheelReveal.phase !== "ready"}
                onClick={() => completeFrontierWheelSpin(wheelReveal)}
                aria-label={wheelReveal.phase === "ready" ? "Spin Wheel Bonus" : "Wheel spinning"}
              >
                {wheelReveal.phase === "revealed" ? wheelReveal.result.wheelBonus?.segment : wheelReveal.phase === "ready" ? "SPIN" : "SPINNING"}
              </button>
            </div>
            <strong>
              {wheelReveal.phase === "ready"
                ? "Tap the center to spin"
                : wheelReveal.phase === "spinning"
                  ? wheelDrama === "near-miss"
                    ? "Slowing near a big one..."
                    : "Wheel is spinning..."
                  : `${wheelReveal.result.wheelBonus?.segment}`}
            </strong>
            {wheelReveal.phase === "revealed" && (
              <p className="wheel-win-amount">
                {wheelReveal.result.wheelBonus?.freeSpinsAwarded
                  ? `${wheelReveal.result.wheelBonus.freeSpinsAwarded} sticky wild free spins awarded`
                  : wheelReveal.result.wheelBonus?.featureTrigger
                    ? getFrontierWheelResultAction(wheelReveal.result)
                    : `Won +${formatCoins(wheelReveal.result.payout)} ${currencyLabel}`}
              </p>
            )}
            <button className="primary-button" disabled={wheelReveal.phase !== "revealed"} onClick={() => setWheelReveal(null)}>
              {wheelReveal.phase === "revealed" ? getFrontierWheelResultAction(wheelReveal.result) : wheelReveal.phase === "ready" ? "Spin the wheel first" : "Spinning"}
            </button>
          </div>
        </div>
      )}
      {frontierIntroReopened && (
        <div className="frontier-intro-reopen-layer">
          <FrontierFeatureIntroScreen
            onContinue={continueFrontierEntry}
          />
        </div>
      )}
      {isGoldRush && goldRushFreeSpinSession?.introOpen && (
        <div className="gold-rush-free-spin-layer" role="dialog" aria-modal="true" aria-label="Gold Rush Free Spins">
          <div className="gold-rush-free-spin-panel">
            <span>Bonus Triggered</span>
            <strong>{goldRushFreeSpinSession.initialSpins} Free Spins</strong>
            <p>Interior Frame Active</p>
            <em>{goldRushFreeSpinSession.interiorColumns}x4 Mine Chamber</em>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setGoldRushFreeSpinSession((current) => current ? { ...current, introOpen: false } : current);
                setUiState("Free Spins");
                playClick();
                playGoldRushSound("button_tap");
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {isGoldRush && goldRushFreeSpinSession?.summaryOpen && (
        <div className="gold-rush-free-spin-layer summary" role="dialog" aria-modal="true" aria-label="Gold Rush Free Spins Complete">
          <div className="gold-rush-free-spin-panel">
            <span>Free Spins Complete</span>
            <strong>{formatCoins(goldRushFreeSpinSession.totalWin)}</strong>
            <p>{goldRushFreeSpinSession.spinsPlayed} spins played</p>
            <em>Final Interior {goldRushFreeSpinSession.interiorColumns}x4</em>
            <button
              className="primary-button"
              type="button"
              onClick={() => {
                setGoldRushFreeSpinSession(null);
                setFreeSpins(0);
                setFreeSpinTotal(0);
                setUiState("Idle");
                playClick();
                playGoldRushSound("button_tap");
              }}
            >
              Continue
            </button>
          </div>
        </div>
      )}
      {bonusResult && (
        <BonusModal
          title={bonusResult.winType === "FREE_SPINS" ? "Free Spins Triggered" : "Pick Bonus"}
          message={
            bonusResult.winType === "FREE_SPINS"
              ? `${bonusResult.freeSpinsAwarded} free spins awarded.`
              : "Pick hidden prize cards to reveal your virtual coin bonus."
          }
          awards={bonusResult.pickBonusAwards}
          picks={bonusResult.pickBonusPicks}
          onResolve={(award) => {
            creditPickBonus({ user: currentUser, game, currency, award });
            setHistory((current) =>
              current.map((spin, index) =>
                index === 0 ? { ...spin, payout: spin.payout + award, pickBonusWin: (spin.pickBonusWin ?? 0) + award } : spin,
              ),
            );
            refreshUser();
          }}
          onClose={() => setBonusResult(null)}
        />
      )}
    </section>
  );
}

