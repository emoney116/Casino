import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/ToastContext";
import { fakeDirectCurrencyPurchase } from "../store/fakePurchaseService";
import { canRequestRedemption, createRedemptionRequest } from "./redemptionService";
import { RedemptionPage } from "./RedemptionPage";
import { WalletPage } from "../wallet/WalletPage";
import type { CasinoData, User } from "../types";

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
  id: "sweeps-prep-user",
  email: "sweeps@test.local",
  username: "SweepsPrep",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user],
  passwordRecords: {},
  sessions: [{ userId: user.id, createdAt: new Date().toISOString() }],
  walletBalances: { [user.id]: { GOLD: 5000, BONUS: 500 } },
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

if (canRequestRedemption("GOLD")) {
  throw new Error("Gold Coins must never be requestable for redemption.");
}

if (canRequestRedemption("BONUS")) {
  throw new Error("Redeemable currency must remain disabled while redemptionEnabled=false.");
}

try {
  fakeDirectCurrencyPurchase(user, "BONUS", 100);
  throw new Error("Direct purchase of redeemable currency should be blocked.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("cannot be purchased directly")) {
    throw error;
  }
}

try {
  createRedemptionRequest(user.id, 100);
  throw new Error("Redemption request creation should be disabled in prototype mode.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("not currently enabled")) {
    throw error;
  }
}

const markup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: createElement(RedemptionPage) }),
  ),
);

if (!markup.includes("Request Disabled") || !markup.includes("Prototype mode. Redemptions are not currently enabled.")) {
  throw new Error("Redemption page should render the disabled request state.");
}

if (!markup.includes("Redeemable balance placeholder")) {
  throw new Error("Redemption page should render the redeemable balance placeholder.");
}

const purchaseMarkup = renderToStaticMarkup(
  createElement(ToastProvider, null,
    createElement(AuthProvider, { initialUser: user, children: <WalletPage initialPanel="purchase" /> }),
  ),
);

for (const expected of [
  "5,000 Gold Coins",
  "25 promotional Sweeps Coins",
  "25,000 Gold Coins",
  "125 promotional Sweeps Coins",
  "75,000 Gold Coins",
  "375 promotional Sweeps Coins",
]) {
  if (!purchaseMarkup.includes(expected)) {
    throw new Error(`Expected purchase modal to render pack value: ${expected}.`);
  }
}

console.log("sweepstakesPrep.devtest passed");
