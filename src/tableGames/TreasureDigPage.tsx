import { useMemo, useState, type CSSProperties } from "react";
import { Bomb, Gem, Shovel } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, ScreenShake, SoundToggle } from "../feedback/components";
import { playBet, playCardFlip, playError, playLose, playWin } from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { treasureDigConfig } from "./configs";
import { cashOutTreasureDigRound, clampTreasureTrapCount, getTreasureDigMultiplier, pickTreasureTile, startTreasureDigRound } from "./treasureDigEngine";
import type { TreasureDigRound } from "./types";

const quickBets = [10, 25, 50, 100, 500];

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
  revealBoardOnFinish: true,
  compactFinishedResult: true,
  compactBottomBetControls: true,
};

export function TreasureDigPage({ onExit }: { onExit?: () => void }) {
  const { user } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(treasureDigConfig.minBet);
  const [betInput, setBetInput] = useState(String(treasureDigConfig.minBet));
  const [trapCount, setTrapCount] = useState(3);
  const [round, setRound] = useState<TreasureDigRound | null>(null);
  const [lastOpened, setLastOpened] = useState<number | null>(null);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const running = round?.status === "RUNNING";
  const safePicks = round?.pickedIndexes.filter((index) => !round.trapIndexes.includes(index)).length ?? 0;
  const multiplier = round?.currentMultiplier ?? getTreasureDigMultiplier({ safePicks: 0, trapCount });
  const nextMultiplier = running ? getTreasureDigMultiplier({ safePicks: safePicks + 1, trapCount: round.trapCount }) : getTreasureDigMultiplier({ safePicks: 1, trapCount });
  const activeBetAmount = round ? round.betAmount : betAmount;
  const possiblePayout = Math.min(treasureDigConfig.maxPayout, Math.round(activeBetAmount * multiplier));
  const maxSafePicks = treasureDigConfig.gridSize * treasureDigConfig.gridSize - trapCount;
  const maxWin = Math.min(
    treasureDigConfig.maxPayout,
    Math.round(betAmount * getTreasureDigMultiplier({ safePicks: maxSafePicks, trapCount })),
  );
  const canStart = !running && betAmount >= treasureDigConfig.minBet && betAmount <= treasureDigConfig.maxBet && balance >= betAmount;
  const tileCount = treasureDigConfig.gridSize * treasureDigConfig.gridSize;
  const tiles = useMemo(() => Array.from({ length: tileCount }, (_, index) => index), [tileCount]);

  function clampBet(value: number) {
    return Math.max(treasureDigConfig.minBet, Math.min(treasureDigConfig.maxBet, Math.round(value)));
  }

  function setBet(value: number) {
    const next = clampBet(value);
    setBetAmount(next);
    setBetInput(String(next));
  }

  function updateBetInput(value: string) {
    setBetInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setBetAmount(Math.max(0, Math.min(treasureDigConfig.maxBet, Math.round(parsed))));
  }

  function start() {
    try {
      const next = startTreasureDigRound({ userId: currentUser.id, currency, betAmount, trapCount });
      setRound(next);
      setLastOpened(null);
      playBet();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to start Treasure Dig.", "error");
      playError();
    }
  }

  function pick(tileIndex: number) {
    if (!round || round.status !== "RUNNING" || round.pickedIndexes.includes(tileIndex)) return;
    try {
      const next = pickTreasureTile({ round, userId: currentUser.id, tileIndex });
      setRound(next);
      setLastOpened(tileIndex);
      playCardFlip();
      if (next.status === "TRAPPED") {
        playLose();
      }
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to open tile.", "error");
      playError();
    }
  }

  function cashOut() {
    if (!round || round.status !== "RUNNING") return;
    const next = cashOutTreasureDigRound({ round, userId: currentUser.id });
    setRound(next);
    playWin();
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
    if (!open) return "treasure-tile hidden";
    return `treasure-tile open ${trap ? "trap" : "safe"} ${finished && !round.pickedIndexes.includes(tileIndex) ? "revealed" : ""} ${lastOpened === tileIndex ? "fresh" : ""}`.trim();
  }

  return (
    <section className={`treasure-dig-page ${round?.status === "TRAPPED" ? "trapped" : ""}`}>
      <header className="treasure-dig-header">
        <button className="treasure-dig-back" onClick={onExit} aria-label="Back to games">&lt;</button>
        <div className="treasure-dig-title">
          <h1>Treasure Dig <span aria-hidden="true"><Shovel size={15} /></span></h1>
          <p>Find treasure. Dodge traps. Virtual coins only.</p>
        </div>
        <div className="treasure-dig-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={running} onClick={() => setCurrency("GOLD")}>Gold</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={running} onClick={() => setCurrency("BONUS")}>Bonus</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <div className="treasure-dig-balance">
        <span>Balance: {formatCoins(balance)}</span>
        <strong>{currency === "GOLD" ? "Gold" : "Bonus"} Bet: {formatCoins(betAmount)}</strong>
      </div>

      <ScreenShake active={round?.status === "TRAPPED"}>
        <main className="treasure-dig-stage">
          <section className="treasure-dig-stats" aria-live="polite">
            <div><span>Multiplier</span><strong className="treasure-dig-multiplier">{multiplier.toFixed(2)}x</strong></div>
            <div><span>Next safe</span><strong>{nextMultiplier.toFixed(2)}x</strong></div>
            <div><span>Payout</span><strong>{formatCoins(possiblePayout)}</strong></div>
          </section>

          <div className="treasure-grid" style={{ "--treasure-grid-size": treasureDigConfig.gridSize } as CSSProperties}>
            {tiles.map((tileIndex) => {
              const finished = Boolean(round && round.status !== "RUNNING");
              const open = finished || (round?.pickedIndexes.includes(tileIndex) ?? false);
              const trap = round?.trapIndexes.includes(tileIndex) ?? false;
              return (
                <button
                  key={tileIndex}
                  type="button"
                  className={tileClass(tileIndex)}
                  disabled={!running || open}
                  onClick={() => pick(tileIndex)}
                  aria-label={`Treasure tile ${tileIndex + 1}`}
                >
                  <span className="treasure-tile-face front"><Shovel size={18} /></span>
                  <span className="treasure-tile-face back">
                    {open && trap ? <Bomb size={20} /> : <Gem size={20} />}
                    {open && !trap && lastOpened === tileIndex && <CoinBurst count={6} />}
                  </span>
                </button>
              );
            })}
          </div>

          {round?.status === "CASHED_OUT" && (
            <div className="treasure-result-mini win" role="status">
              <strong>Won {formatCoins(round.totalPaid ?? 0)}</strong>
              <span>{safePicks} safe picks at {round.currentMultiplier.toFixed(2)}x</span>
            </div>
          )}
          {round?.status === "TRAPPED" && (
            <div className="treasure-result-mini loss" role="status">
              <strong>Trap hit</strong>
              <span>Bet lost. Board revealed.</span>
            </div>
          )}
        </main>
      </ScreenShake>

      <section className="treasure-dig-controls">
        <label className="treasure-risk">
          <span>Traps <strong>{trapCount}</strong> <em>Max win {formatCoins(maxWin)}</em></span>
          <input
            type="range"
            min={treasureDigConfig.minTraps}
            max={treasureDigConfig.maxTraps}
            value={trapCount}
            disabled={running}
            onChange={(event) => setTrapCount(clampTreasureTrapCount(Number(event.target.value)))}
          />
        </label>
        <div className="treasure-bet-row">
          <button type="button" disabled={running} onClick={() => setBet(betAmount - treasureDigConfig.minBet)}>-</button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode="numeric"
              type="number"
              min={treasureDigConfig.minBet}
              max={treasureDigConfig.maxBet}
              value={betInput}
              disabled={running}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={running} onClick={() => setBet(betAmount + treasureDigConfig.minBet)}>+</button>
        </div>
        <div className="treasure-quick-bets">
          {quickBets.map((value) => (
            <button key={value} type="button" className={betAmount === value ? "active" : ""} disabled={running} onClick={() => setBet(value)}>
              {value}
            </button>
          ))}
        </div>
        <div className={balance < betAmount ? "treasure-note warning" : "treasure-note"}>
          <span>Min {formatCoins(treasureDigConfig.minBet)} / Max {formatCoins(treasureDigConfig.maxBet)}</span>
          <strong>{running ? `Cash out ${formatCoins(possiblePayout)}` : "Start, dig, cash out anytime"}</strong>
        </div>
        <button className={running ? "treasure-main-action cashout" : "treasure-main-action"} disabled={!running && !canStart} onClick={mainAction}>
          {running ? "Cash Out" : round ? "Start Again" : "Start"}
        </button>
      </section>
    </section>
  );
}
