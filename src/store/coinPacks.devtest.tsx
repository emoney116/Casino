import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/ToastContext";
import type { CasinoData, User } from "../types";
import { getBalance, getTransactions } from "../wallet/walletService";
import { PurchaseCoinsModal } from "../wallet/PurchaseCoinsModal";
import { saveResponsiblePlaySettings } from "../account/profileService";
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

const expectedScBonuses: Record<string, number> = {
  starter: 5,
  value: 10,
  popular: 20,
  mega: 50,
  whale: 100,
  vault: 200,
};

for (const pack of coinPacks) {
  if (pack.scBonus !== expectedScBonuses[pack.id]) {
    throw new Error(`${pack.id} SC bonus should match the 1 SC per $1 purchase value.`);
  }

  if (pack.scBonus !== Math.round(pack.usdPrice)) {
    throw new Error(`${pack.id} SC bonus should equal the rounded USD package price.`);
  }

  if (!Number.isInteger(pack.gcAmount)) {
    throw new Error(`${pack.id} GC amount must be a whole number.`);
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

const excludedUser: User = { ...user, id: "excluded-pack-user" };
saveResponsiblePlaySettings(excludedUser.id, {
  sessionReminderEnabled: false,
  sessionReminderMinutes: 30,
  spendingLimitEnabled: false,
  dailyGcLimit: 10000,
  selfExclusionEnabled: true,
});
try {
  fakePurchasePack(excludedUser, "starter");
  throw new Error("Self-exclusion should block demo coin purchases.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Coin purchases are locked")) throw error;
}

const markup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: <PurchaseCoinsModal onClose={() => undefined} /> }),
  ),
);

for (const pack of coinPacks) {
  for (const expected of [
    pack.gcAmount.toLocaleString(),
    `+${formatScBonusValue(pack)}`,
    `>Buy ${formatPackPrice(pack)}</button>`,
  ]) {
    if (!markup.includes(expected)) {
      throw new Error(`Purchase modal should render ${pack.id} value: ${expected}.`);
    }
  }
}

for (const removedName of ["Mini", "Standard", "Popular", "Mega", "Elite"]) {
  if (markup.includes(`>${removedName}<`)) {
    throw new Error(`Purchase modal should not render package names: ${removedName}`);
  }
}

if (
  !markup.includes("purchase-pack-tile-grid") ||
  !markup.includes("purchase-pack-tile") ||
  markup.includes("wallet-pack-standard-list") ||
  markup.includes("purchase-pack-main") ||
  markup.includes("purchase-pack-price") ||
  markup.includes("purchase-pack-badge-slot") ||
  markup.includes("Most Popular") ||
  markup.includes("Starter value") ||
  markup.includes("more Gold Coins") ||
  markup.includes("PACKAGE") ||
  markup.includes("Demo purchase only") ||
  markup.includes("SC included as promotional Sweeps Coins.") ||
  markup.includes("$4.99") ||
  markup.includes("$9.99") ||
  markup.includes("$19.99") ||
  markup.includes("$49.99") ||
  markup.includes("$99.99")
) {
  throw new Error("Purchase modal should render compact package tiles with price-only buttons and whole-dollar bundles.");
}

for (const removedName of ["Starter Pack", "Value Pack", "Whale Pack", "Buy $4.99", "Gold Coin packages with Sweeps Coins"]) {
  if (markup.includes(removedName)) {
    throw new Error(`Purchase modal should not render old package/CTA copy: ${removedName}`);
  }
}

if (countText(markup, " featured") !== 1 || markup.includes("Best Value")) {
  throw new Error("Purchase modal should render exactly one featured package through card styling only.");
}

const storeMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: <StorePage onBack={() => undefined} /> }),
  ),
);

if (!storeMarkup.includes("Coin Store") || !storeMarkup.includes("GC packages with bonus SC.")) {
  throw new Error("Store page should render the premium shop heading.");
}

if (!storeMarkup.includes("Running low on coins?") || !storeMarkup.includes("Get Coins")) {
  throw new Error("Low balance store banner should render when GOLD balance is below the UI threshold.");
}

if (!storeMarkup.includes("coin-store-grid") || !storeMarkup.includes("purchase-pack-tile")) {
  throw new Error("Store page should render compact two-column package tiles.");
}

for (const removedName of ["Mini", "Standard", "Popular", "Mega", "Elite"]) {
  if (storeMarkup.includes(`>${removedName}<`)) {
    throw new Error(`Store page should not render package names: ${removedName}`);
  }
}

const confirmMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: <PurchaseCoinsModal initialPackId="starter" onClose={() => undefined} /> }),
  ),
);

for (const expected of [
  "Coin Package",
  "$5",
  "5,000",
  "5 SC",
  "Gold Coins have no cash value",
  "SC are promotional bonus coins",
  "Demo purchase only",
  "Add Demo Coins",
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

function countText(markup: string, text: string) {
  return markup.split(text).length - 1;
}
