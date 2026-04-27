import { formatCoins } from "../lib/format";
import { xpForLevel } from "./progressionService";
import type { PlayerProgression } from "../types";

export function ProgressionBar({ progress }: { progress: PlayerProgression }) {
  const currentFloor = xpForLevel(progress.level);
  const next = xpForLevel(progress.level + 1);
  const pct = Math.max(0, Math.min(100, ((progress.xp - currentFloor) / (next - currentFloor)) * 100));

  return (
    <div className="progression-card card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Player level</p>
          <h2>Level {progress.level}</h2>
        </div>
        <span>{formatCoins(progress.xp)} XP</span>
      </div>
      <div className="xp-track"><i style={{ width: `${pct}%` }} /></div>
      <small>{formatCoins(Math.max(0, next - progress.xp))} XP to next virtual reward</small>
    </div>
  );
}
