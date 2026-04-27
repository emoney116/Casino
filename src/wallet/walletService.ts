import { createId } from "../lib/ids";
import { readData, updateData } from "../lib/storage";
import { getRepository, mirrorToBackend } from "../repositories";
import type { Currency, Transaction, TransactionType, WalletBalances } from "../types";

export const emptyBalances: WalletBalances = { GOLD: 0, BONUS: 0 };

function ensureWallet(userId: string) {
  updateData((data) => {
    if (!data.walletBalances[userId]) {
      data.walletBalances[userId] = { ...emptyBalances };
    }
  });
}

interface LedgerInput {
  userId: string;
  type: TransactionType;
  currency: Currency;
  amount: number;
  metadata?: Record<string, unknown>;
}

export function getBalance(userId: string): WalletBalances;
export function getBalance(userId: string, currency: Currency): number;
export function getBalance(userId: string, currency?: Currency): WalletBalances | number {
  ensureWallet(userId);
  const balances = readData().walletBalances[userId] ?? emptyBalances;
  return currency ? balances[currency] : balances;
}

export function getTransactions(userId?: string) {
  const transactions = readData().transactions;
  return (userId ? transactions.filter((tx) => tx.userId === userId) : transactions)
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function creditCurrency(input: LedgerInput): Transaction {
  if (input.amount <= 0) throw new Error("Credit amount must be positive.");

  let created: Transaction | undefined;
  updateData((data) => {
    const wallet = data.walletBalances[input.userId] ?? { ...emptyBalances };
    const balanceAfter = wallet[input.currency] + input.amount;
    wallet[input.currency] = balanceAfter;
    data.walletBalances[input.userId] = wallet;

    created = {
      id: createId("txn"),
      userId: input.userId,
      type: input.type,
      currency: input.currency,
      amount: input.amount,
      balanceAfter,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    data.transactions.push(created);
  });

  const tx = created as Transaction;
  const balances = getBalance(input.userId);
  mirrorToBackend(async () => {
    const repository = getRepository();
    await repository.syncWalletBalance(input.userId, balances);
    await repository.syncWalletTransaction(tx);
  });
  return tx;
}

export function debitCurrency(input: LedgerInput): Transaction {
  if (input.amount <= 0) throw new Error("Debit amount must be positive.");

  let created: Transaction | undefined;
  updateData((data) => {
    const wallet = data.walletBalances[input.userId] ?? { ...emptyBalances };
    if (wallet[input.currency] < input.amount) {
      throw new Error("Insufficient balance.");
    }

    const balanceAfter = wallet[input.currency] - input.amount;
    wallet[input.currency] = balanceAfter;
    data.walletBalances[input.userId] = wallet;

    created = {
      id: createId("txn"),
      userId: input.userId,
      type: input.type,
      currency: input.currency,
      amount: -input.amount,
      balanceAfter,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    data.transactions.push(created);
  });

  const tx = created as Transaction;
  const balances = getBalance(input.userId);
  mirrorToBackend(async () => {
    const repository = getRepository();
    await repository.syncWalletBalance(input.userId, balances);
    await repository.syncWalletTransaction(tx);
  });
  return tx;
}
