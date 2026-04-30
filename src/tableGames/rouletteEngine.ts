import type { Currency } from "../types";
import { rouletteConfig } from "./configs";
import { placeTableBet, settleTableResult } from "./ledger";
import type { RouletteBet, RouletteConfig, RouletteResult } from "./types";

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const americanWheel: Array<"0" | "00" | number> = [
  "0", 28, 9, 26, 30, 11, 7, 20, 32, 17, 5, 22, 34, 15, 3, 24, 36, 13, 1,
  "00", 27, 10, 25, 29, 12, 8, 19, 31, 18, 6, 21, 33, 16, 4, 23, 35, 14, 2,
];
export const rouletteBoardRows = [
  [3, 6, 9, 12, 15, 18, 21, 24, 27, 30, 33, 36],
  [2, 5, 8, 11, 14, 17, 20, 23, 26, 29, 32, 35],
  [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34],
];

export function getRouletteColor(outcome: "0" | "00" | number) {
  if (outcome === "0" || outcome === "00") return "green";
  return redNumbers.has(outcome) ? "red" : "black";
}

export function rouletteBetWins(bet: RouletteBet, outcome: "0" | "00" | number) {
  if (bet.kind === "split" || bet.kind === "street" || bet.kind === "corner" || bet.kind === "sixLine" || bet.kind === "basket") {
    return bet.numbers.some((number) => number === outcome);
  }
  if (outcome === "0" || outcome === "00") return bet.kind === "straight" && bet.value === outcome;
  if (bet.kind === "straight") return bet.value === outcome;
  if (bet.kind === "color") return getRouletteColor(outcome) === bet.value;
  if (bet.kind === "parity") return bet.value === "odd" ? outcome % 2 === 1 : outcome % 2 === 0;
  if (bet.kind === "range") return bet.value === "low" ? outcome >= 1 && outcome <= 18 : outcome >= 19 && outcome <= 36;
  if (bet.kind === "dozen") return Math.ceil(outcome / 12) === bet.value;
  if (bet.kind === "column") return ((outcome - 1) % 3) + 1 === bet.value;
  return false;
}

export function getRouletteWinningZones(outcome: "0" | "00" | number) {
  const zones: RouletteBet[] = [{ kind: "straight", value: outcome }];
  if (outcome === "0" || outcome === "00") {
    zones.push({ kind: "basket", numbers: ["0", "00", 1, 2, 3] });
    return zones;
  }
  zones.push({ kind: "color", value: getRouletteColor(outcome) as "red" | "black" });
  zones.push({ kind: "parity", value: outcome % 2 === 0 ? "even" : "odd" });
  zones.push({ kind: "range", value: outcome <= 18 ? "low" : "high" });
  zones.push({ kind: "dozen", value: Math.ceil(outcome / 12) as 1 | 2 | 3 });
  zones.push({ kind: "column", value: (((outcome - 1) % 3) + 1) as 1 | 2 | 3 });
  return zones;
}

export interface PlacedRouletteBet {
  id: string;
  bet: RouletteBet;
  amount: number;
  label: string;
}

export function rouletteBetLabel(bet: RouletteBet) {
  if (bet.kind === "straight") return `Straight ${bet.value}`;
  if (bet.kind === "color") return bet.value === "red" ? "Red" : "Black";
  if (bet.kind === "parity") return bet.value === "odd" ? "Odd" : "Even";
  if (bet.kind === "range") return bet.value === "low" ? "1-18" : "19-36";
  if (bet.kind === "dozen") return `${bet.value === 1 ? "1st" : bet.value === 2 ? "2nd" : "3rd"} 12`;
  if (bet.kind === "column") return `${bet.value === 1 ? "1st" : bet.value === 2 ? "2nd" : "3rd"} Column`;
  if (bet.kind === "basket") return "Top Line";
  return `${bet.kind} ${bet.numbers.join("-")}`;
}

export function rouletteBetKey(bet: RouletteBet) {
  if (bet.kind === "straight") return `straight:${bet.value}`;
  if ("value" in bet) return `${bet.kind}:${bet.value}`;
  return `${bet.kind}:${bet.numbers.join("-")}`;
}

export function getRouletteInsideChipPosition(bet: RouletteBet) {
  if (!("numbers" in bet) || bet.kind === "basket") return null;
  const nums: number[] = [];
  bet.numbers.forEach((value) => {
    if (typeof value === "number") nums.push(value);
  });
  if (bet.kind === "sixLine") {
    if (nums.length !== 6) return null;
    const start = numberStreetStart(Math.min(...nums));
    return {
      left: ((start - 1) / 3 + 1) * (100 / 12),
      top: 103,
      coveredNumbers: nums,
    };
  }

  if (nums.length === 0) return null;
  const points = nums.map((number) => {
    const streetIndex = Math.floor((number - 1) / 3);
    const rowIndex = rouletteBoardRows.findIndex((row) => row.includes(number));
    return { left: (streetIndex + 0.5) * (100 / 12), top: (rowIndex + 0.5) * (100 / 3) };
  });
  return {
    left: points.reduce((sum, point) => sum + point.left, 0) / points.length,
    top: points.reduce((sum, point) => sum + point.top, 0) / points.length,
    coveredNumbers: nums,
  };
}

export function numberStreetStart(number: number) {
  return number - ((number - 1) % 3);
}

export function assertRouletteTotal(total: number, config = rouletteConfig) {
  if (total > config.maxTotalBetGold) throw new Error(`Maximum total roulette bet is ${config.maxTotalBetGold} coins.`);
}

export function resolveRouletteBets({
  userId,
  currency,
  bets,
  outcome = americanWheel[Math.floor(Math.random() * americanWheel.length)],
  config = rouletteConfig,
}: {
  userId: string;
  currency: Currency;
  bets: PlacedRouletteBet[];
  outcome?: "0" | "00" | number;
  config?: RouletteConfig;
}): RouletteResult {
  const totalWagered = bets.reduce((sum, placed) => sum + placed.amount, 0);
  if (bets.length === 0) throw new Error("Place at least one roulette bet.");
  assertRouletteTotal(totalWagered, config);
  placeTableBet(userId, currency, totalWagered, config, { bets: bets.map(({ bet, amount, label }) => ({ bet, amount, label })) });
  const winningBetIds = bets.filter((placed) => rouletteBetWins(placed.bet, outcome)).map((placed) => placed.id);
  const totalPaid = bets.reduce((sum, placed) => {
    if (!rouletteBetWins(placed.bet, outcome)) return sum;
    return sum + placed.amount * (config.payouts[placed.bet.kind] + 1);
  }, 0);
  const settlement = settleTableResult({
    userId,
    currency,
    config,
    result: totalPaid > 0 ? "WIN" : "LOSS",
    amountPaid: totalPaid,
    wagered: totalWagered,
    metadata: { bets: bets.map(({ bet, amount, label }) => ({ bet, amount, label })), outcome, winningBetIds },
  });
  return {
    outcome,
    color: getRouletteColor(outcome),
    won: totalPaid > 0,
    totalPaid: settlement.amountPaid,
    totalWagered,
    net: settlement.amountPaid - totalWagered,
    winningBetIds,
    settlement,
  };
}

export function resolveRouletteBet({
  userId,
  currency,
  betAmount,
  bet,
  outcome = americanWheel[Math.floor(Math.random() * americanWheel.length)],
  config = rouletteConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  bet: RouletteBet;
  outcome?: "0" | "00" | number;
  config?: RouletteConfig;
}): RouletteResult {
  return resolveRouletteBets({
    userId,
    currency,
    bets: [{ id: "single", bet, amount: betAmount, label: rouletteBetLabel(bet) }],
    outcome,
    config,
  });
}
