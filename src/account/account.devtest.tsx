import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/ToastContext";
import { updateData } from "../lib/storage";
import { LegalPage, type LegalPageKind } from "../legal/LegalPage";
import type { CasinoData, User } from "../types";
import { AccountPage } from "./AccountPage";
import {
  SELF_EXCLUSION_WARNING,
  assertCanPurchaseCoins,
  assertResponsiblePlayAllowsDebit,
  canSaveAccountProfile,
  checkDisplayNameAvailable,
  getDailyGcSpent,
  getDisplayNameError,
  getProfilePreferences,
  isSelfExcluded,
  saveAvatarDataUrl,
  saveDisplayName,
  saveResponsiblePlaySettings,
  validateDisplayName,
} from "./profileService";

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

(globalThis as any).window = {
  location: { pathname: "/account" },
  history: { pushState: () => undefined },
  setTimeout: () => 0,
  clearTimeout: () => undefined,
  requestAnimationFrame: () => 0,
  cancelAnimationFrame: () => undefined,
} as unknown as Window;

const user: User = {
  id: "account-test-user",
  email: "account@test.local",
  username: "HeaterPlayer",
  createdAt: "2026-05-01T12:00:00.000Z",
  lastLoginAt: "2026-05-28T12:00:00.000Z",
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const otherUser: User = {
  id: "account-other-user",
  email: "other@test.local",
  username: "TakenName",
  createdAt: "2026-05-01T12:00:00.000Z",
  lastLoginAt: "2026-05-28T12:00:00.000Z",
  roles: ["USER"],
  accountStatus: "ACTIVE",
};

const seed: Partial<CasinoData> = {
  users: [user, otherUser],
  passwordRecords: {},
  sessions: [{ userId: user.id, createdAt: new Date().toISOString() }],
  walletBalances: { [user.id]: { GOLD: 3200, BONUS: 45 } },
  transactions: [],
  progression: {
    [user.id]: {
      userId: user.id,
      level: 4,
      xp: 0,
      lifetimeSpins: 20,
      lifetimeWins: 8,
      lifetimeWagered: 0,
      lifetimeWon: 0,
      biggestWin: 0,
      currentStreakDays: 3,
      boosts: {},
    },
  },
  streaks: { [user.id]: { userId: user.id, day: 3, currentStreakDays: 3 } },
  missions: {},
  favorites: {},
  retention: {},
  redemptionRequests: [],
  kycStatuses: { [user.id]: "NOT_STARTED" },
  eligibilityFlags: {},
};

localStorage.setItem("casino-prototype-data-v1", JSON.stringify(seed));

function count(markup: string, text: string) {
  return markup.split(text).length - 1;
}

function renderAccount(renderUser: User = user) {
  return renderToStaticMarkup(
    createElement(ToastProvider, null,
      createElement(AuthProvider, { initialUser: renderUser, children: createElement(AccountPage) }),
    ),
  );
}

if (!validateDisplayName("") || !validateDisplayName("ab") || !validateDisplayName("bad/name")) {
  throw new Error("Display name validation should reject empty, short, and invalid names.");
}

if (validateDisplayName("Heater Player_24")) {
  throw new Error("Display name validation should allow reasonable display names.");
}

if (checkDisplayNameAvailable("TakenName", user.id)) {
  throw new Error("Duplicate display names should not be available.");
}

if (getDisplayNameError("TakenName", user.id, user.username) !== "Display name already taken.") {
  throw new Error("Duplicate display name should show the required error.");
}

if (
  canSaveAccountProfile({ displayName: user.username, savedDisplayName: user.username, userId: user.id, avatarChanged: false }) ||
  canSaveAccountProfile({ displayName: "TakenName", savedDisplayName: user.username, userId: user.id, avatarChanged: false }) ||
  !canSaveAccountProfile({ displayName: "FreshName", savedDisplayName: user.username, userId: user.id, avatarChanged: false }) ||
  canSaveAccountProfile({ displayName: user.username, savedDisplayName: user.username, userId: user.id, avatarChanged: true })
) {
  throw new Error("Save state should only enable for valid display name changes; avatar saves automatically.");
}

try {
  saveDisplayName(user.id, "TakenName");
  throw new Error("Duplicate save should fail.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Display name already taken.") throw error;
}

const savedName = saveDisplayName(user.id, "FreshName");
if (savedName !== "FreshName" || !memory["casino-prototype-data-v1"].includes('"username":"FreshName"')) {
  throw new Error("Saving a display name should persist to local profile data.");
}

const avatarDataUrl = "data:image/png;base64,abc123";
saveAvatarDataUrl(user.id, avatarDataUrl);
if (getProfilePreferences(user.id).avatarDataUrl !== avatarDataUrl) {
  throw new Error("Avatar data URL should persist locally.");
}
if (!memory["casino-prototype-data-v1"].includes('"avatarDataUrl":"data:image/png;base64,abc123"')) {
  throw new Error("Avatar data URL should persist into local profile data.");
}

saveResponsiblePlaySettings(user.id, {
  sessionReminderEnabled: true,
  sessionReminderMinutes: 60,
  spendingLimitEnabled: true,
  dailyGcLimit: 2500,
  selfExclusionEnabled: true,
  selfExclusionStartedAt: "2026-05-28T12:00:00.000Z",
});

const responsiblePlay = getProfilePreferences(user.id).responsiblePlay;
if (
  !responsiblePlay.sessionReminderEnabled ||
  responsiblePlay.sessionReminderMinutes !== 60 ||
  !responsiblePlay.spendingLimitEnabled ||
  responsiblePlay.dailyGcLimit !== 2500 ||
  !isSelfExcluded(user.id)
) {
  throw new Error("Responsible play controls should persist locally.");
}

if (!SELF_EXCLUSION_WARNING.includes("coin purchases") || !SELF_EXCLUSION_WARNING.includes("support team")) {
  throw new Error("Self-exclusion warning should explain purchases and support review.");
}

try {
  assertCanPurchaseCoins(user.id);
  throw new Error("Self-exclusion should block coin purchases.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Coin purchases are locked")) throw error;
}

try {
  assertResponsiblePlayAllowsDebit({ userId: user.id, type: "GAME_BET", currency: "GOLD", amount: 1 });
  throw new Error("Self-exclusion should block gameplay debit.");
} catch (error) {
  if (!(error instanceof Error) || !error.message.includes("Self-exclusion is active")) throw error;
}

saveResponsiblePlaySettings(otherUser.id, {
  sessionReminderEnabled: false,
  sessionReminderMinutes: 30,
  spendingLimitEnabled: true,
  dailyGcLimit: 100,
  selfExclusionEnabled: false,
});
updateData((data) => {
  data.transactions.push({
    id: "limit-test-tx",
    userId: otherUser.id,
    type: "GAME_BET",
    currency: "GOLD",
    amount: -75,
    balanceAfter: 25,
    status: "COMPLETED",
    createdAt: new Date().toISOString(),
    metadata: {},
  });
});
if (getDailyGcSpent(otherUser.id) !== 75) {
  throw new Error("Daily GC spend should sum today's qualifying GOLD debits.");
}
assertResponsiblePlayAllowsDebit({ userId: otherUser.id, type: "GAME_BET", currency: "GOLD", amount: 25 });
try {
  assertResponsiblePlayAllowsDebit({ userId: otherUser.id, type: "GAME_BET", currency: "GOLD", amount: 26 });
  throw new Error("Daily spending limit should block excess GC spend.");
} catch (error) {
  if (!(error instanceof Error) || error.message !== "Daily GC spending limit reached.") throw error;
}

const accountMarkup = renderAccount({ ...user, username: "FreshName" });
for (const expected of [
  "FreshName",
  "Change profile photo",
  'type="file"',
  'accept="image/*"',
  avatarDataUrl,
  'aria-readonly="true"',
  "Every 60 min",
  "2,500 GC daily",
  "Self-exclusion",
  SELF_EXCLUSION_WARNING,
  "Verification will be required before redemptions.",
  "Support / Legal",
  "Logout",
]) {
  if (!accountMarkup.includes(expected)) {
    throw new Error(`Account page should render: ${expected}`);
  }
}

if (!accountMarkup.includes("disabled")) {
  throw new Error("Initial save button should be disabled when no valid changes exist.");
}

for (const removed of [
  "Player Profile",
  "Account Actions",
  "Profile photo",
  "Email is locked for this account.",
  "Profile is current",
  "Unsaved changes",
  "End this session",
  "Gameplay locked",
  "Requires confirmation",
  "Prototype mode. Redemptions are not currently enabled.",
  "Gold Coins have no cash value.",
]) {
  if (accountMarkup.includes(removed)) {
    throw new Error(`Account page should not render removed copy: ${removed}`);
  }
}

if (accountMarkup.indexOf("Support / Legal") > accountMarkup.indexOf("Logout")) {
  throw new Error("Logout should render at the bottom after Support / Legal.");
}

const legalKinds: LegalPageKind[] = ["support", "terms", "privacy", "sweepstakesRules", "responsiblePlay", "eligibility"];
for (const kind of legalKinds) {
  const legalMarkup = renderToStaticMarkup(createElement(LegalPage, { kind }));
  if (!legalMarkup.includes('href="/account"') || !legalMarkup.includes("Account")) {
    throw new Error(`${kind} page should include a back button to Account.`);
  }
  if (!legalMarkup.includes("Draft placeholder. Not legal advice. Must be reviewed by qualified counsel before launch.")) {
    throw new Error(`${kind} page should include legal disclaimer.`);
  }
  if (count(legalMarkup, "<li>") < 3) {
    throw new Error(`${kind} page should render useful structured draft content.`);
  }
}

console.log("account.devtest passed");
