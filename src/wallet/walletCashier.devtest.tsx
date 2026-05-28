import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AppShell } from "../app/AppShell";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/ToastContext";
import type { CasinoData, Transaction, User } from "../types";
import { filterWalletTransactions, getWalletActivityLabel, getWalletActivityTone, WalletPage } from "./WalletPage";

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
  id: "wallet-cashier-user",
  email: "cashier@test.local",
  username: "CashierTest",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const transactions: Transaction[] = [
  {
    id: "txn-purchase",
    userId: user.id,
    type: "GOLD_PURCHASE_DEMO",
    currency: "GOLD",
    amount: 5000,
    balanceAfter: 125000,
    status: "COMPLETED",
    createdAt: "2026-05-27T12:00:00.000Z",
    metadata: { packId: "starter" },
  },
  {
    id: "txn-bonus",
    userId: user.id,
    type: "SWEEPS_BONUS_GRANT",
    currency: "BONUS",
    amount: 5,
    balanceAfter: 24,
    status: "COMPLETED",
    createdAt: "2026-05-27T12:01:00.000Z",
    metadata: { packId: "starter" },
  },
  {
    id: "txn-bet",
    userId: user.id,
    type: "ARCADE_BET",
    currency: "GOLD",
    amount: -100,
    balanceAfter: 124900,
    status: "COMPLETED",
    createdAt: "2026-05-27T12:02:00.000Z",
    metadata: { game: "ember-stack", arcadeGameId: "emberStack", arcadeGame: "Ember Stack" },
  },
  {
    id: "txn-loss",
    userId: user.id,
    type: "TABLE_LOSS",
    currency: "GOLD",
    amount: 0,
    balanceAfter: 124900,
    status: "COMPLETED",
    createdAt: "2026-05-27T12:03:00.000Z",
    metadata: { tableGameId: "crash", tableGame: "Crash" },
  },
  {
    id: "txn-win",
    userId: user.id,
    type: "GAME_WIN",
    currency: "GOLD",
    amount: 250,
    balanceAfter: 125150,
    status: "COMPLETED",
    createdAt: "2026-05-27T12:04:00.000Z",
    metadata: { gameId: "gold-rush-showdown", gameName: "Gold Rush Showdown" },
  },
];

const seed: Partial<CasinoData> = {
  users: [user],
  passwordRecords: {},
  sessions: [{ userId: user.id, createdAt: new Date().toISOString() }],
  walletBalances: { [user.id]: { GOLD: 125150, BONUS: 24 } },
  transactions,
  progression: {},
  streaks: {},
  missions: {},
  favorites: {},
  retention: {},
  redemptionRequests: [],
  kycStatuses: { [user.id]: "NOT_STARTED" },
  eligibilityFlags: {},
};

localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));
localStorage.setItem(`casino-onboarding-dismissed-v1:${user.id}`, "true");

(globalThis as any).window = {
  location: { pathname: "/wallet" },
  history: { pushState: () => undefined },
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => undefined,
} as unknown as Window;

function renderWallet(initialPanel?: "purchase" | "redeem" | "history") {
  return renderToStaticMarkup(
    createElement(ToastProvider, null,
      createElement(AuthProvider, { initialUser: user, children: <WalletPage initialPanel={initialPanel ?? null} /> }),
    ),
  );
}

function count(markup: string, text: string) {
  return markup.split(text).length - 1;
}

const walletMarkup = renderWallet();
for (const expected of [
  "Wallet",
  "Gold Coins",
  "Sweeps Coins",
  "Buy Coins",
  "Redemption Status",
  "Recent Activity",
  "Redeem",
  "View All",
]) {
  if (!walletMarkup.includes(expected)) {
    throw new Error(`Wallet cashier page should render: ${expected}`);
  }
}

if (
  walletMarkup.includes("PLAYHEATER Cashier") ||
  walletMarkup.includes("Cashier</h1>") ||
  walletMarkup.includes("Coin Store</strong>") ||
  walletMarkup.includes("Get GC + bonus SC") ||
  walletMarkup.includes("Entertainment balance") ||
  walletMarkup.includes("Promotional balance") ||
  walletMarkup.includes("View details")
) {
  throw new Error("Wallet page should render the cleaned one-line wallet cashier copy.");
}

if (walletMarkup.includes("Gold Purchase Demo")) {
  throw new Error("Recent activity preview should be limited to the latest three rows.");
}

for (const expected of ["Gold Rush Win", "Crash Loss", "Ember Stack Bet"]) {
  if (!walletMarkup.includes(expected)) {
    throw new Error(`Recent activity should use game-aware labels: ${expected}`);
  }
}

for (const genericLabel of ["Table Loss", "Table Bet", "Game Win", "Arcade Bet"]) {
  if (walletMarkup.includes(genericLabel)) {
    throw new Error(`Recent activity should not use generic ledger labels: ${genericLabel}`);
  }
}

if (getWalletActivityLabel(transactions[3]) !== "Crash Loss" || getWalletActivityTone(transactions[3]) !== "negative") {
  throw new Error("Activity helper should show zero-amount table losses as red game losses.");
}

if (walletMarkup.includes("Prototype mode. Redemptions are not currently enabled.")) {
  throw new Error("Wallet page should not render the old compliance footer.");
}

if (walletMarkup.includes("Gold Coins have no cash value.")) {
  throw new Error("Wallet page should not render the old Gold Coins compliance footer.");
}

const purchaseMarkup = renderWallet("purchase");
for (const expected of ["Coin Store", "modal-title-with-icon", "cashier-store-modal", "purchase-pack-tile-grid", "purchase-pack-tile", "Buy $5", "Buy $10", "Buy $20", "Buy $50", "Buy $100", "Buy $200", "+5 SC", "+200 SC", "cashier-modal-card"]) {
  if (!purchaseMarkup.includes(expected)) {
    throw new Error(`Purchase modal should render cashier purchase flow: ${expected}`);
  }
}

for (const expectedAsset of ["gc_reference", "purchase_chest", "reward_safe", "sc_reference"]) {
  const combinedMarkup = `${walletMarkup}${purchaseMarkup}${renderWallet("redeem")}`;
  if (!combinedMarkup.includes(expectedAsset)) {
    throw new Error(`Cashier asset should render through wallet UI: ${expectedAsset}`);
  }
}

if (
  purchaseMarkup.includes("GC packages with bonus SC.") ||
  purchaseMarkup.includes("Demo purchase only") ||
  purchaseMarkup.includes("SC included as promotional Sweeps Coins.") ||
  purchaseMarkup.includes("cashier-icon-badge") ||
  purchaseMarkup.includes("purchase-pack-main\"><img") ||
  purchaseMarkup.includes("wallet-pack-standard-list") ||
  purchaseMarkup.includes("purchase-pack-price") ||
  purchaseMarkup.includes("purchase-pack-badge-slot") ||
  purchaseMarkup.includes("Most Popular") ||
  purchaseMarkup.includes(">Mini<") ||
  purchaseMarkup.includes(">Standard<") ||
  purchaseMarkup.includes(">Popular<") ||
  purchaseMarkup.includes(">Mega<") ||
  purchaseMarkup.includes(">Elite<") ||
  purchaseMarkup.includes("$4.99") ||
  purchaseMarkup.includes("$9.99") ||
  purchaseMarkup.includes("$19.99") ||
  purchaseMarkup.includes("$49.99") ||
  purchaseMarkup.includes("$99.99") ||
  purchaseMarkup.includes("Starter value") ||
  purchaseMarkup.includes("more Gold Coins") ||
  count(purchaseMarkup, " featured") !== 1
) {
  throw new Error("Purchase modal should stay compact with whole-dollar price buttons and no package icons.");
}

const redemptionMarkup = renderWallet("redeem");
for (const expected of ["Redeemable SC", "Minimum redemption", "Status: Not enabled", "KYC", "Identity check", "Request Disabled"]) {
  if (!redemptionMarkup.includes(expected)) {
    throw new Error(`Redemption modal should render clean disabled status: ${expected}`);
  }
}

const historyMarkup = renderWallet("history");
for (const expected of ["Transaction History", "All", "Purchases", "Bonuses", "Bets", "Wins", "Export JSON", "cashier-transaction-row"]) {
  if (!historyMarkup.includes(expected)) {
    throw new Error(`History modal should render compact filtered history UI: ${expected}`);
  }
}

if (!historyMarkup.includes("Gold Purchase Demo")) {
  throw new Error("Transaction history modal should still show full history.");
}

if (filterWalletTransactions(transactions, "PURCHASES").some((tx) => tx.type !== "GOLD_PURCHASE_DEMO")) {
  throw new Error("Purchase filter should only include purchase ledger rows.");
}

if (!filterWalletTransactions(transactions, "BONUSES").some((tx) => tx.type === "SWEEPS_BONUS_GRANT")) {
  throw new Error("Bonus filter should include Sweeps bonus grants.");
}

const appShellMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(AppShell) }),
  ),
);

if (!appShellMarkup.includes('aria-label="Purchase coin packs"')) {
  throw new Error("Header plus button should expose the shared purchase entry.");
}

console.log("walletCashier.devtest passed");
