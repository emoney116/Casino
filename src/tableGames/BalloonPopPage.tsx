import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Info, Sparkles, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, ScreenShake, SoundToggle } from "../feedback/components";
import { playBalloonPop, playBet, playBigWin, playConfettiBurst, playDartThrow, playError, playLose, playRareBalloonHit, playWin, playWinReveal } from "../feedback/feedbackService";
import { recordRetentionRound } from "../retention/retentionService";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import {
  balloonPopConfig,
  completeBalloonPopRound,
  getBalloonPopBetLimits,
  popBalloon,
  revealLeftoverBalloons,
  startBalloonPopRound,
  type BalloonPopRound,
  type BalloonPopState,
  type BalloonTile,
} from "./balloonPopEngine";
import redBalloonAsset from "../assets/balloon-pop/sprites/red-balloon.png";
import blueBalloonAsset from "../assets/balloon-pop/sprites/blue-balloon.png";
import purpleBalloonAsset from "../assets/balloon-pop/sprites/purple-balloon.png";
import greenBalloonAsset from "../assets/balloon-pop/sprites/green-balloon.png";
import goldBalloonAsset from "../assets/balloon-pop/sprites/gold-balloon.png";
import dartAsset from "../assets/balloon-pop/sprites/dart.png";
import popExplosionAsset from "../assets/balloon-pop/sprites/pop-explosion.png";
import confettiBurstAsset from "../assets/balloon-pop/sprites/confetti-burst-v2.png";
import titleEmblemAsset from "../assets/balloon-pop/sprites/title-emblem-clean.png";
import balloonPopBackdrop from "../assets/balloon-pop/backgrounds/casino-arcade-backdrop.png";

const currencyCopy: Record<Currency, { short: string; label: string }> = {
  GOLD: { short: "GC", label: "GC" },
  BONUS: { short: "SC", label: "SC" },
};
const previewBalloonColors = [
  "red",
  "gold",
  "blue",
  "green",
  "purple",
  "red",
  "green",
  "blue",
  "gold",
  "purple",
  "red",
  "green",
  "blue",
  "green",
  "gold",
  "purple",
];
const balloonSpriteAssets: Record<string, string | undefined> = {
  blue: blueBalloonAsset,
  gold: goldBalloonAsset,
  green: greenBalloonAsset,
  purple: purpleBalloonAsset,
  red: redBalloonAsset,
  yellow: goldBalloonAsset,
};

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
  const [betAmount, setBetAmount] = useState(getBalloonPopBetLimits("GOLD").minBet);
  const [betInput, setBetInput] = useState(formatBetInput(getBalloonPopBetLimits("GOLD").minBet, "GOLD"));
  const [gameState, setGameState] = useState<BalloonPopState>("idle");
  const [round, setRound] = useState<BalloonPopRound | null>(null);
  const [dartTarget, setDartTarget] = useState<number | null>(null);
  const [lastPopped, setLastPopped] = useState<BalloonTile | null>(null);
  const [rareHit, setRareHit] = useState(false);
  const [totalPulse, setTotalPulse] = useState(false);
  const [lastWonByCurrency, setLastWonByCurrency] = useState<Record<Currency, number>>({ GOLD: 0, BONUS: 0 });
  const [roundOverlay, setRoundOverlay] = useState<{ amount: number; key: number } | null>(null);
  const [recentRounds, setRecentRounds] = useState<Array<{ paid: number }>>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const betLimits = getBalloonPopBetLimits(currency);
  const lastWon = lastWonByCurrency[currency];
  const active = gameState === "choosing" || gameState === "popping" || gameState === "reveal";
  const betExceedsBalance = betAmount > balance;
  const canPlay = !active && betAmount >= betLimits.minBet && betAmount <= betLimits.maxBet && balance >= betAmount;
  const shotsRemaining = round?.shotsRemaining ?? balloonPopConfig.shotsPerRound;
  const bigWin = Boolean(round && round.state === "complete" && round.totalPaid >= round.betAmount * 5);
  const boardStyle = useMemo(() => {
    if (dartTarget === null) return { "--dart-x": "50%", "--dart-y": "88%", "--balloon-bg": `url(${balloonPopBackdrop})` } as CSSProperties;
    const column = dartTarget % 4;
    const row = Math.floor(dartTarget / 4);
    return {
      "--dart-x": `${12.5 + column * 25}%`,
      "--dart-y": `${20 + row * 18}%`,
      "--balloon-bg": `url(${balloonPopBackdrop})`,
    } as CSSProperties;
  }, [dartTarget]);

  function clampBet(value: number, nextCurrency = currency) {
    const limits = getBalloonPopBetLimits(nextCurrency);
    return Math.max(limits.minBet, Math.min(limits.maxBet, value));
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
      setBetAmount(Math.max(0, Math.min(betLimits.maxBet, parsed)));
    }
  }

  function selectCurrency(nextCurrency: Currency) {
    const nextBet = clampBet(betAmount, nextCurrency);
    setCurrency(nextCurrency);
    setBet(nextBet, nextCurrency);
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
      setRareHit(false);
      setRoundOverlay(null);
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
          setLastWonByCurrency((current) => ({ ...current, [completed.currency]: completed.totalPaid }));
          setTotalPulse(true);
          setRoundOverlay({ amount: completed.totalPaid, key: Date.now() });
          setRecentRounds((current) => [{ paid: completed.totalPaid }, ...current].slice(0, 5));
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
            playWinReveal();
            if (completed.totalPaid >= completed.betAmount * 5) playBigWin();
            else playWin();
          } else {
            playLose();
          }
          const pulseTimer = window.setTimeout(() => setTotalPulse(false), 520);
          const overlayTimer = window.setTimeout(() => setRoundOverlay(null), 1900);
          timersRef.current.push(pulseTimer, overlayTimer);
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
      playDartThrow();
      const popTimer = window.setTimeout(() => {
        const nextRound = popBalloon(round, balloonIndex);
        const popped = nextRound.balloons.find((balloon) => balloon.index === balloonIndex) ?? null;
        setRound(nextRound);
        setLastPopped(popped);
        playBalloonPop();
        if ((popped?.paidAmount ?? 0) > 0) {
          playConfettiBurst();
          if (popped && popped.paidAmount >= nextRound.betAmount * 10) {
            setRareHit(true);
            const rareTimer = window.setTimeout(() => setRareHit(false), 360);
            timersRef.current.push(rareTimer);
            playRareBalloonHit();
          }
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
    <section className={`balloon-pop-page ${currency === "BONUS" ? "currency-sc" : "currency-gc"} ${bigWin ? "big-win" : ""}`} style={boardStyle}>
      <header className="balloon-pop-header">
        <button className="balloon-pop-back" onClick={onExit} aria-label="Back to games">&lt;</button>
        <div className="balloon-pop-title">
          <div className="balloon-pop-title-row">
            <h1><img className="balloon-pop-title-logo" src={titleEmblemAsset} alt="" draggable={false} /> Balloon Pop</h1>
            <button className="balloon-pop-info-button" type="button" aria-label="Balloon Pop rules" onClick={() => setRulesOpen(true)}>
              <Info size={14} />
            </button>
          </div>
          <p>Every balloon prize is a bet multiplier.</p>
        </div>
        <div className="balloon-pop-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={active} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={active} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <ScreenShake active={bigWin || rareHit}>
        <main className={`balloon-pop-board ${gameState}`} style={boardStyle}>
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
              color: previewBalloonColors[index % previewBalloonColors.length],
              prize: { kind: "blank" as const, multiplier: 0, label: "?" },
              popped: false,
              revealed: false,
              paidAmount: 0,
            }))).map((balloon) => {
              const isTarget = dartTarget === balloon.index;
              const showLeftover = (gameState === "reveal" || gameState === "complete") && !balloon.popped && balloon.revealed;
              const showcaseMultiplier = showLeftover && round ? getShowcaseMultiplier(round, balloon) : balloon.prize.multiplier;
              const showcaseTier = showLeftover ? getShowcaseTier(showcaseMultiplier) : "";
              const balloonSprite = balloonSpriteAssets[balloon.color];
              return (
                <button
                  key={balloon.id}
                  type="button"
                  className={`balloon ${balloon.color} ${balloonSprite ? "has-raster" : ""} ${balloon.popped ? "popped" : ""} ${isTarget ? "targeted" : ""} ${showLeftover ? "leftover" : ""} ${showcaseTier}`.trim()}
                  disabled={gameState !== "choosing" || balloon.popped}
                  onClick={() => throwDart(balloon.index)}
                >
                  <span className="balloon-string" />
                  <span className="balloon-shape">
                    {balloonSprite && !balloon.popped && <img src={balloonSprite} alt="" draggable={false} />}
                    {balloon.popped && <img className="pop-explosion-fx" src={popExplosionAsset} alt="" draggable={false} />}
                    {balloon.popped && balloon.paidAmount > 0 && <img className="confetti-burst-fx" src={confettiBurstAsset} alt="" draggable={false} />}
                    {balloon.popped && <span className="burst-pieces" aria-hidden="true"><i /><i /><i /><i /><i /></span>}
                    {balloon.popped && (
                      <span className="balloon-prize-label">
                        <strong>{formatPrize(balloon)}</strong>
                      </span>
                    )}
                    {showLeftover && (
                      <span className={`leftover-label ${showcaseTier}`.trim()}>
                        <strong>{formatHiddenPrize(balloon, betAmount, showcaseMultiplier)}</strong>
                      </span>
                    )}
                  </span>
                </button>
              );
            })}
          </div>
          {gameState === "popping" && <span className="flying-dart" aria-hidden="true"><img src={dartAsset} alt="" draggable={false} /></span>}
          {lastPopped && gameState !== "complete" && (
            <div className={`balloon-pop-callout ${lastPopped.paidAmount > 0 ? "win" : "blank"}`}>
              <Sparkles size={15} />
              <strong>{formatPrize(lastPopped)}</strong>
            </div>
          )}
          {lastPopped && lastPopped.paidAmount > 0 && <CoinBurst count={12} />}
        </main>
      </ScreenShake>

      {roundOverlay && (
        <div key={roundOverlay.key} className={`balloon-pop-win-popover ${roundOverlay.amount > 0 ? (bigWin ? "big" : "win") : "blank"}`} role="status" aria-live="polite">
          <span>{roundOverlay.amount > 0 ? "Won" : "No win"}</span>
          <strong>{formatCurrencyValue(roundOverlay.amount, currency)}</strong>
        </div>
      )}

      <section className="balloon-pop-controls">
        <div className={totalPulse ? "balloon-pop-bank pulse" : "balloon-pop-bank"}>
          <span>{currencyCopy[currency].short} Balance: {formatCurrencyValue(balance, currency)}</span>
          <strong>Last won: {formatCurrencyValue(lastWon, currency)}</strong>
        </div>
        <div className="balloon-pop-bet-row">
          <button type="button" disabled={active} onClick={() => setBet(betAmount - betLimits.minBet)}>-</button>
          <label>
            <span>Bet</span>
            <input
              aria-label="Bet amount"
              inputMode={currency === "BONUS" ? "decimal" : "numeric"}
              type="text"
              value={betInput}
              disabled={active}
              onChange={(event) => updateBetInput(event.target.value)}
              onBlur={(event) => setBet(Number(event.target.value))}
            />
          </label>
          <button type="button" disabled={active} onClick={() => setBet(betAmount + betLimits.minBet)}>+</button>
        </div>
        <div className={balance < betAmount ? "balloon-pop-note warning" : "balloon-pop-note"}>
          <span>Min {currencyCopy[currency].short}: {formatBetDisplay(betLimits.minBet, currency)}</span>
          <strong>Max {currencyCopy[currency].short}: {formatBetDisplay(betLimits.maxBet, currency)}</strong>
        </div>
        <button className="balloon-pop-play" disabled={!canPlay} onClick={play}>
          {getPlayButtonLabel({ active, betExceedsBalance, roundComplete: round?.state === "complete", currency })}
        </button>
        {recentRounds.length > 0 && (
          <div className="balloon-pop-recent" aria-label="Recent Balloon Pop rounds">
            {recentRounds.map((item, index) => <strong key={`${item.paid}-${index}`} className={item.paid > 0 ? "win" : "loss"}>{formatCurrencyValue(item.paid, currency)}</strong>)}
          </div>
        )}
      </section>

      {rulesOpen && (
        <div className="balloon-pop-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="balloon-pop-rules" role="dialog" aria-modal="true" aria-labelledby="balloon-pop-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="balloon-pop-rules-title">Balloon Pop Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              <li>Choose GC or SC before you play. The active currency sets your balance, bet limits, and payout display.</li>
              <li>Set your bet, press Play, then pop exactly 3 balloons with 3 darts.</li>
              <li>Each round creates the prize map at Play. Balloon color does not indicate value.</li>
              <li>Prizes can be blank or pay up to 25x your bet.</li>
              <li>Unpopped balloons reveal after your third dart so you can see what else was on the board.</li>
              <li>GC bets run from 1 to 1,000,000. SC bets run from 0.01 to 100.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function formatCurrencyValue(amount: number, currency: Currency) {
  void currency;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatBetInput(amount: number, currency: Currency) {
  void currency;
  return formatDecimalDisplay(amount);
}

function formatBetDisplay(amount: number, currency: Currency, compact = false) {
  void compact;
  void currency;
  return amount.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function formatDecimalDisplay(amount: number) {
  return Number.isFinite(amount) ? Number(amount.toFixed(2)).toString() : "0";
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

function getPlayButtonLabel({
  active,
  betExceedsBalance,
  roundComplete,
  currency,
}: {
  active: boolean;
  betExceedsBalance: boolean;
  roundComplete: boolean;
  currency: Currency;
}) {
  if (active) return "Round Active";
  if (betExceedsBalance) return `Bet exceeds ${currencyCopy[currency].short} balance`;
  return roundComplete ? "Play Again" : "Play";
}

function getShowcaseTier(multiplier: number) {
  if (multiplier >= 10) return "super-rare";
  if (multiplier >= 5) return "rare";
  return "";
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
    rank === 0 ? pickShowcaseValue(roll, [10, 12, 15, 25]) :
      rank === 1 ? pickShowcaseValue(roll, [3, 5, 8, 10]) :
        rank === 2 ? pickShowcaseValue(roll, [1.5, 2, 2.5, 3]) :
          rank === 3 ? pickShowcaseValue(roll, [0.75, 1, 1.25, 1.5]) :
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
