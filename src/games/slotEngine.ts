import { creditCurrency, debitCurrency } from "../wallet/walletService";
import { DEMO_MAX_SINGLE_BET, capDemoPayout } from "../economy/limits";
import type { Currency, User } from "../types";
import type { BonusFeatureType, HoldAndWinResult, HoldAndWinState, SlotConfig, SlotSpinInput, SlotSpinResult, SpinMode, WheelBonusResult } from "./types";

function frontierFreeSpinSymbolWeight(symbolId: string, weight: number) {
  if (symbolId === "10" || symbolId === "J") return 0;
  if (symbolId === "Q") return weight * 0.35;
  if (symbolId === "K" || symbolId === "A") return weight * 0.55;
  if (["sun_hawk", "canyon_ram", "sand_fox", "crystal_scorpion", "desert_relic", "oasis_gem", "dust_spirit"].includes(symbolId)) return weight * 1.25;
  if (symbolId === "mirage_wild") return weight * 1.2;
  return weight;
}

function weightedSymbols(game: SlotConfig, spinMode: SpinMode = "NORMAL", freeSpin = false) {
  const boost = spinMode === "NORMAL" ? undefined : game.boostSpins?.[spinMode];
  return game.symbols.map((symbol) => {
    const coinSymbol = game.specialSymbols?.coin;
    const scatterSymbol = game.scatterSymbol;
    const boostedWeight =
      symbol.id === coinSymbol
        ? symbol.weight * (boost?.coinWeightMultiplier ?? 1)
        : symbol.id === scatterSymbol
          ? symbol.weight * (boost?.scatterWeightMultiplier ?? 1)
          : symbol.weight;
    const weight = freeSpin && game.id === "frontier-fortune" ? frontierFreeSpinSymbolWeight(symbol.id, boostedWeight) : boostedWeight;
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

export function generateGrid(game: SlotConfig, spinMode: SpinMode = "NORMAL", freeSpin = false) {
  return Array.from({ length: game.reelCount }, () =>
    Array.from({ length: game.rowCount }, () => pickWeightedSymbol(game, spinMode, freeSpin)),
  );
}

function countInGrid(grid: string[][], symbol: string) {
  return grid.flat().filter((candidate) => candidate === symbol).length;
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

function evaluatePaylines(game: SlotConfig, grid: string[][], betAmount: number, freeSpin: boolean) {
  const lineBet = betAmount / game.paylines.length;
  const lineWins: SlotSpinResult["lineWins"] = [];

  for (const payline of game.paylines) {
    const symbols = payline.rows.map((row, reel) => grid[reel][row]);
    const wildSymbol = game.specialSymbols?.wild ?? "wild";
    const firstRegular = symbols.find((symbol) => symbol !== wildSymbol && symbol !== game.scatterSymbol && symbol !== game.bonusSymbol);
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
      const boosted = multiplier * (freeSpin ? game.freeSpins.winMultiplier : 1);
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

export function calculateFreeSpinsBonus(game: SlotConfig, betAmount: number, awardedSpins: number) {
  const maxSpins = game.freeSpins.maxSpins ?? 30;
  let remaining = Math.max(0, Math.min(maxSpins, awardedSpins));
  let totalAwarded = remaining;
  let spinsPlayed = 0;
  let total = 0;
  let stickyWildPositions: number[] = [];

  while (remaining > 0 && spinsPlayed < maxSpins) {
    const result = calculateSlotResult(game, betAmount, true, undefined, "NORMAL", stickyWildPositions);
    total += result.payout + (result.pickBonusAwards?.[0] ?? 0);
    stickyWildPositions = getStickyWildPositions(game, result.grid, stickyWildPositions);
    remaining -= 1;
    spinsPlayed += 1;
    if (result.freeSpinsAwarded > 0 && totalAwarded < maxSpins) {
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
): SlotSpinResult {
  const grid = applyStickyWilds(game, forcedGrid ?? generateGrid(game, spinMode, freeSpin), freeSpin ? stickyWildPositions : []);
  const scatterCount = countInGrid(grid, game.scatterSymbol);
  const bonusCount = countInGrid(grid, game.bonusSymbol);
  const frontierFreeSpinRetrigger = freeSpin && game.id === "frontier-fortune" && game.freeSpins.retrigger && scatterCount >= (game.wheelBonus?.triggerCount ?? 3);
  let triggeredFreeSpins = frontierFreeSpinRetrigger || (scatterCount >= game.freeSpins.triggerCount && (!freeSpin || game.freeSpins.retrigger));
  const triggeredPickBonus = bonusCount >= game.pickBonus.triggerCount;
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
  const lineWins = evaluatePaylines(game, grid, betAmount, freeSpin);

  let payout = lineWins.reduce((sum, line) => sum + line.payout, 0);
  let bonusPayout = 0;
  let freeSpinsAwarded = 0;
  let pickBonusAwards: number[] | undefined;
  let holdAndWin: HoldAndWinResult | undefined;
  let wheelBonus: WheelBonusResult | undefined;
  let jackpotLabel: SlotSpinResult["jackpotLabel"];
  let winType: SlotSpinResult["winType"] = payout > betAmount * 8 ? "BIG_WIN" : payout > 0 ? "LINE_WIN" : "LOSS";

  if (triggeredFreeSpins) {
    freeSpinsAwarded = frontierFreeSpinRetrigger ? (game.freeSpins.retriggerAward ?? 5) : freeSpinAward(game);
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
    triggeredCoinCollector,
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
  if (!Number.isFinite(input.betAmount) || input.betAmount < input.game.minBet) {
    throw new Error(`Minimum bet is ${input.game.minBet}.`);
  }
  if (input.betAmount > input.game.maxBet) {
    throw new Error(`Maximum bet is ${input.game.maxBet}.`);
  }
  if (input.betAmount > DEMO_MAX_SINGLE_BET) {
    throw new Error(`Demo maximum single bet is ${DEMO_MAX_SINGLE_BET}.`);
  }

  if (!input.freeSpin) {
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
      : calculateSlotResult(input.game, input.betAmount, input.freeSpin, undefined, spinMode, input.stickyWildPositions);
  result.wager = spinCost;
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
        spinMode,
        wheelBonus: result.wheelBonus,
        triggeredCoinCollector: result.triggeredCoinCollector,
      },
    });
  }

  return result;
}
