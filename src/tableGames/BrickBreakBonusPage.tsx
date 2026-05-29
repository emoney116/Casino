import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { Info, Sparkles, X } from "lucide-react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { CoinBurst, ScreenShake, SoundToggle } from "../feedback/components";
import { playBet, playBigWin, playBrickBreakImpact, playBrickCombo, playBrickExplosive, playBrickJackpot, playBrickPaddleHit, playError, playLose, playWin } from "../feedback/feedbackService";
import { recordRetentionRound } from "../retention/retentionService";
import { formatCurrencyDisplay } from "../lib/format";
import type { Currency } from "../types";
import { getBalance } from "../wallet/walletService";
import { BetControls, clampBetAmount } from "./BetControls";
import { brickBreakBonusConfig, generateBrickBreakResult, getBrickBreakBetLimits, type BrickBreakHit, type BrickBreakResult, type BrickBreakState, type BrickBreakStep } from "./brickBreakBonusEngine";

const titleLogoAsset = new URL("../assets/branding/game-logos/brickbreak_logo.png", import.meta.url).href;
const ballAsset = new URL("../assets/brick-break/sprites/ball.png", import.meta.url).href;
const paddleAsset = new URL("../assets/brick-break/sprites/paddle.png", import.meta.url).href;
const brickRedAsset = new URL("../assets/brick-break/sprites/brick-red.png", import.meta.url).href;
const brickBlueAsset = new URL("../assets/brick-break/sprites/brick-blue.png", import.meta.url).href;
const brickGreenAsset = new URL("../assets/brick-break/sprites/brick-green.png", import.meta.url).href;
const brickGoldAsset = new URL("../assets/brick-break/sprites/brick-gold.png", import.meta.url).href;
const brickCrystalAsset = new URL("../assets/brick-break/sprites/brick-crystal.png", import.meta.url).href;
const brickExplosiveAsset = new URL("../assets/brick-break/sprites/brick-explosive.png", import.meta.url).href;
const brickJackpotAsset = new URL("../assets/brick-break/sprites/brick-jackpot.png", import.meta.url).href;
const shatterBurstAsset = new URL("../assets/brick-break/fx/shatter-burst.png", import.meta.url).href;
const sparksAsset = new URL("../assets/brick-break/fx/sparks.png", import.meta.url).href;
const emberBurstAsset = new URL("../assets/brick-break/fx/ember-burst.png", import.meta.url).href;
const crystalShardsAsset = new URL("../assets/brick-break/fx/crystal-shards.png", import.meta.url).href;
const brickBreakBackdrop = new URL("../assets/brick-break/backgrounds/arcade-casino-backdrop.png", import.meta.url).href;

const currencyCopy: Record<Currency, { short: string; label: string }> = {
  GOLD: { short: "GC", label: "GC" },
  BONUS: { short: "SC", label: "SC" },
};

const brickCount = 30;
type BrickImpactFx = "sparks" | "shatter" | "ember" | "crystal";
type BallPhase = "paddle" | "target" | "return" | "miss";

export const brickBreakBonusUiMarkers = {
  gameName: "Brick Break",
  goldBonusToggle: true,
  noSkillAutoplay: true,
  cpuPaddle: true,
  deterministicReplay: true,
  colorCodedBrickValues: true,
  activeBrickValueLabelsHidden: true,
  runningWinningsMeter: true,
  bottomToTopBreakOrder: true,
  stagedBrickBreaks: true,
  readableBrickInterior: true,
  ballTargetsActiveBrick: true,
  configurableAnimationSpeeds: true,
  exposedBrickRule: true,
  prizeRevealAfterFinalCrack: true,
  actualMultiplierBricks: true,
  explosiveBrickTier: true,
  explosiveBrickBlast: true,
  explosiveBlastRtpAccounted: true,
  jackpotBrickTier: true,
  postRoundShowcase: true,
  postRoundAllBrickValues: true,
  noBadBeatCopy: true,
  highMultiplierTeases: true,
  fourCrackStages: true,
  crackStageImages: true,
  postRoundBrokenContrast: true,
  obviousCpuMiss: true,
  compactBottomBetControls: true,
  sharedInfoButton: true,
  rtpUnder95Warning: true,
  sharedSoundToggle: true,
};

export function BrickBreakBonusPage({ onExit }: { onExit?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [currency, setCurrency] = useState<Currency>("GOLD");
  const [betAmount, setBetAmount] = useState(getBrickBreakBetLimits("GOLD").minBet);
  const [gameState, setGameState] = useState<BrickBreakState>("idle");
  const [result, setResult] = useState<BrickBreakResult | null>(null);
  const [revealedHits, setRevealedHits] = useState<BrickBreakHit[]>([]);
  const [activeStepIndex, setActiveStepIndex] = useState(-1);
  const [impactStep, setImpactStep] = useState<BrickBreakStep | null>(null);
  const [impactFx, setImpactFx] = useState<{ key: number; brickIndex: number; kind: BrickImpactFx } | null>(null);
  const [crackedBricks, setCrackedBricks] = useState<Record<number, number>>({});
  const [totalPulse, setTotalPulse] = useState(false);
  const [animationMode] = useState<"normal" | "fast">("normal");
  const [ballPhase, setBallPhase] = useState<BallPhase>("paddle");
  const [rareHit, setRareHit] = useState(false);
  const [freezeFrame, setFreezeFrame] = useState(false);
  const [comboPulse, setComboPulse] = useState(false);
  const [lastWonByCurrency, setLastWonByCurrency] = useState<Record<Currency, number>>({ GOLD: 0, BONUS: 0 });
  const [roundOverlay, setRoundOverlay] = useState<{ amount: number; key: number; tier: "small" | "nice" | "big" | "mega" | "blank" } | null>(null);
  const [recentRounds, setRecentRounds] = useState<Array<{ paid: number; net: number }>>([]);
  const [rulesOpen, setRulesOpen] = useState(false);
  const timersRef = useRef<number[]>([]);

  useEffect(() => () => timersRef.current.forEach((timer) => window.clearTimeout(timer)), []);

  if (!user) return null;
  const currentUser = user;
  const balance = getBalance(currentUser.id, currency);
  const betLimits = getBrickBreakBetLimits(currency);
  const running = gameState === "playing" || gameState === "revealing";
  const winnings = revealedHits.reduce((sum, hit) => sum + hit.amount, 0);
  const combo = revealedHits.length;
  const lastWon = lastWonByCurrency[currency];
  const activeStep = activeStepIndex >= 0 ? result?.replaySteps[activeStepIndex] : null;
  const animationSpeed = animationMode === "fast" ? brickBreakBonusConfig.fastSpeed : brickBreakBonusConfig.normalSpeed;
  const canPlay = !running && betAmount >= betLimits.minBet && betAmount <= betLimits.maxBet && balance >= betAmount;
  const bigWin = Boolean(result && result.totalPaid >= result.betAmount * 5);
  const betExceedsBalance = betAmount > balance;
  const showcaseBricks = result?.showcaseBricks ?? [];
  const boardBricks = result?.boardBricks ?? [];
  const ballStyle = useMemo(() => {
    const outboundMs = Math.max(230, Math.round(animationSpeed * 0.27));
    const returnMs = Math.max(210, Math.round(animationSpeed * 0.25));
    const repositionMs = Math.max(46, Math.round(animationSpeed * 0.055));
    if (ballPhase === "miss") {
      return {
        "--ball-x": "76%",
        "--ball-y": "112%",
        "--ball-current-x": "76%",
        "--ball-current-y": "112%",
        "--paddle-x": "22%",
        "--ball-speed": `${Math.max(210, Math.round(animationSpeed * 0.24))}ms`,
        "--paddle-speed": "120ms",
      } as CSSProperties;
    }
    const index = activeStep?.brickIndex ?? 26;
    const column = index % 6;
    const row = Math.floor(index / 6);
    const targetX = 8.33 + column * 16.66;
    const targetY = 22 + row * 10.5;
    const paddleOffsets = [-7.2, 4.8, -3.6, 3.8, -5.4, 7.2];
    const contactOffset = (paddleOffsets[column] ?? 0) + (row % 2 === 0 ? 1.4 : -1.4);
    const paddleX = Math.max(16, Math.min(84, targetX - contactOffset));
    const paddleY = 91.5;
    const ballX = targetX;
    const ballY = ballPhase === "target" ? targetY : paddleY;
    const ballSpeed = ballPhase === "target" ? outboundMs : ballPhase === "return" ? returnMs : repositionMs;
    return {
      "--ball-x": `${targetX}%`,
      "--ball-y": `${targetY}%`,
      "--ball-current-x": `${ballX}%`,
      "--ball-current-y": `${ballY}%`,
      "--paddle-x": `${paddleX}%`,
      "--ball-speed": `${ballSpeed}ms`,
      "--paddle-speed": `${ballPhase === "paddle" ? repositionMs : Math.max(90, Math.round(animationSpeed * 0.12))}ms`,
    } as CSSProperties;
  }, [activeStep, animationSpeed, ballPhase]);
  const pageStyle = useMemo(() => ({ "--brick-bg": `url(${brickBreakBackdrop})` }) as CSSProperties, []);

  function clampBet(value: number, nextCurrency = currency) {
    const limits = getBrickBreakBetLimits(nextCurrency);
    return clampBetAmount(value, {
      minBet: limits.minBet,
      maxBet: limits.maxBet,
      balance: getBalance(currentUser.id, nextCurrency),
      allowDecimals: nextCurrency === "BONUS",
    });
  }

  function setBet(value: number, nextCurrency = currency) {
    const next = clampBet(value, nextCurrency);
    setBetAmount(next);
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
    if (running) return;
    try {
      clearTimers();
      const next = generateBrickBreakResult({ userId: currentUser.id, currency, betAmount });
      setResult(next);
      setRevealedHits([]);
      setActiveStepIndex(-1);
      setImpactStep(null);
      setImpactFx(null);
      setCrackedBricks({});
      setTotalPulse(false);
      setRareHit(false);
      setFreezeFrame(false);
      setComboPulse(false);
      setRoundOverlay(null);
      setBallPhase("paddle");
      setGameState("playing");
      playBet();

      const openingDelay = window.setTimeout(() => {
        setGameState("revealing");
        if (next.replaySteps.length === 0) setActiveStepIndex(-1);
      }, 360);
      timersRef.current.push(openingDelay);

      let cursor = 360;
      next.replaySteps.forEach((step, index) => {
        const outboundMs = Math.max(230, Math.round(animationSpeed * 0.27));
        const returnMs = Math.max(210, Math.round(animationSpeed * 0.25));
        const repositionMs = Math.max(46, Math.round(animationSpeed * 0.055));
        const reboundDelayMs = 12;
        const launchTimer = window.setTimeout(() => {
          setActiveStepIndex(index);
          setImpactStep(null);
          setBallPhase("paddle");
          const aimTimer = window.setTimeout(() => {
            setBallPhase("target");
            playBrickPaddleHit();
          }, repositionMs + 10);
          timersRef.current.push(aimTimer);
        }, cursor);
        const impactAt = cursor + repositionMs + 10 + outboundMs;
        const impactTimer = window.setTimeout(() => {
          setImpactStep(step);
          setCrackedBricks((current) => ({ ...current, [step.brickIndex]: step.crackLevel }));
          setImpactFx({ key: Date.now() + index, brickIndex: step.brickIndex, kind: getImpactFxKind(step) });
          playBrickImpactSound(step);
          if (step.bonusBall || step.blastBrickIndexes.length > 0 || step.prizeMultiplier >= 5) {
            setFreezeFrame(true);
            const freezeTimer = window.setTimeout(() => setFreezeFrame(false), step.prizeMultiplier >= 25 ? 210 : 120);
            timersRef.current.push(freezeTimer);
          }
          if (step.bonusBall || step.blastBrickIndexes.length > 0 || step.prizeMultiplier >= 25) {
            setRareHit(true);
            const rareTimer = window.setTimeout(() => setRareHit(false), 560);
            timersRef.current.push(rareTimer);
          }
        }, impactAt);
        const revealTimer = window.setTimeout(() => {
          if (step.revealsPrize) {
            const finalHit = next.hitList.find((hit) => hit.id === step.brickId);
            if (finalHit) {
              const blastHits = step.blastHitIds
                .map((hitId) => next.hitList.find((hit) => hit.id === hitId))
                .filter((hit): hit is BrickBreakHit => Boolean(hit));
              setCrackedBricks((current) => step.blastBrickIndexes.reduce((updated, brickIndex) => ({ ...updated, [brickIndex]: 4 }), current));
              setRevealedHits((current) => {
                const seen = new Set(current.map((hit) => hit.id));
                const newHits = [finalHit, ...blastHits].filter((hit) => {
                  if (seen.has(hit.id)) return false;
                  seen.add(hit.id);
                  return true;
                });
                return [...current, ...newHits];
              });
              setTotalPulse(true);
              setComboPulse(true);
              const totalTimer = window.setTimeout(() => setTotalPulse(false), 420);
              const comboTimer = window.setTimeout(() => setComboPulse(false), 360);
              timersRef.current.push(totalTimer, comboTimer);
              if (finalHit.multiplier + step.blastPrizeMultiplier >= 2) playBrickCombo();
              playWin();
            }
          }
        }, impactAt + brickBreakBonusConfig.brickCrackPauseMs);
        const returnTimer = window.setTimeout(() => {
          setBallPhase("return");
        }, impactAt + reboundDelayMs);
        const clearImpactTimer = window.setTimeout(() => {
          setImpactStep(null);
          setImpactFx(null);
        }, impactAt + brickBreakBonusConfig.brickCrackPauseMs);
        timersRef.current.push(launchTimer, impactTimer, revealTimer, returnTimer, clearImpactTimer);
        cursor += repositionMs + outboundMs + returnMs + reboundDelayMs + 56;
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
        setImpactFx(null);
        setLastWonByCurrency((current) => ({ ...current, [next.currency]: next.totalPaid }));
        setRoundOverlay({ amount: next.totalPaid, key: Date.now(), tier: getWinTier(next.totalPaid, next.betAmount) });
        setRecentRounds((current) => [{ paid: next.totalPaid, net: next.net }, ...current].slice(0, 5));
        recordRetentionRound({
          userId: currentUser.id,
          gameId: "brickBreakBonus",
          wager: next.betAmount,
          won: next.totalPaid,
          bonusTriggered: next.hitList.some((hit) => hit.bonusBall || hit.effect === "explosive" || hit.effect === "jackpot"),
          multiplier: next.totalMultiplier,
        });
        refreshUser();
        if (next.totalPaid > 0) {
          if (next.totalPaid >= next.betAmount * 5) playBigWin();
          else playWin();
        } else {
          playLose();
        }
        const overlayTimer = window.setTimeout(() => setRoundOverlay(null), 1900);
        timersRef.current.push(overlayTimer);
      }, cursor + 760);
      timersRef.current.push(ending, settleTimer);
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Unable to play Brick Break.", "error");
      playError();
    }
  }

  return (
    <section className={`brick-break-page ${currency === "BONUS" ? "currency-sc" : "currency-gc"} ${bigWin ? "big-win" : ""}`} style={pageStyle}>
      <header className="brick-break-header">
        <button className="brick-break-back" onClick={onExit} aria-label="Back to games">&lt;</button>
        <div className="brick-break-title">
          <div className="brick-break-title-row">
            <h1><img className="brick-break-title-logo" src={titleLogoAsset} alt="" draggable={false} /> Brick Break</h1>
            <button className="brick-break-info-button" type="button" aria-label="Brick Break rules" onClick={() => setRulesOpen(true)}>
              <Info size={14} />
            </button>
          </div>
          <p>CPU-powered casino brick breaker.</p>
        </div>
        <div className="brick-break-currency-tabs" role="tablist" aria-label="Currency">
          <button type="button" className={currency === "GOLD" ? "active" : ""} disabled={running} onClick={() => selectCurrency("GOLD")}>GC</button>
          <button type="button" className={currency === "BONUS" ? "active" : ""} disabled={running} onClick={() => selectCurrency("BONUS")}>SC</button>
        </div>
        <SoundToggle className="ghost-button icon-only" compact />
      </header>

      <ScreenShake active={Boolean(rareHit || (bigWin && gameState === "gameOver"))}>
        <main className={`brick-break-board ${gameState} ${freezeFrame ? "freeze-frame" : ""}`} style={ballStyle}>
          <div className="brick-break-rail-lights" aria-hidden="true">
            {Array.from({ length: 10 }, (_, index) => <i key={index} />)}
          </div>
          <div className="brick-break-status">
            <span>{running ? "CPU autoplay" : gameState === "gameOver" ? "Round complete" : "Ready"}</span>
            <strong className={comboPulse ? "pulse" : ""}>Combo {combo}x</strong>
          </div>
          <div className="brick-break-grid" aria-label="Brick field">
            {Array.from({ length: brickCount }, (_, index) => {
              const hit = revealedHits.find((candidate) => candidate.brickIndex === index);
              const boardBrick = boardBricks.find((candidate) => candidate.brickIndex === index);
              const showRoundValues = gameState === "gameOver";
              const showcase = showRoundValues ? showcaseBricks.find((candidate) => candidate.brickIndex === index) : undefined;
              const showcaseClass = showcase?.kind === "jackpotTease" ? "jackpot-tease" : showcase?.kind === "nearMiss" ? "near-miss" : "missed-prize";
              const crackLevel = crackedBricks[index] ?? 0;
              const visibleCrackLevel = Math.min(4, Math.max(crackLevel, showRoundValues ? boardBrick?.crackLevel ?? 0 : 0));
              const impacted = impactStep?.brickIndex === index;
              const targeted = activeStep?.brickIndex === index;
              const brickValue = boardBrick?.multiplier ?? hit?.multiplier ?? 0;
              const visibleValue = result ? brickValue : 0;
              const brickEffect = boardBrick?.effect ?? hit?.effect ?? "normal";
              const brickAsset = getBrickAsset(index, visibleValue, Boolean(hit?.bonusBall), brickEffect);
              const brickTier = getBrickTier(visibleValue, Boolean(hit?.bonusBall), brickEffect);
              return (
                <div
                  key={index}
                  className={`brick-tile has-raster ${brickTier} ${brickEffect} ${targeted ? "targeted" : ""} ${impacted ? "impact" : ""} ${visibleCrackLevel ? `cracked crack-${visibleCrackLevel}` : ""} ${showcase && !hit ? `showcase ${showcaseClass}` : ""} ${hit ? `broken ${hit.breakType}` : ""} ${hit?.bonusBall ? "bonus" : ""}`.trim()}
                  data-brick-index={index}
                  data-brick-tier={brickTier}
                  data-brick-multiplier={brickValue || undefined}
                >
                  <img className="brick-art" src={brickAsset} alt="" draggable={false} />
                  {showRoundValues && !hit && brickValue > 0 && (
                    <span className={`brick-value-label ${brickTier}`} aria-label={`Brick value ${formatMultiplier(brickValue)}`}>
                      <strong>{formatMultiplier(brickValue)}</strong>
                    </span>
                  )}
                  {!hit && visibleCrackLevel > 0 && (
                    <span className="brick-crack-mark" aria-hidden="true">
                      <i />
                      <i />
                      <i />
                      <i />
                    </span>
                  )}
                  {hit && (
                    <>
                      <Sparkles size={13} />
                      <span className="brick-prize-label">
                        <small>Multiplier</small>
                        <strong>+{formatMultiplier(hit.multiplier)}</strong>
                      </span>
                    </>
                  )}
                </div>
              );
            })}
          </div>
          <div className="brick-break-lane" aria-hidden="true">
            {activeStep && <span className="brick-target-beam" />}
            {impactFx && (
              <img
                key={impactFx.key}
                className={`brick-impact-fx ${impactFx.kind}`}
                src={getImpactFxAsset(impactFx.kind)}
                alt=""
                draggable={false}
                style={{ "--fx-left": `${8.33 + (impactFx.brickIndex % 6) * 16.66}%`, "--fx-top": `${22 + Math.floor(impactFx.brickIndex / 6) * 10.5}%` } as CSSProperties}
              />
            )}
            <span className={`brick-ball ${ballPhase} ${ballPhase === "miss" ? "missed" : ""}`.trim()}><img src={ballAsset} alt="" draggable={false} /></span>
            <span className={`brick-paddle ${ballPhase === "target" ? "bounce" : ""} ${ballPhase === "miss" ? "missed" : ""}`.trim()}><img src={paddleAsset} alt="" draggable={false} /></span>
          </div>
          {ballPhase === "miss" && <div className="brick-miss-callout">Paddle missed</div>}
          {revealedHits.slice(-4).map((hit, index) => (
            <span key={hit.id} className="brick-float" style={{ "--float-left": `${8.33 + (hit.brickIndex % 6) * 16.66}%`, "--float-top": `${22 + Math.floor(hit.brickIndex / 6) * 10.5}%`, "--float-delay": `${index * 45}ms` } as CSSProperties}>
              +{formatMultiplier(hit.multiplier)}
            </span>
          ))}
          {impactStep?.bonusBall && <CoinBurst count={14} />}
        </main>
      </ScreenShake>

      {roundOverlay && (
        <div key={roundOverlay.key} className={`brick-break-win-popover ${roundOverlay.tier}`} role="status" aria-live="polite">
          <span>{roundOverlay.amount > 0 ? getWinTitle(roundOverlay.tier) : "No win"}</span>
          <strong>{roundOverlay.amount > 0 ? formatCurrencyValue(roundOverlay.amount, currency) : "Try Again"}</strong>
        </div>
      )}

      <section className="brick-break-controls">
        <BetControls
          className={totalPulse ? "pulse" : ""}
          currentBet={betAmount}
          minBet={betLimits.minBet}
          maxBet={betLimits.maxBet}
          balance={balance}
          currency={currency}
          increment={betLimits.minBet}
          allowDecimals={currency === "BONUS"}
          disabled={running}
          leadingInfo={`Last won: ${formatCurrencyValue(lastWon, currency)}`}
          onBetChange={(amount) => setBet(amount)}
        />
        <button className="brick-break-play" disabled={!canPlay} onClick={play}>
          {getPlayButtonLabel({ running, betExceedsBalance, roundComplete: gameState === "gameOver", currency })}
        </button>
        {recentRounds.length > 0 && (
          <div className="brick-break-recent" aria-label="Recent Brick Break rounds">
            {recentRounds.map((round, index) => <strong key={`${round.paid}-${round.net}-${index}`} className={round.net >= 0 ? "win" : "loss"}>{round.net >= 0 ? "+" : ""}{formatCurrencyValue(round.net, currency)}</strong>)}
          </div>
        )}
      </section>

      {rulesOpen && (
        <div className="brick-break-rules-backdrop" role="presentation" onClick={() => setRulesOpen(false)}>
          <section className="brick-break-rules" role="dialog" aria-modal="true" aria-labelledby="brick-break-rules-title" onClick={(event) => event.stopPropagation()}>
            <header>
              <h2 id="brick-break-rules-title">Brick Break Rules</h2>
              <button type="button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={16} /></button>
            </header>
            <ul>
              <li>Choose GC or SC before you play. The active currency sets your balance, bet limits, and payout display.</li>
              <li>Press Play to start an automatic CPU paddle replay. Brick Break is not a skill game.</li>
              <li>Hidden bricks keep their values concealed during play. After the round, colors show value tiers.</li>
              <li>Cracked bricks need more impacts before they break. A payout is credited only when the final crack breaks the brick.</li>
              <li>Rare explosive bricks blast neighboring tiles when they trigger.</li>
              <li>GC bets run from 1 to 1,000,000. SC bets run from 0.01 to 100.</li>
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

function formatCurrencyValue(amount: number, currency: Currency) {
  return formatCurrencyDisplay(amount, currency);
}

function formatMultiplier(multiplier: number) {
  return `${Number.isInteger(multiplier) ? multiplier.toFixed(0) : multiplier.toFixed(2).replace(/0$/, "")}x`;
}

function getBrickAsset(index: number, multiplier: number, bonusBall = false, effect: BrickBreakHit["effect"] = "normal") {
  if (effect === "explosive") return brickExplosiveAsset;
  if (effect === "jackpot") return brickJackpotAsset;
  if (bonusBall || multiplier >= 50) return brickJackpotAsset;
  if (multiplier >= 25) return brickExplosiveAsset;
  if (multiplier >= 5) return brickCrystalAsset;
  if (multiplier >= 2) return brickGoldAsset;
  if (multiplier >= 1) return brickGreenAsset;
  if (multiplier >= 0.5) return brickBlueAsset;
  if (multiplier > 0) return brickRedAsset;
  const standard = [brickRedAsset, brickBlueAsset, brickGreenAsset, brickGoldAsset, brickCrystalAsset];
  return standard[index % standard.length] ?? brickRedAsset;
}

function getBrickTier(multiplier: number, bonusBall = false, effect: BrickBreakHit["effect"] = "normal") {
  if (effect === "explosive") return "explosive";
  if (effect === "jackpot") return "jackpot";
  if (bonusBall || multiplier >= 50) return "jackpot";
  if (multiplier >= 25) return "explosive";
  if (multiplier >= 5) return "crystal";
  if (multiplier >= 2) return "gold";
  if (multiplier >= 1) return "green";
  if (multiplier >= 0.5) return "blue";
  if (multiplier > 0) return "red";
  return "standard";
}

function getImpactFxKind(step: BrickBreakStep): BrickImpactFx {
  if (step.blastBrickIndexes.length > 0) return "ember";
  if (step.bonusBall || step.prizeMultiplier >= 50) return "crystal";
  if (step.prizeMultiplier >= 25) return "ember";
  if (step.revealsPrize) return "shatter";
  return "sparks";
}

function getImpactFxAsset(kind: BrickImpactFx) {
  if (kind === "crystal") return crystalShardsAsset;
  if (kind === "ember") return emberBurstAsset;
  if (kind === "shatter") return shatterBurstAsset;
  return sparksAsset;
}

function playBrickImpactSound(step: BrickBreakStep) {
  if (step.blastBrickIndexes.length > 0) {
    playBrickExplosive();
    return;
  }
  if (step.bonusBall || step.prizeMultiplier >= 50) {
    playBrickJackpot();
    return;
  }
  if (step.prizeMultiplier >= 25) {
    playBrickExplosive();
    return;
  }
  playBrickBreakImpact();
}

function getWinTier(amount: number, betAmount: number): "small" | "nice" | "big" | "mega" | "blank" {
  if (amount <= 0) return "blank";
  if (amount >= betAmount * 25) return "mega";
  if (amount >= betAmount * 5) return "big";
  if (amount >= betAmount * 2) return "nice";
  return "small";
}

function getWinTitle(tier: "small" | "nice" | "big" | "mega" | "blank") {
  if (tier === "mega") return "Mega Win";
  if (tier === "big") return "Big Win";
  if (tier === "nice") return "Nice Win";
  if (tier === "small") return "Win";
  return "No Win";
}

function getPlayButtonLabel({
  running,
  betExceedsBalance,
  roundComplete,
  currency,
}: {
  running: boolean;
  betExceedsBalance: boolean;
  roundComplete: boolean;
  currency: Currency;
}) {
  if (running) return "Round Active";
  if (betExceedsBalance) return `Bet exceeds ${currencyCopy[currency].short} balance`;
  return roundComplete ? "Play Again" : "Play";
}
