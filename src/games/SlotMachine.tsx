import { ArrowLeft, Coins, Gauge, Info, Menu, Minus, Plus, RotateCw, Settings, ShoppingBag, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
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
import { buyBonusDebit, createHoldAndWinState, creditHoldAndWinBonus, creditPickBonus, generateGrid, spinSlot, stepHoldAndWinBonus } from "./slotEngine";
import { SymbolTile } from "./SymbolTile";
import type { ReelVisualState, SlotAnimationState } from "./slotAnimation";
import type { HoldAndWinState, SlotConfig, SlotSpinResult } from "./types";

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

function coinImageFor(value: number) {
  if (value >= 1000) return "/assets/symbols/frontier/coin_1000.png";
  if (value >= 500) return "/assets/symbols/frontier/coin_500.png";
  if (value >= 250) return "/assets/symbols/frontier/coin_250.png";
  return "/assets/symbols/frontier/coin_100.png";
}

export function getBonusChanceTier(betAmount: number, game: SlotConfig) {
  const range = Math.max(1, game.maxBet - game.minBet);
  const progress = (betAmount - game.minBet) / range;
  if (progress >= 0.68) return "Best";
  if (progress >= 0.28) return "Better";
  return "Low";
}

export function getBuyBonusCost(betAmount: number, game: SlotConfig) {
  return game.buyBonus?.enabled ? Math.round(betAmount * game.buyBonus.costMultiplier) : 0;
}

export function getBetOptions(game: SlotConfig) {
  const options = new Set<number>([game.minBet, game.maxBet]);
  for (let value = game.minBet; value <= game.maxBet; value += game.minBet) {
    options.add(value);
  }
  [100, 150, 200, 250, 300, 400, 500, 750, 1000].forEach((value) => {
    if (value >= game.minBet && value <= game.maxBet) options.add(value);
  });
  return [...options].sort((a, b) => a - b);
}

export function SlotMachine({ game, onExit }: { game: SlotConfig; onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(game.minBet);
  const [grid, setGrid] = useState(() => generateGrid(game));
  const [history, setHistory] = useState<SlotSpinResult[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [sessionStats, setSessionStats] = useState(emptySessionStats);
  const [freeSpins, setFreeSpins] = useState(0);
  const [freeSpinTotal, setFreeSpinTotal] = useState(0);
  const [bonusMeter, setBonusMeter] = useState(0);
  const [paytableOpen, setPaytableOpen] = useState(false);
  const [buyBonusOpen, setBuyBonusOpen] = useState(false);
  const [bonusResult, setBonusResult] = useState<SlotSpinResult | null>(null);
  const [uiState, setUiState] = useState<SlotUiState>("Idle");
  const [anticipating, setAnticipating] = useState(false);
  const [overlayResult, setOverlayResult] = useState<SlotSpinResult | null>(null);
  const [holdState, setHoldState] = useState<HoldAndWinState | null>(null);
  const [holdBought, setHoldBought] = useState(false);
  const [bonusBusy, setBonusBusy] = useState(false);
  const [logoReady, setLogoReady] = useState(true);
  const [holdFeedback, setHoldFeedback] = useState("");
  const [animationState, setAnimationState] = useState<SlotAnimationState>("idle");
  const [reelStates, setReelStates] = useState<ReelVisualState[]>(() => Array.from({ length: game.reelCount }, () => "idle"));
  const [betMenuOpen, setBetMenuOpen] = useState(false);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const inHoldAndWin = Boolean(holdState);
  const canSpin = !spinning && !inHoldAndWin && (freeSpins > 0 || balance >= betAmount);
  const buyBonusCost = getBuyBonusCost(betAmount, game);
  const canBuyBonus = !spinning && !inHoldAndWin && Boolean(game.buyBonus?.enabled) && balance >= buyBonusCost;
  const lastResult = history[0];
  const scatterCount = grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
  const bonusCount = grid.flat().filter((symbol) => symbol === game.bonusSymbol).length;
  const betOptions = getBetOptions(game);
  const activePaylines = new Set(lastResult?.lineWins.map((win) => win.paylineId) ?? []);
  const modeLabel =
    animationState === "bonusRespinning"
      ? "Respinning"
      : animationState === "bonusComplete"
        ? "Complete"
        : inHoldAndWin
          ? "Hold And Win"
          : uiState === "Spinning" || uiState === "Evaluating"
            ? turbo
              ? "Fast Spin"
              : "Normal Spin"
            : uiState;

  useEffect(() => {
    setBetAmount(game.minBet);
    setGrid(generateGrid(game));
    setHistory([]);
    setFreeSpins(0);
    setFreeSpinTotal(0);
    setBonusMeter(0);
    setUiState("Idle");
    setOverlayResult(null);
    setHoldState(null);
    setHoldBought(false);
    setHoldFeedback("");
    setAnimationState("idle");
    setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
    setBetMenuOpen(false);
  }, [game]);

  const overlayIsBig = overlayResult?.winTier === "BIG" || overlayResult?.winTier === "MEGA";

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
    setBonusMeter((current) => (result.triggeredBonus ? 0 : Math.min(100, current + game.bonusFeature.meterPerSpin)));
    if (usedFreeSpin) {
      setFreeSpins((count) => Math.max(0, count - 1));
      setFreeSpinTotal((total) => nextFreeSpinTotal(total, result));
    }
    if (result.freeSpinsAwarded > 0) {
      setFreeSpins((count) => count + result.freeSpinsAwarded);
      setFreeSpinTotal(0);
    }
    if (result.triggeredHoldAndWin) {
      setHoldState(createHoldAndWinState(game, betAmount, 3));
      setHoldBought(false);
      setHoldFeedback("Press RESPIN. New coins reset respins to 3.");
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
      result.triggeredHoldAndWin
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

  function spin() {
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
    const mode = turbo ? "fast" : "normal";
    const timing = slotAnimation[mode];
    const stoppedReels = new Set<number>();
    let result: SlotSpinResult;
    try {
      result = spinSlot({ user: currentUser, game, currency, betAmount, freeSpin: usedFreeSpin });
    } catch (caught) {
      setSpinning(false);
      setAnimationState("idle");
      setReelStates(Array.from({ length: game.reelCount }, () => "idle"));
      setUiState("Error/Insufficient Balance");
      notify(caught instanceof Error ? caught.message : "Spin failed.", "error");
      playError();
      return;
    }
    const interval = window.setInterval(() => {
      const sample = generateGrid(game);
      setGrid((current) => current.map((reel, index) => (stoppedReels.has(index) ? reel : sample[index] ?? reel)));
    }, timing.cycleMs);
    window.setTimeout(() => setAnticipating(true), timing.anticipationMs);
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

  function resolveBuyBonus() {
    try {
      if (!game.buyBonus?.enabled) throw new Error("Buy bonus is not available.");
      if (balance < buyBonusCost) throw new Error("Insufficient balance.");
      setSpinning(true);
      setUiState("Bonus Triggered");
      setAnimationState("bonusReveal");
      buyBonusDebit({ user: currentUser, game, currency, betAmount });
      setHoldState(createHoldAndWinState(game, betAmount, 4));
      setHoldBought(true);
      setHoldFeedback("Press RESPIN. New coins reset respins to 3.");
      setOverlayResult(null);
      setUiState("Hold And Win");
      window.setTimeout(() => setAnimationState("bonusIdle"), slotAnimation.bonus.revealMs);
      refreshUser();
      recordRecentGame(game.id);
      setSessionStats((stats) => nextSessionStats(stats, buyBonusCost, 0));
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
      className={`slot-screen premium-slot-shell ${game.visual.background ?? ""} ${inHoldAndWin ? "bonus-active" : ""} animation-${animationState}`}
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
            <p className="eyebrow">{game.theme}</p>
            <h1 className={logoReady ? "asset-backed" : ""}>{game.name}</h1>
            <p className="muted">
              {game.waysToWin} | {game.volatility} volatility | Target RTP {(game.targetRtp * 100).toFixed(1)}% | Demo only
            </p>
          </div>
        </div>
        <div className="slot-header-actions">
          <button className="ghost-button icon-button" onClick={() => setPaytableOpen(true)}>
            <Info size={17} />
            Info
          </button>
          <button className="ghost-button icon-only" title="Settings placeholder">
            <Settings size={17} />
          </button>
        </div>
      </div>
      <div className="jackpot-banner">
        <span>Max {game.maxPayoutMultiplier}x</span>
        {game.jackpotLabels ? (
          <>
            <strong><img src={frontierUiAssets.jackpotGrand} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><span>Grand {game.jackpotLabels.Grand}</span></strong>
            <strong><img src={frontierUiAssets.jackpotMajor} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><span>Major {game.jackpotLabels.Major}</span></strong>
            <strong><img src={frontierUiAssets.jackpotMinor} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><span>Minor {game.jackpotLabels.Minor}</span></strong>
            <strong><img src={frontierUiAssets.jackpotMini} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><span>Mini {game.jackpotLabels.Mini}</span></strong>
          </>
        ) : (
          <strong>Demo progressive cap {game.maxPayoutMultiplier}x</strong>
        )}
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
          {anticipating && (scatterCount >= 2 || bonusCount >= 2) && <strong>Feature close...</strong>}
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
        <div className={`reel-stage frontier-reel-stage ${lastResult?.payout ? "winning" : ""} ${holdState ? "hold-mode" : ""}`}>
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
                        <img src={coinImageFor(value)} alt="" />
                        <strong>{formatCoins(value)}</strong>
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
                      spinning={spinning}
                      reelState={reelStates[reel] ?? "idle"}
                      reelIndex={reel}
                      key={`${reel}-${row}`}
                    />
                  );
                }),
              )}
            </>
          )}
          <WinOverlay
            show={Boolean(overlayResult)}
            title={overlayResult?.triggeredHoldAndWin ? (overlayResult.payout > 0 ? "Hold And Win Complete" : "Bonus Triggered") : overlayResult?.triggeredWheelBonus ? "Wheel Bonus" : overlayResult?.winTier === "MEGA" ? "Mega Win" : overlayResult?.winTier === "BIG" ? "Big Win" : "Win"}
            amount={overlayResult?.payout ?? 0}
            big={overlayIsBig}
            bonus={Boolean(overlayResult?.triggeredBonus)}
            onDismiss={() => setOverlayResult(null)}
          >
            {overlayResult?.holdAndWin ? `Respin rounds: ${overlayResult.holdAndWin.respinRounds.length}` : overlayResult?.wheelBonus ? `Wheel segment: ${overlayResult.wheelBonus.segment}` : null}
          </WinOverlay>
        </div>

        <div className="reel-bonus-action">
          {game.buyBonus?.enabled && !inHoldAndWin && (
            <button
              className="bonus-feature-icon"
              disabled={spinning}
              onClick={() => {
                if (!canBuyBonus) {
                  notify("Insufficient balance for this demo bonus buy.", "error");
                  playError();
                  return;
                }
                setBuyBonusOpen(true);
              }}
              aria-label={`Bonus ${formatCoins(buyBonusCost)}`}
            >
              <span className="bonus-feature-art" aria-hidden="true">
                <Coins size={24} />
              </span>
            </button>
          )}
        </div>

        <aside className="slot-controls card">
          <div className="slot-control-bar">
            <div className="control-readout">
              <span>Balance</span>
              <strong>{formatCoins(balance)}</strong>
              <small>{currency} Coins</small>
              <div className="currency-mini">
                <button className={currency === "GOLD" ? "active" : ""} disabled={inHoldAndWin} onClick={() => setCurrency("GOLD")}>Gold</button>
                <button className={currency === "BONUS" ? "active" : ""} disabled={inHoldAndWin} onClick={() => setCurrency("BONUS")}>Bonus</button>
              </div>
            </div>
            <div className="bet-readout">
              <span>Bet</span>
              <div>
                <button className="round-control" disabled={inHoldAndWin} onClick={() => setBetAmount((value) => Math.max(game.minBet, value - game.minBet))}>
                  <Minus size={16} />
                </button>
                <button className="bet-amount-trigger" disabled={inHoldAndWin} onClick={() => setBetMenuOpen((value) => !value)}>
                  {formatCoins(betAmount)}
                </button>
                <button className="round-control" disabled={inHoldAndWin} onClick={() => setBetAmount((value) => Math.min(game.maxBet, value + game.minBet))}>
                  <Plus size={16} />
                </button>
              </div>
              <div className="premium-bet-menu" aria-hidden={!betMenuOpen}>
                {betMenuOpen && (
                  <div className="bet-size-popover">
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
                )}
              </div>
            </div>
            <button
              className={`slot-main-action ${inHoldAndWin ? "respin" : ""}`}
              disabled={inHoldAndWin ? bonusBusy || holdState?.finished : !canSpin}
              onClick={inHoldAndWin ? respinHoldAndWin : spin}
            >
              {inHoldAndWin ? (bonusBusy ? "..." : <RotateCw size={42} />) : spinning ? "..." : <RotateCw size={42} />}
              <span>{inHoldAndWin ? "Respin" : "Spin"}</span>
            </button>
          </div>
          <div className="premium-control-icons">
            <button className={turbo ? "speed-toggle active" : "speed-toggle"} disabled={inHoldAndWin || spinning} onClick={() => setTurbo((value) => !value)}>
              <Zap size={15} />
              <span>{turbo ? "Fast Spin" : "Normal Spin"}</span>
            </button>
            <button className="ghost-button icon-only" title="Menu"><img src={frontierUiAssets.iconMenu} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><Menu size={18} /></button>
            <button className="ghost-button icon-only" onClick={() => setPaytableOpen(true)} title="Info"><img src={frontierUiAssets.iconInfo} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><Info size={18} /></button>
            <SoundToggle className="ghost-button icon-only" compact />
          </div>
          <div className="segmented small">
            <button className={currency === "GOLD" ? "active" : ""} onClick={() => setCurrency("GOLD")}>
              Gold
            </button>
            <button className={currency === "BONUS" ? "active" : ""} onClick={() => setCurrency("BONUS")}>
              Bonus
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
            <button className="ghost-button" onClick={() => setBetAmount(game.minBet)}>Min</button>
            <button className="ghost-button" onClick={() => setBetAmount((value) => Math.max(game.minBet, value - game.minBet))}><Minus size={16} /></button>
            <button className="ghost-button" onClick={() => setBetAmount((value) => Math.min(game.maxBet, value + game.minBet))}><Plus size={16} /></button>
            <button className="ghost-button" onClick={() => setBetAmount(game.maxBet)}>Max</button>
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
          <button className="spin-button" disabled={inHoldAndWin ? bonusBusy : !canSpin} onClick={inHoldAndWin ? respinHoldAndWin : spin}>
            {inHoldAndWin ? (bonusBusy ? "Respinning" : "Respin") : spinning ? uiState : freeSpins > 0 ? "Free Spin" : "Spin"}
          </button>
          {game.buyBonus?.enabled && (
            <button className="buy-bonus-button" disabled={!canBuyBonus} onClick={() => setBuyBonusOpen(true)}>
              Buy Bonus {formatCoins(buyBonusCost)}
            </button>
          )}
          {balance < betAmount && freeSpins === 0 && <div className="error-box">Balance is too low for this bet.</div>}
          {balance < game.minBet && freeSpins === 0 && (
            <button className="primary-button icon-button" onClick={() => notify("Open Wallet to get more demo coins.", "info")}>
              <ShoppingBag size={16} /> Get More Demo Coins
            </button>
          )}
          <div className="demo-copy game-compliance-copy">{COMPLIANCE_COPY}</div>
          <div className="toggle-row">
            <button className={turbo ? "ghost-button active" : "ghost-button"} onClick={() => setTurbo((value) => !value)}>
              <Zap size={15} /> Turbo
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
        <Modal title="Start Hold and Win?" onClose={() => setBuyBonusOpen(false)}>
          <div className="modal-stack premium-bonus-modal">
            <div className="bonus-modal-token">
              <Coins size={36} />
            </div>
            <p className="muted">{COMPLIANCE_COPY}</p>
            <div className="notice-card bonus-cost-card">
              <span>Cost</span>
              <strong>{formatCoins(buyBonusCost)} {currency}</strong>
              <small>Feature: {game.buyBonus?.featureType.replaceAll("_", " ")}</small>
            </div>
            {!canBuyBonus && <div className="error-box">Insufficient balance for this demo bonus buy.</div>}
            <p>{COMPLIANCE_COPY}</p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setBuyBonusOpen(false)}>Cancel</button>
              <button className="primary-button" disabled={!canBuyBonus} onClick={resolveBuyBonus}>Confirm</button>
            </div>
          </div>
        </Modal>
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

