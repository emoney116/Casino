import { readData, updateData } from "../lib/storage";
import { creditCurrency } from "../wallet/walletService";
import type { MissionProgress, MissionState } from "../types";
import { missionDefs } from "./missionDefs";

function periodExpired(lastResetAt: string, period: "DAILY" | "WEEKLY") {
  const ageHours = (Date.now() - new Date(lastResetAt).getTime()) / 36e5;
  return period === "DAILY" ? ageHours >= 24 : ageHours >= 24 * 7;
}

function freshProgress(): MissionProgress {
  return { progress: 0, status: "ACTIVE", lastResetAt: new Date().toISOString(), playedGames: [] };
}

export function getMissions(userId: string): MissionState {
  const stored = readData().missions[userId] ?? {};
  const next: MissionState = {};
  for (const def of missionDefs) {
    const current = stored[def.id] ?? freshProgress();
    next[def.id] = periodExpired(current.lastResetAt, def.resetPeriod) ? freshProgress() : current;
  }
  return next;
}

export function recordMissionEvent(input: {
  userId: string;
  gameId: string;
  wager: number;
  won: number;
  bonusTriggered: boolean;
  leveledUp: boolean;
  multiplier?: number;
}) {
  let completed: string[] = [];
  updateData((data) => {
    const state = getMissions(input.userId);
    for (const def of missionDefs) {
      const mission = state[def.id];
      if (mission.status === "CLAIMED") continue;
      if (def.metric === "ROUNDS") mission.progress += 1;
      if (def.metric === "SPINS") mission.progress += 1;
      if (def.metric === "WINS" && input.won > 0) mission.progress += 1;
      if (def.metric === "WAGER") mission.progress += input.wager;
      if (def.metric === "BONUS" && input.bonusTriggered) mission.progress += 1;
      if (def.metric === "LEVEL" && input.leveledUp) mission.progress += 1;
      if (def.metric === "MULTIPLIER" && (input.multiplier ?? 0) > 2) mission.progress += 1;
      if (def.metric === "GAMES") {
        const played = new Set(mission.playedGames ?? []);
        played.add(input.gameId);
        mission.playedGames = [...played];
        mission.progress = played.size;
      }
      if (mission.progress >= def.target && mission.status === "ACTIVE") {
        mission.status = "CLAIMABLE";
        completed.push(def.title);
      }
    }
    data.missions[input.userId] = state;
  });
  return completed;
}

export function claimMission(userId: string, missionId: string) {
  const def = missionDefs.find((mission) => mission.id === missionId);
  if (!def) throw new Error("Mission not found.");
  updateData((data) => {
    const state = getMissions(userId);
    if (state[missionId].status !== "CLAIMABLE") throw new Error("Mission is not claimable.");
    state[missionId].status = "CLAIMED";
    data.missions[userId] = state;
  });
  return creditCurrency({
    userId,
    type: "MISSION_REWARD",
    currency: def.rewardCurrency,
    amount: def.rewardAmount,
    metadata: { missionId, title: def.title },
  });
}

export function resetMissions(userId: string) {
  updateData((data) => {
    delete data.missions[userId];
  });
}
