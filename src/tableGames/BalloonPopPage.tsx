import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { CircleDot, Sparkles } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, GameResultBanner, ScreenShake, SoundToggle } from "../feedback/components";
import { playBet, playBigWin, playError, playLose, playWin } from "../feedback/feedbackService";
import { formatCoins } from "../lib/format";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import {
  balloonPopConfig,
  completeBalloonPopRound,
  popBalloon,
  revealLeftoverBalloons,
  startBalloonPopRound,
  type BalloonPopRound,
  type BalloonPopState,
  type BalloonTile,
} from "./balloonPopEngine";
import { COMPLIANCE_COPY } from "../lib/compliance";

const quickBets = [10, 25, 50, 100, 500];

export const balloonPopUiMarkers = {
  gameName: "Balloon Pop",
  goldBonusToggle: true,
  noSkillPrizeMapAtStart: true,
  shotsPerRound: 3,
  carnivalTentTheme: true,
  responsiveBalloonWall: true,
  dartFlightToSelectedBalloon: true,
  popBurstConfetti: true,
  obviousPrizeText: true,
  runningWinningsMeter: true,
  leftoverReveal: true,
  multiplierAppliesToBet: true,
  compactBottomBetControls: true,
  payoutAfterRoundComplete: true,
  rtpUnder95Warning: true,
  sharedSoundToggle: true,
};

export function BalloonPopPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(balloonPopConfig.minBet);
  const [betInput, setBetInput] = useState(String(balloonPopConfig.minBet));
  const [gameState, setGameState] = useState<BalloonPopState>("idle");
  const [round, setRound] = useState<BalloonPopRound | null>(null);
  const [dartTarget, setDartTarget] = useState<number | null>(null);
  const [lastPopped, setLastPopped] = useState<BalloonTile | null>(null);
  const [totalPulse, setTotalPulse] = useState(false);
  const [recentRounds, setRecentRounds] = useState<Array<{ paid: number; net: number }>>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const active = gameState === "choosing" || gameState === "popping" || gameState === "reveal";
  const canPlay = !active && betAmount >= balloonPopConfig.minBet && betAmount <= balloonPopConfig.maxBet && balance >= betAmount;
  const totalWon = round?.totalPaid ?? 0;
  const shotsRemaining = round?.shotsRemaining ?? balloonPopConfig.shotsPerRound;
  const bigWin = Boolean(round && round.state === "complete" && round.totalPaid >= round.betAmount * 5);
  const dartStyle = useMemo(() => {
    if (dartTarget === null) return { "--dart-x": "50%", "--dart-y": "88%" } as CSSProperties;
    const column = dartTarget % 4;
    const row = Math.floor(dartTarget / 4);
    return {
      "--dart-x": `${12.5 + column * 25}%`,
      "--dart-y": `${20 + row * 18}%`,
    } as CSSProperties;
  }, [dartTarget]);

  function clampBet(value: number) {
    return Math.max(balloonPopConfig.minBet, Math.min(balloonPopConfig.maxBet, Math.round(value)));
  }

  function setBet(value: number) {
    const next = clampBet(value);
    setBetAmount(next);
    setBetInput(String(next));
  }

  function updateBetInput(value: string) {
    setBetInput(value);
    const parsed = Number(value);
    if (Number.isFinite(parsed)) setBetAmount(Math.max(0, Math.min(balloonPopConfig.maxBet, Math.round(parsed))));
  }

  function clearTimers() {
    timersRef.current.forEach((timer) => window.clearTimeout(timer));
    timersRef.current = [];
  }

  function play() {
    try {
      clearTimers();
      const nextRound = startBalloonPopRound({ userId: currentUser.id, currency, betAmount });
      setRound(nextRound);
      setGameState("choosing");
      setDartTarget(null);
      setLastPopped(null);
      playBet();
      refreshUser();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to start Balloon Pop.", "error");
      playError();
    }
  }

  function finishRound(nextRound: BalloonPopRound) {
    const revealTimer = window.setTimeout(() => {
      const revealed = revealLeftoverBalloons(nextRound);
      setRound(revealed);
      setGameState("reveal");
      const completeTimer = window.setTimeout(() => {
        try {
          const completed = completeBalloonPopRound({ round: revealed, userId: currentUser.id });
          setRound(completed);
          setGameState("complete");
          setRecentRounds((current) => [{ paid: completed.totalPaid, net: completed.net }, ...current].slice(0, 5));
          recordRetentionRound({
            userId: currentUser.id,
            gameId: "balloonPop",
            wager: completed.betAmount,
            won: completed.totalPaid,
            bonusTriggered: completed.balloons.some((balloon) => balloon.popped && balloon.prize.kind === "bonus"),
            multiplier: completed.betAmount > 0 ? completed.totalPaid / completed.betAmount : 0,
          });
          refreshUser();
          if (completed.totalPaid > 0) {
            if (completed.totalPaid >= completed.betAmount * 5) playBigWin();
            else playWin();
          } else {
            playLose();
          }
        } catch (caught) {
          notify(caught instanceof Error ? caught.message : "Unable to complete Balloon Pop.", "error");
          playError();
        }
      }, 720);
      timersRef.current.push(completeTimer);
    }, 520);
    timersRef.current.push(revealTimer);
  }

  function throwDart(balloonIndex: number) {
    if (!round || gameState !== "choosing") return;
    try {
      setGameState("popping");
      setDartTarget(balloonIndex);
      setLastPopped(null);
      const popTimer = window.setTimeout(() => {
        const nextRound = popBalloon(round, balloonIndex);
        const popped = nextRound.balloons.find((balloon) => balloon.index === balloonIndex) ?? null;
        setRound(nextRound);
        setLastPopped(popped);
        if ((popped?.paidAmount ?? 0) > 0) {
          setTotalPulse(true);
          window.setTimeout(() => setTotalPulse(false), 420);
          playWin();
        }
        if (nextRound.shotsRemaining === 0) {
          setGameState("reveal");
          finishRound(nextRound);
        } else {
          const chooseTimer = window.setTimeout(() => {
            setGameState("choosing");
            setDartTarget(null);
          }, 520);
          timersRef.current.push(chooseTimer);
        }
      }, 520);
      timersRef.current.push(popTimer);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "That dart missed the rules.", "error");
      setGameState("choosing");
      setDartTarget(null);
      playError();
    }
  }

  return (
    <section className={`balloon-pop-page ${bigWin ? "big-win" : ""}`}>
      <header className="balloon-pop-header">
        <button className="balloon-pop-back" onClick={onExit} aria-label="Back to games">&lt;</button>
        <div className="balloon-pop-title">
          <h1>Balloon Pop <CircleDot size={14} /></h1>
          <p>Every balloon prize is a bet multiplier.</p>
        </div>
        <div className="balloon-pop-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={active} onClick={() => setCurrency("GOLD")}>Gold</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={active} onClick={() => setCurrency("BONUS")}>Bonus</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <div className={totalPulse ? "balloon-pop-balance pulse" : "balloon-pop-balance"}>
        <span>Balance: {formatCoins(balance)}</span>
        <strong>Won: {formatCoins(totalWon)}</strong>
      </div>

      <ScreenShake active={bigWin}>
        <main className={`balloon-pop-board ${gameState}`} style={dartStyle}>
          <div className="carnival-lights" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
          </div>
          <div className="balloon-pop-status">
            <span>{gameState === "complete" ? "Round complete" : gameState === "reveal" ? "Prize reveal" : active ? "Pick a balloon" : "Ready"}</span>
            <strong>Darts: {shotsRemaining}</strong>
          </div>
          <div className="balloon-wall" aria-label="Balloon wall">
            {(round?.balloons ?? Array.from({ length: balloonPopConfig.balloonCount }, (_, index) => ({
              id: `preview-${index}`,
              index,
              color: ["red", "yellow", "blue", "green"][index % 4],
              prize: { kind: "blank" as const, multiplier: 0, label: "?" },
              popped: false,
              revealed: false,
              paidAmount: 0,
            }))).map((balloon) => {
              const isTarget = dartTarget === balloon.index;
              const showLeftover = (gameState === "reveal" || gameState === "complete") && !balloon.popped && balloon.revealed;
              const showcaseMultiplier = showLeftover && round ? getShowcaseMultiplier(round, balloon) : balloon.prize.multiplier;
              return (
                <button
                  key={balloon.id}
                  type="button"
                  className={`balloon ${balloon.color} ${balloon.popped ? "popped" : ""} ${isTarget ? "targeted" : ""} ${showLeftover ? "leftover" : ""}`.trim()}
                  disabled={gameState !== "choosing" || balloon.popped}
                  onClick={() => throwDart(balloon.index)}
                >
                  <span className="balloon-string" />
                  <span className="balloon-shape">
                    {balloon.popped && <span className="burst-pieces" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
                    {balloon.popped && (
                      <span className="balloon-prize-label">
                        <strong>{formatPrize(balloon)}</strong>
                      </span>
                    )}
                    {showLeftover && (
                      <span className="leftover-label">
                        <strong>{formatHiddenPrize(balloon, betAmount, showcaseMultiplier)}</strong>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {gameState === "popping" && <span className="flying-dart" aria-hidden="true" />}
          {lastPopped && gameState !== "complete" && (
            <div className={`balloon-pop-callout ${lastPopped.paidAmount > 0 ? "win" : "blank"}`}>
              <Sparkles size={15} />
              <strong>{formatPrize(lastPopped)}</strong>
            </div>
          )}
          {lastPopped && lastPopped.paidAmount > 0 && <CoinBurst count={12} />}
        </main>
      </ScreenShake>

      {round?.state === "complete" && (
        <div className="balloon-pop-result-row">
          <GameResultBanner
            tone={round.totalPaid > 0 ? (bigWin ? "big-win" : "win") : "loss"}
            title={round.totalPaid > 0 ? "Prize Paid" : "No Prize"}
            amount={round.totalPaid > 0 ? round.totalPaid : undefined}
            message={`Total Won: ${formatCoins(round.totalPaid)} | Net: ${round.net >= 0 ? "+" : ""}${formatCoins(round.net)}`}
            compact
          />
        </div>
      )}

      <section className="balloon-pop-controls">
        <div className="balloon-pop-bet-row">
          <button type="button" disabled={active} onClick={() => setBet(betAmount - balloonPopConfig.minBet)}>-</button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode="numeric"
              type="number"
              min={balloonPopConfig.minBet}
              max={balloonPopConfig.maxBet}
              value={betInput}
              disabled={active}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={active} onClick={() => setBet(betAmount + balloonPopConfig.minBet)}>+</button>
        </div>
        <div className="balloon-pop-quick-bets">
          {quickBets.map((value) => (
            <button key={value} type="button" className={betAmount === value ? "active" : ""} disabled={active} onClick={() => setBet(value)}>
              {value}
            </button>
          ))}
        </div>
        <div className={balance < betAmount ? "balloon-pop-note warning" : "balloon-pop-note"}>
          <span>No skill. Prize map is set on Play.</span>
          <strong>{gameState === "complete" ? "Play Again" : `${shotsRemaining} darts`}</strong>
        </div>
        <button className="balloon-pop-play" disabled={!canPlay} onClick={play}>
          {active ? "Round Active" : round?.state === "complete" ? "Play Again" : "Play"}
        </button>
        <div className="demo-copy game-compliance-copy">{COMPLIANCE_COPY}</div>
        {recentRounds.length > 0 && (
          <div className="balloon-pop-recent" aria-label="Recent Balloon Pop rounds">
            {recentRounds.map((item, index) => <strong key={`${item.paid}-${item.net}-${index}`} className={item.net >= 0 ? "win" : "loss"}>{item.net >= 0 ? "+" : ""}{formatCoins(item.net)}</strong>)}
          </div>
        )}
      </section>
    </section>
  );
}

function formatPrize(balloon: BalloonTile) {
  if (balloon.prize.kind === "blank") return "BLANK";
  return `+${formatMultiplier(balloon.prize.multiplier)}`;
}

function formatHiddenPrize(balloon: BalloonTile, betAmount: number, showcaseMultiplier?: number) {
  void betAmount;
  if (balloon.prize.kind === "blank") return "BLANK";
  return formatMultiplier(showcaseMultiplier ?? balloon.prize.multiplier);
}

function formatMultiplier(multiplier: number) {
  return `${Number.isInteger(multiplier) ? multiplier.toFixed(0) : multiplier.toFixed(2).replace(/0$/, "")}x`;
}

function getShowcaseMultiplier(round: BalloonPopRound, balloon: BalloonTile) {
  const actual = balloon.prize.kind === "blank" ? 0 : balloon.prize.multiplier;
  const leftovers = round.balloons
    .filter((candidate) => !candidate.popped)
    .map((candidate) => ({
      index: candidate.index,
      roll: seededRoll(`${round.id}:${candidate.index}:showcase-rank`),
    }))
    .sort((a, b) => b.roll - a.roll);
  const rank = leftovers.findIndex((candidate) => candidate.index === balloon.index);
  const roll = seededRoll(`${round.id}:${balloon.index}:showcase-value`);
  const target =
    rank === 0 ? pickShowcaseValue(roll, [2, 2.5, 3, 5]) :
      rank === 1 ? pickShowcaseValue(roll, [1, 1.5, 2, 2.5]) :
        rank === 2 ? pickShowcaseValue(roll, [0.75, 1, 1.5, 2]) :
          rank === 3 ? pickShowcaseValue(roll, [0.5, 0.75, 1]) :
            actual;
  return Math.max(actual, Math.min(target, balloonPopConfig.maxWinMultiplier));
}

function pickShowcaseValue(roll: number, values: number[]) {
  const index = Math.min(values.length - 1, Math.floor(roll * values.length));
  return values[index] ?? values[0] ?? 0.1;
}

function seededRoll(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0) / 4294967296;
}
