import { creditCurrency, debitCurrency } from "../wallet/walletService";
import type { Currency, User } from "../types";
import type { BonusFeatureType, HoldAndWinResult, HoldAndWinState, SlotConfig, SlotSpinInput, SlotSpinResult, WheelBonusResult } from "./types";

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

function maxWinFor(game: SlotConfig, betAmount: number) {
  return Math.round(betAmount * game.maxPayoutMultiplier);
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

function randomFrom<T>(items: T[]) {
  return items[Math.floor(Math.random() * items.length)];
}

function coinAward(game: SlotConfig, betAmount: number) {
  const multipliers = game.volatility === "High" ? [1, 1, 2, 2, 3, 5, 8, 10, 15] : [1, 1, 1, 2, 2, 3, 5, 8];
  return Math.round(betAmount * randomFrom(multipliers));
}

export function createHoldAndWinState(game: SlotConfig, betAmount: number, startingCoins = 3): HoldAndWinState {
  const positions = game.reelCount * game.rowCount;
  const values: Array<number | null> = Array.from({ length: positions }, () => null);
  const used = new Set<number>();
  while (used.size < Math.min(startingCoins, positions)) {
    used.add(Math.floor(Math.random() * positions));
  }
  used.forEach((position) => {
    values[position] = coinAward(game, betAmount);
  });
  const total = values.reduce<number>((sum, value) => sum + (value ?? 0), 0);
  return {
    values,
    respinsRemaining: 3,
    total,
    finished: false,
    filledAll: values.every((value) => value !== null),
    lastNewCoins: [...used],
  };
}

export function stepHoldAndWinBonus(game: SlotConfig, betAmount: number, state: HoldAndWinState): HoldAndWinState {
  if (state.finished) return state;
  const values = [...state.values];
  const lastNewCoins: number[] = [];
  values.forEach((value, index) => {
    if (value === null && Math.random() < 0.18) {
      values[index] = coinAward(game, betAmount);
      lastNewCoins.push(index);
    }
  });
  const filledAll = values.every((value) => value !== null);
  const respinsRemaining = filledAll ? 0 : lastNewCoins.length > 0 ? 3 : state.respinsRemaining - 1;
  const total = Math.min(
    values.reduce<number>((sum, value) => sum + (value ?? 0), 0) + (filledAll ? Math.round(betAmount * 60) : 0),
    maxWinFor(game, betAmount),
  );
  return {
    values,
    respinsRemaining,
    total,
    finished: filledAll || respinsRemaining <= 0,
    filledAll,
    lastNewCoins,
  };
}

export function calculateHoldAndWinBonus(game: SlotConfig, betAmount: number): HoldAndWinResult {
  let state = createHoldAndWinState(game, betAmount, 3 + Math.floor(Math.random() * 3));
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
  const segments: WheelBonusResult[] = [
    { segment: "5x", multiplier: 5, payout: betAmount * 5 },
    { segment: "10x", multiplier: 10, payout: betAmount * 10 },
    { segment: "25x", multiplier: 25, payout: betAmount * 25 },
    { segment: "50x", multiplier: 50, payout: betAmount * 50 },
    { segment: "Mini", multiplier: 10, payout: betAmount * 10, jackpotLabel: "Mini" },
    { segment: "Major", multiplier: 50, payout: betAmount * 50, jackpotLabel: "Major" },
    { segment: "Grand", multiplier: 80, payout: betAmount * 80, jackpotLabel: "Grand" },
  ];
  const weighted = [segments[0], segments[0], segments[1], segments[1], segments[2], segments[3], segments[4], segments[5], segments[6]];
  const result = randomFrom(weighted);
  const payout = Math.min(Math.round(result.payout), maxWinFor(game, betAmount));
  return { ...result, payout };
}

function calculateDirectFeature(game: SlotConfig, betAmount: number, featureType: BonusFeatureType) {
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
    return {
      bonusPayout: wheelBonus.payout,
      winType: "WHEEL_BONUS" as const,
      jackpotLabel: wheelBonus.jackpotLabel,
      wheelBonus,
    };
  }
  if (featureType === "FREE_SPINS") {
    const spins = freeSpinAward(game);
    let bonusPayout = 0;
    for (let index = 0; index < spins; index += 1) {
      bonusPayout += calculateSlotResult(game, betAmount, true).payout;
    }
    return {
      bonusPayout: Math.min(bonusPayout, maxWinFor(game, betAmount)),
      winType: "FREE_SPINS" as const,
      freeSpinsAwarded: spins,
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
): SlotSpinResult {
  const grid = forcedGrid ?? generateGrid(game);
  const scatterCount = countInGrid(grid, game.scatterSymbol);
  const bonusCount = countInGrid(grid, game.bonusSymbol);
  const triggeredFreeSpins = scatterCount >= game.freeSpins.triggerCount;
  const triggeredPickBonus = bonusCount >= game.pickBonus.triggerCount;
  const coinSymbol = game.specialSymbols?.coin;
  const wheelSymbol = game.buyBonus?.featureType === "WHEEL_BONUS" ? game.bonusSymbol : game.specialSymbols?.multiplier;
  const triggeredHoldAndWin = game.featureTypes?.includes("HOLD_AND_WIN") && coinSymbol ? countInGrid(grid, coinSymbol) >= 3 : false;
  const triggeredWheelBonus = game.featureTypes?.includes("WHEEL_BONUS") && wheelSymbol ? countInGrid(grid, wheelSymbol) >= 3 : false;
  const lineWins = evaluatePaylines(game, grid, betAmount, freeSpin);

  let payout = lineWins.reduce((sum, line) => sum + line.payout, 0);
  let bonusPayout = 0;
  let freeSpinsAwarded = 0;
  let pickBonusAwards: number[] | undefined;
  let holdAndWin: HoldAndWinResult | undefined;
  let wheelBonus: WheelBonusResult | undefined;
  let jackpotLabel: SlotSpinResult["jackpotLabel"];
  let winType: SlotSpinResult["winType"] = payout > betAmount * 8 ? "BIG_WIN" : payout > 0 ? "LINE_WIN" : "LOSS";

  if (triggeredFreeSpins && (!freeSpin || game.freeSpins.retrigger)) {
    freeSpinsAwarded = freeSpinAward(game);
    winType = "FREE_SPINS";
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
    winType = "WHEEL_BONUS";
  }

  payout += bonusPayout;
  const uncappedPayout = payout;
  const maxWin = maxWinFor(game, betAmount);
  payout = Math.min(payout, maxWin);
  bonusPayout = Math.min(bonusPayout, payout);
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
    triggeredBonus: triggeredFreeSpins || triggeredPickBonus || Boolean(triggeredHoldAndWin) || Boolean(triggeredWheelBonus),
    triggeredFreeSpins,
    triggeredPickBonus,
    triggeredHoldAndWin,
    triggeredWheelBonus,
    bonusPayout,
    jackpotLabel,
    holdAndWin,
    wheelBonus,
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
}: {
  user: User;
  game: SlotConfig;
  currency: Currency;
  betAmount: number;
}) {
  if (!game.buyBonus?.enabled) throw new Error("Buy bonus is not available for this game.");
  if (betAmount < game.minBet || betAmount > game.maxBet) throw new Error("Bet amount is outside this game's limits.");
  const cost = Math.round(betAmount * game.buyBonus.costMultiplier);
  return debitCurrency({
    userId: user.id,
    type: "BUY_BONUS",
    currency,
    amount: cost,
    metadata: {
      gameId: game.id,
      gameName: game.name,
      featureType: game.buyBonus.featureType,
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
}: {
  user: User;
  game: SlotConfig;
  currency: Currency;
  betAmount: number;
}) {
  if (!game.buyBonus?.enabled) throw new Error("Buy bonus is not available for this game.");
  if (betAmount < game.minBet || betAmount > game.maxBet) throw new Error("Bet amount is outside this game's limits.");
  const cost = Math.round(betAmount * game.buyBonus.costMultiplier);
  buyBonusDebit({ user, game, currency, betAmount });

  const feature = calculateDirectFeature(game, betAmount, game.buyBonus.featureType);
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
    triggeredFreeSpins: game.buyBonus.featureType === "FREE_SPINS",
    triggeredPickBonus: game.buyBonus.featureType === "PICK_BONUS",
    triggeredHoldAndWin: game.buyBonus.featureType === "HOLD_AND_WIN",
    triggeredWheelBonus: game.buyBonus.featureType === "WHEEL_BONUS",
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
        winType: game.buyBonus.featureType,
        buyBonus: true,
        demoOnly: true,
        holdAndWin: result.holdAndWin,
        wheelBonus: result.wheelBonus,
      },
    });
  }

  return result;
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
      type: result.bonusPayout && result.bonusPayout >= result.payout ? (result.jackpotLabel ? "JACKPOT_WIN" : "BONUS_WIN") : "GAME_WIN",
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
