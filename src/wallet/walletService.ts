import { createId } from "../lib/ids";
import { readData, updateData } from "../lib/storage";
import { getRepository, mirrorToBackend } from "../repositories";
import { assertResponsiblePlayAllowsDebit } from "../account/profileService";
import { emitVipLedgerUpdated, isVipWagerTransaction } from "../account/vipService";
import { setDebugWalletFetch, setLastMirrorError } from "../lib/debugState";
import type { Currency, Transaction, TransactionType, WalletBalances } from "../types";

export const emptyBalances: WalletBalances = { GOLD: 0, BONUS: 0 };
export const WALLET_BALANCE_UPDATED_EVENT = "playheater:wallet-balance-updated";

function ensureWallet(userId: string) {
  updateData((data) => {
    if (!data.walletBalances[userId]) {
      data.walletBalances[userId] = { ...emptyBalances };
    }
  });
}

function replaceWalletCache(userId: string, balances: WalletBalances) {
  updateData((data) => {
    data.walletBalances[userId] = { ...balances };
  });
}

function replaceUserTransactions(userId: string, transactions: Transaction[]) {
  updateData((data) => {
    data.transactions = [
      ...data.transactions.filter((transaction) => transaction.userId !== userId),
      ...transactions,
    ];
  });
}

function dispatchWalletUpdated(userId: string, balances: WalletBalances, source: "supabase" | "local") {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent(WALLET_BALANCE_UPDATED_EVENT, { detail: { userId, balances, source } }));
}

function errorDebugRow(error: unknown) {
  return { error: error instanceof Error ? error.message : String(error) };
}

interface LedgerInput {
  userId: string;
  type: TransactionType;
  currency: Currency;
  amount: number;
  metadata?: Record<string, unknown>;
}

interface WalletRefreshOptions {
  missingBalances?: WalletBalances;
  createMissingBalance?: boolean;
}

export async function refreshWalletFromRepository(userId: string, options: WalletRefreshOptions = {}) {
  const repository = getRepository();
  if (repository.mode !== "supabase") {
    ensureWallet(userId);
    const localBalances = readData().walletBalances[userId] ?? emptyBalances;
    setDebugWalletFetch({ userId, source: "local", fetchedRow: localBalances });
    dispatchWalletUpdated(userId, localBalances, "local");
    return localBalances;
  }

  const missingBalances = options.missingBalances ?? emptyBalances;
  let balances = { ...missingBalances };
  let fetchedBalances: WalletBalances | null = null;

  try {
    fetchedBalances = await repository.fetchWalletBalance(userId);
    setDebugWalletFetch({ userId, source: "supabase", fetchedRow: fetchedBalances });
    if (fetchedBalances) {
      balances = fetchedBalances;
    } else {
      console.warn(
        "No Supabase wallet_balances row returned for current user. If a row exists, verify the app user id matches wallet_balances.user_id and that RLS allows reads.",
        { userId },
      );
    }
  } catch (error) {
    setLastMirrorError(error);
    setDebugWalletFetch({ userId, source: "supabase", fetchedRow: errorDebugRow(error) });
    console.warn("Unable to fetch Supabase wallet_balances; ignoring stale local cached balance.", error);
  }

  replaceWalletCache(userId, balances);

  if (!fetchedBalances && options.createMissingBalance) {
    try {
      await repository.syncWalletBalance(userId, balances);
    } catch (error) {
      setLastMirrorError(error);
      console.warn("Unable to create initial Supabase wallet_balances row.", error);
    }
  }

  try {
    const transactions = await repository.fetchWalletTransactions(userId);
    replaceUserTransactions(userId, transactions);
    if (transactions.some(isVipWagerTransaction)) emitVipLedgerUpdated(userId);
  } catch (error) {
    setLastMirrorError(error);
    replaceUserTransactions(userId, []);
    console.warn("Unable to fetch Supabase wallet_transactions; ignoring stale local transaction cache.", error);
  }

  dispatchWalletUpdated(userId, balances, "supabase");
  return balances;
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
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Credit amount must be positive.");

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
  dispatchWalletUpdated(input.userId, balances, getRepository().mode === "supabase" ? "supabase" : "local");
  mirrorToBackend(async () => {
    const repository = getRepository();
    await repository.syncWalletBalance(input.userId, balances);
    await repository.syncWalletTransaction(tx);
  });
  return tx;
}

export function recordWalletEvent(input: LedgerInput): Transaction {
  if (input.amount !== 0) throw new Error("Wallet event amount must be zero.");

  let created: Transaction | undefined;
  updateData((data) => {
    const wallet = data.walletBalances[input.userId] ?? { ...emptyBalances };
    data.walletBalances[input.userId] = wallet;

    created = {
      id: createId("txn"),
      userId: input.userId,
      type: input.type,
      currency: input.currency,
      amount: 0,
      balanceAfter: wallet[input.currency],
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: input.metadata ?? {},
    };
    data.transactions.push(created);
  });

  const tx = created as Transaction;
  const balances = getBalance(input.userId);
  dispatchWalletUpdated(input.userId, balances, getRepository().mode === "supabase" ? "supabase" : "local");
  mirrorToBackend(async () => {
    const repository = getRepository();
    await repository.syncWalletBalance(input.userId, balances);
    await repository.syncWalletTransaction(tx);
  });
  return tx;
}

export function debitCurrency(input: LedgerInput): Transaction {
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Debit amount must be positive.");
  assertResponsiblePlayAllowsDebit(input);

  let created: Transaction | undefined;
  updateData((data) => {
    const wallet = data.walletBalances[input.userId] ?? { ...emptyBalances };
    if (wallet[input.currency] < input.amount) {
      throw new Error("Insufficient balance.");
    }

    const balanceAfter = wallet[input.currency] - input.amount;
    if (balanceAfter < 0) throw new Error("Insufficient balance.");
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
  if (isVipWagerTransaction(tx)) emitVipLedgerUpdated(input.userId);
  const balances = getBalance(input.userId);
  dispatchWalletUpdated(input.userId, balances, getRepository().mode === "supabase" ? "supabase" : "local");
  mirrorToBackend(async () => {
    const repository = getRepository();
    await repository.syncWalletBalance(input.userId, balances);
    await repository.syncWalletTransaction(tx);
  });
  return tx;
}
