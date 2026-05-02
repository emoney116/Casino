import { blackjackConfig, crashConfig, diceConfig, rouletteConfig, treasureDigConfig } from "./configs";
import { createDeck, handValue, shuffleDeck } from "./blackjackEngine";
import { americanWheel, rouletteBetWins } from "./rouletteEngine";
import { getDiceReturnMultiplier } from "./diceEngine";
import { generateCrashPoint } from "./crashEngine";
import { createTreasureMultiplierTiles, createTreasureTrapIndexes, getTreasureBoostMultiplier, getTreasureDigMultiplier } from "./treasureDigEngine";
import { getBrickBreakMathWarnings, simulateBrickBreakBonus } from "./brickBreakBonusEngine";
import type { TableGameConfig, TableGameId, TableSimulationResult } from "./types";

export function simulateTableGame(gameId: TableGameId, rounds = 100000): TableSimulationResult {
  if (gameId === "brickBreakBonus") {
    const result = simulateBrickBreakBonus(rounds);
    return {
      totalWagered: result.totalWagered,
      totalPaid: result.totalPaid,
      observedRtp: result.observedRtp,
      houseEdge: 1 - result.observedRtp,
      biggestWin: result.biggestWin,
      maxPayoutCapHits: result.maxPayoutCapHits,
      bustRate: result.bustRate,
      averagePayout: result.averagePayout,
      averageBricksHit: result.averageBricksHit,
      maxCapHitRate: result.maxCapHitRate,
    };
  }
  if (gameId === "blackjack") return simulateBlackjack(rounds);
  if (gameId === "roulette") return simulateRoulette(rounds);
  if (gameId === "dice") return simulateDice(rounds);
  if (gameId === "treasureDig") return simulateTreasureDig(rounds);
  return simulateCrash(rounds);
}

function baseResult(wagered: number, paid: number, biggestWin: number, caps: number): TableSimulationResult {
  return {
    totalWagered: wagered,
    totalPaid: paid,
    observedRtp: paid / wagered,
    houseEdge: 1 - paid / wagered,
    biggestWin,
    maxPayoutCapHits: caps,
  };
}

function simulateBlackjack(rounds: number) {
  const bet = blackjackConfig.minBet;
  let paid = 0;
  let biggest = 0;
  let caps = 0;
  for (let index = 0; index < rounds; index += 1) {
    const deck = shuffleDeck(createDeck());
    const player = [deck.shift()!, deck.shift()!];
    const dealer = [deck.shift()!, deck.shift()!];
    while (handValue(player).total < 16) player.push(deck.shift()!);
    while (handValue(dealer).total < 17 || (handValue(dealer).total === 17 && handValue(dealer).soft)) dealer.push(deck.shift()!);
    const playerTotal = handValue(player).total;
    const dealerTotal = handValue(dealer).total;
    let payout = 0;
    if (playerTotal <= 21 && (dealerTotal > 21 || playerTotal > dealerTotal)) payout = bet * 2;
    if (playerTotal <= 21 && playerTotal === dealerTotal) payout = bet;
    const capped = Math.min(payout, blackjackConfig.maxPayout);
    if (capped < payout) caps += 1;
    biggest = Math.max(biggest, capped);
    paid += capped;
  }
  return baseResult(rounds * bet, paid, biggest, caps);
}

function simulateRoulette(rounds: number) {
  const bet = rouletteConfig.minBet;
  let paid = 0;
  let biggest = 0;
  let caps = 0;
  const sampleBet = { kind: "color", value: "red" } as const;
  for (let index = 0; index < rounds; index += 1) {
    const outcome = americanWheel[Math.floor(Math.random() * americanWheel.length)];
    const payout = rouletteBetWins(sampleBet, outcome) ? bet * 2 : 0;
    const capped = Math.min(payout, rouletteConfig.maxPayout);
    if (capped < payout) caps += 1;
    biggest = Math.max(biggest, capped);
    paid += capped;
  }
  return baseResult(rounds * bet, paid, biggest, caps);
}

function simulateDice(rounds: number) {
  const bet = diceConfig.minBet;
  const target = 50;
  let paid = 0;
  let biggest = 0;
  let caps = 0;
  for (let index = 0; index < rounds; index += 1) {
    const roll = Math.floor(Math.random() * 100) + 1;
    const payout = roll > target ? bet * getDiceReturnMultiplier("over", target, diceConfig) : 0;
    const capped = Math.min(Math.round(payout), diceConfig.maxPayout);
    if (capped < payout) caps += 1;
    biggest = Math.max(biggest, capped);
    paid += capped;
  }
  return baseResult(rounds * bet, paid, biggest, caps);
}

function simulateCrash(rounds: number) {
  const bet = crashConfig.minBet;
  const autoCashOut = 2;
  let paid = 0;
  let biggest = 0;
  let caps = 0;
  for (let index = 0; index < rounds; index += 1) {
    const crashPoint = generateCrashPoint(Math.random(), crashConfig);
    const payout = crashPoint > autoCashOut ? bet * autoCashOut : 0;
    const capped = Math.min(Math.round(payout), crashConfig.maxPayout);
    if (capped < payout) caps += 1;
    biggest = Math.max(biggest, capped);
    paid += capped;
  }
  return baseResult(rounds * bet, paid, biggest, caps);
}

function simulateTreasureDig(rounds: number) {
  const bet = treasureDigConfig.minBet;
  const trapCount = 3;
  const autoCashOutPicks = 3;
  let totalPaid = 0;
  let biggestWin = 0;
  for (let index = 0; index < rounds; index += 1) {
    let survived = true;
    const trapIndexes = createTreasureTrapIndexes({ trapCount, config: treasureDigConfig });
    const traps = new Set(trapIndexes);
    const multiplierTiles = createTreasureMultiplierTiles({ trapIndexes, config: treasureDigConfig });
    const remaining = Array.from({ length: treasureDigConfig.gridSize * treasureDigConfig.gridSize }, (_, tile) => tile);
    const pickedIndexes: number[] = [];
    for (let pick = 0; pick < autoCashOutPicks; pick += 1) {
      const tile = remaining.splice(Math.floor(Math.random() * remaining.length), 1)[0];
      pickedIndexes.push(tile);
      if (traps.has(tile)) {
        survived = false;
        break;
      }
    }
    const boostMultiplier = getTreasureBoostMultiplier(pickedIndexes, multiplierTiles);
    const payout = survived ? bet * getTreasureDigMultiplier({ safePicks: autoCashOutPicks, trapCount, multiplierTiles, boostMultiplier }) : 0;
    const capped = Math.min(Math.round(payout), treasureDigConfig.maxPayout);
    totalPaid += capped;
    biggestWin = Math.max(biggestWin, capped);
  }
  const totalWagered = bet * rounds;
  return {
    totalWagered,
    totalPaid,
    observedRtp: totalPaid / totalWagered,
    houseEdge: 1 - totalPaid / totalWagered,
    biggestWin,
    maxPayoutCapHits: 0,
  };
}

export function getTableMathWarnings(config: TableGameConfig, simulation?: TableSimulationResult) {
  if (config.id === "brickBreakBonus") {
    const brickSimulation = simulation && typeof simulation.averagePayout === "number" && typeof simulation.bustRate === "number" && typeof simulation.averageBricksHit === "number" && typeof simulation.maxCapHitRate === "number"
      ? { ...simulation, averagePayout: simulation.averagePayout, bustRate: simulation.bustRate, averageBricksHit: simulation.averageBricksHit, maxCapHitRate: simulation.maxCapHitRate }
      : undefined;
    return getBrickBreakMathWarnings(brickSimulation);
  }
  const warnings: string[] = [];
  if (simulation?.observedRtp && simulation.observedRtp > 0.99) warnings.push(`${config.name} observed RTP is above 99%.`);
  if (config.maxPayout > config.maxBet * 50) warnings.push(`${config.name} max payout is high versus max bet.`);
  if (config.maxBet > 1000) warnings.push(`${config.name} bet limit is high for the demo economy.`);
  return warnings;
}
