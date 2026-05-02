import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { claimMission, getMissions } from "./missionService";
import { missionDefs } from "./missionDefs";

export function MissionsPanel({ compact = false }: { compact?: boolean }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [version, setVersion] = useState(0);
  if (!user) return null;
  const currentUser = user;
  const state = getMissions(currentUser.id);
  const visible = compact ? missionDefs.slice(0, 5) : missionDefs;

  function claim(id: string) {
    try {
      claimMission(currentUser.id, id);
      refreshUser();
      setVersion((value) => value + 1);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Mission unavailable.", "error");
    }
  }

  return (
    <article className="card missions-panel" key={version}>
      <div className="section-title">
        <div>
          <p className="eyebrow">Missions</p>
          <h2>{compact ? "Daily Missions" : "Daily & Weekly Missions"}</h2>
        </div>
      </div>
      <div className="mission-list">
        {visible.map((mission) => {
          const progress = state[mission.id];
          const pct = Math.min(100, (progress.progress / mission.target) * 100);
          return (
            <div className="mission-row" key={mission.id}>
              <div>
                <strong>{mission.title}</strong>
                <small>{mission.description}</small>
                <div className="xp-track"><i style={{ width: `${pct}%` }} /></div>
                <small>{Math.min(progress.progress, mission.target)} / {mission.target}</small>
              </div>
              <button className="ghost-button" disabled={progress.status !== "CLAIMABLE"} onClick={() => claim(mission.id)}>
                {progress.status === "CLAIMED" ? "Claimed" : `${formatCoins(mission.rewardAmount)} ${mission.rewardCurrency}`}
              </button>
            </div>
          );
        })}
      </div>
    </article>
  );
}
