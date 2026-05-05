import { ArrowLeft, Coins, Gauge, Info, Menu, Minus, Plus, RotateCw, ShoppingBag, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { getCurrencyShortName } from "../config/currencyConfig";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { nextSessionStats, emptySessionStats } from "../economy/sessionStats";
import { recordRetentionRound } from "../retention/retentionService";
import { playBigWin, playBonus, playClick, playError, playLose, playSpin, playWin } from "../feedback/feedbackService";
import { GameResultBanner, ScreenShake, SoundToggle, WinOverlay } from "../feedback/components";
import { BonusModal } from "./BonusModal";
import { GameLogo } from "./GameLogo";
import { Modal } from "../components/Modal";
import { PaytableModal } from "./PaytableModal";
import { frontierUiAssets } from "./frontierAssets";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { recordRecentGame } from "./recentGames";
import { getSpinDuration, slotAnimation } from "./slotAnimation";
import { nextFreeSpinTotal } from "./slotSession";
import { buyBonusDebit, buyBonusFeature, createHoldAndWinState, creditHoldAndWinBonus, creditPickBonus, generateGrid, getBonusBuyCost, getBonusBuyPayoutBetAmount, getSpinCost, spinSlot, stepHoldAndWinBonus } from "./slotEngine";
import { SymbolTile } from "./SymbolTile";
import type { ReelVisualState, SlotAnimationState } from "./slotAnimation";
import type { BonusFeatureType, HoldAndWinState, SlotConfig, SlotSpinResult, SpinMode } from "./types";

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

export const moneyLightningIconAssets = {
  primary: "/assets/ui/money-lightning/primary_256.svg",
  neon: "/assets/ui/money-lightning/neon_256.svg",
} as const;

export function getFrontierEBoostIconAsset(state: "default" | "active" = "default") {
  return state === "active" ? moneyLightningIconAssets.neon : moneyLightningIconAssets.primary;
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
      detail: "+20% cost, better coin chance",
    },
    {
      id: "scatter-boost",
      label: "Scatter Boost",
      cost: getSpinCost(game, betAmount, "SCATTER_BOOST"),
      detail: "+25% cost, better scatter chance",
    },
  ];
}

export function getFrontierMainControlActions() {
  return ["Speed", "Info", "Sound"];
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
  const [bonusMeter, setBonusMeter] = useState(0);
  const [collectorCoins, setCollectorCoins] = useState(0);
  const [collectorFeedback, setCollectorFeedback] = useState("");
  const [collectorAnimation, setCollectorAnimation] = useState({ key: 0, collected: 0, triggered: false, displayLevel: null as number | null });
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [buyBonusOpen, setBuyBonusOpen] = useState(false);
  const [bonusResult, setBonusResult] = useState<SlotSpinResult | null>(null);
  const [wheelReveal, setWheelReveal] = useState<{ result: SlotSpinResult; revealed: boolean } | null>(null);
  const [uiState, setUiState] = useState<SlotUiState>("Idle");
  const [anticipating, setAnticipating] = useState(false);
  const [overlayResult, setOverlayResult] = useState<SlotSpinResult | null>(null);
  const [holdState, setHoldState] = useState<HoldAndWinState | null>(null);
  const [holdBought, setHoldBought] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [logoReady, setLogoReady] = useState(true);
  const [assetsLoaded, setAssetsLoaded] = useState(false);
  const [lowPerformanceMode, setLowPerformanceMode] = useState(false);
  const [holdFeedback, setHoldFeedback] = useState("");
  const [animationState, setAnimationState] = useState<SlotAnimationState>("idle");
  const [reelStates, setReelStates] = useState<ReelVisualState[]>(() => Array.from({ length: game.reelCount }, () => "idle"));
  const [betMenuOpen, setBetMenuOpen] = useState(false);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const currencyLabel = getCurrencyShortName(currency);
  const inHoldAndWin = Boolean(holdState);
  const spinCost = getSpinCost(game, betAmount, spinMode);
  const canSpin = assetsLoaded && !spinning && !inHoldAndWin && (freeSpins > 0 || balance >= spinCost);
  const holdBuyCost = getBonusBuyCost(game, betAmount, "HOLD_AND_WIN", currency);
  const wheelBuyCost = getBonusBuyCost(game, betAmount, "WHEEL_BONUS", currency);
  const turbo = frontierTurboBypassesAnimation(spinSpeed);
  const lastResult = history[0];
  const scatterCount = grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
  const bonusCount = grid.flat().filter((symbol) => symbol === game.bonusSymbol).length;
  const betOptions = getBetOptions(game, currency);
  const activePaylines = new Set(lastResult?.lineWins.map((win) => win.paylineId) ?? []);
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

  useEffect(() => {
    setBetAmount(getDefaultBetAmount(game, "GOLD"));
    setGrid(generateGrid(game));
    setHistory([]);
    setFreeSpins(0);
    setFreeSpinTotal(0);
    setBonusMeter(0);
    setCollectorCoins(0);
    setCollectorFeedback("");
    setCollectorAnimation({ key: 0, collected: 0, triggered: false, displayLevel: null });
    setSpinMode("NORMAL");
    setSpinSpeed("NORMAL");
    setUiState("Idle");
    setOverlayResult(null);
    setHoldState(null);
    setHoldBought(false);
    setHoldFeedback("");
    setAnimationState("idle");
    setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
    setBetMenuOpen(false);
    setWheelReveal(null);
  }, [game]);

  useEffect(() => {
    setBetAmount(getDefaultBetAmount(game, currency));
  }, [currency, game]);

  useEffect(() => {
    let active = true;
    setAssetsLoaded(false);
    const urls = [
      ...game.symbols.map((symbol) => symbol.image).filter((url): url is string => Boolean(url)),
      ...Object.values(frontierUiAssets),
    ];
    Promise.all(
      [...new Set(urls)].map(
        (url) =>
          new Promise<void>((resolve) => {
            const image = new Image();
            image.decoding = "async";
            image.onload = () => resolve();
            image.onerror = () => resolve();
            image.src = url;
          }),
      ),
    ).then(() => {
      if (active) setAssetsLoaded(true);
    });
    const memory = "deviceMemory" in navigator ? Number((navigator as Navigator & { deviceMemory?: number }).deviceMemory) : 4;
    setLowPerformanceMode(memory <= 2 || window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    return () => {
      active = false;
    };
  }, [game]);

  useEffect(() => {
    if (!collectorAnimation.collected && !collectorAnimation.triggered) return;
    const timeout = window.setTimeout(
      () =>
        setCollectorAnimation((current) =>
          current.key === collectorAnimation.key
            ? { key: current.key, collected: 0, triggered: false, displayLevel: null }
            : current,
        ),
      collectorAnimation.triggered ? 1100 : 760,
    );
    return () => window.clearTimeout(timeout);
  }, [collectorAnimation.collected, collectorAnimation.displayLevel, collectorAnimation.key, collectorAnimation.triggered]);

  const overlayIsBig = overlayResult?.winTier === "BIG" || overlayResult?.winTier === "MEGA";

  function stepBet(direction: -1 | 1) {
    const index = betOptions.indexOf(betAmount);
    const nextIndex = Math.min(betOptions.length - 1, Math.max(0, (index >= 0 ? index : 0) + direction));
    setBetAmount(betOptions[nextIndex] ?? betAmount);
  }

  useEffect(() => {
    if (!overlayResult) return;
    const timeout = window.setTimeout(
      () => setOverlayResult(null),
      overlayResult.triggeredHoldAndWin && overlayResult.payout === 0 ? 1600 : overlayResult.winTier === "MEGA" ? 2800 : 2000,
    );
    return () => window.clearTimeout(timeout);
  }, [overlayResult]);

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
    if (usedFreeSpin) {
      setFreeSpins((count) => Math.max(0, count - 1));
      setFreeSpinTotal((total) => nextFreeSpinTotal(total, result));
    }
    if (result.freeSpinsAwarded > 0) {
      setFreeSpins((count) => count + result.freeSpinsAwarded);
      setFreeSpinTotal(0);
    }
    if (result.triggeredWheelBonus) {
      setBonusResult(null);
      setWheelReveal({ result, revealed: false });
      setOverlayResult(null);
      setAnimationState("bonusReveal");
      if (result.wheelBonus?.featureTrigger) {
        const superHold = result.wheelBonus.featureTrigger === "SUPER_HOLD_AND_WIN";
        window.setTimeout(() => {
          setWheelReveal((current) => current ? { ...current, revealed: true } : current);
          setHoldState(createHoldAndWinState(game, betAmount, 6, superHold));
          setHoldBought(false);
          setHoldFeedback(superHold ? "SUPER HOLD AND WIN - ALL STARTING COINS OVER 2x" : "Wheel awarded Hold & Win with 6 starting coins.");
          setAnimationState("bonusIdle");
          setUiState("Hold And Win");
        }, slotAnimation.bonus.revealMs);
      } else {
        window.setTimeout(() => {
          setWheelReveal((current) => current ? { ...current, revealed: true } : current);
          setOverlayResult(result);
          setAnimationState("idle");
        }, slotAnimation.bonus.revealMs + 620);
      }
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
    } else if (result.triggeredBonus) {
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
    if (result.triggeredBonus) playBonus();
    else if (result.winTier === "BIG" || result.winTier === "MEGA") playBigWin();
    else if (result.payout > 0) playWin();
    else playLose();
  }

  function spin(modeOverride: SpinMode = spinMode) {
    const activeSpinMode = freeSpins > 0 ? "NORMAL" : modeOverride;
    const activeSpinCost = getSpinCost(game, betAmount, activeSpinMode);
    if (!spinning && !inHoldAndWin && freeSpins === 0 && balance < activeSpinCost) {
      setUiState("Error/Insufficient Balance");
      notify("Insufficient balance for this spin.", "error");
      playError();
      return;
    }
    if (!canSpin) {
      setUiState("Error/Insufficient Balance");
      playError();
      return;
    }

    setSpinning(true);
    playClick();
    playSpin();
    setUiState("Spinning");
    setAnimationState("spinning");
    setReelStates(Array.from({ length: game.reelCount }, () => "spinning"));
    setOverlayResult(null);
    setAnticipating(false);
    const usedFreeSpin = freeSpins > 0;
    const mode = getFrontierSpinAnimationMode(spinSpeed);
    const timing = slotAnimation[mode];
    const stoppedReels = new Set<number>();
    let result: SlotSpinResult;
    try {
      result = spinSlot({ user: currentUser, game, currency, betAmount, freeSpin: usedFreeSpin, spinMode: activeSpinMode });
    } catch (caught) {
      setSpinning(false);
      setAnimationState("idle");
      setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
      setUiState("Error/Insufficient Balance");
      notify(caught instanceof Error ? caught.message : "Spin failed.", "error");
      playError();
      return;
    }
    if (frontierTurboBypassesAnimation(spinSpeed)) {
      setGrid(result.grid);
      setUiState("Evaluating");
      setAnimationState("settling");
      setReelStates(Array.from({ length: game.reelCount }, () => "stopped"));
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
    timing.reelStopMs.forEach((stopMs, reelIndex) => {
      window.setTimeout(() => {
        stoppedReels.add(reelIndex);
        setGrid((current) => current.map((reel, index) => (index === reelIndex ? result.grid[index] ?? reel : reel)));
        setReelStates((states) => states.map((state, index) => (index === reelIndex ? "settling" : state)));
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
    }, getSpinDuration(mode) - timing.evaluateMs);
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
      } else {
        const result = buyBonusFeature({ user: currentUser, game, currency, betAmount, featureType });
        resolvedPayout = result.payout;
        setHistory((current) => [result, ...current].slice(0, 8));
        setWheelReveal({ result, revealed: false });
        setOverlayResult(null);
        setUiState("Win");
        window.setTimeout(() => {
          setWheelReveal((current) => current ? { ...current, revealed: true } : current);
          setOverlayResult(result);
          setAnimationState("idle");
        }, slotAnimation.bonus.revealMs + 620);
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
            {logoReady && <img className="frontier-title-logo" src={frontierUiAssets.titleLogo} alt={game.name} onError={() => setLogoReady(false)} />}
            {!logoReady && <p className="eyebrow">{game.theme}</p>}
            <h1 className={logoReady ? "asset-backed" : ""}>{game.name}</h1>
            <p className="muted">
              {game.waysToWin} | {game.volatility} volatility | Target RTP {(game.targetRtp * 100).toFixed(1)}% | Demo only
            </p>
          </div>
        </div>
        <div className="slot-header-actions">
          <div className="header-jackpot-strip" aria-label="Frontier Fortune jackpots">
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
        </div>
      </div>
      <div
        className={`treasure-pot-collector charge-${treasurePotState.chargeLevel} ${treasurePotState.reset ? "triggered" : ""} ${treasurePotState.collecting ? "collecting" : ""}`}
        style={{ "--charge": treasurePotState.level, "--pot-rise": `${5 - treasurePotState.level}px`, "--pot-scale": treasurePotState.scale, "--pot-glow": treasurePotState.glow } as React.CSSProperties}
        aria-label={`Treasure Pot ${treasurePotState.level} of ${game.coinCollector?.maxCoins ?? 5}`}
        title={collectorFeedback || `Treasure Pot ${treasurePotState.level} of ${game.coinCollector?.maxCoins ?? 5}`}
      >
        {treasurePotState.reset && <strong className="treasure-pot-trigger-label">Collector Triggered</strong>}
        <div className="treasure-pot-core" aria-hidden="true">
          <div className="treasure-pot-aura" />
          <div className="treasure-pot-inner-light" />
          <div className="treasure-pot-coins">
            {treasurePotState.coins.map((filled, index) => (
              <i className={filled ? "filled" : ""} key={index} />
            ))}
          </div>
          <div className="treasure-pot-bowl" />
          {Array.from({ length: 3 }, (_, index) => (
            <span className="treasure-pot-spark" key={index} />
          ))}
          <div className="treasure-pot-flying-coins">
            {treasurePotState.flyingCoins.map((index) => (
              <span
                key={`${collectorAnimation.key}-${index}`}
                style={{ "--fly-index": index, "--fly-x": `${(index - (treasurePotState.flyingCoins.length - 1) / 2) * 18}px` } as React.CSSProperties}
              />
            ))}
          </div>
          <div className="treasure-pot-burst">
            {treasurePotState.burstCoins.map((index) => (
              <span key={`${collectorAnimation.key}-burst-${index}`} style={{ "--burst-index": index } as React.CSSProperties} />
            ))}
          </div>
        </div>
      </div>

      <ScreenShake active={Boolean(overlayResult?.winTier === "MEGA")}>
      <div className="slot-board">
        <div className="slot-side-menu">
          <button className="ghost-button icon-only" title="Menu"><Menu size={18} /></button>
          <button className="ghost-button icon-only" onClick={() => setPaytableOpen(true)} title="Info"><Info size={18} /></button>
          <SoundToggle className="ghost-button icon-only" compact />
        </div>
        <div className={`slot-state-pill ${inHoldAndWin ? "bonus" : ""}`}>
          <span>{modeLabel}</span>
          {anticipating && <strong>{scatterCount >= 2 ? "Wheel close..." : "Coins close..."}</strong>}
          {lastResult?.holdAndWin && <strong>Hold and Win total {formatCoins(lastResult.holdAndWin.total)}</strong>}
          {lastResult?.wheelBonus && <strong>Wheel landed {lastResult.wheelBonus.segment}</strong>}
        </div>
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
              {lastResult?.lineWins.length ? (
                <svg className="payline-overlay" viewBox="0 0 500 300" preserveAspectRatio="none" aria-hidden="true">
                  {game.paylines.map((payline) => {
                    const points = payline.rows.map((lineRow, reel) => `${reel * 100 + 50},${lineRow * 100 + 50}`).join(" ");
                    return <polyline className={activePaylines.has(payline.id) ? "active" : ""} points={points} key={payline.id} />;
                  })}
                </svg>
              ) : null}
              {Array.from({ length: game.rowCount }, (_, row) =>
                Array.from({ length: game.reelCount }, (_, reel) => {
                  const symbolId = grid[reel]?.[row] ?? game.symbols[0].id;
                  const active = Boolean(
                    lastResult?.winningPositions.some((position) => position.reel === reel && position.row === row) ||
                    (lastResult?.triggeredHoldAndWin && symbolId === game.bonusSymbol)
                  );
                  return (
                    <SymbolTile
                      game={game}
                      symbolId={symbolId}
                      active={active}
                      reelState={reelStates[reel] ?? "idle"}
                      reelIndex={reel}
                      spinning={spinning && reelStates[reel] === "spinning"}
                      key={`${reel}-${row}`}
                    />
                  );
                }),
              )}
            </>
          )}
          <WinOverlay
            show={Boolean(overlayResult)}
            title={overlayResult?.triggeredWheelBonus ? "WHEEL BONUS" : overlayResult?.triggeredHoldAndWin ? (overlayResult.payout > 0 ? "Hold And Win Complete" : "Bonus Triggered") : overlayResult?.winTier === "MEGA" ? "Mega Win" : overlayResult?.winTier === "BIG" ? "Big Win" : "Win"}
            amount={overlayResult?.payout ?? 0}
            big={overlayIsBig}
            bonus={Boolean(overlayResult?.triggeredBonus)}
            onDismiss={() => setOverlayResult(null)}
          >
            {overlayResult?.wheelBonus ? `Wheel result: ${overlayResult.wheelBonus.segment}` : overlayResult?.holdAndWin ? `Respin rounds: ${overlayResult.holdAndWin.respinRounds.length}` : null}
          </WinOverlay>
        </div>

        <div className="reel-bonus-action">
          {game.buyBonus?.enabled && !inHoldAndWin && (
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
              className={`slot-main-action ${inHoldAndWin ? "respin" : ""}`}
              disabled={inHoldAndWin ? bonusBusy || holdState?.finished : !canSpin}
              onClick={inHoldAndWin ? respinHoldAndWin : () => spin()}
            >
              {inHoldAndWin ? (bonusBusy ? "..." : <RotateCw size={42} />) : spinning ? "..." : <RotateCw size={42} />}
              <span>{inHoldAndWin ? "Respin" : assetsLoaded ? "Spin" : "Load"}</span>
            </button>
          </div>
          <div className="premium-control-icons">
            <button
              className={`ghost-button icon-only speed-control speed-${spinSpeed.toLowerCase()}`}
              onClick={() => setSpinSpeed((value) => getNextFrontierSpinSpeed(value))}
              title={`Speed: ${spinSpeed === "NORMAL" ? "Normal" : spinSpeed === "FAST" ? "Fast" : "Turbo"}`}
              aria-label={`Speed ${spinSpeed === "NORMAL" ? "Normal" : spinSpeed === "FAST" ? "Fast" : "Turbo"}`}
            >
              <Zap size={19} />
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
            <span>Feature meter</span>
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
          <button className="ghost-button icon-button" disabled title="Dev-only placeholder">
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
              <button className="ghost-button icon-only" onClick={() => setBetMenuOpen(false)} aria-label="Close bet selector">×</button>
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
                <small>+20% cost, better coin chance.</small>
              </button>
              <button className="notice-card bonus-cost-card" disabled={balance < getSpinCost(game, betAmount, "SCATTER_BOOST")} onClick={() => startBoostSpin("SCATTER_BOOST")}>
                <span className="bonus-card-icon scatter" aria-hidden="true"><img src="/assets/symbols/frontier/oasis_scatter.png" alt="" /></span>
                <span className="bonus-card-heading">
                  <span>Scatter Boost</span>
                </span>
                <strong>{formatCoins(getSpinCost(game, betAmount, "SCATTER_BOOST"))} {currencyLabel}</strong>
                <small>+25% cost, better scatter chance.</small>
              </button>
            </div>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setBuyBonusOpen(false)}>Cancel</button>
            </div>
          </div>
        </Modal>
      )}
      {wheelReveal && (
        <div className={`wheel-bonus-screen ${wheelReveal.revealed ? "revealed" : "spinning"}`} role="dialog" aria-label="Wheel Bonus">
          <div className="wheel-bonus-panel">
            <span>WHEEL BONUS</span>
            <div className="wheel-disc">
              {(game.wheelBonus?.segments ?? []).map((segment, index) => (
                <i style={{ "--segment-index": index } as React.CSSProperties} key={`${segment.label}-${index}`}>{segment.label}</i>
              ))}
              <b>{wheelReveal.revealed ? wheelReveal.result.wheelBonus?.segment : ""}</b>
            </div>
            <strong>{wheelReveal.revealed ? `Result: ${wheelReveal.result.wheelBonus?.segment}` : "Spinning..."}</strong>
            {wheelReveal.revealed && (
              <p className="wheel-win-amount">
                Won +{formatCoins(wheelReveal.result.payout)} {currencyLabel}
              </p>
            )}
            <button className="primary-button" disabled={!wheelReveal.revealed} onClick={() => setWheelReveal(null)}>Continue</button>
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

