import { blackjackConfig, diceConfig, rouletteConfig } from "./configs";
import { createDeck, handValue, shuffleDeck } from "./blackjackEngine";
import { americanWheel, rouletteBetWins } from "./rouletteEngine";
import { getDiceReturnMultiplier } from "./diceEngine";
import type { TableGameConfig, TableGameId, TableSimulationResult } from "./types";

export function simulateTableGame(gameId: TableGameId, rounds = 100000): TableSimulationResult {
  if (gameId === "blackjack") return simulateBlackjack(rounds);
  if (gameId === "roulette") return simulateRoulette(rounds);
  return simulateDice(rounds);
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

export function getTableMathWarnings(config: TableGameConfig, simulation?: TableSimulationResult) {
  const warnings: string[] = [];
  if (simulation?.observedRtp && simulation.observedRtp > 0.99) warnings.push(`${config.name} observed RTP is above 99%.`);
  if (config.maxPayout > config.maxBet * 50) warnings.push(`${config.name} max payout is high versus max bet.`);
  if (config.maxBet > 1000) warnings.push(`${config.name} bet limit is high for the demo economy.`);
  return warnings;
}
