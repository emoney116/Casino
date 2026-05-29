import type { CasinoRepository } from "./types";
import { readData } from "../lib/storage";

export const localRepository: CasinoRepository = {
  mode: "local",
  async fetchWalletBalance(userId) {
    return readData().walletBalances[userId] ?? null;
  },
  async fetchWalletTransactions(userId) {
    return readData().transactions.filter((transaction) => transaction.userId === userId);
  },
  async ensureVipProgress() {
    return undefined;
  },
  async fetchVipLifetimeSCWagered() {
    return null;
  },
  async recordVipWager() {
    return undefined;
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
