import type { SimulationResult, SlotConfig } from "./types";
import { calculateNeonCascadeResult, calculateSlotResult } from "./slotEngine";

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
    const totalResultPaid = result.payout + pickAward + freeSpinPaid;
    totalPaid += totalResultPaid;
    if (totalResultPaid > 0) hits += 1;
    if (result.triggeredBonus) bonusTriggers += 1;
    if (result.triggeredFreeSpins) freeSpinTriggers += 1;
    if (result.triggeredPickBonus) pickBonusTriggers += 1;
    biggestWin = Math.max(biggestWin, totalResultPaid);
  }

  return {
    spins,
    totalWagered,
    totalPaid,
    observedRtp: totalPaid / totalWagered,
    hitRate: hits / spins,
    biggestWin,
    bonusTriggerRate: bonusTriggers / spins,
    freeSpinTriggerRate: freeSpinTriggers / spins,
    pickBonusTriggerRate: pickBonusTriggers / spins,
  };
}

export function getMathWarnings(game: SlotConfig, simulation?: SimulationResult) {
  const warnings: string[] = [];
  if (game.targetRtp > 0.96) warnings.push("Target RTP is above 96%.");
  if (game.demoProgressive && game.demoProgressive.maxPayoutMultiplier > 100) {
    warnings.push("Max payout multiplier is unusually high for this demo.");
  }
  if (game.maxPayoutMultiplier > 75) {
    warnings.push("Configured max payout cap is high for this demo economy.");
  }
  if (simulation && simulation.observedRtp > 0.96) {
    warnings.push("Observed RTP is above 96%; tune symbol weights or payouts before release.");
  }
  if (simulation && simulation.bonusTriggerRate > 0.16) {
    warnings.push("Bonus trigger rate is frequent; check demo economy balance.");
  }
  return warnings;
}
