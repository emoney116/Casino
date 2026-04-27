import { creditCurrency, debitCurrency } from "../wallet/walletService";
import type { Currency, User } from "../types";
import type { SlotConfig, SlotSpinInput, SlotSpinResult } from "./types";

function pickWeightedSymbol(game: SlotConfig) {
  const total = game.symbols.reduce((sum, symbol) => sum + symbol.weight, 0);
  let roll = Math.random() * total;
  for (const symbol of game.symbols) {
    roll -= symbol.weight;
    if (roll <= 0) return symbol.id;
  }
  return game.symbols[game.symbols.length - 1].id;
}

export function generateGrid(game: SlotConfig) {
  return Array.from({ length: game.reelCount }, () =>
    Array.from({ length: game.rowCount }, () => pickWeightedSymbol(game)),
  );
}

function countInGrid(grid: string[][], symbol: string) {
  return grid.flat().filter((candidate) => candidate === symbol).length;
}

function payoutMultiplier(game: SlotConfig, symbol: string, count: number) {
  const rules = game.payoutTable
    .filter((rule) => rule.symbol === symbol && count >= rule.count)
    .sort((a, b) => b.count - a.count || b.multiplier - a.multiplier);
  return rules[0]?.multiplier ?? 0;
}

function evaluatePaylines(game: SlotConfig, grid: string[][], betAmount: number, freeSpin: boolean) {
  const lineBet = betAmount / game.paylines.length;
  const lineWins: SlotSpinResult["lineWins"] = [];

  for (const payline of game.paylines) {
    const symbols = payline.rows.map((row, reel) => grid[reel][row]);
    const firstRegular = symbols.find(
      (symbol) => symbol !== "wild" && symbol !== game.scatterSymbol && symbol !== game.bonusSymbol,
    );
    if (!firstRegular) continue;

    let count = 0;
    const positions: Array<{ reel: number; row: number }> = [];
    for (let reel = 0; reel < symbols.length; reel += 1) {
      const symbol = symbols[reel];
      if (symbol === firstRegular || symbol === "wild") {
        count += 1;
        positions.push({ reel, row: payline.rows[reel] });
      } else {
        break;
      }
    }

    const multiplier = payoutMultiplier(game, firstRegular, count);
    if (multiplier > 0) {
      const boosted = multiplier * (freeSpin ? game.freeSpins.winMultiplier : 1);
      lineWins.push({
        paylineId: payline.id,
        paylineName: payline.name,
        symbol: firstRegular,
        count,
        multiplier: boosted,
        positions,
        payout: Math.round(lineBet * boosted),
      });
    }
  }

  return lineWins;
}

function collapseGrid(game: SlotConfig, grid: string[][], positions: Array<{ reel: number; row: number }>) {
  const remove = new Set(positions.map((position) => `${position.reel}:${position.row}`));
  return grid.map((reelSymbols, reel) => {
    const remaining = reelSymbols.filter((_, row) => !remove.has(`${reel}:${row}`));
    const fill = Array.from({ length: game.rowCount - remaining.length }, () => pickWeightedSymbol(game));
    return [...fill, ...remaining].slice(0, game.rowCount);
  });
}

function freeSpinAward(game: SlotConfig) {
  const range = game.freeSpins.awarded;
  return range[0] + Math.floor(Math.random() * (range[1] - range[0] + 1));
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
): SlotSpinResult {
  const grid = forcedGrid ?? generateGrid(game);
  const scatterCount = countInGrid(grid, game.scatterSymbol);
  const bonusCount = countInGrid(grid, game.bonusSymbol);
  const triggeredFreeSpins = scatterCount >= game.freeSpins.triggerCount;
  const triggeredPickBonus = bonusCount >= game.pickBonus.triggerCount;
  const lineWins = evaluatePaylines(game, grid, betAmount, freeSpin);

  let payout = lineWins.reduce((sum, line) => sum + line.payout, 0);
  let freeSpinsAwarded = 0;
  let pickBonusAwards: number[] | undefined;
  let winType: SlotSpinResult["winType"] = payout > betAmount * 8 ? "BIG_WIN" : payout > 0 ? "LINE_WIN" : "LOSS";

  if (triggeredFreeSpins && (!freeSpin || game.freeSpins.retrigger)) {
    freeSpinsAwarded = freeSpinAward(game);
    winType = "FREE_SPINS";
  }

  if (triggeredPickBonus) {
    pickBonusAwards = createPickBonusAwards(game, betAmount);
    winType = "PICK_BONUS";
  }

  const uncappedPayout = payout;
  const maxWin = Math.round(betAmount * game.maxPayoutMultiplier);
  payout = Math.min(payout, maxWin);
  const capped = uncappedPayout > payout;
  const multiplier = betAmount > 0 ? payout / betAmount : 0;
  const winTier: SlotSpinResult["winTier"] =
    multiplier >= 20 ? "MEGA" : multiplier >= 8 ? "BIG" : multiplier > 0 ? "SMALL" : "NONE";

  const winningPositions = lineWins.flatMap((line) => line.positions);

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
    triggeredBonus: triggeredFreeSpins || triggeredPickBonus,
    triggeredFreeSpins,
    triggeredPickBonus,
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
  const maxWin = Math.round(betAmount * game.maxPayoutMultiplier);
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

export function spinSlot(input: SlotSpinInput) {
  if (!Number.isFinite(input.betAmount) || input.betAmount < input.game.minBet) {
    throw new Error(`Minimum bet is ${input.game.minBet}.`);
  }
  if (input.betAmount > input.game.maxBet) {
    throw new Error(`Maximum bet is ${input.game.maxBet}.`);
  }

  if (!input.freeSpin) {
    debitCurrency({
      userId: input.user.id,
      type: "GAME_BET",
      currency: input.currency,
      amount: input.betAmount,
      metadata: { gameId: input.game.id, gameName: input.game.name },
    });
  }

  const result =
    input.game.id === "neon-fortune"
      ? calculateNeonCascadeResult(input.game, input.betAmount, input.freeSpin)
      : calculateSlotResult(input.game, input.betAmount, input.freeSpin);
  if (result.payout > 0) {
    creditCurrency({
      userId: input.user.id,
      type: "GAME_WIN",
      currency: input.currency,
      amount: result.payout,
      metadata: {
        gameId: input.game.id,
        gameName: input.game.name,
        grid: result.grid,
        lineWins: result.lineWins,
        winType: result.winType,
        freeSpin: Boolean(input.freeSpin),
      },
    });
  }

  return result;
}
