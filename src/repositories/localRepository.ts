import type { CasinoRepository } from "./types";

export const localRepository: CasinoRepository = {
  mode: "local",
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
