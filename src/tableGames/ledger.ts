import { creditCurrency, debitCurrency, getBalance, recordWalletEvent } from "../wallet/walletService";
import type { Currency, Transaction } from "../types";
import type { TableGameConfig, TableSettlement } from "./types";
import { DEMO_MAX_SINGLE_BET, capDemoPayout } from "../economy/limits";

export function assertTableBet(userId: string, currency: Currency, amount: number, config: TableGameConfig) {
  if (!Number.isFinite(amount) || amount < config.minBet) {
    throw new Error(`Minimum bet is ${config.minBet} coins.`);
  }
  if (amount > config.maxBet) {
    throw new Error(`Maximum bet is ${config.maxBet} coins.`);
  }
  if (amount > DEMO_MAX_SINGLE_BET && config.id !== "roulette") {
    throw new Error(`Demo maximum single bet is ${DEMO_MAX_SINGLE_BET} coins.`);
  }
  if (getBalance(userId, currency) < amount) {
    throw new Error("Insufficient balance for this table bet.");
  }
}

export function placeTableBet(
  userId: string,
  currency: Currency,
  amount: number,
  config: TableGameConfig,
  metadata: Record<string, unknown> = {},
) {
  assertTableBet(userId, currency, amount, config);
  return debitCurrency({
    userId,
    currency,
    amount,
    type: "TABLE_BET",
    metadata: { tableGameId: config.id, tableGame: config.name, ...metadata },
  });
}

export function settleTableResult({
  userId,
  currency,
  config,
  result,
  amountPaid,
  wagered,
  metadata = {},
}: {
  userId: string;
  currency: Currency;
  config: TableGameConfig;
  result: TableSettlement["result"];
  amountPaid: number;
  wagered: number;
  metadata?: Record<string, unknown>;
}): TableSettlement {
  const transactions: Transaction[] = [];
  const cappedPaid = capDemoPayout(Math.min(Math.max(0, Math.round(amountPaid)), config.maxPayout));
  const baseMetadata = { tableGameId: config.id, tableGame: config.name, wagered, ...metadata };

  if (result === "WIN" && cappedPaid > 0) {
    transactions.push(
      creditCurrency({ userId, currency, amount: cappedPaid, type: "TABLE_WIN", metadata: baseMetadata }),
    );
  } else if (result === "PUSH" && cappedPaid > 0) {
    transactions.push(
      creditCurrency({ userId, currency, amount: cappedPaid, type: "TABLE_PUSH", metadata: baseMetadata }),
    );
  } else if (result === "REFUND" && cappedPaid > 0) {
    transactions.push(
      creditCurrency({ userId, currency, amount: cappedPaid, type: "TABLE_REFUND", metadata: baseMetadata }),
    );
  } else {
    transactions.push(
      recordWalletEvent({ userId, currency, amount: 0, type: "TABLE_LOSS", metadata: baseMetadata }),
    );
  }

  return {
    result,
    amountPaid: cappedPaid,
    profit: cappedPaid - wagered,
    transactions,
    message: result === "WIN" ? `Paid ${cappedPaid}` : result === "PUSH" ? "Push. Bet returned." : "No payout.",
  };
}
