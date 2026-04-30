import type { Currency } from "../types";
import { rouletteConfig } from "./configs";
import { placeTableBet, settleTableResult } from "./ledger";
import type { RouletteBet, RouletteConfig, RouletteResult } from "./types";

const redNumbers = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
export const americanWheel: Array<"0" | "00" | number> = ["0", "00", ...Array.from({ length: 36 }, (_, index) => index + 1)];

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
