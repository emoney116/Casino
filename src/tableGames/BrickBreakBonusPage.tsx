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
import { brickBreakBonusConfig, generateBrickBreakResult, type BrickBreakHit, type BrickBreakResult, type BrickBreakState, type BrickBreakStep } from "./brickBreakBonusEngine";
import { COMPLIANCE_COPY } from "../lib/compliance";

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
  bottomToTopBreakOrder: true,
  stagedBrickBreaks: true,
  readableBrickInterior: true,
  ballTargetsActiveBrick: true,
  configurableAnimationSpeeds: true,
  exposedBrickRule: true,
  prizeRevealAfterFinalCrack: true,
  actualMultiplierBricks: true,
  postRoundShowcase: true,
  postRoundAllBrickValues: true,
  noBadBeatCopy: true,
  highMultiplierTeases: true,
  fourCrackStages: true,
  crackStageImages: true,
  postRoundBrokenContrast: true,
  obviousCpuMiss: true,
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
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [impactStep, setImpactStep] = useState<BrickBreakStep | null>(null);
  const [crackedBricks, setCrackedBricks] = useState<Record<number, number>>({});
  const [totalPulse, setTotalPulse] = useState(false);
  const [animationMode, setAnimationMode] = useState<"normal" | "fast">("normal");
  const [ballPhase, setBallPhase] = useState<"rest" | "target" | "miss">("rest");
  const [recentRounds, setRecentRounds] = useState<Array<{ paid: number; net: number }>>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const running = gameState === "playing" || gameState === "revealing";
  const winnings = revealedHits.reduce((sum, hit) => sum + hit.amount, 0);
  const activeStep = activeStepIndex >= 0 ? result?.replaySteps[activeStepIndex] : null;
  const animationSpeed = animationMode === "fast" ? brickBreakBonusConfig.fastSpeed : brickBreakBonusConfig.normalSpeed;
  const canPlay = !running && betAmount >= brickBreakBonusConfig.minBet && betAmount <= brickBreakBonusConfig.maxBet && balance >= betAmount;
  const net = result ? result.totalPaid - result.betAmount : 0;
  const bigWin = Boolean(result && result.totalPaid >= result.betAmount * 5);
  const showcaseBricks = gameState === "gameOver" ? result?.showcaseBricks ?? [] : [];
  const ballStyle = useMemo(() => {
    if (ballPhase === "miss") {
      return {
        "--ball-x": "82%",
        "--ball-y": "112%",
        "--ball-current-x": "82%",
        "--ball-current-y": "112%",
        "--paddle-x": "12%",
        "--ball-speed": `${Math.round(animationSpeed * 0.72)}ms`,
      } as CSSProperties;
    }
    const index = activeStep?.brickIndex ?? 26;
    const column = index % 6;
    const row = Math.floor(index / 6);
    const targetX = 8.33 + column * 16.66;
    const targetY = 22 + row * 10.5;
    const restX = targetX;
    const restY = 84;
    const ballX = ballPhase === "target" ? targetX : restX;
    const ballY = ballPhase === "target" ? targetY : restY;
    return {
      "--ball-x": `${targetX}%`,
      "--ball-y": `${targetY}%`,
      "--ball-current-x": `${ballX}%`,
      "--ball-current-y": `${ballY}%`,
      "--paddle-x": `${Math.max(6, Math.min(72, targetX - 14))}%`,
      "--ball-speed": `${animationSpeed}ms`,
    } as CSSProperties;
  }, [activeStep, animationSpeed, ballPhase]);

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
      setActiveStepIndex(-1);
      setImpactStep(null);
      setCrackedBricks({});
      setTotalPulse(false);
      setBallPhase("rest");
      setGameState("playing");
      playBet();

      const openingDelay = window.setTimeout(() => {
        setGameState("revealing");
        if (next.replaySteps.length === 0) setActiveStepIndex(-1);
      }, 360);
      timersRef.current.push(openingDelay);

      let cursor = 520;
      next.replaySteps.forEach((step, index) => {
        const launchTimer = window.setTimeout(() => {
          setActiveStepIndex(index);
          setImpactStep(null);
          setBallPhase("rest");
          const aimTimer = window.setTimeout(() => setBallPhase("target"), 32);
          timersRef.current.push(aimTimer);
        }, cursor);
        const impactAt = cursor + animationSpeed + 32;
        const impactTimer = window.setTimeout(() => {
          setImpactStep(step);
          setCrackedBricks((current) => ({ ...current, [step.brickIndex]: step.crackLevel }));
        }, impactAt);
        const revealTimer = window.setTimeout(() => {
          if (step.revealsPrize) {
            const finalHit = next.hitList.find((hit) => hit.id === step.brickId);
            if (finalHit) {
              setRevealedHits((current) => [...current, finalHit]);
              setTotalPulse(true);
              window.setTimeout(() => setTotalPulse(false), 420);
              playWin();
            }
          }
        }, impactAt + brickBreakBonusConfig.brickCrackPauseMs);
        const returnTimer = window.setTimeout(() => {
          setBallPhase("rest");
        }, impactAt + brickBreakBonusConfig.impactPauseMs);
        const clearImpactTimer = window.setTimeout(() => {
          setImpactStep(null);
        }, impactAt + brickBreakBonusConfig.brickCrackPauseMs);
        timersRef.current.push(launchTimer, impactTimer, revealTimer, returnTimer, clearImpactTimer);
        cursor += animationSpeed * 2 + brickBreakBonusConfig.impactPauseMs + 70;
      });

      const ending = window.setTimeout(() => {
        setBallPhase("miss");
        setActiveStepIndex(-1);
        setImpactStep(null);
      }, cursor + 120);
      const settleTimer = window.setTimeout(() => {
        setGameState("gameOver");
        setActiveStepIndex(-1);
        setImpactStep(null);
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
      }, cursor + 760);
      timersRef.current.push(ending, settleTimer);
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

      <div className={totalPulse ? "brick-break-balance pulse" : "brick-break-balance"}>
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
              const showcase = showcaseBricks.find((candidate) => candidate.brickIndex === index);
              const showcaseClass = showcase?.kind === "jackpotTease" ? "jackpot-tease" : showcase?.kind === "nearMiss" ? "near-miss" : "missed-prize";
              const crackLevel = crackedBricks[index] ?? 0;
              const visibleCrackLevel = Math.min(4, Math.max(crackLevel, showcase?.crackLevel ?? 0));
              const impacted = impactStep?.brickIndex === index;
              const targeted = activeStep?.brickIndex === index;
              return (
                <div key={index} className={`brick-tile ${targeted ? "targeted" : ""} ${impacted ? "impact" : ""} ${visibleCrackLevel ? `cracked crack-${visibleCrackLevel}` : ""} ${showcase && !hit ? `showcase ${showcaseClass}` : ""} ${hit ? `broken ${hit.breakType}` : ""} ${hit?.bonusBall ? "bonus" : ""}`.trim()}>
                  {!hit && visibleCrackLevel > 0 && (
                    <span className="brick-crack-mark" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {!hit && showcase && (
                    <span className="brick-showcase-label" aria-label={`Unbroken brick value ${showcase.multiplier}x`}>
                      <strong>{showcase.multiplier}x</strong>
                    </span>
                  )}
                  {hit && (
                    <>
                      <Sparkles size={13} />
                      <span className="brick-prize-label">
                        <small>{hit.breakType === "partial" ? "Chip" : "Prize"}</small>
                        <strong>+{hit.multiplier >= 1 ? `${hit.multiplier}x` : formatCoins(hit.amount)}</strong>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="brick-break-lane" aria-hidden="true">
            {activeStep && <span className="brick-target-beam" />}
            <span className={ballPhase === "miss" ? "brick-ball missed" : "brick-ball"} />
            <span className={ballPhase === "miss" ? "brick-paddle missed" : "brick-paddle"} />
          </div>
          {ballPhase === "miss" && <div className="brick-miss-callout">Paddle missed</div>}
          {revealedHits.slice(-4).map((hit, index) => (
            <span key={hit.id} className="brick-float" style={{ "--float-left": `${8.33 + (hit.brickIndex % 6) * 16.66}%`, "--float-top": `${22 + Math.floor(hit.brickIndex / 6) * 10.5}%`, "--float-delay": `${index * 45}ms` } as CSSProperties}>
              +{hit.amount >= betAmount ? `${hit.multiplier}x` : formatCoins(hit.amount)}
            </span>
          ))}
          {impactStep?.bonusBall && <CoinBurst count={14} />}
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
          <strong>{animationMode === "fast" ? "Fast" : "Normal"} replay</strong>
        </div>
        <div className="brick-break-speed" role="group" aria-label="Animation speed">
          <button type="button" className={animationMode === "normal" ? "active" : ""} disabled={running} onClick={() => setAnimationMode("normal")}>Normal</button>
          <button type="button" className={animationMode === "fast" ? "active" : ""} disabled={running} onClick={() => setAnimationMode("fast")}>Fast</button>
        </div>
        <button className="brick-break-play" disabled={!canPlay} onClick={play}>
          {running ? "Playing" : "Play"}
        </button>
        <div className="demo-copy game-compliance-copy">{COMPLIANCE_COPY}</div>
        {recentRounds.length > 0 && (
          <div className="brick-break-recent" aria-label="Recent Brick Break Bonus rounds">
            {recentRounds.map((round, index) => <strong key={`${round.paid}-${round.net}-${index}`} className={round.net >= 0 ? "win" : "loss"}>{round.net >= 0 ? "+" : ""}{formatCoins(round.net)}</strong>)}
          </div>
        )}
      </section>
    </section>
  );
}
