import type { Currency } from "../types";
import { createId } from "../lib/ids";
import { placeTableBet, settleTableResult } from "./ledger";
import { treasureDigConfig } from "./configs";
import type { TreasureDigConfig, TreasureDigRound, TreasureMultiplierTile } from "./types";

export function getTreasureTileCount(config: TreasureDigConfig = treasureDigConfig) {
  return config.gridSize * config.gridSize;
}

export function clampTreasureTrapCount(trapCount: number, config: TreasureDigConfig = treasureDigConfig) {
  return Math.max(config.minTraps, Math.min(config.maxTraps, Math.round(trapCount)));
}

export function getTreasureDigMultiplier({
  safePicks,
  trapCount,
  multiplierTiles = [],
  boostMultiplier = 1,
  config = treasureDigConfig,
}: {
  safePicks: number;
  trapCount: number;
  multiplierTiles?: TreasureMultiplierTile[];
  boostMultiplier?: number;
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

  const expectedBoost = getExpectedTreasureBoost({ safePicks: picks, safeTileCount: safeTiles, multiplierTiles });
  const multiplier = (1 / survivalProbability) * (1 - config.edge) * Math.max(1, boostMultiplier) / expectedBoost;
  return Math.max(1, Math.floor(multiplier * 100) / 100);
}

export function getTreasureBoostMultiplier(pickedIndexes: number[], multiplierTiles: TreasureMultiplierTile[]) {
  return multiplierTiles
    .filter((tile) => pickedIndexes.includes(tile.index))
    .reduce((product, tile) => product * tile.value, 1);
}

export function getExpectedTreasureBoost({
  safePicks,
  safeTileCount,
  multiplierTiles,
}: {
  safePicks: number;
  safeTileCount: number;
  multiplierTiles: TreasureMultiplierTile[];
}) {
  const picks = Math.max(0, Math.min(safeTileCount, Math.round(safePicks)));
  const specialCount = Math.min(multiplierTiles.length, safeTileCount);
  if (picks === 0 || specialCount === 0) return 1;

  const denominator = combinations(safeTileCount, picks);
  if (denominator <= 0) return 1;

  let expected = 0;
  const subsetCount = 1 << specialCount;
  for (let mask = 0; mask < subsetCount; mask += 1) {
    let selectedSpecials = 0;
    let product = 1;
    for (let index = 0; index < specialCount; index += 1) {
      if ((mask & (1 << index)) !== 0) {
        selectedSpecials += 1;
        product *= multiplierTiles[index].value;
      }
    }
    const nonSpecialPicks = picks - selectedSpecials;
    if (nonSpecialPicks < 0 || nonSpecialPicks > safeTileCount - specialCount) continue;
    expected += product * (combinations(safeTileCount - specialCount, nonSpecialPicks) / denominator);
  }
  return Math.max(1, expected);
}

function combinations(n: number, k: number) {
  if (k < 0 || k > n) return 0;
  const picks = Math.min(k, n - k);
  let result = 1;
  for (let index = 1; index <= picks; index += 1) {
    result = (result * (n - picks + index)) / index;
  }
  return result;
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

export function createTreasureMultiplierTiles({
  trapIndexes,
  random = Math.random,
  config = treasureDigConfig,
}: {
  trapIndexes: number[];
  random?: () => number;
  config?: TreasureDigConfig;
}): TreasureMultiplierTile[] {
  const totalTiles = getTreasureTileCount(config);
  const safeIndexes = Array.from({ length: totalTiles }, (_, index) => index).filter((index) => !trapIndexes.includes(index));
  if (safeIndexes.length === 0) return [];

  const maxCount = Math.min(config.maxMultiplierTiles, safeIndexes.length);
  const minCount = Math.min(config.minMultiplierTiles, maxCount);
  const count = minCount + Math.floor(random() * (maxCount - minCount + 1));
  const shuffled = [...safeIndexes];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [shuffled[swapIndex], shuffled[index]];
  }

  return shuffled.slice(0, count).map((index) => ({
    index,
    value: config.multiplierValues[Math.floor(random() * config.multiplierValues.length)] ?? 2,
  })).sort((a, b) => a.index - b.index);
}

export function startTreasureDigRound({
  userId,
  currency,
  betAmount,
  trapCount,
  trapIndexes,
  multiplierTiles,
  config = treasureDigConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  trapCount: number;
  trapIndexes?: number[];
  multiplierTiles?: TreasureMultiplierTile[];
  config?: TreasureDigConfig;
}): TreasureDigRound {
  const traps = clampTreasureTrapCount(trapCount, config);
  const totalTiles = getTreasureTileCount(config);
  const nextTrapIndexes = trapIndexes ?? createTreasureTrapIndexes({ trapCount: traps, config });
  if (nextTrapIndexes.length !== traps || nextTrapIndexes.some((index) => index < 0 || index >= totalTiles)) {
    throw new Error("Invalid Treasure Dig trap layout.");
  }
  const nextMultiplierTiles = multiplierTiles ?? createTreasureMultiplierTiles({ trapIndexes: nextTrapIndexes, config });
  if (
    nextMultiplierTiles.some((tile) => tile.index < 0 || tile.index >= totalTiles || nextTrapIndexes.includes(tile.index) || tile.value < 2) ||
    new Set(nextMultiplierTiles.map((tile) => tile.index)).size !== nextMultiplierTiles.length
  ) {
    throw new Error("Invalid Treasure Dig multiplier layout.");
  }

  placeTableBet(userId, currency, betAmount, config, { trapCount: traps, multiplierTiles: nextMultiplierTiles });
  return {
    id: createId("dig"),
    status: "RUNNING",
    currency,
    betAmount,
    gridSize: config.gridSize,
    trapCount: traps,
    trapIndexes: nextTrapIndexes,
    multiplierTiles: nextMultiplierTiles,
    pickedIndexes: [],
    currentMultiplier: 1,
    boostMultiplier: 1,
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
      metadata: {
        trapCount: round.trapCount,
        safePicks: round.pickedIndexes.length,
        trappedTile: tileIndex,
        multiplierTiles: round.multiplierTiles,
        boostMultiplier: round.boostMultiplier,
      },
    });
    return { ...round, status: "TRAPPED", pickedIndexes: [...round.pickedIndexes, tileIndex], totalPaid: 0, settlement };
  }

  const pickedIndexes = [...round.pickedIndexes, tileIndex];
  const boostMultiplier = getTreasureBoostMultiplier(pickedIndexes, round.multiplierTiles);
  return {
    ...round,
    pickedIndexes,
    boostMultiplier,
    currentMultiplier: getTreasureDigMultiplier({
      safePicks: pickedIndexes.length,
      trapCount: round.trapCount,
      multiplierTiles: round.multiplierTiles,
      boostMultiplier,
      config,
    }),
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
  const boostMultiplier = getTreasureBoostMultiplier(round.pickedIndexes, round.multiplierTiles);
  const multiplier = getTreasureDigMultiplier({
    safePicks: round.pickedIndexes.length,
    trapCount: round.trapCount,
    multiplierTiles: round.multiplierTiles,
    boostMultiplier,
    config,
  });
  const settlement = settleTableResult({
    userId,
    currency: round.currency,
    config,
    result: "WIN",
    amountPaid: round.betAmount * multiplier,
    wagered: round.betAmount,
    metadata: { trapCount: round.trapCount, safePicks: round.pickedIndexes.length, multiplier, multiplierTiles: round.multiplierTiles, boostMultiplier },
  });
  return {
    ...round,
    status: "CASHED_OUT",
    currentMultiplier: multiplier,
    boostMultiplier,
    totalPaid: settlement.amountPaid,
    settlement,
  };
}

export function getTreasurePotentialMaxMultiplier({
  trapCount,
  betMultiplierTiles,
  config = treasureDigConfig,
}: {
  trapCount: number;
  betMultiplierTiles?: TreasureMultiplierTile[];
  config?: TreasureDigConfig;
}) {
  const traps = clampTreasureTrapCount(trapCount, config);
  const safeTileCount = getTreasureTileCount(config) - traps;
  const multiplierTiles = betMultiplierTiles ?? Array.from(
    { length: Math.min(config.maxMultiplierTiles, safeTileCount) },
    (_, index) => ({ index, value: Math.max(...config.multiplierValues) }),
  );
  let bestMultiplier = 1;
  for (let safePicks = 1; safePicks <= safeTileCount; safePicks += 1) {
    const boostMultiplier = multiplierTiles
      .slice(0, Math.min(safePicks, multiplierTiles.length))
      .reduce((product, tile) => product * tile.value, 1);
    bestMultiplier = Math.max(
      bestMultiplier,
      getTreasureDigMultiplier({ safePicks, trapCount: traps, multiplierTiles, boostMultiplier, config }),
    );
  }
  return bestMultiplier;
}
