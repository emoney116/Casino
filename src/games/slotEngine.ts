import { creditCurrency, debitCurrency } from "../wallet/walletService";
import { DEMO_MAX_SINGLE_BET, capDemoPayout } from "../economy/limits";
import type { Currency, User } from "../types";
import type { BonusFeatureType, ExpansionBonusResult, GoldRushBonusBuyType, GoldRushMineClashSegment, GoldRushSpinMetadata, GoldRushVsConfig, HoldAndWinResult, HoldAndWinState, MineClashColumnResult, MultiplierWildPosition, SlotConfig, SlotSpinInput, SlotSpinResult, SpinMode, WheelBonusResult } from "./types";
import { calculateExpansionBonus, getExpansionTriggerPositions } from "./expansionBonus";

function frontierFreeSpinSymbolWeight(symbolId: string, weight: number) {
  if (symbolId === "10" || symbolId === "J") return 0;
  if (symbolId === "Q") return weight * 0.35;
  if (symbolId === "K" || symbolId === "A") return weight * 0.55;
  if (["sun_hawk", "canyon_ram", "sand_fox", "crystal_scorpion", "desert_relic", "oasis_gem", "dust_spirit"].includes(symbolId)) return weight * 1.25;
  if (symbolId === "mirage_wild") return weight * 1.2;
  return weight;
}

function goldRushFreeSpinSymbolWeight(symbolId: string, weight: number) {
  if (symbolId === "10" || symbolId === "J") return weight * 0.45;
  if (symbolId === "Q" || symbolId === "K" || symbolId === "A") return weight * 0.72;
  if (["treasure_chest", "blue_diamond", "gold_nugget", "dynamite", "mine_cart", "lantern", "pickaxe"].includes(symbolId)) return weight * 1.18;
  if (symbolId === "mine_scatter") return weight * 2;
  if (symbolId === "vs_mine_clash") return weight * 1.8;
  return weight;
}

function weightedSymbols(game: SlotConfig, spinMode: SpinMode = "NORMAL", freeSpin = false) {
  const boost = spinMode === "NORMAL" ? undefined : game.boostSpins?.[spinMode];
  return game.symbols.map((symbol) => {
    const coinSymbol = game.specialSymbols?.coin;
    const scatterSymbol = game.scatterSymbol;
    const goldRushBonusBoost = game.id === "gold-rush-showdown" && spinMode === "GOLD_RUSH_BONUS_BOOST" && symbol.id === game.scatterSymbol
      ? symbol.weight * (game.boostSpins?.GOLD_RUSH_BONUS_BOOST?.scatterWeightMultiplier ?? 1)
      : symbol.weight;
    const boostedWeight =
      symbol.id === coinSymbol
        ? symbol.weight * (boost?.coinWeightMultiplier ?? 1)
        : symbol.id === scatterSymbol
          ? goldRushBonusBoost * (spinMode === "GOLD_RUSH_BONUS_BOOST" ? 1 : boost?.scatterWeightMultiplier ?? 1)
          : symbol.id === game.goldRushVs?.triggerSymbol && spinMode === "GOLD_RUSH_SHOWDOWN"
            ? symbol.weight * 2.5
            : symbol.weight;
    const weight = freeSpin && game.id === "frontier-fortune"
      ? frontierFreeSpinSymbolWeight(symbol.id, boostedWeight)
      : freeSpin && game.id === "gold-rush-showdown"
        ? goldRushFreeSpinSymbolWeight(symbol.id, boostedWeight)
        : boostedWeight;
    return { ...symbol, weight };
  });
}

function pickWeightedSymbol(game: SlotConfig, spinMode: SpinMode = "NORMAL", freeSpin = false) {
  const symbols = weightedSymbols(game, spinMode, freeSpin).filter((symbol) => symbol.weight > 0);
  const total = symbols.reduce((sum, symbol) => sum + symbol.weight, 0);
  let roll = Math.random() * total;
  for (const symbol of symbols) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return symbols[symbols.length - 1].id;
}

function pickWeightedSymbolExcluding(game: SlotConfig, excludedSymbols: Set<string>, spinMode: SpinMode = "NORMAL", freeSpin = false) {
  const symbols = weightedSymbols(game, spinMode, freeSpin).filter((symbol) => symbol.weight > 0 && !excludedSymbols.has(symbol.id));
  const total = symbols.reduce((sum, symbol) => sum + symbol.weight, 0);
  let roll = Math.random() * total;
  for (const symbol of symbols) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return symbols[symbols.length - 1]?.id ?? game.symbols[0].id;
}

function capGoldRushVsPerReel(game: SlotConfig, grid: string[][], spinMode: SpinMode = "NORMAL", freeSpin = false) {
  const triggerSymbol = game.goldRushVs?.triggerSymbol;
  if (!triggerSymbol) return grid;
  const excluded = new Set([triggerSymbol]);
  return grid.map((reel) => {
    let hasVs = false;
    return reel.map((symbol) => {
      if (symbol !== triggerSymbol) return symbol;
      if (!hasVs) {
        hasVs = true;
        return symbol;
      }
      return pickWeightedSymbolExcluding(game, excluded, spinMode, freeSpin);
    });
  });
}

export function generateGrid(game: SlotConfig, spinMode: SpinMode = "NORMAL", freeSpin = false) {
  const grid = Array.from({ length: game.reelCount }, () =>
    Array.from({ length: game.rowCount }, () => pickWeightedSymbol(game, spinMode, freeSpin)),
  );
  return game.id === "gold-rush-showdown" ? capGoldRushVsPerReel(game, grid, spinMode, freeSpin) : grid;
}

function countInGrid(grid: string[][], symbol: string) {
  return grid.flat().filter((candidate) => candidate === symbol).length;
}

export function countGoldRushBonusSymbols(game: SlotConfig, grid: string[][]) {
  return countInGrid(grid, game.scatterSymbol);
}

function allGridPositions(game: SlotConfig) {
  const positions: Array<{ reel: number; row: number }> = [];
  for (let reel = 0; reel < game.reelCount; reel += 1) {
    for (let row = 0; row < game.rowCount; row += 1) positions.push({ reel, row });
  }
  return positions;
}

function replaceSymbols(grid: string[][], symbols: Set<string>, replacement: (reel: number, row: number) => string) {
  return grid.map((reelSymbols, reel) => reelSymbols.map((symbol, row) => (symbols.has(symbol) ? replacement(reel, row) : symbol)));
}

export function createGoldRushBonusTriggerGrid(game: SlotConfig, bonusSymbols: 3 | 4) {
  const excluded = new Set([game.scatterSymbol]);
  const grid = replaceSymbols(generateGrid(game), excluded, () => pickWeightedSymbolExcluding(game, excluded));
  const available = allGridPositions(game).sort(() => Math.random() - 0.5);
  available.slice(0, bonusSymbols).forEach((position) => {
    grid[position.reel][position.row] = game.scatterSymbol;
  });
  return capGoldRushVsPerReel(game, grid);
}

export function createGoldRushShowdownBoostGrid(game: SlotConfig) {
  const grid = generateGrid(game, "GOLD_RUSH_SHOWDOWN");
  const triggerSymbol = game.goldRushVs?.triggerSymbol ?? "vs_mine_clash";
  const interiorColumns = weightedRandom([
    { columns: 2, weight: 70 },
    { columns: 3, weight: 22 },
    { columns: 4, weight: 7 },
    { columns: 5, weight: 1 },
    { columns: 6, weight: 0.15 },
  ]).columns;
  const interior = selectGoldRushInterior(game, false, {
    startColumn: selectGoldRushInteriorStart(game, interiorColumns),
    columns: interiorColumns,
    rowStart: 0,
    rowCount: game.rowCount,
  });
  const bridgeSymbols = [
    { symbol: "K", weight: 16 },
    { symbol: "A", weight: 20 },
    { symbol: "pickaxe", weight: 22 },
    { symbol: "lantern", weight: 22 },
    { symbol: "mine_cart", weight: 14 },
    { symbol: "dynamite", weight: 6 },
  ];
  const bridgeSymbol = weightedRandom(bridgeSymbols).symbol;
  const payline = randomFrom(game.paylines);
  const preferInteriorVs = interior && Math.random() < 0.35;
  const insideReels = interior
    ? Array.from({ length: interior.columns }, (_, index) => interior.startColumn + index)
    : [];
  const outsideReels = Array.from({ length: game.reelCount }, (_, reel) => reel).filter((reel) => !insideReels.includes(reel));
  const eligibleReels = preferInteriorVs && insideReels.length > 0 ? insideReels : outsideReels.length > 0 ? outsideReels : insideReels;
  const reel = randomFrom(eligibleReels.length ? eligibleReels : Array.from({ length: game.reelCount }, (_, index) => index));
  const row = payline.rows[reel] ?? Math.floor(Math.random() * game.rowCount);

  for (let payReel = 0; payReel < game.reelCount; payReel += 1) {
    const payRow = payline.rows[payReel];
    if (typeof payRow === "number" && grid[payReel]?.[payRow] !== undefined) {
      grid[payReel][payRow] = bridgeSymbol;
    }
  }
  grid[reel] = grid[reel].map((symbol, symbolRow) => (symbol === triggerSymbol && symbolRow !== row ? pickWeightedSymbolExcluding(game, new Set([triggerSymbol]), "GOLD_RUSH_SHOWDOWN") : symbol));
  grid[reel][row] = triggerSymbol;
  return { grid: capGoldRushVsPerReel(game, grid, "GOLD_RUSH_SHOWDOWN"), interior };
}

function maxWinFor(game: SlotConfig, betAmount: number) {
  return capDemoPayout(Math.round(betAmount * game.maxPayoutMultiplier));
}

export function getBonusBuyCost(
  game: SlotConfig,
  betAmount: number,
  featureType: BonusFeatureType = game.buyBonus?.featureType ?? "HOLD_AND_WIN",
  currency?: Currency,
) {
  const option = game.bonusBuys?.find((buy) => buy.featureType === featureType);
  const costMultiplier = (currency && option?.currencyCostMultipliers?.[currency]) ?? option?.costMultiplier ?? game.buyBonus?.costMultiplier ?? 0;
  return Math.round(betAmount * costMultiplier * 100) / 100;
}

export function getSpinCost(game: SlotConfig, betAmount: number, spinMode: SpinMode = "NORMAL") {
  const boost = spinMode === "NORMAL" ? undefined : game.boostSpins?.[spinMode];
  return Math.round(betAmount * (boost?.costMultiplier ?? 1) * 100) / 100;
}

export function getGoldRushBonusBuyOption(game: SlotConfig, bonusType: GoldRushBonusBuyType) {
  return game.goldRushBonusBuys?.options.find((option) => option.type === bonusType);
}

export function getGoldRushBonusBuyCost(game: SlotConfig, betAmount: number, bonusType: GoldRushBonusBuyType) {
  const option = getGoldRushBonusBuyOption(game, bonusType);
  return Math.round(betAmount * (option?.costMultiplier ?? 0) * 100) / 100;
}

export function getGoldRushFreeSpinInitialInteriorColumns(game: SlotConfig, triggerCount: number) {
  const config = game.goldRushBonusBuys?.freeSpins;
  const normal = config?.normalInitialInteriorColumns ?? game.goldRushInterior?.freeSpinsInitialInteriorColumns ?? 2;
  const superColumns = config?.superInitialInteriorColumns ?? Math.max(3, normal);
  return Math.max(2, Math.min(config?.maxInteriorColumns ?? game.goldRushInterior?.maxInteriorColumns ?? game.reelCount, triggerCount >= 4 ? superColumns : normal));
}

export function getBonusBuyPayoutBetAmount(
  game: SlotConfig,
  betAmount: number,
  featureType: BonusFeatureType,
  currency?: Currency,
) {
  const option = game.bonusBuys?.find((buy) => buy.featureType === featureType);
  const multiplier = (currency && option?.payoutBetMultipliers?.[currency]) ?? 1;
  return Math.round(betAmount * multiplier * 100) / 100;
}

function payoutMultiplier(game: SlotConfig, symbol: string, count: number) {
  const rules = game.payoutTable
    .filter((rule) => rule.symbol === symbol && count >= rule.count)
    .sort((a, b) => b.count - a.count || b.multiplier - a.multiplier);
  return rules[0]?.multiplier ?? 0;
}

function bestWildSubstituteSymbol(game: SlotConfig, count: number) {
  return game.symbols
    .filter((symbol) => symbol.kind !== "wild" && symbol.kind !== "scatter" && symbol.kind !== "bonus" && symbol.kind !== "coin")
    .map((symbol) => ({ symbol: symbol.id, multiplier: payoutMultiplier(game, symbol.id, count) }))
    .sort((a, b) => b.multiplier - a.multiplier)[0]?.symbol;
}

function evaluatePaylines(
  game: SlotConfig,
  grid: string[][],
  betAmount: number,
  freeSpin: boolean,
  multiplierWilds?: {
    positions: Array<{ reel: number; row: number }>;
    multiplier: number;
    positionMultipliers?: MultiplierWildPosition[];
  },
) {
  const lineBet = game.paytableBasis === "totalBet" ? betAmount : betAmount / game.paylines.length;
  const lineWins: SlotSpinResult["lineWins"] = [];
  const multiplierWildPositions = new Set(multiplierWilds?.positions.map((position) => `${position.reel}:${position.row}`) ?? []);
  const multiplierWildMap = new Map(
    multiplierWilds?.positionMultipliers?.map((position) => [`${position.reel}:${position.row}`, Math.max(1, position.multiplier)] as const) ?? [],
  );

  for (const payline of game.paylines) {
    const symbols = payline.rows.map((row, reel) => grid[reel][row]);
    const wildSymbol = game.specialSymbols?.wild ?? "wild";
    const firstRegular = symbols.find((symbol) => symbol !== wildSymbol && symbol !== game.scatterSymbol && symbol !== game.bonusSymbol)
      ?? (symbols.every((symbol) => symbol === wildSymbol) ? bestWildSubstituteSymbol(game, symbols.length) : undefined);
    if (!firstRegular) continue;

    let count = 0;
    const positions: Array<{ reel: number; row: number }> = [];
    for (let reel = 0; reel < symbols.length; reel += 1) {
      const symbol = symbols[reel];
      if (symbol === firstRegular || symbol === wildSymbol) {
        count += 1;
        positions.push({ reel, row: payline.rows[reel] });
      } else {
        break;
      }
    }

    const multiplier = payoutMultiplier(game, firstRegular, count);
    if (multiplier > 0) {
      const positionMultipliers = positions
        .map((position) => multiplierWildMap.get(`${position.reel}:${position.row}`))
        .filter((value): value is number => typeof value === "number");
      const positionMultiplierSum = positionMultipliers.reduce((sum, value) => sum + value, 0);
      const globalMultiplier = multiplierWildPositions.size > 0 && positions.some((position) => multiplierWildPositions.has(`${position.reel}:${position.row}`))
        ? Math.max(1, multiplierWilds?.multiplier ?? 1)
        : 0;
      const wildMultiplier = positionMultiplierSum > 0 || globalMultiplier > 0
        ? Math.max(1, positionMultiplierSum + globalMultiplier)
        : 1;
      const boosted = multiplier * (freeSpin ? game.freeSpins.winMultiplier : 1) * wildMultiplier;
      lineWins.push({
        paylineId: payline.id,
        paylineName: payline.name,
        symbol: firstRegular,
        count,
        multiplier: boosted,
        positions,
        payout: roundLinePayout(lineBet * boosted, betAmount),
      });
    }
  }

  return lineWins;
}

function applyMultiplierWildTransform(
  game: SlotConfig,
  grid: string[][],
  positions: Array<{ reel: number; row: number }> = [],
) {
  const wildSymbol = game.specialSymbols?.wild;
  if (!wildSymbol || positions.length === 0) return grid;
  const nextGrid = grid.map((reel) => [...reel]);
  positions.forEach((position) => {
    if (nextGrid[position.reel]?.[position.row] !== undefined) nextGrid[position.reel][position.row] = wildSymbol;
  });
  return nextGrid;
}

function collapseGrid(game: SlotConfig, grid: string[][], positions: Array<{ reel: number; row: number }>) {
  const remove = new Set(positions.map((position) => `${position.reel}:${position.row}`));
  return grid.map((reelSymbols, reel) => {
    const remaining = reelSymbols.filter((_, row) => !remove.has(`${reel}:${row}`));
    const fill = Array.from({ length: game.rowCount - remaining.length }, () => pickWeightedSymbol(game));
    return [...fill, ...remaining].slice(0, game.rowCount);
  });
}

function freeSpinAward(game: SlotConfig, scatterCount = 0) {
  const countAward = scatterCount >= 5
    ? game.freeSpins.awardsByScatter?.[5]
    : scatterCount >= 4
      ? game.freeSpins.awardsByScatter?.[4]
      : scatterCount >= 3
        ? game.freeSpins.awardsByScatter?.[3]
        : undefined;
  if (typeof countAward === "number") return countAward;
  const range = game.freeSpins.awarded;
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100;
}

function roundLinePayout(amount: number, betAmount: number) {
  return betAmount < 1 ? roundCurrency(amount) : Math.round(amount);
}

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function weightedRandom<T extends { weight: number }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function totalLinePayout(lineWins: SlotSpinResult["lineWins"]) {
  return lineWins.reduce((sum, line) => sum + line.payout, 0);
}

function positionKey(position: { reel: number; row: number }) {
  return `${position.reel}:${position.row}`;
}

function uniquePositions(positions: Array<{ reel: number; row: number }>) {
  const seen = new Set<string>();
  return positions.filter((position) => {
    const key = positionKey(position);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function positionSet(positions: Array<{ reel: number; row: number }>) {
  return new Set(positions.map(positionKey));
}

function lineWinsUsePositions(lineWins: SlotSpinResult["lineWins"], positions: Array<{ reel: number; row: number }>) {
  const keys = positionSet(positions);
  return lineWins.some((win) => win.positions.some((position) => keys.has(positionKey(position))));
}

function getGoldRushColumnPositionMap(game: SlotConfig, positions: Array<{ reel: number; row: number }>) {
  const map = new Map<number, Array<{ reel: number; row: number }>>();
  positions.forEach((position) => {
    if (map.has(position.reel)) return;
    map.set(position.reel, getGoldRushColumnPositions(game, position.reel));
  });
  return map;
}

function sanitizeGoldRushInterior(game: SlotConfig, interior: NonNullable<GoldRushSpinMetadata["interior"]>) {
  const maxColumns = Math.max(2, Math.min(game.reelCount, game.goldRushInterior?.maxInteriorColumns ?? game.reelCount));
  const columns = Math.max(2, Math.min(maxColumns, interior.columns));
  const startColumn = Math.max(0, Math.min(game.reelCount - columns, interior.startColumn));
  return {
    startColumn,
    columns,
    rowStart: 0,
    rowCount: game.rowCount,
  };
}

export function selectGoldRushInteriorStart(game: SlotConfig, columns: number) {
  const safeColumns = Math.max(1, Math.min(game.reelCount, columns));
  const maxStart = Math.max(0, game.reelCount - safeColumns);
  return Math.floor(Math.random() * (maxStart + 1));
}

function selectGoldRushInterior(game: SlotConfig, freeSpin: boolean, override?: GoldRushSpinMetadata["interior"]) {
  const config = game.goldRushInterior;
  if (!config) return undefined;
  if (override) return sanitizeGoldRushInterior(game, override);
  const shouldAppear = freeSpin && config.freeSpinsInteriorAlwaysActive ? true : Math.random() < config.appearanceChance;
  if (!shouldAppear) return undefined;
  const selected = freeSpin && config.freeSpinsInitialInteriorColumns
    ? { columns: config.freeSpinsInitialInteriorColumns, weight: 1 }
    : weightedRandom(config.sizes);
  const columns = Math.max(2, Math.min(config.maxInteriorColumns, game.reelCount, selected.columns));
  const startColumn = selectGoldRushInteriorStart(game, columns);
  return { startColumn, columns, rowStart: 0, rowCount: game.rowCount };
}

function getGoldRushInteriorPositions(interior: NonNullable<GoldRushSpinMetadata["interior"]>) {
  const positions: Array<{ reel: number; row: number }> = [];
  for (let reel = interior.startColumn; reel < interior.startColumn + interior.columns; reel += 1) {
    for (let row = interior.rowStart; row < interior.rowStart + interior.rowCount; row += 1) {
      positions.push({ reel, row });
    }
  }
  return positions;
}

function getGoldRushColumnPositions(game: SlotConfig, reel: number) {
  return Array.from({ length: game.rowCount }, (_, row) => ({ reel, row }));
}

function isInsideInterior(position: { reel: number; row: number }, interior?: GoldRushSpinMetadata["interior"]) {
  if (!interior) return false;
  return position.reel >= interior.startColumn && position.reel < interior.startColumn + interior.columns && position.row >= interior.rowStart && position.row < interior.rowStart + interior.rowCount;
}

function selectGoldRushVsDuel(config: GoldRushVsConfig) {
  const tier = weightedRandom(config.duelTiers);
  const multiplier = weightedRandom(tier.multipliers).multiplier;
  return { tier, multiplier };
}

function losingMineClashDisplayMultiplier(winningMultiplier: number) {
  if (winningMultiplier <= 2) return winningMultiplier + 2;
  const candidate = Math.floor(winningMultiplier * 0.65);
  return candidate === winningMultiplier ? Math.max(2, winningMultiplier - 1) : Math.max(2, candidate);
}

function getMineClashDisplayOutcome(duel: ReturnType<typeof selectGoldRushVsDuel>) {
  if (duel.tier.id === "gold-diamond") {
    return {
      winner: "diamond" as const,
      goldMultiplier: Math.max(2, Math.min(duel.multiplier - 1, losingMineClashDisplayMultiplier(duel.multiplier))),
      diamondMultiplier: duel.multiplier,
    };
  }

  if (duel.tier.id === "diamond-diamond") {
    const runnerUp = Math.max(5, Math.min(duel.multiplier - 1, Math.floor(duel.multiplier * 0.74)));
    return {
      winner: "diamond" as const,
      goldMultiplier: runnerUp,
      diamondMultiplier: duel.multiplier,
    };
  }

  return {
    winner: "gold" as const,
    goldMultiplier: duel.multiplier,
    diamondMultiplier: losingMineClashDisplayMultiplier(duel.multiplier),
  };
}

function makeGoldRushMineClashSegments({
  game,
  type,
  triggerPosition,
  transformedPositions,
  mineClashColumns,
  duel,
  interior,
}: {
  game: SlotConfig;
  type: "normal-column" | "interior";
  triggerPosition: { reel: number; row: number };
  transformedPositions: Array<{ reel: number; row: number }>;
  mineClashColumns?: MineClashColumnResult[];
  duel: ReturnType<typeof selectGoldRushVsDuel>;
  interior?: GoldRushSpinMetadata["interior"];
}): GoldRushMineClashSegment[] {
  const segments: GoldRushMineClashSegment[] = [];

  if (type === "interior" && interior) {
    const { winner, goldMultiplier, diamondMultiplier } = getMineClashDisplayOutcome(duel);
    segments.push({
      type: "interior",
      startReel: interior.startColumn,
      width: interior.columns,
      rowStart: interior.rowStart,
      rowCount: interior.rowCount,
      winner,
      multiplier: duel.multiplier,
      tier: duel.tier.id,
      goldMultiplier,
      diamondMultiplier,
      triggerPosition,
      transformedPositions: getGoldRushInteriorPositions(interior),
    });
  }

  (mineClashColumns ?? []).forEach((column) => {
    segments.push({
      type: "column",
      startReel: column.reel,
      width: 1,
      rowStart: 0,
      rowCount: game.rowCount,
      winner: column.winner,
      multiplier: column.multiplier,
      tier: column.tier,
      goldMultiplier: column.goldMultiplier,
      diamondMultiplier: column.diamondMultiplier,
      triggerPosition: column.position,
      transformedPositions: column.transformedPositions,
    });
  });

  if (segments.length === 0) {
    const { winner, goldMultiplier, diamondMultiplier } = getMineClashDisplayOutcome(duel);
    segments.push({
      type: "column",
      startReel: triggerPosition.reel,
      width: 1,
      rowStart: 0,
      rowCount: game.rowCount,
      winner,
      multiplier: duel.multiplier,
      tier: duel.tier.id,
      goldMultiplier,
      diamondMultiplier,
      triggerPosition,
      transformedPositions,
    });
  }

  return segments.sort((a, b) => a.startReel - b.startReel || a.rowStart - b.rowStart || (a.type === "interior" ? -1 : 1));
}

function makeGoldRushMineClashResult({
  game,
  betAmount,
  triggerPosition,
  triggerPositions,
  type,
  transformedPositions,
  multiplierWilds,
  mineClashColumns,
  duel,
  payout,
  capped,
  interior,
  activeFrame,
}: {
  game: SlotConfig;
  betAmount: number;
  triggerPosition: { reel: number; row: number };
  triggerPositions?: Array<{ reel: number; row: number }>;
  type: "normal-column" | "interior";
  transformedPositions: Array<{ reel: number; row: number }>;
  multiplierWilds?: MultiplierWildPosition[];
  mineClashColumns?: MineClashColumnResult[];
  duel: ReturnType<typeof selectGoldRushVsDuel>;
  payout: number;
  capped: boolean;
  interior?: GoldRushSpinMetadata["interior"];
  activeFrame?: { startReel: number; width: number; rowStart: number; rowCount: number };
}): ExpansionBonusResult {
  const activeSegments = makeGoldRushMineClashSegments({
    game,
    type,
    triggerPosition,
    transformedPositions,
    mineClashColumns,
    duel,
    interior,
  });
  const primarySegment = activeSegments[0];
  const frameSource = activeFrame ?? primarySegment;
  const frame = frameSource
    ? {
      startReel: frameSource.startReel,
      width: frameSource.width,
      rowStart: frameSource.rowStart,
      rowCount: frameSource.rowCount,
      reelCount: game.reelCount,
    }
    : type === "interior" && interior
    ? {
      startReel: interior.startColumn,
      width: interior.columns,
      rowStart: interior.rowStart,
      rowCount: interior.rowCount,
      reelCount: game.reelCount,
    }
    : {
      startReel: triggerPosition.reel,
      width: 1,
      rowStart: 0,
      rowCount: game.rowCount,
      reelCount: game.reelCount,
  };
  const { winner, goldMultiplier, diamondMultiplier } = getMineClashDisplayOutcome(duel);
  return {
    triggerPositions: triggerPositions ?? [triggerPosition],
    rounds: [
      { phaseId: "vs-flash", phaseTitle: "Mine Clash", label: "VS symbol flashes", gain: 0, totalMultiplier: 0 },
      { phaseId: "frame-expand", phaseTitle: type === "interior" ? "Interior Mine Frame" : "Column Mine Frame", label: type === "interior" ? `${frame.width} column chamber opens` : "Column glows with ore", gain: 0, totalMultiplier: 0 },
      { phaseId: "mining", phaseTitle: duel.tier.label, label: "Gold and diamond miners clash", gain: 0, totalMultiplier: 0 },
      { phaseId: "winner", phaseTitle: winner === "gold" ? "Gold Miner Wins" : "Diamond Miner Wins", label: `${duel.multiplier}x multiplier revealed`, gain: duel.multiplier, totalMultiplier: duel.multiplier },
      { phaseId: "wild-transform", phaseTitle: "Multiplier Wilds", label: `${transformedPositions.length} positions transform`, gain: duel.multiplier, totalMultiplier: duel.multiplier },
    ],
    multiplier: duel.multiplier,
    payout,
    capped,
    sourceFeature: "mine-clash",
    frame,
    transformedPositions,
    multiplierWilds,
    mineClashColumns,
    activeSegments,
    mineClash: {
      winner,
      goldMultiplier,
      diamondMultiplier,
      frameWidth: frame.width,
      multiplierWildEv: multiplierWilds?.reduce((sum, position) => sum + position.multiplier, 0) ?? transformedPositions.length * duel.multiplier,
    },
    vsActive: true,
    vsType: type,
    activeAreaType: type === "normal-column" ? "column" : "interior",
    activeColumns: { start: frame.startReel, count: frame.width },
    activeRows: { start: frame.rowStart, count: frame.rowCount },
    vsTier: duel.tier.id,
    vsMultiplier: duel.multiplier,
    vsCandidateMultipliers: { gold: goldMultiplier, diamond: diamondMultiplier },
    vsWinningMultiplier: duel.multiplier,
    vsWinnerSide: winner,
    activeVsPosition: triggerPosition,
    activeVsPositions: triggerPositions ?? [triggerPosition],
    interiorColumns: interior?.columns,
    interiorStartColumn: interior?.startColumn,
  };
}

function resolveGoldRushVsFeature(
  game: SlotConfig,
  grid: string[][],
  betAmount: number,
  freeSpin: boolean,
  baseLineWins: SlotSpinResult["lineWins"],
  interiorOverride?: GoldRushSpinMetadata["interior"],
): {
  lineWins: SlotSpinResult["lineWins"];
  payout: number;
  expansionBonus?: ExpansionBonusResult;
  goldRush: GoldRushSpinMetadata;
} {
  const vsConfig = game.goldRushVs;
  const interior = selectGoldRushInterior(game, freeSpin, interiorOverride);
  const vsPositions = vsConfig ? getExpansionTriggerPositions(grid, vsConfig.triggerSymbol).sort((a, b) => a.reel - b.reel || a.row - b.row) : [];
  const baseLinePayout = totalLinePayout(baseLineWins);
  const metadata: GoldRushSpinMetadata = {
    baseLinePayout,
    inactiveVsPositions: vsPositions,
    vsActive: false,
    interior,
    vsInsideInteriorCount: vsPositions.filter((position) => isInsideInterior(position, interior)).length,
    activeNormalVsPayout: 0,
    activeInteriorVsPayout: 0,
  };
  if (!vsConfig || vsPositions.length === 0) return { lineWins: baseLineWins, payout: baseLinePayout, goldRush: metadata };

  const candidates: Array<{
    position: { reel: number; row: number };
    type: "normal-column" | "interior";
    positions: Array<{ reel: number; row: number }>;
    activeVsPositions?: Array<{ reel: number; row: number }>;
    baseMultiplierPositions?: Array<{ reel: number; row: number }>;
    columnVsPositions?: Array<{ reel: number; row: number }>;
    activeFrame?: { startReel: number; width: number; rowStart: number; rowCount: number };
    transformedWins: SlotSpinResult["lineWins"];
    payout: number;
  }> = [];

  const interiorVs = interior ? vsPositions.filter((position) => isInsideInterior(position, interior)) : [];
  if (interior && interiorVs.length > 0) {
    const position = interiorVs[0];
    const interiorPositions = getGoldRushInteriorPositions(interior);
    let positions = interiorPositions;
    let transformedGrid = applyMultiplierWildTransform(game, grid, positions);
    let transformedWins = evaluatePaylines(game, transformedGrid, betAmount, freeSpin, { positions, multiplier: 1 });
    let payout = totalLinePayout(transformedWins);
    let activeVsPositions = [position];
    let columnVsPositions: Array<{ reel: number; row: number }> = [];
    const normalVsPositions = vsPositions.filter((vsPosition) => !isInsideInterior(vsPosition, interior));
    const columnMap = getGoldRushColumnPositionMap(game, normalVsPositions);
    const allColumnPositions = uniquePositions([...columnMap.values()].flat());

    if (allColumnPositions.length > 0) {
      const allPositions = uniquePositions([...interiorPositions, ...allColumnPositions]);
      const allTransformedGrid = applyMultiplierWildTransform(game, grid, allPositions);
      const allTransformedWins = evaluatePaylines(game, allTransformedGrid, betAmount, freeSpin, { positions: allPositions, multiplier: 1 });
      const winningPositionKeys = positionSet(allTransformedWins.flatMap((win) => win.positions));
      const maxActive = Math.max(1, Math.min(game.reelCount, vsConfig.maxActiveNormalVs ?? 1));
      const activeReels = [...columnMap.keys()]
        .sort((a, b) => a - b)
        .filter((reel) => columnMap.get(reel)?.some((columnPosition) => winningPositionKeys.has(positionKey(columnPosition))))
        .slice(0, maxActive);
      const extraVsPositions = activeReels
        .map((reel) => normalVsPositions.find((vsPosition) => vsPosition.reel === reel))
        .filter((vsPosition): vsPosition is { reel: number; row: number } => Boolean(vsPosition));
      const extraPositions = uniquePositions(activeReels.flatMap((reel) => columnMap.get(reel) ?? []));
      if (extraVsPositions.length > 0 && extraPositions.length > 0) {
        const candidatePositions = uniquePositions([...interiorPositions, ...extraPositions]);
        const candidateGrid = applyMultiplierWildTransform(game, grid, candidatePositions);
        const candidateWins = evaluatePaylines(game, candidateGrid, betAmount, freeSpin, { positions: candidatePositions, multiplier: 1 });
        const candidatePayout = totalLinePayout(candidateWins);
        if (candidatePayout >= payout) {
          positions = candidatePositions;
          transformedGrid = candidateGrid;
          transformedWins = candidateWins;
          payout = candidatePayout;
          activeVsPositions = [position, ...extraVsPositions];
          columnVsPositions = extraVsPositions;
        }
      }
    }

    if (payout > baseLinePayout || lineWinsUsePositions(transformedWins, positions)) {
      candidates.push({
        position,
        type: "interior",
        positions,
        activeVsPositions,
        baseMultiplierPositions: interiorPositions,
        columnVsPositions,
        activeFrame: {
          startReel: interior.startColumn,
          width: interior.columns,
          rowStart: interior.rowStart,
          rowCount: interior.rowCount,
        },
        transformedWins,
        payout,
      });
    }
  }

  if (candidates.length === 0 && (vsConfig.maxActiveNormalVs ?? 1) > 0) {
    const normalVsPositions = vsPositions.filter((position) => !isInsideInterior(position, interior));
    const columnMap = getGoldRushColumnPositionMap(game, normalVsPositions);
    const allColumnPositions = uniquePositions([...columnMap.values()].flat());
    if (allColumnPositions.length > 0) {
      const transformedGrid = applyMultiplierWildTransform(game, grid, allColumnPositions);
      const transformedWins = evaluatePaylines(game, transformedGrid, betAmount, freeSpin, { positions: allColumnPositions, multiplier: 1 });
      const payout = totalLinePayout(transformedWins);
      const winningPositionKeys = positionSet(transformedWins.flatMap((win) => win.positions));
      const maxActive = Math.max(1, Math.min(game.reelCount, vsConfig.maxActiveNormalVs ?? game.reelCount));
      const activeReels = [...columnMap.keys()]
        .sort((a, b) => a - b)
        .filter((reel) => columnMap.get(reel)?.some((position) => winningPositionKeys.has(positionKey(position))))
        .slice(0, maxActive);
      const activeVsPositions = activeReels
        .map((reel) => normalVsPositions.find((position) => position.reel === reel))
        .filter((position): position is { reel: number; row: number } => Boolean(position));
      const positions = uniquePositions(activeReels.flatMap((reel) => columnMap.get(reel) ?? []));
      if (positions.length > 0 && activeVsPositions.length > 0 && (payout > baseLinePayout || lineWinsUsePositions(transformedWins, positions))) {
        candidates.push({ position: activeVsPositions[0], type: "normal-column", positions, activeVsPositions, transformedWins, payout });
      }
    }
  }

  if (candidates.length === 0) return { lineWins: baseLineWins, payout: baseLinePayout, goldRush: metadata };

  const selected = candidates[0];
  const makeColumnDuel = (position: { reel: number; row: number }) => {
    const duel = selectGoldRushVsDuel(vsConfig);
    const transformedPositions = getGoldRushColumnPositions(game, position.reel);
    const { winner, goldMultiplier, diamondMultiplier } = getMineClashDisplayOutcome(duel);
    return {
      position,
      duel,
      column: {
        position,
        reel: position.reel,
        multiplier: duel.multiplier,
        winner,
        tier: duel.tier.id,
        goldMultiplier,
        diamondMultiplier,
        transformedPositions,
      } satisfies MineClashColumnResult,
    };
  };
  const columnDuels = (selected.type === "normal-column"
    ? (selected.activeVsPositions ?? [selected.position])
    : selected.columnVsPositions ?? []).map(makeColumnDuel);
  const duel = selected.type === "interior"
    ? selectGoldRushVsDuel(vsConfig)
    : columnDuels[0]?.duel ?? selectGoldRushVsDuel(vsConfig);
  const mineClashColumns = columnDuels.map((entry) => entry.column);
  const columnMultiplierWilds: MultiplierWildPosition[] = mineClashColumns.flatMap((column) => column.transformedPositions.map((position) => ({
    ...position,
    multiplier: column.multiplier,
    winner: column.winner,
  })));
  const interiorMultiplierWilds: MultiplierWildPosition[] = selected.type === "interior"
    ? (selected.baseMultiplierPositions ?? selected.positions).map((position) => ({
      ...position,
      multiplier: duel.multiplier,
      winner: duel.tier.winner,
    }))
    : [];
  const multiplierWilds: MultiplierWildPosition[] = selected.type === "normal-column"
    ? columnMultiplierWilds
    : [...interiorMultiplierWilds, ...columnMultiplierWilds];
  const transformedGrid = applyMultiplierWildTransform(game, grid, selected.positions);
  const lineWins = evaluatePaylines(game, transformedGrid, betAmount, freeSpin, {
    positions: selected.type === "interior" ? selected.baseMultiplierPositions ?? selected.positions : [],
    multiplier: selected.type === "interior" ? duel.multiplier : 1,
    positionMultipliers: selected.type === "normal-column" ? multiplierWilds : columnMultiplierWilds,
  });
  const uncappedPayout = totalLinePayout(lineWins);
  const maxWin = maxWinFor(game, betAmount);
  const payout = Math.min(uncappedPayout, maxWin);
  const capped = uncappedPayout > payout;
  const expansionBonus = makeGoldRushMineClashResult({
    game,
    betAmount,
    triggerPosition: selected.position,
    triggerPositions: selected.activeVsPositions ?? [selected.position],
    type: selected.type,
    transformedPositions: selected.positions,
    multiplierWilds,
    mineClashColumns: mineClashColumns.length > 0 ? mineClashColumns : undefined,
    duel,
    payout,
    capped,
    interior,
    activeFrame: selected.activeFrame,
  });
  const activeVsPositions = selected.activeVsPositions ?? [selected.position];
  const activeFrame = expansionBonus.frame ?? selected.activeFrame ?? {
    startReel: selected.position.reel,
    width: 1,
    rowStart: 0,
    rowCount: game.rowCount,
  };
  const activeReels = new Set(activeVsPositions.map((position) => position.reel));
  const activeVsKeys = positionSet(activeVsPositions);
  metadata.vsActive = true;
  metadata.vsType = selected.type;
  metadata.activeAreaType = selected.type === "normal-column" ? "column" : "interior";
  metadata.activeColumns = {
    start: activeFrame.startReel,
    count: activeFrame.width,
  };
  metadata.activeRows = {
    start: activeFrame.rowStart,
    count: activeFrame.rowCount,
  };
  metadata.vsTier = duel.tier.id;
  metadata.vsMultiplier = duel.multiplier;
  metadata.vsCandidateMultipliers = {
    gold: expansionBonus.mineClash?.goldMultiplier ?? duel.multiplier,
    diamond: expansionBonus.mineClash?.diamondMultiplier ?? duel.multiplier,
  };
  metadata.vsWinningMultiplier = duel.multiplier;
  metadata.vsWinnerSide = expansionBonus.mineClash?.winner;
  metadata.activeVsPosition = selected.position;
  metadata.activeVsPositions = activeVsPositions;
  metadata.transformedPositions = selected.positions;
  metadata.mineClashColumns = mineClashColumns.length > 0 ? mineClashColumns : undefined;
  metadata.activeSegments = expansionBonus.activeSegments;
  metadata.multiplierWilds = multiplierWilds;
  metadata.inactiveVsPositions = selected.type === "normal-column"
    ? vsPositions.filter((position) => !activeReels.has(position.reel))
    : vsPositions.filter((position) => !activeVsKeys.has(positionKey(position)));
  metadata.activeNormalVsPayout = selected.type === "normal-column" ? Math.max(0, payout - baseLinePayout) : 0;
  metadata.activeInteriorVsPayout = selected.type === "interior" ? Math.max(0, payout - baseLinePayout) : 0;
  return { lineWins, payout, expansionBonus, goldRush: metadata };
}

function coinAward(game: SlotConfig, betAmount: number, superHold = false) {
  const awards = game.holdAndWin?.coinAwards;
  if (awards?.length) {
    const eligible = superHold ? awards.filter((award) => award.multiplier > 2) : awards;
    const award = weightedRandom(eligible.length ? eligible : awards);
    return Math.round(betAmount * award.multiplier * 100) / 100;
  }
  const multipliers =
    game.holdAndWin?.coinValueMultipliers ??
    (game.volatility === "High" ? [0.25, 0.5, 1, 1.5, 2, 3, 5] : [0.1, 0.25, 0.5, 1, 1.5, 2]);
  const eligible = superHold ? multipliers.filter((multiplier) => multiplier > 2) : multipliers;
  return Math.round(betAmount * randomFrom(eligible.length ? eligible : multipliers) * 100) / 100;
}

export function createHoldAndWinState(game: SlotConfig, betAmount: number, startingCoins = 3, superHold = false): HoldAndWinState {
  const positions = game.reelCount * game.rowCount;
  const values: Array<number | null> = Array.from({ length: positions }, () => null);
  const used = new Set<number>();
  while (used.size < Math.min(startingCoins, positions)) {
    used.add(Math.floor(Math.random() * positions));
  }
  used.forEach((position) => {
    values[position] = coinAward(game, betAmount, superHold);
  });
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return {
    betAmount,
    values,
    respinsRemaining: 3,
    total,
    finished: false,
    filledAll: values.every((value) => value !== null),
    lastNewCoins: [...used],
  };
}

export function stepHoldAndWinBonus(game: SlotConfig, betAmount: number, state: HoldAndWinState, spinMode: SpinMode = "NORMAL"): HoldAndWinState {
  if (state.finished) return state;
  const awardBetAmount = state.betAmount ?? betAmount;
  const values = [...state.values];
  const lastNewCoins: number[] = [];
  const boost = spinMode === "NORMAL" ? undefined : game.boostSpins?.[spinMode];
  const landingChance = (game.holdAndWin?.coinLandingChance ?? 0.18) * (boost?.holdAndWinTriggerBoost ?? 1);
  values.forEach((value, index) => {
    if (value === null && Math.random() < landingChance) {
      values[index] = coinAward(game, awardBetAmount);
      lastNewCoins.push(index);
    }
  });
  const filledAll = values.every((value) => value !== null);
  const respinsRemaining = filledAll ? 0 : lastNewCoins.length > 0 ? 3 : state.respinsRemaining - 1;
  const total = Math.min(
    values.reduce<number>((sum, value) => sum + (value ?? 0) , 0) + (filledAll ? Math.round(awardBetAmount * (game.holdAndWin?.grandMultiplier ?? 60)) : 0),
    maxWinFor(game, awardBetAmount),
  );
  return {
    betAmount: state.betAmount,
    values,
    respinsRemaining,
    total,
    finished: filledAll || respinsRemaining <= 0,
    filledAll,
    lastNewCoins,
  };
}

export function calculateHoldAndWinBonus(game: SlotConfig, betAmount: number, superHold = false, startingCoins?: number): HoldAndWinResult {
  let state = createHoldAndWinState(game, betAmount, startingCoins ?? 3 + Math.floor(Math.random() * 3), superHold);
  const respinRounds: HoldAndWinResult["respinRounds"] = [];

  while (!state.finished) {
    state = stepHoldAndWinBonus(game, betAmount, state);
    respinRounds.push({
      respinsRemaining: state.respinsRemaining,
      newCoins: state.lastNewCoins.length,
      lockedCoins: state.values.filter((value) => value !== null).length,
      total: state.total,
    });
  }

  return { total: state.total, respinRounds, filledAll: state.filledAll };
}

export function calculateWheelBonus(game: SlotConfig, betAmount: number): WheelBonusResult {
  const configured = game.wheelBonus?.segments.map((segment) => ({
    segment: segment.label,
    multiplier: segment.multiplier,
    payout: betAmount * segment.multiplier,
    jackpotLabel: segment.jackpotLabel,
    featureTrigger: segment.featureTrigger,
    freeSpinsAwarded: segment.freeSpinsAwarded,
    weight: segment.weight,
  }));
  const fallback: Array<WheelBonusResult & { weight: number }> = [
    { segment: "2x", multiplier: 2, payout: betAmount * 2, weight: 28 },
    { segment: "3x", multiplier: 3, payout: betAmount * 3, weight: 24 },
    { segment: "5x", multiplier: 5, payout: betAmount * 5, weight: 17 },
    { segment: "8x", multiplier: 8, payout: betAmount * 8, weight: 10 },
    { segment: "10x", multiplier: 10, payout: betAmount * 10, weight: 6 },
  ];
  const result = weightedRandom(configured?.length ? configured : fallback);
  const payout = Math.min(roundCurrency(result.payout), maxWinFor(game, betAmount));
  return {
    segment: result.segment,
    multiplier: result.multiplier,
    payout,
    jackpotLabel: result.jackpotLabel,
    featureTrigger: result.featureTrigger,
    freeSpinsAwarded: result.freeSpinsAwarded,
  };
}

function applyStickyWilds(game: SlotConfig, grid: string[][], stickyWildPositions: number[] = []) {
  const wildSymbol = game.specialSymbols?.wild;
  if (!wildSymbol || stickyWildPositions.length === 0) return grid;
  const nextGrid = grid.map((reel) => [...reel]);
  stickyWildPositions.forEach((position) => {
    const reel = position % game.reelCount;
    const row = Math.floor(position / game.reelCount);
    if (nextGrid[reel]?.[row] !== undefined) nextGrid[reel][row] = wildSymbol;
  });
  return nextGrid;
}

export function getStickyWildPositions(game: SlotConfig, grid: string[][], existing: number[] = []) {
  const wildSymbol = game.specialSymbols?.wild;
  if (!wildSymbol || !game.freeSpins.stickyWilds) return [];
  const positions = new Set(existing);
  grid.forEach((reelSymbols, reel) => {
    reelSymbols.forEach((symbol, row) => {
      if (symbol === wildSymbol) positions.add(row * game.reelCount + reel);
    });
  });
  return [...positions].sort((a, b) => a - b);
}

export function calculateFreeSpinsBonus(game: SlotConfig, betAmount: number, awardedSpins: number, initialInteriorColumns?: number) {
  const maxSpins = game.freeSpins.maxSpins ?? 30;
  let remaining = Math.max(0, Math.min(maxSpins, awardedSpins));
  let totalAwarded = remaining;
  let spinsPlayed = 0;
  let total = 0;
  let stickyWildPositions: number[] = [];
  let goldRushBonusSymbols = 0;
  let goldRushInteriorColumns = initialInteriorColumns ?? getGoldRushFreeSpinInitialInteriorColumns(game, 3);
  let goldRushInteriorStart = selectGoldRushInteriorStart(game, goldRushInteriorColumns);
  let goldRushVsInsideCount = 0;
  let goldRushFinalInteriorColumns = goldRushInteriorColumns;

  while (remaining > 0 && spinsPlayed < maxSpins) {
    if (game.id === "gold-rush-showdown") {
      goldRushInteriorStart = selectGoldRushInteriorStart(game, goldRushInteriorColumns);
    }
    const interiorOverride = game.id === "gold-rush-showdown"
      ? { startColumn: goldRushInteriorStart, columns: goldRushInteriorColumns, rowStart: 0, rowCount: game.rowCount }
      : undefined;
    const result = calculateSlotResult(game, betAmount, true, undefined, "NORMAL", stickyWildPositions, interiorOverride);
    total += result.payout + (result.pickBonusAwards?.[0] ?? 0);
    stickyWildPositions = getStickyWildPositions(game, result.grid, stickyWildPositions);
    if (game.id === "gold-rush-showdown") {
      const collected = countGoldRushBonusSymbols(game, result.grid);
      const previousThresholds = Math.floor(goldRushBonusSymbols / (game.goldRushBonusBuys?.freeSpins.collectThreshold ?? 3));
      goldRushBonusSymbols += collected;
      const nextThresholds = Math.floor(goldRushBonusSymbols / (game.goldRushBonusBuys?.freeSpins.collectThreshold ?? 3));
      const thresholdsReached = Math.max(0, nextThresholds - previousThresholds);
      if (thresholdsReached > 0 && totalAwarded < maxSpins) {
        const addedSpins = thresholdsReached * (game.goldRushBonusBuys?.freeSpins.addedSpins ?? 2);
        const add = Math.min(maxSpins - totalAwarded, addedSpins);
        remaining += add;
        totalAwarded += add;
        const growBy = thresholdsReached * (game.goldRushBonusBuys?.freeSpins.growColumns ?? 1);
        goldRushInteriorColumns = Math.min(game.goldRushBonusBuys?.freeSpins.maxInteriorColumns ?? game.reelCount, goldRushInteriorColumns + growBy);
        goldRushInteriorStart = selectGoldRushInteriorStart(game, goldRushInteriorColumns);
        goldRushFinalInteriorColumns = goldRushInteriorColumns;
      }
      goldRushVsInsideCount += result.goldRush?.vsInsideInteriorCount ?? 0;
    }
    remaining -= 1;
    spinsPlayed += 1;
    if (game.id !== "gold-rush-showdown" && result.freeSpinsAwarded > 0 && totalAwarded < maxSpins) {
      const add = Math.min(maxSpins - totalAwarded, result.freeSpinsAwarded);
      remaining += add;
      totalAwarded += add;
    }
  }

  return {
    total: Math.min(roundCurrency(total), maxWinFor(game, betAmount)),
    spinsAwarded: totalAwarded,
    spinsPlayed,
    stickyWildPositions,
    bonusSymbolsCollected: goldRushBonusSymbols,
    finalInteriorColumns: goldRushFinalInteriorColumns,
    vsInsideFreeSpinsCount: goldRushVsInsideCount,
  };
}

export function calculateDirectFeature(game: SlotConfig, betAmount: number, featureType: BonusFeatureType) {
  if (featureType === "HOLD_AND_WIN") {
    const holdAndWin = calculateHoldAndWinBonus(game, betAmount);
    return {
      bonusPayout: holdAndWin.total,
      winType: "HOLD_AND_WIN" as const,
      jackpotLabel: holdAndWin.filledAll ? ("Grand" as const) : undefined,
      holdAndWin,
    };
  }
  if (featureType === "WHEEL_BONUS") {
    const wheelBonus = calculateWheelBonus(game, betAmount);
    const holdAndWin = wheelBonus.featureTrigger
      ? calculateHoldAndWinBonus(game, betAmount, wheelBonus.featureTrigger === "SUPER_HOLD_AND_WIN", 6)
      : undefined;
    const freeSpins = wheelBonus.freeSpinsAwarded
      ? calculateFreeSpinsBonus(game, betAmount, wheelBonus.freeSpinsAwarded)
      : undefined;
    const bonusPayout = Math.min(wheelBonus.payout + (holdAndWin?.total ?? 0) + (freeSpins?.total ?? 0), maxWinFor(game, betAmount));
    return {
      bonusPayout,
      winType: "WHEEL_BONUS" as const,
      jackpotLabel: wheelBonus.jackpotLabel ?? (holdAndWin?.filledAll ? ("Grand" as const) : undefined),
      wheelBonus,
      holdAndWin,
      freeSpinsAwarded: wheelBonus.freeSpinsAwarded,
    };
  }
  if (featureType === "FREE_SPINS") {
    const spins = freeSpinAward(game);
    const freeSpins = calculateFreeSpinsBonus(game, betAmount, spins);
    return {
      bonusPayout: freeSpins.total,
      winType: "FREE_SPINS" as const,
      freeSpinsAwarded: freeSpins.spinsAwarded,
    };
  }
  return {
    bonusPayout: createPickBonusAwards(game, betAmount)[0] ?? 0,
    winType: "PICK_BONUS" as const,
  };
}

export function createPickBonusAwards(game: SlotConfig, betAmount: number) {
  const maxAward = Math.round(betAmount * game.maxPayoutMultiplier);
  const awards = game.pickBonus.awards.slice().sort(() => Math.random() - 0.5).slice(0, 6);
  return awards.map((multiplier) => Math.min(Math.round(multiplier * betAmount), maxAward));
}

export function calculateSlotResult(
  game: SlotConfig,
  betAmount: number,
  freeSpin = false,
  forcedGrid?: string[][],
  spinMode: SpinMode = "NORMAL",
  stickyWildPositions: number[] = [],
  goldRushInteriorOverride?: GoldRushSpinMetadata["interior"],
): SlotSpinResult {
  const grid = applyStickyWilds(game, forcedGrid ?? generateGrid(game, spinMode, freeSpin), freeSpin ? stickyWildPositions : []);
  const scatterCount = countInGrid(grid, game.scatterSymbol);
  const bonusCount = countInGrid(grid, game.bonusSymbol);
  const retriggerCount = game.id === "frontier-fortune" ? (game.wheelBonus?.triggerCount ?? game.freeSpins.triggerCount) : game.freeSpins.triggerCount;
  const goldRushCollectsDuringFreeSpins = game.id === "gold-rush-showdown" && freeSpin;
  const freeSpinRetrigger = !goldRushCollectsDuringFreeSpins && freeSpin && game.freeSpins.retrigger && scatterCount >= retriggerCount;
  let triggeredFreeSpins = !goldRushCollectsDuringFreeSpins && (freeSpinRetrigger || (scatterCount >= game.freeSpins.triggerCount && (!freeSpin || game.freeSpins.retrigger)));
  const triggeredPickBonus = bonusCount >= game.pickBonus.triggerCount;
  const expansionTriggerPositions = game.expansionBonus ? getExpansionTriggerPositions(grid, game.expansionBonus.triggerSymbol) : [];
  let triggeredExpansionBonus = Boolean(game.id !== "gold-rush-showdown" && game.expansionBonus && expansionTriggerPositions.length >= game.expansionBonus.triggerCount);
  const coinSymbol = game.specialSymbols?.coin;
  const coinCount = coinSymbol ? countInGrid(grid, coinSymbol) : 0;
  const boost = spinMode === "NORMAL" ? undefined : game.boostSpins?.[spinMode];
  const holdTriggerCount = game.holdAndWin?.triggerCount ?? 3;
  let triggeredHoldAndWin = game.featureTypes?.includes("HOLD_AND_WIN") && coinSymbol ? coinCount >= holdTriggerCount : false;
  const wheelSymbol = game.buyBonus?.featureType === "WHEEL_BONUS" ? game.bonusSymbol : game.specialSymbols?.multiplier;
  const symbolWheelTrigger = game.featureTypes?.includes("WHEEL_BONUS") && wheelSymbol ? countInGrid(grid, wheelSymbol) >= 3 : false;
  const scatterWheelTrigger = !freeSpin && game.featureTypes?.includes("WHEEL_BONUS") && game.wheelBonus ? scatterCount >= game.wheelBonus.triggerCount : false;
  const triggeredWheelBonus = symbolWheelTrigger || scatterWheelTrigger;
  const collector = game.coinCollector;
  const collectorAdds = coinCount > 0 && collector?.enabled
    ? Math.min(collector.maxCoins, Math.max(collector.minCollect, Math.min(collector.maxCollect, coinCount)))
    : 0;
  const collectorTriggerChance = (collector?.triggerChancePerCoin ?? 0) * collectorAdds * (boost?.collectorTriggerBoost ?? 1);
  const triggeredCoinCollector = Boolean(collector?.enabled && collectorAdds > 0 && Math.random() < collectorTriggerChance);
  triggeredHoldAndWin = triggeredHoldAndWin || triggeredCoinCollector;
  let lineWins = evaluatePaylines(game, grid, betAmount, freeSpin);

  let payout = lineWins.reduce((sum, line) => sum + line.payout, 0);
  let bonusPayout = 0;
  let freeSpinsAwarded = 0;
  let pickBonusAwards: number[] | undefined;
  let holdAndWin: HoldAndWinResult | undefined;
  let wheelBonus: WheelBonusResult | undefined;
  let expansionBonus: SlotSpinResult["expansionBonus"];
  let goldRush: GoldRushSpinMetadata | undefined;
  let jackpotLabel: SlotSpinResult["jackpotLabel"];
  let winType: SlotSpinResult["winType"] = payout > betAmount * 8 ? "BIG_WIN" : payout > 0 ? "LINE_WIN" : "LOSS";

  if (game.id === "gold-rush-showdown") {
    const resolved = resolveGoldRushVsFeature(game, grid, betAmount, freeSpin, lineWins, goldRushInteriorOverride);
    lineWins = resolved.lineWins;
    payout = resolved.payout;
    expansionBonus = resolved.expansionBonus;
    goldRush = resolved.goldRush;
    goldRush.bonusSymbolCount = scatterCount;
    triggeredExpansionBonus = Boolean(expansionBonus);
    if (expansionBonus) winType = "EXPANSION_BONUS";
  }

  if (triggeredFreeSpins) {
    freeSpinsAwarded = freeSpinRetrigger ? (game.freeSpins.retriggerAward ?? 5) : freeSpinAward(game, scatterCount);
    if (game.id === "gold-rush-showdown") freeSpinsAwarded = game.goldRushBonusBuys?.freeSpins.initialSpins ?? 10;
    winType = "FREE_SPINS";
    if (goldRush) {
      goldRush.freeSpinsTrigger = {
        triggerCount: scatterCount,
        awardedSpins: freeSpinsAwarded,
        initialInteriorColumns: getGoldRushFreeSpinInitialInteriorColumns(game, scatterCount),
        source: "natural",
      };
    }
  }

  if (triggeredPickBonus) {
    pickBonusAwards = createPickBonusAwards(game, betAmount);
    winType = "PICK_BONUS";
  }

  if (triggeredHoldAndWin) {
    winType = "HOLD_AND_WIN";
  }

  if (triggeredWheelBonus) {
    wheelBonus = calculateWheelBonus(game, betAmount);
    bonusPayout += wheelBonus.payout;
    jackpotLabel = wheelBonus.jackpotLabel;
    if (wheelBonus.featureTrigger) {
      triggeredHoldAndWin = true;
      jackpotLabel = undefined;
    }
    if (wheelBonus.freeSpinsAwarded) {
      freeSpinsAwarded = wheelBonus.freeSpinsAwarded;
      triggeredFreeSpins = true;
    }
    winType = "WHEEL_BONUS";
  }

  if (triggeredExpansionBonus && game.expansionBonus && game.id !== "gold-rush-showdown") {
    expansionBonus = calculateExpansionBonus(game, betAmount, expansionTriggerPositions, game.expansionBonus);
    if (expansionBonus.sourceFeature === "mine-clash") {
      const transformedGrid = applyMultiplierWildTransform(game, grid, expansionBonus.transformedPositions);
      lineWins = evaluatePaylines(game, transformedGrid, betAmount, freeSpin, {
        positions: expansionBonus.transformedPositions ?? [],
        multiplier: expansionBonus.multiplier,
      });
      payout = lineWins.reduce((sum, line) => sum + line.payout, 0);
      expansionBonus.payout = payout;
    } else {
      bonusPayout += expansionBonus.payout;
    }
    winType = "EXPANSION_BONUS";
  }

  payout += bonusPayout;
  const uncappedPayout = payout;
  const maxWin = maxWinFor(game, betAmount);
  payout = Math.min(payout, maxWin);
  bonusPayout = Math.min(bonusPayout, payout);
  const capped = uncappedPayout > payout;
  if (expansionBonus?.sourceFeature === "mine-clash") {
    expansionBonus.payout = payout;
    expansionBonus.capped = capped;
  }
  const multiplier = betAmount > 0 ? payout / betAmount : 0;
  const winTier: SlotSpinResult["winTier"] =
    multiplier >= 20 ? "MEGA" : multiplier >= 8 ? "BIG" : multiplier > 0 ? "SMALL" : "NONE";

  const winningPositions = [
    ...lineWins.flatMap((line) => line.positions),
    ...(triggeredExpansionBonus ? expansionTriggerPositions : []),
    ...(expansionBonus?.sourceFeature === "mine-clash" ? (expansionBonus.transformedPositions ?? []) : []),
  ];

  return {
    gameId: game.id,
    grid,
    wager: freeSpin ? 0 : betAmount,
    payout,
    multiplier,
    winType,
    winTier,
    capped,
    lineWins,
    winningPositions,
    freeSpinsAwarded,
    pickBonusAwards,
    pickBonusPicks: triggeredPickBonus ? game.pickBonus.picks : undefined,
    triggeredBonus: triggeredFreeSpins || triggeredPickBonus || Boolean(triggeredHoldAndWin) || Boolean(triggeredWheelBonus) || triggeredExpansionBonus,
    triggeredFreeSpins,
    triggeredPickBonus,
    triggeredHoldAndWin,
    triggeredWheelBonus,
    triggeredExpansionBonus,
    triggeredCoinCollector,
    bonusPayout,
    jackpotLabel,
    holdAndWin,
    wheelBonus,
    expansionBonus,
    goldRush,
  };
}

export function calculateNeonCascadeResult(game: SlotConfig, betAmount: number, freeSpin = false): SlotSpinResult {
  let grid = generateGrid(game);
  const cascades: NonNullable<SlotSpinResult["cascades"]> = [];
  let totalPayout = 0;
  let allLineWins: SlotSpinResult["lineWins"] = [];
  let allPositions: SlotSpinResult["winningPositions"] = [];

  for (let cascadeIndex = 0; cascadeIndex < 6; cascadeIndex += 1) {
    const cascadeMultiplier = Math.min(5, cascadeIndex + 1) * (freeSpin ? game.freeSpins.winMultiplier : 1);
    const lineWins = evaluatePaylines(game, grid, betAmount, false).map((line) => ({
      ...line,
      multiplier: line.multiplier * cascadeMultiplier,
      payout: Math.round(line.payout * cascadeMultiplier),
    }));
    if (lineWins.length === 0) break;
    const positions = lineWins.flatMap((line) => line.positions);
    const payout = lineWins.reduce((sum, line) => sum + line.payout, 0);
    cascades.push({ grid, payout, multiplier: cascadeMultiplier, winningPositions: positions });
    totalPayout += payout;
    allLineWins = [...allLineWins, ...lineWins];
    allPositions = [...allPositions, ...positions];
    grid = collapseGrid(game, grid, positions);
  }

  const scatterCount = countInGrid(grid, game.scatterSymbol);
  const bonusCount = countInGrid(grid, game.bonusSymbol);
  const triggeredFreeSpins = scatterCount >= game.freeSpins.triggerCount;
  const triggeredPickBonus = bonusCount >= game.pickBonus.triggerCount;
  const uncapped = totalPayout;
  const maxWin = maxWinFor(game, betAmount);
  totalPayout = Math.min(totalPayout, maxWin);
  const multiplier = betAmount > 0 ? totalPayout / betAmount : 0;
  const winTier: SlotSpinResult["winTier"] =
    multiplier >= 20 ? "MEGA" : multiplier >= 8 ? "BIG" : multiplier > 0 ? "SMALL" : "NONE";
  const freeSpinsAwarded = triggeredFreeSpins && (!freeSpin || game.freeSpins.retrigger) ? freeSpinAward(game) : 0;
  const pickBonusAwards = triggeredPickBonus ? createPickBonusAwards(game, betAmount) : undefined;

  return {
    gameId: game.id,
    grid,
    wager: freeSpin ? 0 : betAmount,
    payout: totalPayout,
    multiplier,
    winType: triggeredPickBonus ? "PICK_BONUS" : triggeredFreeSpins ? "FREE_SPINS" : totalPayout > 0 ? (winTier === "BIG" || winTier === "MEGA" ? "BIG_WIN" : "LINE_WIN") : "LOSS",
    winTier,
    capped: uncapped > totalPayout,
    lineWins: allLineWins,
    winningPositions: allPositions,
    freeSpinsAwarded,
    pickBonusAwards,
    pickBonusPicks: triggeredPickBonus ? game.pickBonus.picks : undefined,
    triggeredBonus: triggeredFreeSpins || triggeredPickBonus,
    triggeredFreeSpins,
    triggeredPickBonus,
    cascades,
  };
}

export function creditPickBonus({
  user,
  game,
  currency,
  award,
}: {
  user: User;
  game: SlotConfig;
  currency: Currency;
  award: number;
}) {
  if (award <= 0) throw new Error("Pick bonus award must be positive.");
  return creditCurrency({
    userId: user.id,
    type: "GAME_WIN",
    currency,
    amount: award,
    metadata: {
      gameId: game.id,
      gameName: game.name,
      winType: "PICK_BONUS",
      bonusResolution: true,
    },
  });
}

export function buyBonusDebit({
  user,
  game,
  currency,
  betAmount,
  featureType = game.buyBonus?.featureType ?? "HOLD_AND_WIN",
}: {
  user: User;
  game: SlotConfig;
  currency: Currency;
  betAmount: number;
  featureType?: BonusFeatureType;
}) {
  if (!game.buyBonus?.enabled) throw new Error("Buy bonus is not available for this game.");
  if (betAmount < game.minBet || betAmount > game.maxBet) throw new Error("Bet amount is outside this game's limits.");
  if (betAmount > DEMO_MAX_SINGLE_BET) throw new Error(`Demo maximum single bet is ${DEMO_MAX_SINGLE_BET}.`);
  const cost = getBonusBuyCost(game, betAmount, featureType, currency);
  return debitCurrency({
    userId: user.id,
    type: "BUY_BONUS",
    currency,
    amount: cost,
    metadata: {
      gameId: game.id,
      gameName: game.name,
      featureType,
      demoOnly: true,
    },
  });
}

export function debitGoldRushBonusBuy({
  user,
  game,
  currency,
  betAmount,
  bonusType,
}: {
  user: User;
  game: SlotConfig;
  currency: Currency;
  betAmount: number;
  bonusType: GoldRushBonusBuyType;
}) {
  if (game.id !== "gold-rush-showdown") throw new Error("Gold Rush bonus buys are only available on Gold Rush Showdown.");
  if (betAmount < game.minBet || betAmount > game.maxBet) throw new Error("Bet amount is outside this game's limits.");
  if (betAmount > DEMO_MAX_SINGLE_BET) throw new Error(`Demo maximum single bet is ${DEMO_MAX_SINGLE_BET}.`);
  const option = getGoldRushBonusBuyOption(game, bonusType);
  if (!option) throw new Error("Gold Rush bonus option is not available.");
  const cost = getGoldRushBonusBuyCost(game, betAmount, bonusType);
  return debitCurrency({
    userId: user.id,
    type: "BUY_BONUS",
    currency,
    amount: cost,
    metadata: {
      game: game.id,
      gameId: game.id,
      gameName: game.name,
      action: option.mode === "boost" ? "boost-buy" : "bonus-buy",
      bonusType,
      costMultiplier: option.costMultiplier,
      betAmount,
      currency,
      demoOnly: true,
    },
  });
}

export function creditHoldAndWinBonus({
  user,
  game,
  currency,
  betAmount,
  state,
  buyBonus = false,
}: {
  user: User;
  game: SlotConfig;
  currency: Currency;
  betAmount: number;
  state: HoldAndWinState;
  buyBonus?: boolean;
}) {
  const amount = Math.min(state.total, maxWinFor(game, betAmount));
  if (amount <= 0) throw new Error("Hold and Win award must be positive.");
  return creditCurrency({
    userId: user.id,
    type: state.filledAll ? "JACKPOT_WIN" : "BONUS_WIN",
    currency,
    amount,
    metadata: {
      gameId: game.id,
      gameName: game.name,
      winType: "HOLD_AND_WIN",
      buyBonus,
      filledAll: state.filledAll,
      lockedCoins: state.values.filter((value) => value !== null).length,
      demoOnly: true,
    },
  });
}

export function buyBonusFeature({
  user,
  game,
  currency,
  betAmount,
  featureType = game.buyBonus?.featureType ?? "HOLD_AND_WIN",
}: {
  user: User;
  game: SlotConfig;
  currency: Currency;
  betAmount: number;
  featureType?: BonusFeatureType;
}) {
  if (!game.buyBonus?.enabled) throw new Error("Buy bonus is not available for this game.");
  if (betAmount < game.minBet || betAmount > game.maxBet) throw new Error("Bet amount is outside this game's limits.");
  if (betAmount > DEMO_MAX_SINGLE_BET) throw new Error(`Demo maximum single bet is ${DEMO_MAX_SINGLE_BET}.`);
  const cost = getBonusBuyCost(game, betAmount, featureType, currency);
  buyBonusDebit({ user, game, currency, betAmount, featureType });

  const payoutBetAmount = getBonusBuyPayoutBetAmount(game, betAmount, featureType, currency);
  const feature = calculateDirectFeature(game, payoutBetAmount, featureType);
  const payout = Math.min(feature.bonusPayout, maxWinFor(game, betAmount));
  const result: SlotSpinResult = {
    gameId: game.id,
    grid: generateGrid(game),
    wager: cost,
    payout,
    multiplier: betAmount > 0 ? payout / betAmount : 0,
    winType: "BUY_BONUS",
    winTier: payout >= betAmount * 20 ? "MEGA" : payout >= betAmount * 8 ? "BIG" : payout > 0 ? "SMALL" : "NONE",
    capped: feature.bonusPayout > payout,
    lineWins: [],
    winningPositions: [],
    freeSpinsAwarded: feature.freeSpinsAwarded ?? 0,
    triggeredBonus: true,
    triggeredFreeSpins: featureType === "FREE_SPINS" || Boolean(feature.freeSpinsAwarded),
    triggeredPickBonus: featureType === "PICK_BONUS",
    triggeredHoldAndWin: featureType === "HOLD_AND_WIN" || Boolean(feature.wheelBonus?.featureTrigger),
    triggeredWheelBonus: featureType === "WHEEL_BONUS",
    bonusPayout: payout,
    jackpotLabel: feature.jackpotLabel,
    holdAndWin: feature.holdAndWin,
    wheelBonus: feature.wheelBonus,
  };

  if (payout > 0) {
    creditCurrency({
      userId: user.id,
      type: result.jackpotLabel ? "JACKPOT_WIN" : "BONUS_WIN",
      currency,
      amount: payout,
      metadata: {
        gameId: game.id,
        gameName: game.name,
        winType: featureType,
        buyBonus: true,
        betAmount,
        payoutBetAmount,
        demoOnly: true,
        holdAndWin: result.holdAndWin,
        wheelBonus: result.wheelBonus,
      },
    });
  }

  return result;
}

export function spinSlot(input: SlotSpinInput) {
  const spinMode = input.spinMode ?? "NORMAL";
  const spinCost = input.freeSpin ? 0 : getSpinCost(input.game, input.betAmount, spinMode);
  const prepaidWager = typeof input.prepaidWager === "number" ? input.prepaidWager : undefined;
  if (!Number.isFinite(input.betAmount) || input.betAmount < input.game.minBet) {
    throw new Error(`Minimum bet is ${input.game.minBet}.`);
  }
  if (input.betAmount > input.game.maxBet) {
    throw new Error(`Maximum bet is ${input.game.maxBet}.`);
  }
  if (input.betAmount > DEMO_MAX_SINGLE_BET) {
    throw new Error(`Demo maximum single bet is ${DEMO_MAX_SINGLE_BET}.`);
  }

  if (!input.freeSpin && prepaidWager === undefined) {
    debitCurrency({
      userId: input.user.id,
      type: "GAME_BET",
      currency: input.currency,
      amount: spinCost,
      metadata: { gameId: input.game.id, gameName: input.game.name, spinMode, displayedCost: spinCost, betAmount: input.betAmount },
    });
  }

  const result =
    input.game.id === "neon-fortune"
      ? calculateNeonCascadeResult(input.game, input.betAmount, input.freeSpin)
      : calculateSlotResult(input.game, input.betAmount, input.freeSpin, input.forcedGrid, spinMode, input.stickyWildPositions, input.goldRushInteriorOverride);
  result.wager = input.freeSpin ? 0 : prepaidWager ?? spinCost;
  if (result.payout > 0) {
    creditCurrency({
      userId: input.user.id,
      type: result.winType === "EXPANSION_BONUS" || (result.bonusPayout && result.bonusPayout >= result.payout) ? (result.jackpotLabel ? "JACKPOT_WIN" : "BONUS_WIN") : "GAME_WIN",
      currency: input.currency,
      amount: result.payout,
      metadata: {
        gameId: input.game.id,
        gameName: input.game.name,
        grid: result.grid,
        lineWins: result.lineWins,
        winType: result.winType,
        freeSpin: Boolean(input.freeSpin),
        spinMode,
        wheelBonus: result.wheelBonus,
        expansionBonus: result.expansionBonus,
        triggeredCoinCollector: result.triggeredCoinCollector,
      },
    });
  }

  return result;
}
