import { useMemo, useState, type CSSProperties } from "react";
import { ChevronLeft, CirclePlay, Info, Minus, Plus, Sparkles, X, Zap } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import {
  playError,
  playTreasureDigClick,
  playTreasureDigPayout,
  playTreasureDigReveal,
  playTreasureDigStreak,
  playTreasureDigTrap,
  playTreasureDigTreasure,
} from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { treasureDigConfig } from "./configs";
import {
  cashOutTreasureDigRound,
  clampTreasureTrapCount,
  getTreasureBoostMultiplier,
  getTreasureDigMultiplier,
  pickTreasureTile,
  startTreasureDigRound,
} from "./treasureDigEngine";
import type { TreasureDigConfig, TreasureDigRound } from "./types";

const hiddenTileAsset = new URL("../assets/treasure-dig/hidden-dig-tile-premium.png", import.meta.url).href;
const treasureTileAsset = new URL("../assets/treasure-dig/treasure-reveal-tile-premium.png", import.meta.url).href;
const trapTileAsset = new URL("../assets/treasure-dig/trap-reveal-tile-premium.png", import.meta.url).href;
const treasureBurstAsset = new URL("../assets/treasure-dig/dig-burst-fx.png", import.meta.url).href;
const trapBurstAsset = new URL("../assets/treasure-dig/trap-explosion-fx.png", import.meta.url).href;
const chestAsset = new URL("../assets/gold-rush-showdown/symbols/treasure-chest.png", import.meta.url).href;
const gemAsset = new URL("../assets/gold-rush-showdown/symbols/blue-diamond.png", import.meta.url).href;
const goldAsset = new URL("../assets/gold-rush-showdown/symbols/gold-nugget.png", import.meta.url).href;

const currencyCopy: Record<Currency, { short: string; className: string }> = {
  GOLD: { short: "GC", className: "currency-gc" },
  BONUS: { short: "SC", className: "currency-sc" },
};

const treasureBetLimits = {
  GOLD: { minBet: 1, maxBet: 1000000, step: 1 },
  BONUS: { minBet: 0.01, maxBet: 500, step: 0.01 },
} satisfies Record<Currency, { minBet: number; maxBet: number; step: number }>;

type TreasureResult = {
  safePicks: number;
  multiplier: number;
  won: boolean;
  paid: number;
};

export const treasureDigUiMarkers = {
  gameName: "Treasure Dig",
  goldBonusToggle: true,
  fiveByFiveGrid: true,
  trapCountPicker: true,
  multiplierMathRtpCapped: true,
  tileFlipAnimation: true,
  treasureGlow: true,
  trapExplosionShake: true,
  cashOutAnytime: true,
  possiblePayout: true,
  potentialMaxWin: true,
  variableMultiplierTiles: true,
  sharedSoundToggle: true,
  revealBoardOnFinish: true,
  compactFinishedResult: true,
  compactBottomBetControls: true,
  playheaterHeader: true,
  rasterDigTiles: true,
  rasterRevealFx: true,
  premiumRiskSlider: true,
  lastFiveResults: true,
  payoutCountUp: true,
  currencySpecificLimits: true,
  infoBesideGameName: true,
  rulesInfoModal: true,
};

export function TreasureDigPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(treasureBetLimits.GOLD.minBet);
  const [betInput, setBetInput] = useState(formatBetInput(treasureBetLimits.GOLD.minBet, "GOLD"));
  const [trapCount, setTrapCount] = useState(3);
  const [round, setRound] = useState<TreasureDigRound | null>(null);
  const [lastOpened, setLastOpened] = useState<number | null>(null);
  const [recentResults, setRecentResults] = useState<TreasureResult[]>([]);
  const [rulesOpen, setRulesOpen] = useState(false);

  if (!user) return null;
  const currentUser = user;
  const betLimits = treasureBetLimits[currency];
  const currencyLabel = currencyCopy[currency].short;
  const activeTreasureConfig = getActiveTreasureConfig(currency);
  const balance = getBalance(currentUser.id, currency);
  const running = round?.status === "RUNNING";
  const tileCount = treasureDigConfig.gridSize * treasureDigConfig.gridSize;
  const safePicks = round ? countSafePicks(round) : 0;
  const liveBoostMultiplier = round ? getTreasureBoostMultiplier(round.pickedIndexes, round.multiplierTiles) : 1;
  const resolvedTrapCount = round?.trapCount ?? trapCount;
  const safeTileCount = Math.max(1, tileCount - resolvedTrapCount);
  const multiplier = round
    ? getTreasureDigMultiplier({
      safePicks,
      trapCount: round.trapCount,
      boostMultiplier: liveBoostMultiplier,
      config: activeTreasureConfig,
    })
    : getTreasureDigMultiplier({ safePicks: 0, trapCount, config: activeTreasureConfig });
  const nextMultiplier = running
    ? getTreasureDigMultiplier({
      safePicks: safePicks + 1,
      trapCount: round.trapCount,
      boostMultiplier: liveBoostMultiplier,
      config: activeTreasureConfig,
    })
    : getTreasureDigMultiplier({ safePicks: 1, trapCount, config: activeTreasureConfig });
  const activeBetAmount = round ? round.betAmount : betAmount;
  const possiblePayout = getPreviewPayout(activeBetAmount, multiplier, activeTreasureConfig);
  const canStart = Boolean(
    !running &&
    Number.isFinite(betAmount) &&
    betAmount >= betLimits.minBet &&
    betAmount <= betLimits.maxBet &&
    balance >= betAmount,
  );
  const tiles = useMemo(() => Array.from({ length: tileCount }, (_, index) => index), [tileCount]);
  const riskTone = getRiskTone(trapCount);
  const riskLabel = riskTone === "high" ? "High Risk" : riskTone === "medium" ? "Medium Risk" : "Low Risk";
  const tension = running
    ? Math.min(1, (safePicks / safeTileCount) * 1.35 + (resolvedTrapCount / tileCount) * 0.28)
    : Math.min(0.5, resolvedTrapCount / tileCount);
  const trapRatio = trapCount / treasureDigConfig.maxTraps;
  const pageClass = [
    "treasure-dig-page",
    currencyCopy[currency].className,
    running ? "is-running" : "",
    round?.status === "TRAPPED" ? "is-trapped" : "",
    round?.status === "CASHED_OUT" ? "is-cashed-out" : "",
    `risk-${riskTone}`,
  ].filter(Boolean).join(" ");
  const pageStyle = {
    "--dig-tension": tension.toFixed(3),
    "--dig-trap-ratio": trapRatio.toFixed(3),
  } as CSSProperties;

  function clampBet(value: number, nextCurrency = currency) {
    const limits = treasureBetLimits[nextCurrency];
    if (!Number.isFinite(value)) return limits.minBet;
    const normalized = nextCurrency === "BONUS" ? Math.round(value * 100) / 100 : Math.round(value);
    return Math.max(limits.minBet, Math.min(limits.maxBet, normalized));
  }

  function setBet(value: number, nextCurrency = currency) {
    const next = clampBet(value, nextCurrency);
    setBetAmount(next);
    setBetInput(formatBetInput(next, nextCurrency));
  }

  function updateBetInput(value: string) {
    setBetInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      const normalized = currency === "BONUS" ? Math.round(parsed * 100) / 100 : Math.round(parsed);
      setBetAmount(Math.max(0, Math.min(betLimits.maxBet, normalized)));
    }
  }

  function selectCurrency(nextCurrency: Currency) {
    if (running || nextCurrency === currency) return;
    setCurrency(nextCurrency);
    setBet(clampBet(betAmount, nextCurrency), nextCurrency);
  }

  function updateTrapCount(value: number) {
    setTrapCount(clampTreasureTrapCount(value));
  }

  function start() {
    try {
      const wager = clampBet(betAmount);
      const next = startTreasureDigRound({
        userId: currentUser.id,
        currency,
        betAmount: wager,
        trapCount,
        config: activeTreasureConfig,
      });
      setRound(next);
      setLastOpened(null);
      playTreasureDigClick();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to start Treasure Dig.", "error");
      playError();
    }
  }

  function pick(tileIndex: number) {
    if (!round || round.status !== "RUNNING" || round.pickedIndexes.includes(tileIndex)) return;
    try {
      playTreasureDigClick();
      const next = pickTreasureTile({ round, userId: currentUser.id, tileIndex, config: activeTreasureConfig });
      setRound(next);
      setLastOpened(tileIndex);
      playTreasureDigReveal();
      if (next.status === "TRAPPED") {
        const safeCount = countSafePicks(next);
        recordTreasureRetention(next.betAmount, 0, next.currentMultiplier);
        setRecentResults((current) => [
          { safePicks: safeCount, multiplier: next.currentMultiplier, won: false, paid: 0 },
          ...current,
        ].slice(0, 5));
        playTreasureDigTrap();
        return;
      }
      const nextSafeCount = countSafePicks(next);
      const multiplierTile = next.multiplierTiles.some((tile) => tile.index === tileIndex);
      if (multiplierTile || nextSafeCount > 1) playTreasureDigStreak(nextSafeCount);
      else playTreasureDigTreasure(nextSafeCount);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to open tile.", "error");
      playError();
    }
  }

  function cashOut() {
    if (!round || round.status !== "RUNNING") return;
    const next = cashOutTreasureDigRound({ round, userId: currentUser.id, config: activeTreasureConfig });
    const paid = next.totalPaid ?? 0;
    setRound(next);
    setRecentResults((current) => [
      { safePicks: countSafePicks(next), multiplier: next.currentMultiplier, won: true, paid },
      ...current,
    ].slice(0, 5));
    recordTreasureRetention(next.betAmount, paid, next.currentMultiplier);
    playTreasureDigPayout();
  }

  function recordTreasureRetention(wager: number, won: number, multiplierValue: number) {
    recordRetentionRound({
      userId: currentUser.id,
      gameId: "treasureDig",
      wager,
      won,
      multiplier: multiplierValue,
    });
    refreshUser();
  }

  function mainAction() {
    if (running) cashOut();
    else start();
  }

  function tileClass(tileIndex: number) {
    if (!round) return "treasure-tile hidden";
    const finished = round.status !== "RUNNING";
    const open = finished || round.pickedIndexes.includes(tileIndex);
    const trap = round.trapIndexes.includes(tileIndex);
    const multiplierTile = round.multiplierTiles.some((tile) => tile.index === tileIndex);
    if (!open) return "treasure-tile hidden";
    return [
      "treasure-tile",
      "open",
      trap ? "trap" : multiplierTile ? "multiplier" : "safe",
      finished && !round.pickedIndexes.includes(tileIndex) ? "revealed" : "",
      lastOpened === tileIndex ? "fresh" : "",
    ].filter(Boolean).join(" ");
  }

  return (
    <section className={pageClass} style={pageStyle}>
      <header className="treasure-dig-header">
        <button className="treasure-dig-icon-button treasure-dig-back" type="button" onClick={onExit} aria-label="Back to table games">
          <ChevronLeft size={18} />
        </button>
        <div className="treasure-dig-title">
          <h1>Treasure Dig</h1>
          <button className="treasure-dig-info-button" type="button" aria-label="Treasure Dig rules" onClick={() => setRulesOpen(true)}>
            <Info size={14} />
          </button>
        </div>
        <div className="treasure-dig-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={running} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={running} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="treasure-dig-icon-button" compact />
      </header>

      <ScreenShake active={round?.status === "TRAPPED"}>
        <main className="treasure-dig-table">
          <section className="treasure-dig-stage" aria-live="polite">
            <div className="treasure-dig-stage-light" aria-hidden="true" />
            <section className="treasure-dig-stats">
              <div className="primary"><span>Current</span><strong key={`m-${safePicks}-${liveBoostMultiplier}`}>{multiplier.toFixed(2)}x</strong></div>
              <div><span>Next Safe</span><strong>{nextMultiplier.toFixed(2)}x</strong></div>
              <div><span>Payout</span><strong>{formatCoins(possiblePayout)}</strong></div>
            </section>

            <div className="treasure-board-shell">
              <div className="treasure-board-aura" aria-hidden="true" />
              <div className="treasure-grid" style={{ "--treasure-grid-size": treasureDigConfig.gridSize } as CSSProperties}>
                {tiles.map((tileIndex) => {
                  const finished = Boolean(round && round.status !== "RUNNING");
                  const open = finished || (round?.pickedIndexes.includes(tileIndex) ?? false);
                  const trap = round?.trapIndexes.includes(tileIndex) ?? false;
                  const multiplierTile = round?.multiplierTiles.find((tile) => tile.index === tileIndex);
                  const tileLabel = open
                    ? trap
                      ? `Trap tile ${tileIndex + 1}`
                      : multiplierTile
                        ? `Multiplier treasure tile ${tileIndex + 1}`
                        : `Safe treasure tile ${tileIndex + 1}`
                    : `Dig tile ${tileIndex + 1}`;
                  return (
                    <button
                      key={tileIndex}
                      type="button"
                      className={tileClass(tileIndex)}
                      disabled={!running || open}
                      onClick={() => pick(tileIndex)}
                      aria-label={tileLabel}
                    >
                      <span className="treasure-tile-face treasure-front">
                        <img className="treasure-tile-bg" src={hiddenTileAsset} alt="" draggable={false} />
                      </span>
                      <span className="treasure-tile-face treasure-back">
                        <img className="treasure-tile-bg" src={trap ? trapTileAsset : treasureTileAsset} alt="" draggable={false} />
                        {open && !trap && (
                          <img
                            className={multiplierTile ? "treasure-prize-icon multiplier-prize" : "treasure-prize-icon"}
                            src={getTreasurePrizeAsset(tileIndex, Boolean(multiplierTile))}
                            alt=""
                            draggable={false}
                          />
                        )}
                        {open && multiplierTile && (
                          <strong className="treasure-boost">
                            <Sparkles size={12} />
                            {multiplierTile.value}x
                          </strong>
                        )}
                        {open && !trap && lastOpened === tileIndex && <img className="treasure-fx treasure-burst" src={treasureBurstAsset} alt="" draggable={false} />}
                        {open && trap && lastOpened === tileIndex && <img className="treasure-fx trap-burst" src={trapBurstAsset} alt="" draggable={false} />}
                        {open && !trap && lastOpened === tileIndex && <CoinBurst count={multiplierTile ? 12 : 7} />}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <section className="treasure-dig-history">
              <LastTreasureResults values={recentResults} />
            </section>

            {round?.status === "CASHED_OUT" && (
              <GameResultBanner
                tone="win"
                title="Collected"
                amount={round.totalPaid ?? 0}
                message={`${safePicks} safe digs at ${round.currentMultiplier.toFixed(2)}x`}
                compact
              />
            )}
            {round?.status === "TRAPPED" && (
              <GameResultBanner
                tone="loss"
                title="Trap Hit"
                message={`${safePicks} safe digs before the blast`}
                compact
              />
            )}
          </section>
        </main>
      </ScreenShake>

      <section className="treasure-dig-controls">
        <section className={`treasure-risk ${riskTone}`}>
          <div className="treasure-risk-top">
            <span>Traps</span>
            <strong>{trapCount}</strong>
            <em>{riskLabel}</em>
          </div>
          <input
            aria-label="Trap count"
            type="range"
            min={treasureDigConfig.minTraps}
            max={treasureDigConfig.maxTraps}
            value={trapCount}
            disabled={running}
            onChange={(event) => updateTrapCount(Number(event.currentTarget.value))}
            onInput={(event) => updateTrapCount(Number(event.currentTarget.value))}
          />
          <div className="treasure-risk-scale" aria-hidden="true">
            <span>Low</span>
            <span>Medium</span>
            <span>High</span>
          </div>
        </section>

        <div className={balance < betAmount ? "treasure-bet-bank warning" : "treasure-bet-bank"}>
          <div className="treasure-bet-row">
            <button type="button" aria-label="Decrease bet" disabled={running} onClick={() => setBet(betAmount - betLimits.step)}><Minus size={18} /></button>
            <label>
              <span>Bet</span>
              <input
                aria-label="Bet amount"
                inputMode={currency === "BONUS" ? "decimal" : "numeric"}
                type="text"
                min={betLimits.minBet}
                max={betLimits.maxBet}
                value={betInput}
                disabled={running}
                onChange={(event) => updateBetInput(event.target.value)}
                onBlur={(event) => setBet(Number(event.target.value))}
              />
            </label>
            <button type="button" aria-label="Increase bet" disabled={running} onClick={() => setBet(betAmount + betLimits.step)}><Plus size={18} /></button>
          </div>
          <div className="treasure-bet-summary">
            <span>{currencyLabel} Balance</span>
            <strong>{formatCoins(balance)}</strong>
          </div>
        </div>

        <div className={balance < betAmount ? "treasure-note warning" : "treasure-note"}>
          <span>Min {currencyLabel}: {formatCoins(betLimits.minBet)}</span>
          <strong>Max {currencyLabel}: {formatCoins(betLimits.maxBet)}</strong>
        </div>

        <button className={running ? "treasure-main-action cashout" : "treasure-main-action"} type="button" disabled={!running && !canStart} onClick={mainAction}>
          {running ? <Zap size={18} /> : <CirclePlay size={18} />}
          <span>{running ? `Collect ${formatCoins(possiblePayout)}` : round ? "Dig Again" : "Dig"}</span>
        </button>
      </section>

      <p className="treasure-compliance-copy">{COMPLIANCE_COPY}</p>
      {rulesOpen && (
        <div className="treasure-dig-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="treasure-dig-rules" role="dialog" aria-modal="true" aria-labelledby="treasure-dig-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="treasure-dig-rules-title">Treasure Dig Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              {treasureDigConfig.rules.map((rule) => <li key={rule}>{rule}</li>)}
              <li>Collect anytime after a safe dig to lock the current payout.</li>
              <li>Prototype mode. Redemptions are not currently enabled. Gold Coins have no cash value.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function getActiveTreasureConfig(currency: Currency): TreasureDigConfig {
  const limits = treasureBetLimits[currency];
  return {
    ...treasureDigConfig,
    minBet: limits.minBet,
    maxBet: limits.maxBet,
    minBetGold: treasureBetLimits.GOLD.minBet,
    maxBetGold: treasureBetLimits.GOLD.maxBet,
    minBetRealCentsPlaceholder: treasureBetLimits.BONUS.minBet,
    maxBetRealCentsPlaceholder: treasureBetLimits.BONUS.maxBet,
  };
}

function countSafePicks(round: TreasureDigRound) {
  return round.pickedIndexes.filter((index) => !round.trapIndexes.includes(index)).length;
}

function getPreviewPayout(betAmount: number, multiplier: number, config: TreasureDigConfig) {
  return Math.min(config.maxPayout, Math.round(betAmount * multiplier * 100) / 100);
}

function getRiskTone(trapCount: number) {
  if (trapCount >= 12) return "high";
  if (trapCount >= 5) return "medium";
  return "low";
}

function getTreasurePrizeAsset(tileIndex: number, multiplierTile: boolean) {
  if (multiplierTile) return gemAsset;
  const assets = [chestAsset, gemAsset, goldAsset];
  return assets[tileIndex % assets.length];
}

function LastTreasureResults({ values }: { values: TreasureResult[] }) {
  return (
    <aside className="treasure-last-results" aria-label="Last five Treasure Dig results">
      <span>Last 5</span>
      <div>
        {values.length === 0 ? <em>--</em> : values.map((value, index) => (
          <strong key={`${value.safePicks}-${value.multiplier}-${value.paid}-${index}`} className={value.won ? "win" : "loss"}>
            {value.won ? `${value.multiplier.toFixed(2)}x` : `${value.safePicks}S`}
          </strong>
        ))}
      </div>
    </aside>
  );
}

function formatBetInput(amount: number, currency: Currency) {
  if (!Number.isFinite(amount)) return "0";
  return currency === "BONUS" ? Number(amount.toFixed(2)).toString() : Math.round(amount).toString();
}
