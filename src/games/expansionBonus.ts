import type { ExpansionBonusConfig, ExpansionBonusResult, SlotConfig } from "./types";

function weightedRandom<T extends { weight: number }>(items: T[]) {
  const total = items.reduce((sum, item) => sum + item.weight, 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= item.weight;
    if (roll <= 0) return item;
  }
  return items[items.length - 1];
}

function roundCount(rounds: number | [number, number]) {
  if (typeof rounds === "number") return rounds;
  const [min, max] = rounds;
  return min + Math.floor(Math.random() * (max - min + 1));
}

function roundCurrency(amount: number) {
  return Math.round(amount * 100) / 100;
}

function randomInteger(min: number, max: number) {
  return min + Math.floor(Math.random() * (max - min + 1));
}

export function getExpansionTriggerPositions(grid: string[][], triggerSymbol: string) {
  const positions: Array<{ reel: number; row: number }> = [];
  grid.forEach((reelSymbols, reel) => {
    reelSymbols.forEach((symbol, row) => {
      if (symbol === triggerSymbol) positions.push({ reel, row });
    });
  });
  return positions;
}

export function selectExpansionFrame(
  game: SlotConfig,
  triggerPositions: Array<{ reel: number; row: number }>,
  config: ExpansionBonusConfig = game.expansionBonus!,
) {
  const triggerReel = triggerPositions[0]?.reel ?? Math.floor(game.reelCount / 2);
  const selectedWidth = Math.max(1, Math.min(game.reelCount, weightedRandom(config.frameWidths ?? [{ width: 2, weight: 1 }]).width));
  const centeredStart = triggerReel - Math.floor(selectedWidth / 2);
  const startReel = Math.max(0, Math.min(game.reelCount - selectedWidth, centeredStart));
  return {
    startReel,
    width: selectedWidth,
    rowStart: 0,
    rowCount: game.rowCount,
    reelCount: game.reelCount,
  };
}

export function getExpansionFramePositions(frame: NonNullable<ExpansionBonusResult["frame"]>) {
  const positions: Array<{ reel: number; row: number }> = [];
  for (let reel = frame.startReel; reel < frame.startReel + frame.width; reel += 1) {
    for (let row = frame.rowStart; row < frame.rowStart + frame.rowCount; row += 1) {
      positions.push({ reel, row });
    }
  }
  return positions;
}

function calculateMineClashBonus(
  game: SlotConfig,
  triggerPositions: Array<{ reel: number; row: number }>,
  config: ExpansionBonusConfig,
): ExpansionBonusResult {
  const mineClash = config.mineClash;
  if (!mineClash) throw new Error("Mine Clash expansion config is missing.");
  const frame = selectExpansionFrame(game, triggerPositions, config);
  const rareBoosted = Math.random() < mineClash.rareBoost.chance;
  const goldMultiplier = rareBoosted
    ? mineClash.rareBoost.multiplier
    : randomInteger(mineClash.goldMiner.min, mineClash.goldMiner.max);
  const diamondMultiplier = rareBoosted
    ? mineClash.rareBoost.multiplier
    : randomInteger(mineClash.diamondMiner.min, mineClash.diamondMiner.max);
  const winnerConfig = rareBoosted
    ? (Math.random() < 0.58 ? "diamond" : "gold")
    : weightedRandom([
      { id: "gold" as const, weight: mineClash.goldMiner.weight },
      { id: "diamond" as const, weight: mineClash.diamondMiner.weight },
    ]).id;
  const winner = winnerConfig === "diamond" && diamondMultiplier >= goldMultiplier ? "diamond" : winnerConfig === "gold" && goldMultiplier >= diamondMultiplier ? "gold" : goldMultiplier >= diamondMultiplier ? "gold" : "diamond";
  const multiplier = winner === "gold" ? goldMultiplier : diamondMultiplier;
  const transformedPositions = getExpansionFramePositions(frame);
  const rounds: ExpansionBonusResult["rounds"] = [
    { phaseId: "vs-flash", phaseTitle: "Mine Clash", label: "VS symbol flashes", gain: 0, totalMultiplier: 0 },
    { phaseId: "frame-expand", phaseTitle: "Mine Frame", label: `${frame.width} reel chamber opens`, gain: 0, totalMultiplier: 0 },
    { phaseId: "mining", phaseTitle: "Mining Clash", label: "Gold and diamond ore meters fill", gain: 0, totalMultiplier: 0 },
    { phaseId: "winner", phaseTitle: winner === "gold" ? "Gold Miner Wins" : "Diamond Miner Wins", label: `${winner === "gold" ? "Gold Miner" : "Diamond Miner"} multiplier`, gain: multiplier, totalMultiplier: multiplier },
    { phaseId: "wild-transform", phaseTitle: "Multiplier Wilds", label: `${transformedPositions.length} positions transform`, gain: multiplier, totalMultiplier: multiplier },
  ];

  return {
    triggerPositions,
    rounds,
    multiplier,
    payout: 0,
    capped: false,
    sourceFeature: "mine-clash",
    frame,
    transformedPositions,
    mineClash: {
      winner,
      goldMultiplier,
      diamondMultiplier,
      frameWidth: frame.width,
      multiplierWildEv: transformedPositions.length * multiplier,
    },
  };
}

export function calculateExpansionBonus(
  game: SlotConfig,
  betAmount: number,
  triggerPositions: Array<{ reel: number; row: number }>,
  config: ExpansionBonusConfig = game.expansionBonus!,
): ExpansionBonusResult {
  if (config.mechanic === "mine-clash") {
    return calculateMineClashBonus(game, triggerPositions, config);
  }

  let totalMultiplier = 0;
  const rounds: ExpansionBonusResult["rounds"] = [];

  for (const phase of config.phases) {
    const count = roundCount(phase.rounds);
    for (let index = 0; index < count; index += 1) {
      let gainOption = weightedRandom(phase.gains);
      if (phase.id === "escape" && config.rareFinalChance && phase.gains.length > 1) {
        const rare = phase.gains[phase.gains.length - 1];
        const regular = phase.gains[0];
        gainOption = Math.random() < config.rareFinalChance ? rare : regular;
      }
      const gain = gainOption.min + Math.floor(Math.random() * (gainOption.max - gainOption.min + 1));
      totalMultiplier = Math.min(config.maxMultiplier, totalMultiplier + gain);
      rounds.push({
        phaseId: phase.id,
        phaseTitle: phase.title,
        label: gainOption.label,
        gain,
        totalMultiplier,
      });
    }
  }

  const capped = totalMultiplier >= config.maxMultiplier;
  const multiplier = Math.min(config.maxMultiplier, totalMultiplier);
  return {
    triggerPositions,
    rounds,
    multiplier,
    payout: roundCurrency(betAmount * multiplier),
    capped,
    sourceFeature: "heist-showdown",
  };
}

export function getExpansionBonusTotal(rounds: ExpansionBonusResult["rounds"]) {
  return rounds.reduce((sum, round) => sum + round.gain, 0);
}
