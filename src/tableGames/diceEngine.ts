import type { Currency } from "../types";
import { diceConfig } from "./configs";
import { placeTableBet, settleTableResult } from "./ledger";
import type { DiceConfig, DiceDirection, DiceResult } from "./types";

export function getDiceChance(direction: DiceDirection, target: number) {
  return direction === "over" ? (100 - target) / 100 : (target - 1) / 100;
}

export function getDiceReturnMultiplier(direction: DiceDirection, target: number, config: DiceConfig = diceConfig) {
  const chance = Math.max(0.01, getDiceChance(direction, target));
  return (1 / chance) * (1 - config.edge);
}

export function resolveDiceBet({
  userId,
  currency,
  betAmount,
  direction,
  target,
  roll = Math.floor(Math.random() * 100) + 1,
  config = diceConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  direction: DiceDirection;
  target: number;
  roll?: number;
  config?: DiceConfig;
}): DiceResult {
  if (target < config.minTarget || target > config.maxTarget) {
    throw new Error(`Target must be between ${config.minTarget} and ${config.maxTarget}.`);
  }
  placeTableBet(userId, currency, betAmount, config, { direction, target });
  const won = direction === "over" ? roll > target : roll < target;
  const totalReturnMultiplier = getDiceReturnMultiplier(direction, target, config);
  const totalPaid = won ? betAmount * totalReturnMultiplier : 0;
  const settlement = settleTableResult({
    userId,
    currency,
    config,
    result: won ? "WIN" : "LOSS",
    amountPaid: totalPaid,
    wagered: betAmount,
    metadata: { direction, target, roll, totalReturnMultiplier },
  });
  return { roll, won, totalReturnMultiplier, totalPaid: settlement.amountPaid, settlement };
}
