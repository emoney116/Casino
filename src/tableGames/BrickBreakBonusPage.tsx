import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Gamepad2, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import { playBet, playBigWin, playError, playLose, playWin } from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { brickBreakBonusConfig, generateBrickBreakResult, type BrickBreakHit, type BrickBreakResult, type BrickBreakState } from "./brickBreakBonusEngine";

const quickBets = [10, 25, 50, 100, 500];
const brickCount = 30;

export const brickBreakBonusUiMarkers = {
  gameName: "Brick Break Bonus",
  goldBonusToggle: true,
  noSkillAutoplay: true,
  cpuPaddle: true,
  deterministicReplay: true,
  hiddenBrickValues: true,
  runningWinningsMeter: true,
  compactBottomBetControls: true,
  rtpUnder95Warning: true,
  sharedSoundToggle: true,
};

export function BrickBreakBonusPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(brickBreakBonusConfig.minBet);
  const [betInput, setBetInput] = useState(String(brickBreakBonusConfig.minBet));
  const [gameState, setGameState] = useState<BrickBreakState>("idle");
  const [result, setResult] = useState<BrickBreakResult | null>(null);
  const [revealedHits, setRevealedHits] = useState<BrickBreakHit[]>([]);
  const [activeHitIndex, setActiveHitIndex] = useState(-1);
  const [recentRounds, setRecentRounds] = useState<Array<{ paid: number; net: number }>>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const running = gameState === "playing" || gameState === "revealing";
  const winnings = revealedHits.reduce((sum, hit) => sum + hit.amount, 0);
  const activeHit = activeHitIndex >= 0 ? result?.hitList[activeHitIndex] : null;
  const canPlay = !running && betAmount >= brickBreakBonusConfig.minBet && betAmount <= brickBreakBonusConfig.maxBet && balance >= betAmount;
  const net = result ? result.totalPaid - result.betAmount : 0;
  const bigWin = Boolean(result && result.totalPaid >= result.betAmount * 5);
  const ballStyle = useMemo(() => {
    const index = activeHit?.brickIndex ?? 14;
    const column = index % 6;
    const row = Math.floor(index / 6);
    return {
      "--ball-x": `${12 + column * 15}%`,
      "--ball-y": `${13 + row * 9}%`,
      "--paddle-x": `${8 + column * 14}%`,
    } as CSSProperties;
  }, [activeHit]);

  function clampBet(value: number) {
    return Math.max(brickBreakBonusConfig.minBet, Math.min(brickBreakBonusConfig.maxBet, Math.round(value)));
  }

  function setBet(value: number) {
    const next = clampBet(value);
    setBetAmount(next);
    setBetInput(String(next));
  }

  function updateBetInput(value: string) {
    setBetInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setBetAmount(Math.max(0, Math.min(brickBreakBonusConfig.maxBet, Math.round(parsed))));
  }

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function play() {
    if (running) return;
    try {
      clearTimers();
      const next = generateBrickBreakResult({ userId: currentUser.id, currency, betAmount });
      setResult(next);
      setRevealedHits([]);
      setActiveHitIndex(-1);
      setGameState("playing");
      playBet();

      const openingDelay = window.setTimeout(() => {
        setGameState("revealing");
        if (next.hitList.length === 0) setActiveHitIndex(-1);
      }, 360);
      timersRef.current.push(openingDelay);

      next.hitList.forEach((hit, index) => {
        const timer = window.setTimeout(() => {
          setActiveHitIndex(index);
          setRevealedHits((current) => [...current, hit]);
          playWin();
        }, 650 + index * 430);
        timersRef.current.push(timer);
      });

      const ending = window.setTimeout(() => {
        setGameState("gameOver");
        setActiveHitIndex(-1);
        setRecentRounds((current) => [{ paid: next.totalPaid, net: next.net }, ...current].slice(0, 5));
        recordRetentionRound({
          userId: currentUser.id,
          gameId: "brickBreakBonus",
          wager: next.betAmount,
          won: next.totalPaid,
          bonusTriggered: next.hitList.some((hit) => hit.bonusBall),
          multiplier: next.totalMultiplier,
        });
        refreshUser();
        if (next.totalPaid > 0) {
          if (next.totalPaid >= next.betAmount * 5) playBigWin();
          else playWin();
        } else {
          playLose();
        }
      }, 920 + Math.max(1, next.hitList.length) * 430);
      timersRef.current.push(ending);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to play Brick Break Bonus.", "error");
      playError();
    }
  }

  return (
    <section className={`brick-break-page ${bigWin ? "big-win" : ""}`}>
      <header className="brick-break-header">
        <button className="brick-break-back" onClick={onExit} aria-label="Back to games">&lt;</button>
        <div className="brick-break-title">
          <h1>Brick Break Bonus <span aria-hidden="true"><Gamepad2 size={14} /></span></h1>
        </div>
        <div className="brick-break-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={running} onClick={() => setCurrency("GOLD")}>Gold</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={running} onClick={() => setCurrency("BONUS")}>Bonus</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <div className="brick-break-balance">
        <span>Balance: {formatCoins(balance)}</span>
        <strong>Won: {formatCoins(winnings)}</strong>
      </div>

      <ScreenShake active={bigWin && gameState === "gameOver"}>
        <main className={`brick-break-board ${gameState}`} style={ballStyle}>
          <div className="brick-break-status">
            <span>{running ? "CPU autoplay" : gameState === "gameOver" ? "Round complete" : "Ready"}</span>
            <strong>{formatCoins(winnings)}</strong>
          </div>
          <div className="brick-break-grid" aria-label="Brick field">
            {Array.from({ length: brickCount }, (_, index) => {
              const hit = revealedHits.find((candidate) => candidate.brickIndex === index);
              return (
                <div key={index} className={`brick-tile ${hit ? "broken" : ""} ${hit?.bonusBall ? "bonus" : ""}`.trim()}>
                  {hit && (
                    <>
                      <Sparkles size={13} />
                      <span>+{hit.multiplier >= 1 ? `${hit.multiplier}x` : formatCoins(hit.amount)}</span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="brick-break-lane" aria-hidden="true">
            <span className="brick-ball" />
            <span className="brick-paddle" />
          </div>
          {revealedHits.slice(-4).map((hit, index) => (
            <span key={hit.id} className="brick-float" style={{ "--float-left": `${12 + (hit.brickIndex % 6) * 15}%`, "--float-delay": `${index * 45}ms` } as CSSProperties}>
              +{hit.amount >= betAmount ? `${hit.multiplier}x` : formatCoins(hit.amount)}
            </span>
          ))}
          {activeHit?.bonusBall && <CoinBurst count={14} />}
          {gameState === "gameOver" && result && (
            <GameResultBanner
              tone={result.totalPaid > 0 ? (bigWin ? "big-win" : "win") : "loss"}
              title="Game Over"
              amount={result.totalPaid > 0 ? result.totalPaid : undefined}
              message={`Total Won: ${formatCoins(result.totalPaid)} | Net: ${net >= 0 ? "+" : ""}${formatCoins(net)}`}
              compact
            />
          )}
        </main>
      </ScreenShake>

      <section className="brick-break-controls">
        <div className="brick-break-bet-row">
          <button type="button" disabled={running} onClick={() => setBet(betAmount - brickBreakBonusConfig.minBet)}>-</button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode="numeric"
              type="number"
              min={brickBreakBonusConfig.minBet}
              max={brickBreakBonusConfig.maxBet}
              value={betInput}
              disabled={running}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={running} onClick={() => setBet(betAmount + brickBreakBonusConfig.minBet)}>+</button>
        </div>
        <div className="brick-break-quick-bets">
          {quickBets.map((value) => (
            <button key={value} type="button" className={betAmount === value ? "active" : ""} disabled={running} onClick={() => setBet(value)}>
              {value}
            </button>
          ))}
        </div>
        <div className={balance < betAmount ? "brick-break-note warning" : "brick-break-note"}>
          <span>No skill. CPU autoplay.</span>
          <strong>RTP target {(brickBreakBonusConfig.targetRtp * 100).toFixed(0)}%</strong>
        </div>
        <button className="brick-break-play" disabled={!canPlay} onClick={play}>
          {running ? "Playing" : "Play"}
        </button>
        {recentRounds.length > 0 && (
          <div className="brick-break-recent" aria-label="Recent Brick Break Bonus rounds">
            {recentRounds.map((round, index) => <strong key={`${round.paid}-${round.net}-${index}`} className={round.net >= 0 ? "win" : "loss"}>{round.net >= 0 ? "+" : ""}{formatCoins(round.net)}</strong>)}
          </div>
        )}
      </section>
    </section>
  );
}
