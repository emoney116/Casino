import type { SimulationResult, SlotConfig } from "./types";
import { calculateDirectFeature, calculateFreeSpinsBonus, calculateHoldAndWinBonus, calculateNeonCascadeResult, calculateSlotResult, createGoldRushBonusTriggerGrid, createGoldRushShowdownBoostGrid, getBonusBuyCost, getBonusBuyPayoutBetAmount, getGoldRushBonusBuyCost, getSpinCost } from "./slotEngine";
import { capDemoPayout } from "../economy/limits";
import type { Currency } from "../types";
import type { BonusFeatureType, SpinMode } from "./types";

// Demo-only math tooling. Any real regulated gambling product would need certified
// RNG, certified math, jurisdiction-specific legal review, and independent testing.
export function simulateSlot(game: SlotConfig, spins = 100000, betAmount = game.minBet): SimulationResult {
  let totalWagered = 0;
  let totalPaid = 0;
  let hits = 0;
  let biggestWin = 0;
  let bonusTriggers = 0;
  let freeSpinTriggers = 0;
  let pickBonusTriggers = 0;
  let holdAndWinTriggers = 0;
  let wheelBonusTriggers = 0;
  let expansionBonusTriggers = 0;
  let coinCollectorTriggers = 0;
  let cappedResults = 0;
  let holdAndWinPaid = 0;
  let mineClashTriggers = 0;
  let mineClashPaid = 0;
  let mineClashWildEv = 0;
  let freeSpinPaidTotal = 0;
  let baseLinePaid = 0;
  let inactiveVsCount = 0;
  let activeNormalVsCount = 0;
  let activeNormalVsPaid = 0;
  let interiorBoardAppearanceCount = 0;
  let vsInsideInteriorCount = 0;
  let activeInteriorVsCount = 0;
  let activeInteriorVsPaid = 0;
  let naturalThreeBonusTriggers = 0;
  let naturalFourBonusTriggers = 0;
  let freeSpinsPlayedTotal = 0;
  let freeSpinsFinalInteriorTotal = 0;
  let freeSpinsVsInsideTotal = 0;
  const interiorSizeDistribution: Record<string, number> = {};
  const vsDuelTierDistribution: Record<string, number> = {};
  const vsMultiplierDistribution: Record<string, number> = {};
  const increment = (record: Record<string, number>, key: string) => {
    record[key] = (record[key] ?? 0) + 1;
  };

  for (let index = 0; index < spins; index += 1) {
    const result = game.id === "neon-fortune" ? calculateNeonCascadeResult(game, betAmount) : calculateSlotResult(game, betAmount);
    totalWagered += betAmount;
    const freeSpinBonus = result.freeSpinsAwarded > 0 ? calculateFreeSpinsBonus(game, betAmount, result.freeSpinsAwarded, result.goldRush?.freeSpinsTrigger?.initialInteriorColumns) : undefined;
    const freeSpinPaid = freeSpinBonus?.total ?? 0;
    freeSpinPaidTotal += freeSpinPaid;
    const pickAward = result.pickBonusAwards?.[0] ?? 0;
    const holdAward = result.triggeredHoldAndWin ? calculateHoldAndWinBonus(game, betAmount).total : 0;
    if (result.capped || holdAward >= betAmount * game.maxPayoutMultiplier) cappedResults += 1;
    holdAndWinPaid += holdAward;
    const totalResultPaid = result.payout + pickAward + holdAward + freeSpinPaid;
    totalPaid += totalResultPaid;
    if (totalResultPaid > 0) hits += 1;
    if (result.triggeredBonus) bonusTriggers += 1;
    if (result.triggeredFreeSpins) freeSpinTriggers += 1;
    if (game.id === "gold-rush-showdown" && result.triggeredFreeSpins) {
      const count = result.goldRush?.freeSpinsTrigger?.triggerCount ?? 0;
      if (count === 3) naturalThreeBonusTriggers += 1;
      if (count >= 4) naturalFourBonusTriggers += 1;
      freeSpinsPlayedTotal += freeSpinBonus?.spinsPlayed ?? 0;
      freeSpinsFinalInteriorTotal += freeSpinBonus?.finalInteriorColumns ?? 0;
      freeSpinsVsInsideTotal += freeSpinBonus?.vsInsideFreeSpinsCount ?? 0;
    }
    if (result.triggeredPickBonus) pickBonusTriggers += 1;
    if (result.triggeredHoldAndWin) holdAndWinTriggers += 1;
    if (result.triggeredWheelBonus) wheelBonusTriggers += 1;
    if (result.triggeredExpansionBonus) expansionBonusTriggers += 1;
    if (result.expansionBonus?.sourceFeature === "mine-clash") {
      mineClashTriggers += 1;
      mineClashPaid += result.expansionBonus.payout;
      mineClashWildEv += result.expansionBonus.mineClash?.multiplierWildEv ?? 0;
    }
    if (result.goldRush) {
      const goldRush = result.goldRush;
      baseLinePaid += goldRush.baseLinePayout;
      inactiveVsCount += goldRush.inactiveVsPositions.length;
      vsInsideInteriorCount += goldRush.vsInsideInteriorCount;
      if (goldRush.interior) {
        interiorBoardAppearanceCount += 1;
        increment(interiorSizeDistribution, `${goldRush.interior.columns}`);
      }
      if (goldRush.vsActive && goldRush.vsType === "normal-column") {
        activeNormalVsCount += 1;
        activeNormalVsPaid += goldRush.activeNormalVsPayout;
      }
      if (goldRush.vsActive && goldRush.vsType === "interior") {
        activeInteriorVsCount += 1;
        activeInteriorVsPaid += goldRush.activeInteriorVsPayout;
      }
      if (goldRush.vsTier) increment(vsDuelTierDistribution, goldRush.vsTier);
      if (goldRush.vsMultiplier) increment(vsMultiplierDistribution, `${goldRush.vsMultiplier}x`);
    }
    if (result.triggeredCoinCollector) coinCollectorTriggers += 1;
    biggestWin = Math.max(biggestWin, totalResultPaid, freeSpinPaid);
  }

  const modeResults: NonNullable<SimulationResult["modeResults"]> = {
    NORMAL: simulateSpinMode(game, spins, betAmount, "NORMAL"),
  };
  if (game.boostSpins?.GOLD_BOOST) modeResults.GOLD_BOOST = simulateSpinMode(game, spins, betAmount, "GOLD_BOOST");
  if (game.boostSpins?.SCATTER_BOOST) modeResults.SCATTER_BOOST = simulateSpinMode(game, spins, betAmount, "SCATTER_BOOST");
  if (game.boostSpins?.GOLD_RUSH_BONUS_BOOST) modeResults.GOLD_RUSH_BONUS_BOOST = simulateSpinMode(game, spins, betAmount, "GOLD_RUSH_BONUS_BOOST");
  if (game.boostSpins?.GOLD_RUSH_SHOWDOWN) modeResults.GOLD_RUSH_SHOWDOWN = simulateGoldRushShowdownMode(game, spins, betAmount);
  if (game.bonusBuys?.some((buy) => buy.featureType === "HOLD_AND_WIN")) {
    modeResults.BUY_HOLD_AND_WIN = simulateBonusBuyMode(game, spins, betAmount, "HOLD_AND_WIN", "GOLD");
  }
  if (game.bonusBuys?.some((buy) => buy.featureType === "WHEEL_BONUS")) {
    modeResults.BUY_WHEEL_BONUS = simulateBonusBuyMode(game, spins, betAmount, "WHEEL_BONUS", "GOLD");
  }
  if (game.id === "gold-rush-showdown") {
    modeResults.GOLD_RUSH_BUY_BONUS = simulateGoldRushFreeSpinsBuyMode(game, spins, betAmount, 3, "buy-bonus");
    modeResults.GOLD_RUSH_BUY_SUPER_BONUS = simulateGoldRushFreeSpinsBuyMode(game, spins, betAmount, 4, "buy-super-bonus");
  }

  let buyBonusRtp: number | undefined;
  let buyBonusAveragePayout: number | undefined;
  if (game.buyBonus?.enabled) {
    let buyPaid = 0;
    let buyCost = 0;
    let buyCapHits = 0;
    const cost = getBonusBuyCost(game, betAmount, game.buyBonus.featureType, "GOLD");
    const buySpins = Math.min(5000, spins);
    for (let index = 0; index < buySpins; index += 1) {
      const payoutBetAmount = getBonusBuyPayoutBetAmount(game, betAmount, game.buyBonus.featureType, "GOLD");
      const feature = calculateDirectFeature(game, payoutBetAmount, game.buyBonus.featureType);
      const payout = Math.min(feature.bonusPayout, capDemoPayout(Math.round(betAmount * game.maxPayoutMultiplier)));
      buyCost += cost;
      buyPaid += payout;
      if (feature.bonusPayout > payout) buyCapHits += 1;
    }
    buyBonusRtp = buyPaid / buyCost;
    buyBonusAveragePayout = buyPaid / buySpins;
    cappedResults += buyCapHits;
  }

  return {
    spins,
    totalWagered,
    totalPaid,
    observedRtp: totalPaid / totalWagered,
    modeResults,
    hitRate: hits / spins,
    biggestWin,
    bonusTriggerRate: bonusTriggers / spins,
    freeSpinTriggerRate: freeSpinTriggers / spins,
    pickBonusTriggerRate: pickBonusTriggers / spins,
    holdAndWinTriggerRate: holdAndWinTriggers / spins,
    wheelBonusTriggerRate: wheelBonusTriggers / spins,
    expansionBonusTriggerRate: expansionBonusTriggers / spins,
    mineClashTriggerRate: mineClashTriggers / spins,
    averageMineClashPayout: mineClashTriggers > 0 ? mineClashPaid / mineClashTriggers : 0,
    multiplierWildEv: mineClashTriggers > 0 ? mineClashWildEv / mineClashTriggers : 0,
    freeSpinsAveragePayout: freeSpinTriggers > 0 ? freeSpinPaidTotal / freeSpinTriggers : 0,
    coinCollectorTriggerRate: coinCollectorTriggers / spins,
    buyBonusRtp,
    buyBonusAveragePayout,
    holdAndWinAveragePayout: holdAndWinTriggers > 0 ? holdAndWinPaid / holdAndWinTriggers : 0,
    capHitRate: cappedResults / (spins + (game.buyBonus?.enabled ? Math.min(250, spins) : 0)),
    baseLineRtp: baseLinePaid / totalWagered,
    inactiveVsCount,
    activeNormalVsCount,
    activeNormalVsRate: activeNormalVsCount / spins,
    interiorBoardAppearanceCount,
    interiorBoardAppearanceRate: interiorBoardAppearanceCount / spins,
    vsInsideInteriorCount,
    activeInteriorVsCount,
    activeInteriorVsRate: activeInteriorVsCount / spins,
    averageActiveNormalVsPayout: activeNormalVsCount > 0 ? activeNormalVsPaid / activeNormalVsCount : 0,
    averageActiveInteriorVsPayout: activeInteriorVsCount > 0 ? activeInteriorVsPaid / activeInteriorVsCount : 0,
    maxWinObserved: biggestWin,
    interiorSizeDistribution,
    vsDuelTierDistribution,
    vsMultiplierDistribution,
    naturalThreeBonusTriggerRate: naturalThreeBonusTriggers / spins,
    naturalFourBonusTriggerRate: naturalFourBonusTriggers / spins,
    buyBonusRtp3: modeResults.GOLD_RUSH_BUY_BONUS?.observedRtp,
    buyBonusRtp4: modeResults.GOLD_RUSH_BUY_SUPER_BONUS?.observedRtp,
    bonusPlusSpinsRtp: modeResults.GOLD_RUSH_BONUS_BOOST?.observedRtp,
    showdownSpinRtp: modeResults.GOLD_RUSH_SHOWDOWN?.observedRtp,
    buyBonusAverageFreeSpins: freeSpinTriggers > 0 ? freeSpinsPlayedTotal / freeSpinTriggers : 0,
    buyBonusAverageFinalInteriorSize: freeSpinTriggers > 0 ? freeSpinsFinalInteriorTotal / freeSpinTriggers : 0,
    vsInsideFreeSpinsRate: freeSpinsPlayedTotal > 0 ? freeSpinsVsInsideTotal / freeSpinsPlayedTotal : 0,
  };
}

function simulateSpinMode(game: SlotConfig, spins: number, betAmount: number, spinMode: SpinMode) {
  let totalWagered = 0;
  let totalPaid = 0;
  let biggestWin = 0;
  let capHits = 0;
  for (let index = 0; index < spins; index += 1) {
    const result = game.id === "neon-fortune"
      ? calculateNeonCascadeResult(game, betAmount)
      : calculateSlotResult(game, betAmount, false, undefined, spinMode);
    const holdAward = result.triggeredHoldAndWin ? calculateHoldAndWinBonus(game, betAmount).total : 0;
    const freeSpinAward = result.freeSpinsAwarded > 0 ? calculateFreeSpinsBonus(game, betAmount, result.freeSpinsAwarded, result.goldRush?.freeSpinsTrigger?.initialInteriorColumns).total : 0;
    const totalResultPaid = result.payout + (result.pickBonusAwards?.[0] ?? 0) + holdAward + freeSpinAward;
    const wager = getSpinCost(game, betAmount, spinMode);
    totalWagered += wager;
    totalPaid += totalResultPaid;
    biggestWin = Math.max(biggestWin, totalResultPaid);
    if (result.capped || holdAward >= betAmount * game.maxPayoutMultiplier) capHits += 1;
  }
  const observedRtp = totalPaid / totalWagered;
  return { totalWagered, totalPaid, observedRtp, biggestWin, capHitRate: capHits / spins, warning: observedRtp > 0.95 };
}

function simulateBonusBuyMode(game: SlotConfig, spins: number, betAmount: number, featureType: BonusFeatureType, currency?: Currency) {
  let totalWagered = 0;
  let totalPaid = 0;
  let biggestWin = 0;
  let capHits = 0;
  const buySpins = Math.max(1, Math.min(5000, spins));
  for (let index = 0; index < buySpins; index += 1) {
    const payoutBetAmount = currency ? getBonusBuyPayoutBetAmount(game, betAmount, featureType, currency) : betAmount;
    const feature = calculateDirectFeature(game, payoutBetAmount, featureType);
    const payout = Math.min(feature.bonusPayout, capDemoPayout(Math.round(betAmount * game.maxPayoutMultiplier)));
    totalWagered += getBonusBuyCost(game, betAmount, featureType, currency);
    totalPaid += payout;
    biggestWin = Math.max(biggestWin, payout);
    if (feature.bonusPayout > payout) capHits += 1;
  }
  const observedRtp = totalPaid / totalWagered;
  return { totalWagered, totalPaid, observedRtp, biggestWin, capHitRate: capHits / buySpins, warning: observedRtp > 0.95 };
}

function simulateGoldRushShowdownMode(game: SlotConfig, spins: number, betAmount: number) {
  let totalWagered = 0;
  let totalPaid = 0;
  let biggestWin = 0;
  let capHits = 0;
  const boostSpins = Math.max(1, Math.min(5000, spins));
  for (let index = 0; index < boostSpins; index += 1) {
    const forced = createGoldRushShowdownBoostGrid(game);
    const result = calculateSlotResult(game, betAmount, false, forced.grid, "GOLD_RUSH_SHOWDOWN", [], forced.interior);
    const freeSpinAward = result.freeSpinsAwarded > 0 ? calculateFreeSpinsBonus(game, betAmount, result.freeSpinsAwarded, result.goldRush?.freeSpinsTrigger?.initialInteriorColumns).total : 0;
    const totalResultPaid = result.payout + freeSpinAward;
    const wager = getGoldRushBonusBuyCost(game, betAmount, "showdown-spin");
    totalWagered += wager;
    totalPaid += totalResultPaid;
    biggestWin = Math.max(biggestWin, totalResultPaid);
    if (result.capped) capHits += 1;
  }
  const observedRtp = totalPaid / totalWagered;
  return { totalWagered, totalPaid, observedRtp, biggestWin, capHitRate: capHits / boostSpins, warning: observedRtp > 0.95 };
}

function simulateGoldRushFreeSpinsBuyMode(game: SlotConfig, spins: number, betAmount: number, bonusSymbols: 3 | 4, buyType: "buy-bonus" | "buy-super-bonus") {
  let totalWagered = 0;
  let totalPaid = 0;
  let biggestWin = 0;
  let capHits = 0;
  const buySpins = Math.max(1, Math.min(5000, spins));
  for (let index = 0; index < buySpins; index += 1) {
    const trigger = calculateSlotResult(game, betAmount, false, createGoldRushBonusTriggerGrid(game, bonusSymbols));
    const freeSpinAward = calculateFreeSpinsBonus(game, betAmount, game.goldRushBonusBuys?.freeSpins.initialSpins ?? 10, bonusSymbols >= 4 ? game.goldRushBonusBuys?.freeSpins.superInitialInteriorColumns : game.goldRushBonusBuys?.freeSpins.normalInitialInteriorColumns);
    const totalResultPaid = trigger.payout + freeSpinAward.total;
    totalWagered += getGoldRushBonusBuyCost(game, betAmount, buyType);
    totalPaid += totalResultPaid;
    biggestWin = Math.max(biggestWin, totalResultPaid);
    if (trigger.capped || freeSpinAward.total >= capDemoPayout(Math.round(betAmount * game.maxPayoutMultiplier))) capHits += 1;
  }
  const observedRtp = totalPaid / totalWagered;
  return { totalWagered, totalPaid, observedRtp, biggestWin, capHitRate: capHits / buySpins, warning: observedRtp > 0.95 };
}

export function getMathWarnings(game: SlotConfig, simulation?: SimulationResult) {
  const warnings: string[] = [];
  if (game.targetRtp > 0.95) warnings.push("Target RTP is above 95%.");
  if (game.demoProgressive && game.demoProgressive.maxPayoutMultiplier > 100) {
    warnings.push("Max payout multiplier is unusually high for this demo.");
  }
  if (game.maxPayoutMultiplier > 75) {
    warnings.push("Configured max payout cap is high for this demo economy.");
  }
  if (simulation && simulation.observedRtp > 0.95) {
    warnings.push("Observed RTP is above 95%; tune symbol weights or payouts before release.");
  }
  Object.entries(simulation?.modeResults ?? {}).forEach(([mode, result]) => {
    if (result.observedRtp > 0.95) warnings.push(`${mode.replaceAll("_", " ")} RTP is above 95%.`);
  });
  if (simulation && simulation.bonusTriggerRate > 0.16) {
    warnings.push("Bonus trigger rate is frequent; check demo economy balance.");
  }
  if (simulation?.buyBonusRtp && simulation.buyBonusRtp > simulation.observedRtp + 0.12) {
    warnings.push("Buy bonus RTP is materially higher than base game RTP.");
  }
  if (simulation?.buyBonusRtp && simulation.buyBonusRtp > 0.95) {
    warnings.push("Buy bonus RTP is above 95%; increase cost or reduce bonus awards.");
  }
  if (simulation?.capHitRate && simulation.capHitRate > 0.08) {
    warnings.push("Max win cap is triggering frequently; review bet range or max payout.");
  }
  return warnings;
}
