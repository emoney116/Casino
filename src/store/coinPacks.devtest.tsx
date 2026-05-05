import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/ToastContext";
import type { CasinoData, User } from "../types";
import { getBalance, getTransactions } from "../wallet/walletService";
import { PurchaseCoinsModal } from "../wallet/PurchaseCoinsModal";
import { coinPacks, formatPackPrice, formatScBonusValue } from "./coinPacks";
import { fakeDirectCurrencyPurchase, fakePurchasePack } from "./fakePurchaseService";
import { StorePage } from "./StorePage";

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

const user: User = {
  id: "pack-test-user",
  email: "packs@test.local",
  username: "PackTester",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user],
  passwordRecords: {},
  sessions: [{ userId: user.id, createdAt: new Date().toISOString() }],
  walletBalances: { [user.id]: { GOLD: 0, BONUS: 0 } },
  transactions: [],
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

for (const pack of coinPacks) {
  if (pack.scBonus !== Math.round(pack.usdPrice)) {
    throw new Error(`${pack.id} SC bonus must equal the rounded USD pack value.`);
  }

  if (!Number.isInteger(pack.gcAmount) || !Number.isInteger(pack.scBonus)) {
    throw new Error(`${pack.id} pack values must be whole numbers.`);
  }
}

for (let index = 1; index < coinPacks.length; index += 1) {
  if (coinPacks[index].gcPerDollar <= coinPacks[index - 1].gcPerDollar) {
    throw new Error("GC per dollar should increase with higher tiers.");
  }
}

try {
  fakeDirectCurrencyPurchase(user, "BONUS", 5);
  throw new Error("SC should not be directly purchasable.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("cannot be purchased directly")) {
    throw error;
  }
}

const markup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: <PurchaseCoinsModal onClose={() => undefined} /> }),
  ),
);

for (const pack of coinPacks) {
  for (const expected of [
    formatPackPrice(pack),
    `${pack.name} Pack`,
    pack.gcAmount.toLocaleString(),
    `+ ${formatScBonusValue(pack)}`,
  ]) {
    if (!markup.includes(expected)) {
      throw new Error(`Purchase modal should render ${pack.id} value: ${expected}.`);
    }
  }
}

for (const requiredCopy of [
  "Play more. Get bonus SC.",
  "Gold Coins have no cash value",
  "SC are promotional bonus coins",
  "No purchase necessary placeholder.",
  "Prototype mode. Redemptions not enabled.",
]) {
  if (!markup.includes(requiredCopy)) {
    throw new Error(`Purchase modal missing compliance copy: ${requiredCopy}`);
  }
}

if (!markup.includes("BEST VALUE") || !markup.includes("MOST POPULAR")) {
  throw new Error("Expected highlighted pack badges to render.");
}

const storeMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: <StorePage onBack={() => undefined} /> }),
  ),
);

if (!storeMarkup.includes("Coin Store") || !storeMarkup.includes("Play more. Get bonus SC.")) {
  throw new Error("Store page should render the premium shop heading.");
}

if (!storeMarkup.includes("Running low on coins?") || !storeMarkup.includes("Get Coins")) {
  throw new Error("Low balance store banner should render when GOLD balance is below the UI threshold.");
}

const confirmMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: <PurchaseCoinsModal initialPackId="starter" onClose={() => undefined} /> }),
  ),
);

for (const expected of [
  "Starter Pack",
  "$4.99",
  "5,000",
  "5 SC",
  "Gold Coins have no cash value",
  "SC are promotional bonus coins",
  "Prototype mode. Redemptions not enabled",
  "Confirm",
]) {
  if (!confirmMarkup.includes(expected)) {
    throw new Error(`Purchase confirmation modal should render: ${expected}`);
  }
}

const selectedPack = coinPacks.find((pack) => pack.id === "value");
if (!selectedPack) throw new Error("Expected value pack config.");

fakePurchasePack(user, selectedPack.id);

const balances = getBalance(user.id);
if (balances.GOLD !== selectedPack.gcAmount) {
  throw new Error("Demo purchase should grant configured GC amount once.");
}
if (balances.BONUS !== selectedPack.scBonus) {
  throw new Error("Demo purchase should grant configured SC bonus once.");
}

const transactions = getTransactions(user.id);
const goldEntries = transactions.filter((tx) => tx.type === "GOLD_PURCHASE_DEMO" && tx.metadata?.packId === selectedPack.id);
const scEntries = transactions.filter((tx) => tx.type === "SWEEPS_BONUS_GRANT" && tx.metadata?.packId === selectedPack.id);
if (goldEntries.length !== 1 || goldEntries[0].amount !== selectedPack.gcAmount) {
  throw new Error("Configured GC amount should match the GOLD_PURCHASE_DEMO ledger entry.");
}
if (scEntries.length !== 1 || scEntries[0].amount !== selectedPack.scBonus) {
  throw new Error("Configured SC bonus should match the SWEEPS_BONUS_GRANT ledger entry.");
}

console.log("coinPacks.devtest passed");
