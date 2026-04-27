import type { CasinoRepository } from "./types";

export const localRepository: CasinoRepository = {
  mode: "local",
  async syncProfile() {
    return undefined;
  },
  async syncWalletBalance() {
    return undefined;
  },
  async syncWalletTransaction() {
    return undefined;
  },
};
