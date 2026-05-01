import type { Currency } from "../types";
import { createId } from "../lib/ids";
import { placeTableBet, settleTableResult } from "./ledger";
import { treasureDigConfig } from "./configs";
import type { TreasureDigConfig, TreasureDigRound } from "./types";

export function getTreasureTileCount(config: TreasureDigConfig = treasureDigConfig) {
  return config.gridSize * config.gridSize;
}

export function clampTreasureTrapCount(trapCount: number, config: TreasureDigConfig = treasureDigConfig) {
  return Math.max(config.minTraps, Math.min(config.maxTraps, Math.round(trapCount)));
}

export function getTreasureDigMultiplier({
  safePicks,
  trapCount,
  config = treasureDigConfig,
}: {
  safePicks: number;
  trapCount: number;
  config?: TreasureDigConfig;
}) {
  const totalTiles = getTreasureTileCount(config);
  const traps = clampTreasureTrapCount(trapCount, config);
  const safeTiles = totalTiles - traps;
  const picks = Math.max(0, Math.min(safeTiles, Math.round(safePicks)));
  if (picks === 0) return 1;

  let survivalProbability = 1;
  for (let pick = 0; pick < picks; pick += 1) {
    survivalProbability *= (safeTiles - pick) / (totalTiles - pick);
  }

  const multiplier = (1 / survivalProbability) * (1 - config.edge);
  return Math.max(1, Math.floor(multiplier * 100) / 100);
}

export function createTreasureTrapIndexes({
  trapCount,
  random = Math.random,
  config = treasureDigConfig,
}: {
  trapCount: number;
  random?: () => number;
  config?: TreasureDigConfig;
}) {
  const totalTiles = getTreasureTileCount(config);
  const traps = clampTreasureTrapCount(trapCount, config);
  const indexes = Array.from({ length: totalTiles }, (_, index) => index);
  for (let index = indexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [indexes[index], indexes[swapIndex]] = [indexes[swapIndex], indexes[index]];
  }
  return indexes.slice(0, traps).sort((a, b) => a - b);
}

export function startTreasureDigRound({
  userId,
  currency,
  betAmount,
  trapCount,
  trapIndexes,
  config = treasureDigConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  trapCount: number;
  trapIndexes?: number[];
  config?: TreasureDigConfig;
}): TreasureDigRound {
  const traps = clampTreasureTrapCount(trapCount, config);
  const totalTiles = getTreasureTileCount(config);
  const nextTrapIndexes = trapIndexes ?? createTreasureTrapIndexes({ trapCount: traps, config });
  if (nextTrapIndexes.length !== traps || nextTrapIndexes.some((index) => index < 0 || index >= totalTiles)) {
    throw new Error("Invalid Treasure Dig trap layout.");
  }

  placeTableBet(userId, currency, betAmount, config, { trapCount: traps });
  return {
    id: createId("dig"),
    status: "RUNNING",
    currency,
    betAmount,
    gridSize: config.gridSize,
    trapCount: traps,
    trapIndexes: nextTrapIndexes,
    pickedIndexes: [],
    currentMultiplier: 1,
  };
}

export function pickTreasureTile({
  round,
  userId,
  tileIndex,
  config = treasureDigConfig,
}: {
  round: TreasureDigRound;
  userId: string;
  tileIndex: number;
  config?: TreasureDigConfig;
}): TreasureDigRound {
  if (round.status !== "RUNNING") return round;
  const totalTiles = getTreasureTileCount(config);
  if (tileIndex < 0 || tileIndex >= totalTiles) throw new Error("Treasure tile is outside the grid.");
  if (round.pickedIndexes.includes(tileIndex)) throw new Error("That treasure tile is already open.");

  if (round.trapIndexes.includes(tileIndex)) {
    const settlement = settleTableResult({
      userId,
      currency: round.currency,
      config,
      result: "LOSS",
      amountPaid: 0,
      wagered: round.betAmount,
      metadata: { trapCount: round.trapCount, safePicks: round.pickedIndexes.length, trappedTile: tileIndex },
    });
    return { ...round, status: "TRAPPED", pickedIndexes: [...round.pickedIndexes, tileIndex], totalPaid: 0, settlement };
  }

  const pickedIndexes = [...round.pickedIndexes, tileIndex];
  return {
    ...round,
    pickedIndexes,
    currentMultiplier: getTreasureDigMultiplier({ safePicks: pickedIndexes.length, trapCount: round.trapCount, config }),
  };
}

export function cashOutTreasureDigRound({
  round,
  userId,
  config = treasureDigConfig,
}: {
  round: TreasureDigRound;
  userId: string;
  config?: TreasureDigConfig;
}): TreasureDigRound {
  if (round.status !== "RUNNING") return round;
  const multiplier = getTreasureDigMultiplier({ safePicks: round.pickedIndexes.length, trapCount: round.trapCount, config });
  const settlement = settleTableResult({
    userId,
    currency: round.currency,
    config,
    result: "WIN",
    amountPaid: round.betAmount * multiplier,
    wagered: round.betAmount,
    metadata: { trapCount: round.trapCount, safePicks: round.pickedIndexes.length, multiplier },
  });
  return {
    ...round,
    status: "CASHED_OUT",
    currentMultiplier: multiplier,
    totalPaid: settlement.amountPaid,
    settlement,
  };
}
