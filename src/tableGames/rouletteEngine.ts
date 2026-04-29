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
  if (outcome === "0" || outcome === "00") return bet.kind === "straight" && bet.value === outcome;
  if (bet.kind === "straight") return bet.value === outcome;
  if (bet.kind === "color") return getRouletteColor(outcome) === bet.value;
  if (bet.kind === "parity") return bet.value === "odd" ? outcome % 2 === 1 : outcome % 2 === 0;
  if (bet.kind === "range") return bet.value === "low" ? outcome >= 1 && outcome <= 18 : outcome >= 19 && outcome <= 36;
  if (bet.kind === "dozen") return Math.ceil(outcome / 12) === bet.value;
  if (bet.kind === "column") return ((outcome - 1) % 3) + 1 === bet.value;
  return false;
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
  placeTableBet(userId, currency, betAmount, config, { bet });
  const won = rouletteBetWins(bet, outcome);
  const multiplier = config.payouts[bet.kind];
  const totalPaid = won ? betAmount * (multiplier + 1) : 0;
  const settlement = settleTableResult({
    userId,
    currency,
    config,
    result: won ? "WIN" : "LOSS",
    amountPaid: totalPaid,
    wagered: betAmount,
    metadata: { bet, outcome },
  });
  return { outcome, color: getRouletteColor(outcome), won, totalPaid: settlement.amountPaid, settlement };
}
