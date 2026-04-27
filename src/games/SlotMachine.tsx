import { Gauge, Info, ShoppingBag, Volume2, Zap } from "lucide-react";
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
import { PaytableModal } from "./PaytableModal";
import { recordRecentGame } from "./recentGames";
import { nextFreeSpinTotal } from "./slotSession";
import { creditPickBonus, generateGrid, spinSlot } from "./slotEngine";
import { SymbolTile } from "./SymbolTile";
import type { SlotConfig, SlotSpinResult } from "./types";

type SlotUiState =
  | "Idle"
  | "Spinning"
  | "Evaluating"
  | "Win"
  | "Bonus Triggered"
  | "Free Spins"
  | "Pick Bonus"
  | "Error/Insufficient Balance";

export function SlotMachine({ game }: { game: SlotConfig }) {
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
  const [bonusResult, setBonusResult] = useState<SlotSpinResult | null>(null);
  const [uiState, setUiState] = useState<SlotUiState>("Idle");
  const [anticipating, setAnticipating] = useState(false);
  const [overlayResult, setOverlayResult] = useState<SlotSpinResult | null>(null);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const canSpin = !spinning && (freeSpins > 0 || balance >= betAmount);
  const lastResult = history[0];
  const scatterCount = grid.flat().filter((symbol) => symbol === game.scatterSymbol).length;
  const bonusCount = grid.flat().filter((symbol) => symbol === game.bonusSymbol).length;

  useEffect(() => {
    setBetAmount(game.minBet);
    setGrid(generateGrid(game));
    setHistory([]);
    setFreeSpins(0);
    setFreeSpinTotal(0);
    setBonusMeter(0);
    setUiState("Idle");
    setOverlayResult(null);
  }, [game]);

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
    if (result.triggeredBonus) setBonusResult(result);
    setOverlayResult(result.payout > 0 ? result : null);
    setUiState(
      result.triggeredPickBonus
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

  return (
    <section
      className="slot-screen"
      style={{ "--accent": game.visual.accent, "--secondary": game.visual.secondary, "--panel": game.visual.panel } as React.CSSProperties}
    >
      <div className="slot-header">
        <div className="game-heading">
          <GameLogo game={game} small />
          <div>
            <p className="eyebrow">{game.theme}</p>
            <h1>{game.name}</h1>
            <p className="muted">
              {game.waysToWin} | {game.volatility} volatility | Target RTP {(game.targetRtp * 100).toFixed(1)}% | Demo only
            </p>
          </div>
        </div>
        <button className="ghost-button icon-button" onClick={() => setPaytableOpen(true)}>
          <Info size={17} />
          Paytable
        </button>
      </div>

      <div className="slot-board">
        <div className="slot-state-pill">
          <span>{uiState}</span>
          {anticipating && (scatterCount >= 2 || bonusCount >= 2) && <strong>Feature close...</strong>}
        </div>
        <div className={`reel-stage ${lastResult?.payout ? "winning" : ""}`}>
          {game.paylines.map((payline) => (
            <div
              className={`payline-trace ${lastResult?.lineWins.some((win) => win.paylineId === payline.id) ? "active" : ""} ${payline.id}`}
              key={payline.id}
            />
          ))}
          {Array.from({ length: game.rowCount }, (_, row) =>
            Array.from({ length: game.reelCount }, (_, reel) => {
              const symbolId = grid[reel]?.[row] ?? game.symbols[0].id;
              const active = Boolean(lastResult?.winningPositions.some((position) => position.reel === reel && position.row === row));
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
          {overlayResult ? (
            <div className={`big-win-overlay ${overlayResult.winTier.toLowerCase()}`}>
              {overlayResult.winTier === "MEGA" ? "Mega Win" : overlayResult.winTier === "BIG" ? "Big Win" : "Small Win"}
              <span>{formatCoins(overlayResult.payout)}</span>
              {(overlayResult.winTier === "BIG" || overlayResult.winTier === "MEGA") && <div className="coin-burst" />}
              {overlayResult.winTier === "MEGA" && <div className="confetti-burst" />}
            </div>
          ) : null}
        </div>

        <aside className="slot-controls card">
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
          <div className="bet-stepper">
            <button className="ghost-button" onClick={() => setBetAmount(game.minBet)}>Min</button>
            <button className="ghost-button" onClick={() => setBetAmount((value) => Math.max(game.minBet, value - game.minBet))}>-</button>
            <button className="ghost-button" onClick={() => setBetAmount((value) => Math.min(game.maxBet, value + game.minBet))}>+</button>
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
          <button className="spin-button" disabled={!canSpin} onClick={spin}>
            {spinning ? uiState : freeSpins > 0 ? "Free Spin" : "Spin"}
          </button>
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
