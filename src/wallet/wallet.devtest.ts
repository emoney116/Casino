import { creditCurrency, debitCurrency, getBalance, getTransactions } from "./walletService";
import { claimDailyBonus } from "./dailyBonusService";

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

const userId = "test-user";
const seed = {
  users: [
    {
      id: userId,
      email: "test@demo.local",
      username: "TestUser",
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
      roles: ["USER"],
      accountStatus: "ACTIVE",
    },
  ],
  passwordRecords: {},
  sessions: [],
  walletBalances: {},
  transactions: [],
};
localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));

creditCurrency({ userId, type: "ADMIN_ADJUSTMENT", currency: "GOLD", amount: 100 });
debitCurrency({ userId, type: "GAME_BET", currency: "GOLD", amount: 25 });

if (getBalance(userId, "GOLD") !== 75) {
  throw new Error("Expected GOLD balance to be 75.");
}

if (getTransactions(userId).length !== 2) {
  throw new Error("Expected every balance change to create a transaction.");
}

try {
  debitCurrency({ userId, type: "GAME_BET", currency: "GOLD", amount: 1000 });
  throw new Error("Expected insufficient balance debit to fail.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Insufficient balance.") throw error;
}

claimDailyBonus(userId);
try {
  claimDailyBonus(userId);
  throw new Error("Expected second daily bonus claim to fail.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Daily bonus already claimed today.") throw error;
}

console.log("wallet.devtest passed");
