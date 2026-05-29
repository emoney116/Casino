import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { setRepositoryOverrideForTests } from "../repositories";
import type { CasinoRepository } from "../repositories/types";
import type { CasinoData, Transaction, User, WalletBalances } from "../types";
import { AccountVipCard } from "./AccountPage";
import {
  getLifetimeSCWagered,
  refreshVipProgress,
  syncVipWagerTransaction,
} from "./vipService";

const memory: Record<string, string> = {};
globalThis.localStorage = {
  getItem: (key) => memory[key] ?? null,
  setItem: (key, value) => {
    memory[key] = value;
  },
  removeItem: (key) => {
    delete memory[key];
  },
  clear: () => {
    Object.keys(memory).forEach((key) => delete memory[key]);
  },
  key: (index) => Object.keys(memory)[index] ?? null,
  get length() {
    return Object.keys(memory).length;
  },
} as Storage;

function tx(partial: Partial<Transaction> & Pick<Transaction, "id" | "userId" | "type" | "currency" | "amount">): Transaction {
  return {
    balanceAfter: 0,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    metadata: {},
    ...partial,
  };
}

function createSupabaseVipMock(initialLifetime: number | null) {
  let lifetime = initialLifetime;
  let ensureCount = 0;
  const processed = new Set<string>();

  const repository: CasinoRepository = {
    mode: "supabase",
    async fetchWalletBalance(): Promise<WalletBalances | null> {
      return null;
    },
    async fetchWalletTransactions() {
      return [];
    },
    async ensureVipProgress() {
      ensureCount += 1;
      if (lifetime === null) lifetime = 0;
    },
    async fetchVipLifetimeSCWagered() {
      return lifetime;
    },
    async recordVipWager(transaction) {
      if (processed.has(transaction.id)) return;
      processed.add(transaction.id);
      lifetime = (lifetime ?? 0) + Math.abs(transaction.amount);
    },
    async syncProfile() {
      return undefined;
    },
    async syncProfileAvatar() {
      return undefined;
    },
    async syncStreak() {
      return undefined;
    },
    async syncWalletBalance() {
      return undefined;
    },
    async syncWalletTransaction() {
      return undefined;
    },
  };

  return {
    repository,
    getLifetime: () => lifetime,
    getEnsureCount: () => ensureCount,
  };
}

const user: User = {
  id: "vip-test-user",
  email: "vip@test.local",
  username: "VipTester",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user],
  sessions: [{ userId: user.id, createdAt: new Date().toISOString() }],
  walletBalances: { [user.id]: { GOLD: 100_000, BONUS: 100_000 } },
  transactions: [
    tx({ id: "local-sc-bet", userId: user.id, type: "GAME_BET", currency: "BONUS", amount: -1000 }),
    tx({ id: "local-sc-table", userId: user.id, type: "TABLE_BET", currency: "BONUS", amount: -1200 }),
    tx({ id: "local-sc-arcade", userId: user.id, type: "ARCADE_BET", currency: "BONUS", amount: -200 }),
    tx({ id: "local-sc-buy", userId: user.id, type: "BUY_BONUS", currency: "BONUS", amount: -20 }),
    tx({ id: "local-gc-bet", userId: user.id, type: "GAME_BET", currency: "GOLD", amount: -999_999 }),
    tx({ id: "local-sc-win", userId: user.id, type: "GAME_WIN", currency: "BONUS", amount: 999 }),
    tx({ id: "local-sc-purchase", userId: user.id, type: "GOLD_PURCHASE_DEMO", currency: "GOLD", amount: 5000 }),
    tx({ id: "local-sc-reward", userId: user.id, type: "PROMO_REWARD", currency: "BONUS", amount: 0.1 }),
    tx({ id: "local-sc-failed", userId: user.id, type: "GAME_BET", currency: "BONUS", amount: -777, status: "FAILED" }),
  ],
  progression: {},
  streaks: {},
  missions: {},
  favorites: {},
  retention: {},
  redemptionRequests: [],
  kycStatuses: {},
  eligibilityFlags: {},
};

localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));

setRepositoryOverrideForTests(null);
const localProgress = await refreshVipProgress(user.id);
if (getLifetimeSCWagered(user.id) !== 2420 || localProgress.lifetimeSCWagered !== 2420) {
  throw new Error("Local fallback VIP should derive only completed SC wager debits from local transactions.");
}

const supabaseVip = createSupabaseVipMock(0);
setRepositoryOverrideForTests(supabaseVip.repository);
const scBet = tx({ id: "sc-bet-1", userId: user.id, type: "GAME_BET", currency: "BONUS", amount: -1250 });
await syncVipWagerTransaction(scBet);
await syncVipWagerTransaction(scBet);
if (supabaseVip.getLifetime() !== 1250) {
  throw new Error("Supabase VIP should increment once per SC wager transaction id.");
}

const nonVipTransactions = [
  tx({ id: "gc-bet", userId: user.id, type: "GAME_BET", currency: "GOLD", amount: -1250 }),
  tx({ id: "sc-win", userId: user.id, type: "GAME_WIN", currency: "BONUS", amount: 1250 }),
  tx({ id: "purchase", userId: user.id, type: "GOLD_PURCHASE_DEMO", currency: "GOLD", amount: 5000 }),
  tx({ id: "reward", userId: user.id, type: "PROMO_REWARD", currency: "BONUS", amount: 25 }),
  tx({ id: "failed", userId: user.id, type: "GAME_BET", currency: "BONUS", amount: -1250, status: "FAILED" }),
  tx({ id: "cancelled", userId: user.id, type: "GAME_BET", currency: "BONUS", amount: -1250, status: "CANCELLED" as Transaction["status"] }),
];
for (const transaction of nonVipTransactions) {
  await syncVipWagerTransaction(transaction);
}
if (supabaseVip.getLifetime() !== 1250) {
  throw new Error("Supabase VIP should ignore GC bets, wins, purchases, rewards, and failed/cancelled wagers.");
}

const legendVip = createSupabaseVipMock(50_000_000);
setRepositoryOverrideForTests(legendVip.repository);
const legendProgress = await refreshVipProgress(user.id);
if (legendProgress.currentTier.name !== "Whale / Legend" || legendProgress.lifetimeSCWagered !== 50_000_000) {
  throw new Error("VIP should read lifetime_sc_wagered from Supabase when the Supabase repository is active.");
}

const vipCardMarkup = renderToStaticMarkup(createElement(AccountVipCard, {
  vipProgress: legendProgress,
  onOpenVip: () => undefined,
}));
if (!vipCardMarkup.includes("Whale / Legend") || !vipCardMarkup.includes("50,000,000 SC") || !vipCardMarkup.includes("Top tier reached")) {
  throw new Error("Account VIP card should render the Supabase vip_progress value.");
}

const missingVip = createSupabaseVipMock(null);
setRepositoryOverrideForTests(missingVip.repository);
const missingProgress = await refreshVipProgress("missing-vip-row");
if (missingProgress.lifetimeSCWagered !== 0 || missingVip.getLifetime() !== 0 || missingVip.getEnsureCount() !== 1) {
  throw new Error("Missing Supabase vip_progress row should be created and read as zero.");
}

setRepositoryOverrideForTests(null);
console.log("vip.devtest passed");
