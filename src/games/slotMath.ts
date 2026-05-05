import type { SimulationResult, SlotConfig } from "./types";
import { calculateDirectFeature, calculateHoldAndWinBonus, calculateNeonCascadeResult, calculateSlotResult, getBonusBuyCost, getSpinCost } from "./slotEngine";
import { capDemoPayout } from "../economy/limits";
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
  let coinCollectorTriggers = 0;
  let cappedResults = 0;
  let holdAndWinPaid = 0;

  for (let index = 0; index < spins; index += 1) {
    const result = game.id === "neon-fortune" ? calculateNeonCascadeResult(game, betAmount) : calculateSlotResult(game, betAmount);
    totalWagered += betAmount;
    let freeSpinPaid = 0;
    for (let freeSpin = 0; freeSpin < result.freeSpinsAwarded; freeSpin += 1) {
      const freeResult =
        game.id === "neon-fortune" ? calculateNeonCascadeResult(game, betAmount, true) : calculateSlotResult(game, betAmount, true);
      freeSpinPaid += freeResult.payout + (freeResult.pickBonusAwards?.[0] ?? 0);
      biggestWin = Math.max(biggestWin, freeResult.payout);
    }
    const pickAward = result.pickBonusAwards?.[0] ?? 0;
    const holdAward = result.triggeredHoldAndWin ? calculateHoldAndWinBonus(game, betAmount).total : 0;
    if (result.capped || holdAward >= betAmount * game.maxPayoutMultiplier) cappedResults += 1;
    holdAndWinPaid += holdAward;
    const totalResultPaid = result.payout + pickAward + holdAward + freeSpinPaid;
    totalPaid += totalResultPaid;
    if (totalResultPaid > 0) hits += 1;
    if (result.triggeredBonus) bonusTriggers += 1;
    if (result.triggeredFreeSpins) freeSpinTriggers += 1;
    if (result.triggeredPickBonus) pickBonusTriggers += 1;
    if (result.triggeredHoldAndWin) holdAndWinTriggers += 1;
    if (result.triggeredWheelBonus) wheelBonusTriggers += 1;
    if (result.triggeredCoinCollector) coinCollectorTriggers += 1;
    biggestWin = Math.max(biggestWin, totalResultPaid);
  }

  const modeResults: NonNullable<SimulationResult["modeResults"]> = {
    NORMAL: simulateSpinMode(game, spins, betAmount, "NORMAL"),
  };
  if (game.boostSpins?.GOLD_BOOST) modeResults.GOLD_BOOST = simulateSpinMode(game, spins, betAmount, "GOLD_BOOST");
  if (game.boostSpins?.SCATTER_BOOST) modeResults.SCATTER_BOOST = simulateSpinMode(game, spins, betAmount, "SCATTER_BOOST");
  if (game.bonusBuys?.some((buy) => buy.featureType === "HOLD_AND_WIN")) {
    modeResults.BUY_HOLD_AND_WIN = simulateBonusBuyMode(game, spins, betAmount, "HOLD_AND_WIN");
  }
  if (game.bonusBuys?.some((buy) => buy.featureType === "WHEEL_BONUS")) {
    modeResults.BUY_WHEEL_BONUS = simulateBonusBuyMode(game, spins, betAmount, "WHEEL_BONUS");
  }

  let buyBonusRtp: number | undefined;
  let buyBonusAveragePayout: number | undefined;
  if (game.buyBonus?.enabled) {
    let buyPaid = 0;
    let buyCost = 0;
    let buyCapHits = 0;
    const cost = getBonusBuyCost(game, betAmount, game.buyBonus.featureType);
    const buySpins = Math.min(250, spins);
    for (let index = 0; index < buySpins; index += 1) {
      const feature = calculateDirectFeature(game, betAmount, game.buyBonus.featureType);
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
    coinCollectorTriggerRate: coinCollectorTriggers / spins,
    buyBonusRtp,
    buyBonusAveragePayout,
    holdAndWinAveragePayout: holdAndWinTriggers > 0 ? holdAndWinPaid / holdAndWinTriggers : 0,
    capHitRate: cappedResults / (spins + (game.buyBonus?.enabled ? Math.min(250, spins) : 0)),
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
    const totalResultPaid = result.payout + (result.pickBonusAwards?.[0] ?? 0) + holdAward;
    const wager = getSpinCost(game, betAmount, spinMode);
    totalWagered += wager;
    totalPaid += totalResultPaid;
    biggestWin = Math.max(biggestWin, totalResultPaid);
    if (result.capped || holdAward >= betAmount * game.maxPayoutMultiplier) capHits += 1;
  }
  const observedRtp = totalPaid / totalWagered;
  return { totalWagered, totalPaid, observedRtp, biggestWin, capHitRate: capHits / spins, warning: observedRtp > 0.95 };
}

function simulateBonusBuyMode(game: SlotConfig, spins: number, betAmount: number, featureType: BonusFeatureType) {
  let totalWagered = 0;
  let totalPaid = 0;
  let biggestWin = 0;
  let capHits = 0;
  const buySpins = Math.max(1, Math.min(5000, spins));
  for (let index = 0; index < buySpins; index += 1) {
    const feature = calculateDirectFeature(game, betAmount, featureType);
    const payout = Math.min(feature.bonusPayout, capDemoPayout(Math.round(betAmount * game.maxPayoutMultiplier)));
    totalWagered += getBonusBuyCost(game, betAmount, featureType);
    totalPaid += payout;
    biggestWin = Math.max(biggestWin, payout);
    if (feature.bonusPayout > payout) capHits += 1;
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
