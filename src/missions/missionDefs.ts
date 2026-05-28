import type { Currency, MissionPeriod } from "../types";
import { assertSafeRewardGrant } from "../retention/rewardConfig";

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  metric: "ROUNDS" | "SPINS" | "WINS" | "WAGER" | "BONUS" | "GAMES" | "LEVEL" | "MULTIPLIER";
  target: number;
  multiplierTarget?: number;
  rewardCurrency: Currency;
  rewardAmount: number;
  resetPeriod: MissionPeriod;
  promoApproved?: boolean;
}

export const missionDefs: MissionDefinition[] = [
  { id: "daily-rounds", title: "Play 5 rounds", description: "Play any 5 virtual game rounds today.", metric: "ROUNDS", target: 5, rewardCurrency: "GOLD", rewardAmount: 2500, resetPeriod: "DAILY" },
  { id: "daily-wins", title: "Win 3 rounds", description: "Win 3 rounds in any game.", metric: "WINS", target: 3, rewardCurrency: "GOLD", rewardAmount: 3000, resetPeriod: "DAILY" },
  { id: "daily-multiplier", title: "Hit 10x+", description: "Land any result at 10x or better.", metric: "MULTIPLIER", multiplierTarget: 10, target: 1, rewardCurrency: "GOLD", rewardAmount: 5000, resetPeriod: "DAILY" },
  { id: "daily-games", title: "Try 3 games", description: "Play three different games.", metric: "GAMES", target: 3, rewardCurrency: "GOLD", rewardAmount: 4000, resetPeriod: "DAILY" },
  { id: "daily-wager", title: "Wager 1,000 GC", description: "Wager 1,000 Gold Coins today.", metric: "WAGER", target: 1000, rewardCurrency: "GOLD", rewardAmount: 2500, resetPeriod: "DAILY" },
  { id: "daily-bonus", title: "Trigger bonus", description: "Find scatters or bonus symbols.", metric: "BONUS", target: 1, rewardCurrency: "GOLD", rewardAmount: 5000, resetPeriod: "DAILY" },
];

missionDefs.forEach((mission) => {
  assertSafeRewardGrant(
    { currency: mission.rewardCurrency, amount: mission.rewardAmount, promoApproved: mission.promoApproved },
    `Mission ${mission.id}`,
  );
});
