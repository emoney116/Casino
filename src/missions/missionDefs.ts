import type { Currency, MissionPeriod } from "../types";

export interface MissionDefinition {
  id: string;
  title: string;
  description: string;
  metric: "SPINS" | "WINS" | "WAGER" | "BONUS" | "GAMES" | "LEVEL";
  target: number;
  rewardCurrency: Currency;
  rewardAmount: number;
  resetPeriod: MissionPeriod;
}

export const missionDefs: MissionDefinition[] = [
  { id: "daily-spins", title: "Spin 20 times", description: "Play any slots today.", metric: "SPINS", target: 20, rewardCurrency: "BONUS", rewardAmount: 500, resetPeriod: "DAILY" },
  { id: "daily-wins", title: "Win 5 times", description: "Land 5 winning spins.", metric: "WINS", target: 5, rewardCurrency: "BONUS", rewardAmount: 650, resetPeriod: "DAILY" },
  { id: "daily-wager", title: "Wager 1,000 coins", description: "Use Gold or Bonus Coins.", metric: "WAGER", target: 1000, rewardCurrency: "BONUS", rewardAmount: 700, resetPeriod: "DAILY" },
  { id: "daily-bonus", title: "Trigger any bonus", description: "Find scatters or bonus symbols.", metric: "BONUS", target: 1, rewardCurrency: "BONUS", rewardAmount: 800, resetPeriod: "DAILY" },
  { id: "daily-games", title: "Play 3 games", description: "Try three different slots.", metric: "GAMES", target: 3, rewardCurrency: "BONUS", rewardAmount: 750, resetPeriod: "DAILY" },
  { id: "weekly-spins", title: "Spin 200 times", description: "Weekly play goal.", metric: "SPINS", target: 200, rewardCurrency: "BONUS", rewardAmount: 2500, resetPeriod: "WEEKLY" },
  { id: "weekly-wins", title: "Win 50 times", description: "Weekly win goal.", metric: "WINS", target: 50, rewardCurrency: "BONUS", rewardAmount: 3000, resetPeriod: "WEEKLY" },
  { id: "weekly-wager", title: "Wager 25,000 coins", description: "Across any slots.", metric: "WAGER", target: 25000, rewardCurrency: "BONUS", rewardAmount: 3500, resetPeriod: "WEEKLY" },
  { id: "weekly-bonus", title: "Trigger 10 bonuses", description: "Any bonus feature counts.", metric: "BONUS", target: 10, rewardCurrency: "BONUS", rewardAmount: 4000, resetPeriod: "WEEKLY" },
  { id: "weekly-level", title: "Reach a new level", description: "Level up this week.", metric: "LEVEL", target: 1, rewardCurrency: "GOLD", rewardAmount: 400, resetPeriod: "WEEKLY" },
];
