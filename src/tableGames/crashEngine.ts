import type { Currency } from "../types";
import { createId } from "../lib/ids";
import { crashConfig } from "./configs";
import { placeTableBet, settleTableResult } from "./ledger";
import type { CrashConfig, CrashRound } from "./types";

export function generateCrashPoint(randomValue = Math.random(), config: CrashConfig = crashConfig) {
  const u = Math.min(0.999999, Math.max(0, randomValue));
  const raw = (1 - config.edge) / (1 - u);
  const bounded = Math.max(config.minCrashPoint, Math.min(config.maxCrashPoint, raw));
  return Math.floor(bounded * 100) / 100;
}

export function getCrashMultiplier(elapsedMs: number) {
  const seconds = Math.max(0, elapsedMs) / 1000;
  const value = Math.exp(seconds / 4.6);
  return Math.max(1, Math.floor(value * 100) / 100);
}

export function startCrashRound({
  userId,
  currency,
  betAmount,
  crashPoint = generateCrashPoint(),
  now = Date.now(),
  config = crashConfig,
}: {
  userId: string;
  currency: Currency;
  betAmount: number;
  crashPoint?: number;
  now?: number;
  config?: CrashConfig;
}): CrashRound {
  placeTableBet(userId, currency, betAmount, config, { crashPoint });
  return {
    id: createId("crash"),
    status: "RUNNING",
    currency,
    betAmount,
    crashPoint,
    startedAt: now,
  };
}

export function cashOutCrashRound({
  round,
  userId,
  multiplier,
  now = Date.now(),
  config = crashConfig,
}: {
  round: CrashRound;
  userId: string;
  multiplier: number;
  now?: number;
  config?: CrashConfig;
}): CrashRound {
  if (round.status !== "RUNNING") return round;
  const cashOutMultiplier = Math.max(1, Math.floor(multiplier * 100) / 100);
  if (cashOutMultiplier >= round.crashPoint) {
    return crashCrashRound({ round, userId, multiplier: round.crashPoint, now, config });
  }
  const settlement = settleTableResult({
    userId,
    currency: round.currency,
    config,
    result: "WIN",
    amountPaid: round.betAmount * cashOutMultiplier,
    wagered: round.betAmount,
    metadata: { crashPoint: round.crashPoint, cashOutMultiplier },
  });
  return {
    ...round,
    status: "CASHED_OUT",
    cashedOutAt: now,
    cashOutMultiplier,
    totalPaid: settlement.amountPaid,
    settlement,
  };
}

export function crashCrashRound({
  round,
  userId,
  multiplier,
  now = Date.now(),
  config = crashConfig,
}: {
  round: CrashRound;
  userId: string;
  multiplier?: number;
  now?: number;
  config?: CrashConfig;
}): CrashRound {
  if (round.status !== "RUNNING") return round;
  const shownMultiplier = Math.max(1, Math.floor((multiplier ?? round.crashPoint) * 100) / 100);
  const settlement = settleTableResult({
    userId,
    currency: round.currency,
    config,
    result: "LOSS",
    amountPaid: 0,
    wagered: round.betAmount,
    metadata: { crashPoint: round.crashPoint, crashMultiplier: shownMultiplier },
  });
  return {
    ...round,
    status: "CRASHED",
    cashedOutAt: now,
    cashOutMultiplier: shownMultiplier,
    totalPaid: 0,
    settlement,
  };
}
