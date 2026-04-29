import type { BlackjackConfig, DiceConfig, RouletteConfig, TableGameConfig } from "./types";

const demoOnlyCopy =
  "Demo table game using virtual coins only. No cash value, deposits, withdrawals, prizes, or redemptions.";

export const blackjackConfig: BlackjackConfig = {
  id: "blackjack",
  name: "Blackjack",
  theme: "Green felt cards",
  minBet: 10,
  maxBet: 500,
  minBetGold: 10,
  maxBetGold: 500,
  minBetRealCentsPlaceholder: 1,
  maxBetRealCentsPlaceholder: 500,
  maxPayout: 5000,
  houseEdgeTarget: 0.018,
  currency: "GOLD",
  demoOnlyCopy,
  rules: ["Dealer hits soft 17", "Blackjack pays 3:2", "Push on tied totals", "Double down allowed"],
  dealerHitsSoft17: true,
  blackjackPayout: 1.5,
  doubleDownAllowed: true,
  // Demo tuning only. Real-money games need certified RNG, math, legal, and responsible gaming review.
  dealerAdvantageAssistRate: 0.04,
};

export const rouletteConfig: RouletteConfig = {
  id: "roulette",
  name: "Roulette",
  theme: "American double-zero wheel",
  minBet: 10,
  maxBet: 250,
  minBetGold: 10,
  maxBetGold: 250,
  minBetRealCentsPlaceholder: 1,
  maxBetRealCentsPlaceholder: 250,
  maxPayout: 10000,
  houseEdgeTarget: 0.0526,
  currency: "GOLD",
  demoOnlyCopy,
  rules: ["American roulette with 0 and 00", "Even-money bets pay 1:1", "Straight numbers pay 35:1"],
  payouts: {
    color: 1,
    parity: 1,
    range: 1,
    dozen: 2,
    column: 2,
    straight: 35,
  },
};

export const diceConfig: DiceConfig = {
  id: "dice",
  name: "Dice Hi-Lo",
  theme: "Probability dice table",
  minBet: 10,
  maxBet: 500,
  minBetGold: 10,
  maxBetGold: 500,
  minBetRealCentsPlaceholder: 1,
  maxBetRealCentsPlaceholder: 500,
  maxPayout: 12000,
  houseEdgeTarget: 0.03,
  currency: "GOLD",
  demoOnlyCopy,
  rules: ["Choose over or under a target", "Payout is based on probability minus a configurable demo house edge"],
  edge: 0.03,
  minTarget: 2,
  maxTarget: 98,
};

export const tableGameConfigs: TableGameConfig[] = [blackjackConfig, rouletteConfig, diceConfig];
