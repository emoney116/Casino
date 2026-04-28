import { ArrowLeft, Coins, Gauge, Info, Menu, Minus, Plus, RotateCw, Settings, ShoppingBag, Volume2, Zap } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { nextSessionStats, emptySessionStats } from "../economy/sessionStats";
import { recordMissionEvent } from "../missions/missionService";
import { recordSpinProgress } from "../progression/progressionService";
import { playBigWin, playBonus, playClick, playSpin, playWin, setMuted } from "../feedback/feedbackService";
import { BonusModal } from "./BonusModal";
import { GameLogo } from "./GameLogo";
import { Modal } from "../components/Modal";
import { PaytableModal } from "./PaytableModal";
import { frontierUiAssets } from "./frontierAssets";
import { recordRecentGame } from "./recentGames";
import { nextFreeSpinTotal } from "./slotSession";
import { buyBonusDebit, createHoldAndWinState, creditHoldAndWinBonus, creditPickBonus, generateGrid, spinSlot, stepHoldAndWinBonus } from "./slotEngine";
import { SymbolTile } from "./SymbolTile";
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

export function SlotMachine({ game, onExit }: { game: SlotConfig; onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(game.minBet);
  const [grid, setGrid] = useState(() => generateGrid(game));
  const [history, setHistory] = useState<SlotSpinResult[]>([]);
  const [spinning, setSpinning] = useState(false);
  const [turbo, setTurbo] = useState(false);
  const [sound, setSound] = useState(false);
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

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const inHoldAndWin = Boolean(holdState);
  const canSpin = !spinning && !inHoldAndWin && (freeSpins > 0 || balance >= betAmount);
  const buyBonusCost = game.buyBonus?.enabled ? Math.round(betAmount * game.buyBonus.costMultiplier) : 0;
  const canBuyBonus = !spinning && !inHoldAndWin && Boolean(game.buyBonus?.enabled) && balance >= buyBonusCost;
  const lastResult = history[0];
  const scatterCount = grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
  const bonusCount = grid.flat().filter((symbol) => symbol === game.bonusSymbol).length;
  const quickBetValues = [10, 20, 50, 100, 250].filter((value) => value <= game.maxBet);

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
  }, [game]);

  useEffect(() => {
    if (!overlayResult || overlayResult.triggeredHoldAndWin) return;
    const timeout = window.setTimeout(() => setOverlayResult(null), overlayResult.winTier === "MEGA" ? 2600 : 1800);
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
      setOverlayResult({
        ...result,
        payout: 0,
        winType: "HOLD_AND_WIN",
        winTier: "BIG",
      });
    } else if (result.triggeredBonus) {
      setBonusResult(result);
      setOverlayResult(result.payout > 0 ? result : null);
    } else {
      setOverlayResult(result.payout > 0 ? result : null);
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
    const progress = recordSpinProgress({
      userId: currentUser.id,
      wager: result.wager,
      won: result.payout,
      bonusTriggered: result.triggeredBonus,
    });
    const completed = recordMissionEvent({
      userId: currentUser.id,
      gameId: game.id,
      wager: result.wager,
      won: result.payout,
      bonusTriggered: result.triggeredBonus,
      leveledUp: progress.leveledUp,
    });
    setSessionStats((stats) => nextSessionStats(stats, result.wager, result.payout));
    if (progress.leveledUp) notify(`Level ${progress.level}! ${formatCoins(progress.reward)} Bonus Coins credited.`, "success");
    if (completed.length > 0) notify(`Mission complete: ${completed[0]}`, "success");
    if (result.triggeredBonus) playBonus();
    else if (result.winTier === "BIG" || result.winTier === "MEGA") playBigWin();
    else if (result.payout > 0) playWin();
  }

  function spin() {
    if (!canSpin) {
      setUiState("Error/Insufficient Balance");
      return;
    }

    setSpinning(true);
    playClick();
    playSpin();
    setUiState("Spinning");
    setOverlayResult(null);
    setAnticipating(false);
    const usedFreeSpin = freeSpins > 0;
    const delay = turbo ? 260 : 980;
    const interval = window.setInterval(() => setGrid(generateGrid(game)), turbo ? 55 : 85);
    window.setTimeout(() => setAnticipating(true), turbo ? 90 : 420);
    window.setTimeout(() => {
      window.clearInterval(interval);
      setUiState("Evaluating");
      setAnticipating(false);
      window.setTimeout(() => {
        try {
          const result = spinSlot({ user: currentUser, game, currency, betAmount, freeSpin: usedFreeSpin });
          updateAfterSpin(result, usedFreeSpin);
          if (result.winTier === "BIG" || result.winTier === "MEGA") {
            notify(`${result.winTier} demo win credited.`, "success");
          }
        } catch (caught) {
          setUiState("Error/Insufficient Balance");
          notify(caught instanceof Error ? caught.message : "Spin failed.", "error");
        } finally {
          setSpinning(false);
        }
      }, turbo ? 120 : 280);
    }, delay);
  }

  function resolveBuyBonus() {
    try {
      if (!game.buyBonus?.enabled) throw new Error("Buy bonus is not available.");
      if (balance < buyBonusCost) throw new Error("Insufficient balance.");
      setSpinning(true);
      setUiState("Bonus Triggered");
      buyBonusDebit({ user: currentUser, game, currency, betAmount });
      setHoldState(createHoldAndWinState(game, betAmount, 4));
      setHoldBought(true);
      setOverlayResult(null);
      setUiState("Hold And Win");
      refreshUser();
      recordRecentGame(game.id);
      setSessionStats((stats) => nextSessionStats(stats, buyBonusCost, 0));
      notify("Demo bonus buy started. Virtual coins only.", "success");
      playBonus();
    } catch (caught) {
      setUiState("Error/Insufficient Balance");
      notify(caught instanceof Error ? caught.message : "Bonus buy failed.", "error");
    } finally {
      setBuyBonusOpen(false);
      setSpinning(false);
    }
  }

  function respinHoldAndWin() {
    if (!holdState || bonusBusy) return;
    setBonusBusy(true);
    window.setTimeout(() => {
      const next = stepHoldAndWinBonus(game, betAmount, holdState);
      setHoldState(next);
      if (next.lastNewCoins.length > 0) notify(`${next.lastNewCoins.length} new coin${next.lastNewCoins.length === 1 ? "" : "s"} locked. Respins reset.`, "success");
      if (next.finished) {
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
          refreshUser();
          setSessionStats((stats) => nextSessionStats(stats, 0, next.total));
          notify(`Hold and Win paid ${formatCoins(next.total)} virtual coins.`, "success");
          playBigWin();
          setHoldState(null);
          setHoldBought(false);
        } catch (caught) {
          notify(caught instanceof Error ? caught.message : "Bonus credit failed.", "error");
        }
      }
      setBonusBusy(false);
    }, 520);
  }

  function closeHoldAndWin() {
    setHoldState(null);
    setHoldBought(false);
    setUiState("Idle");
  }

  return (
    <section
      className={`slot-screen premium-slot-shell ${game.visual.background ?? ""}`}
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

      <div className="slot-board">
        <div className="slot-side-menu">
          <button className="ghost-button icon-only" title="Menu"><Menu size={18} /></button>
          <button className="ghost-button icon-only" onClick={() => setPaytableOpen(true)} title="Info"><Info size={18} /></button>
          <button className={sound ? "ghost-button icon-only active" : "ghost-button icon-only"} onClick={() => setSound((value) => {
            setMuted(value);
            return !value;
          })} title="Sound"><Volume2 size={18} /></button>
        </div>
        <div className="slot-state-pill">
          <span>{uiState}</span>
          {anticipating && (scatterCount >= 2 || bonusCount >= 2) && <strong>Feature close...</strong>}
          {lastResult?.holdAndWin && <strong>Hold and Win total {formatCoins(lastResult.holdAndWin.total)}</strong>}
          {lastResult?.wheelBonus && <strong>Wheel landed {lastResult.wheelBonus.segment}</strong>}
        </div>
        <div className={`reel-stage frontier-reel-stage ${lastResult?.payout ? "winning" : ""} ${holdState ? "hold-mode" : ""}`}>
          {holdState ? (
            <div className="hold-and-win-board">
              <div className="hold-title">
                <strong>HOLD AND WIN</strong>
                <span>{holdState.finished ? "Bonus Complete" : `${holdState.respinsRemaining} respins remaining`}</span>
              </div>
              <div className="hold-grid">
                {holdState.values.map((value, index) => (
                  <div className={`hold-cell ${value ? "locked" : ""} ${holdState.lastNewCoins.includes(index) ? "new" : ""}`} key={index}>
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
              <div className="hold-total">
                <span>Bonus Total</span>
                <strong>{formatCoins(holdState.total)}</strong>
              </div>
              <div className="hold-hint">
                Press RESPIN in the control bar. New relic coins reset respins to 3.
              </div>
            </div>
          ) : (
            <>
              {game.paylines.map((payline) => (
                <div
                  className={`payline-trace ${lastResult?.lineWins.some((win) => win.paylineId === payline.id) ? "active" : ""} ${payline.id}`}
                  key={payline.id}
                />
              ))}
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
                      key={`${reel}-${row}-${symbolId}`}
                    />
                  );
                }),
              )}
            </>
          )}
          {overlayResult ? (
            <button className={`big-win-overlay ${overlayResult.winTier.toLowerCase()}`} onClick={() => setOverlayResult(null)}>
              {overlayResult.triggeredHoldAndWin ? (overlayResult.payout > 0 ? "Hold And Win Complete" : "Bonus Triggered") : overlayResult.triggeredWheelBonus ? "Wheel Bonus" : overlayResult.winTier === "MEGA" ? "Mega Win" : overlayResult.winTier === "BIG" ? "Big Win" : "Win"}
              <span>{formatCoins(overlayResult.payout)}</span>
              {overlayResult.jackpotLabel && <small>{overlayResult.jackpotLabel} demo jackpot</small>}
              {overlayResult.holdAndWin && <small>Respin rounds: {overlayResult.holdAndWin.respinRounds.length}</small>}
              {overlayResult.wheelBonus && <small>Wheel segment: {overlayResult.wheelBonus.segment}</small>}
              {(overlayResult.winTier === "BIG" || overlayResult.winTier === "MEGA") && <div className="coin-burst" />}
              {overlayResult.winTier === "MEGA" && <div className="confetti-burst" />}
            </button>
          ) : null}
        </div>

        <aside className="slot-controls card">
          <div className="slot-control-bar">
            <div className="control-readout">
              <span>Balance</span>
              <strong>{formatCoins(balance)}</strong>
              <small>{currency} Coins</small>
              <div className="currency-mini">
                <button className={currency === "GOLD" ? "active" : ""} onClick={() => setCurrency("GOLD")}>Gold</button>
                <button className={currency === "BONUS" ? "active" : ""} onClick={() => setCurrency("BONUS")}>Bonus</button>
              </div>
            </div>
            <div className="bet-readout">
              <span>Bet</span>
              <div>
                <button className="round-control" disabled={inHoldAndWin} onClick={() => setBetAmount((value) => Math.max(game.minBet, value - game.minBet))}>
                  <Minus size={16} />
                </button>
                <strong>{formatCoins(betAmount)}</strong>
                <button className="round-control" disabled={inHoldAndWin} onClick={() => setBetAmount((value) => Math.min(game.maxBet, value + game.minBet))}>
                  <Plus size={16} />
                </button>
              </div>
              <div className="premium-quick-bets">
                {quickBetValues.map((value) => (
                  <button
                    className={betAmount === value ? "active" : ""}
                    disabled={value < game.minBet || inHoldAndWin}
                    onClick={() => setBetAmount(value)}
                    key={value}
                  >
                    {formatCoins(value)}
                  </button>
                ))}
              </div>
            </div>
            <button
              className={`slot-main-action ${inHoldAndWin ? "respin" : ""}`}
              disabled={inHoldAndWin ? bonusBusy : !canSpin}
              onClick={inHoldAndWin ? respinHoldAndWin : spin}
            >
              {inHoldAndWin ? (bonusBusy ? "..." : <RotateCw size={34} />) : spinning ? "..." : <RotateCw size={42} />}
              <span>{inHoldAndWin ? "Respin" : "Spin"}</span>
            </button>
          </div>
          {game.buyBonus?.enabled && (
            <button className="buy-bonus-button premium-buy-bonus" disabled={!canBuyBonus} onClick={() => setBuyBonusOpen(true)}>
              <Coins size={22} />
              <span>Buy Bonus</span>
              <strong>{formatCoins(buyBonusCost)}</strong>
            </button>
          )}
          <div className="premium-control-icons">
            <button className="ghost-button icon-only" title="Menu"><img src={frontierUiAssets.iconMenu} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><Menu size={18} /></button>
            <button className="ghost-button icon-only" onClick={() => setPaytableOpen(true)} title="Info"><img src={frontierUiAssets.iconInfo} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><Info size={18} /></button>
            <button className={sound ? "ghost-button icon-only active" : "ghost-button icon-only"} onClick={() => setSound((value) => {
              setMuted(value);
              return !value;
            })} title="Sound"><img src={frontierUiAssets.iconSound} alt="" onError={(event) => event.currentTarget.parentElement?.classList.add("asset-missing")} /><Volume2 size={18} /></button>
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
          <div className="demo-copy">Virtual coins only. No cash value, prizes, withdrawals, or redemption.</div>
          <div className="toggle-row">
            <button className={turbo ? "ghost-button active" : "ghost-button"} onClick={() => setTurbo((value) => !value)}>
              <Zap size={15} /> Turbo
            </button>
            <button className={sound ? "ghost-button active" : "ghost-button"} onClick={() => setSound((value) => {
              setMuted(value);
              return !value;
            })}>
              <Volume2 size={15} /> Sound
            </button>
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
        <Modal title="Demo Bonus Buy" onClose={() => setBuyBonusOpen(false)}>
          <div className="modal-stack">
            <p className="muted">Demo bonus buy only. Virtual coins have no cash value.</p>
            <div className="notice-card">
              Cost: {formatCoins(buyBonusCost)} {currency}. Feature: {game.buyBonus?.featureType.replaceAll("_", " ")}.
            </div>
            <p>No real money, withdrawals, prizes, redemptions, or cashout are available in this prototype.</p>
            <div className="modal-actions">
              <button className="ghost-button" onClick={() => setBuyBonusOpen(false)}>Cancel</button>
              <button className="primary-button" disabled={!canBuyBonus} onClick={resolveBuyBonus}>Start Demo Bonus</button>
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
            notify(`Pick bonus credited: ${formatCoins(award)} virtual coins.`, "success");
          }}
          onClose={() => setBonusResult(null)}
        />
      )}
    </section>
  );
}

