import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { ToastProvider } from "../components/ToastContext";
import { AuthProvider } from "../auth/AuthContext";
import { AppShell } from "./AppShell";
import { navItems } from "./navigation";
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
  id: "route-smoke-user",
  email: "route@test.local",
  username: "RouteSmoke",
  createdAt: new Date().toISOString(),
  lastLoginAt: new Date().toISOString(),
  roles: ["USER", "ADMIN"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user],
  passwordRecords: {},
  sessions: [{ userId: user.id, createdAt: new Date().toISOString() }],
  walletBalances: { [user.id]: { GOLD: 100000, BONUS: 100000 } },
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

if (navItems.some((item) => item.id === "redemption")) {
  throw new Error("Redemption should be part of Wallet, not a separate bottom navigation item.");
}

const routes = [
  { path: "/wallet", text: "Coins at a glance" },
  { path: "/slots/frontier-fortune", text: "Loading slot..." },
  { path: "/games/blackjack", text: "Loading game..." },
  { path: "/games/roulette", text: "Loading game..." },
  { path: "/games/over-under", text: "Loading game..." },
  { path: "/games/crash", text: "Loading game..." },
  { path: "/games/treasure-dig", text: "Loading game..." },
  { path: "/games/brick-break-bonus", text: "Loading game..." },
  { path: "/games/balloon-pop", text: "Loading game..." },
  { path: "/redemption", text: "Redemption" },
  { path: "/terms", text: "Terms" },
  { path: "/sweepstakes-rules", text: "Sweepstakes Rules" },
  { path: "/privacy", text: "Privacy Policy" },
  { path: "/responsible-play", text: "Responsible Play" },
  { path: "/eligibility", text: "Eligibility" },
];

for (const route of routes) {
  (globalThis as any).window = {
    location: { pathname: route.path },
    history: { pushState: () => undefined },
    setTimeout: () => 0,
    clearTimeout: () => undefined,
    requestAnimationFrame: () => 0,
    cancelAnimationFrame: () => undefined,
  } as unknown as Window;

  const markup = renderToStaticMarkup(
    createElement(ToastProvider, null,
      createElement(AuthProvider, { initialUser: user, children: createElement(AppShell) }),
    ),
  );

  if (!markup.includes(route.text)) {
    throw new Error(`Expected ${route.path} to render ${route.text}.`);
  }
  if (!markup.includes("Prototype mode. Redemptions are not currently enabled.")) {
    throw new Error(`Expected ${route.path} to render compliance copy.`);
  }
  if (["/terms", "/sweepstakes-rules", "/privacy", "/responsible-play", "/eligibility"].includes(route.path)
    && !markup.includes("Draft placeholder. Not legal advice. Must be reviewed by qualified counsel before launch.")) {
    throw new Error(`Expected ${route.path} to render legal placeholder copy.`);
  }
}

console.log("routes.devtest passed");
