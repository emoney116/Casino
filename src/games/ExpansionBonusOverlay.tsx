import { useEffect, useMemo, useState } from "react";
import { playBigWin, playBonus, playExpansionHit, playMultiplierTick } from "../feedback/feedbackService";
import { formatCurrencyDisplay } from "../lib/format";
import type { ExpansionBonusConfig, ExpansionBonusResult } from "./types";

export interface ExpansionBonusTheme {
  title: string;
  introLabel?: string;
  finalLabel?: string;
  backdropLabel?: string;
  accent: string;
  secondary: string;
  panel: string;
}

export function ExpansionBonusOverlay({
  open,
  theme,
  triggerPositions,
  result,
  config,
  betAmount,
  onComplete,
}: {
  open: boolean;
  theme: ExpansionBonusTheme;
  triggerPositions: Array<{ reel: number; row: number }>;
  result: ExpansionBonusResult;
  config?: ExpansionBonusConfig;
  betAmount: number;
  onComplete: () => void;
}) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [complete, setComplete] = useState(false);
  const activeRound = result.rounds[Math.min(roundIndex, Math.max(0, result.rounds.length - 1))];
  const activePositions = useMemo(() => triggerPositions.map((position) => `${position.reel}:${position.row}`), [triggerPositions]);
  const isMineClash = result.sourceFeature === "mine-clash";
  const winnerLabel = result.mineClash?.winner === "diamond" ? "Diamond Miner" : "Gold Miner";
  const winnerMultiplier = result.multiplier;

  useEffect(() => {
    if (!open) return;
    setRoundIndex(0);
    setComplete(false);
    playExpansionHit();
    playBonus();
  }, [open]);

  useEffect(() => {
    if (!open || complete) return;
    if (roundIndex >= result.rounds.length - 1) {
      const timeout = window.setTimeout(() => {
        setComplete(true);
        if (result.multiplier >= 50) playBigWin();
      }, 980);
      return () => window.clearTimeout(timeout);
    }
    const phaseDelay = isMineClash
      ? activeRound?.phaseId === "vs-flash"
        ? 400
        : activeRound?.phaseId === "frame-expand"
          ? 820
          : activeRound?.phaseId === "mining"
            ? 2100
            : activeRound?.phaseId === "winner"
              ? 900
              : 700
      : activeRound?.phaseId === "escape" ? 1180 : 920;
    const timeout = window.setTimeout(() => {
      playMultiplierTick();
      setRoundIndex((value) => value + 1);
    }, phaseDelay);
    return () => window.clearTimeout(timeout);
  }, [activeRound?.phaseId, complete, isMineClash, open, result.multiplier, result.rounds.length, roundIndex]);

  if (!open) return null;

  return (
    <div
      className={`expansion-bonus-overlay ${isMineClash ? "mine-clash-overlay" : ""} ${complete ? "complete" : "running"} phase-${activeRound?.phaseId ?? "intro"} winner-${result.mineClash?.winner ?? "none"}`}
      role="dialog"
      aria-modal="true"
      aria-label={theme.title}
      style={{
        "--expansion-accent": theme.accent,
        "--expansion-secondary": theme.secondary,
        "--expansion-panel": theme.panel,
        "--frame-start": result.frame?.startReel ?? 0,
        "--frame-width": result.frame?.width ?? 2,
        "--frame-row-start": result.frame?.rowStart ?? 0,
        "--frame-row-count": result.frame?.rowCount ?? 3,
        "--frame-reel-count": result.frame?.reelCount ?? 5,
      } as React.CSSProperties}
    >
      <div className="expansion-reel-dim" aria-hidden="true" />
      <div className="expansion-trigger-map" aria-hidden="true">
        {activePositions.map((position, index) => {
          const [reel, row] = position.split(":").map(Number);
          return (
            <span
              key={position}
              style={{
                "--trigger-reel": reel,
                "--trigger-row": row,
                "--trigger-index": index,
              } as React.CSSProperties}
            />
          );
        })}
      </div>
      <div className="expansion-frame-shell" aria-hidden="true">
        <span className="ore-corner gold" />
        <span className="ore-corner diamond" />
        <span className="ore-corner ember" />
        <span className="ore-corner quartz" />
      </div>
      <div className="expansion-bonus-stage">
        <div className={isMineClash ? "expansion-mine-scene" : "expansion-train-scene"} aria-hidden="true">
          <i className="train-light left" />
          <i className="train-light right" />
          <i className="vault-door" />
          <i className="dust-line" />
          {Array.from({ length: 18 }, (_, index) => <span key={index} style={{ "--particle-index": index } as React.CSSProperties} />)}
        </div>
        {isMineClash ? (
          <div className="mine-clash-copy">
            <span>{complete ? (theme.finalLabel ?? "Multiplier Wild Payout") : (theme.introLabel ?? "Mine Clash")}</span>
            <h2>{complete ? `${winnerLabel} Wins` : activeRound?.phaseTitle ?? "Mine Clash"}</h2>
            <div className="miner-duel">
              <div className={`miner-card gold ${result.mineClash?.winner === "gold" ? "winner" : ""}`}>
                <i className="miner-silhouette" />
                <span>Gold Miner</span>
                <strong>{result.mineClash?.goldMultiplier ?? 0}x</strong>
                <em style={{ "--meter": `${Math.min(100, ((result.mineClash?.goldMultiplier ?? 0) / 50) * 100)}%` } as React.CSSProperties} />
              </div>
              <div className="mine-vs-badge">VS</div>
              <div className={`miner-card diamond ${result.mineClash?.winner === "diamond" ? "winner" : ""}`}>
                <i className="miner-silhouette" />
                <span>Diamond Miner</span>
                <strong>{result.mineClash?.diamondMultiplier ?? 0}x</strong>
                <em style={{ "--meter": `${Math.min(100, ((result.mineClash?.diamondMultiplier ?? 0) / 50) * 100)}%` } as React.CSSProperties} />
              </div>
            </div>
            <strong className="mine-clash-multiplier">{complete ? `${winnerMultiplier}x` : activeRound?.phaseId === "winner" || activeRound?.phaseId === "wild-transform" ? `${winnerMultiplier}x` : "..."}</strong>
            <p>{complete ? `${result.transformedPositions?.length ?? 0} multiplier wilds paid ${formatCurrencyDisplay(result.payout)}` : activeRound?.label ?? "The chamber is opening"}</p>
          </div>
        ) : (
          <div className="expansion-bonus-copy">
            <span>{complete ? (theme.finalLabel ?? config?.labels?.final ?? "Final Payout") : (theme.introLabel ?? config?.labels?.intro ?? "Expansion Bonus")}</span>
            <h2>{complete ? theme.title : activeRound?.phaseTitle ?? theme.title}</h2>
            <strong>{activeRound ? `${activeRound.totalMultiplier}x` : "0x"}</strong>
            {!complete && activeRound && (
              <p>
                {activeRound.label} <b>+{activeRound.gain}x</b>
              </p>
            )}
            {complete && (
              <p>
                {result.multiplier}x on {formatCurrencyDisplay(betAmount)} = <b>{formatCurrencyDisplay(result.payout)}</b>
              </p>
            )}
          </div>
        )}
        <button type="button" className="primary-button expansion-complete-button" disabled={!complete} onClick={onComplete}>
          {complete ? "Collect" : "Resolving"}
        </button>
      </div>
    </div>
  );
}
