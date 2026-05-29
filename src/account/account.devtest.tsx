import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { AuthProvider } from "../auth/AuthContext";
import { ToastProvider } from "../components/ToastContext";
import { BalanceToggle } from "../components/BalanceCard";
import { getDisplayBalances } from "../lib/displayBalanceStress";
import {
  formatCurrencyDisplay,
  formatCurrencyDisplayWithCode,
  formatCurrencyFullDisplay,
  getCurrencyAmountFitClass,
} from "../lib/format";
import { updateData } from "../lib/storage";
import { LegalPage, type LegalPageKind } from "../legal/LegalPage";
import type { CasinoData, User } from "../types";
import { getBalance } from "../wallet/walletService";
import { AccountPage, VipDetailsContent } from "./AccountPage";
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
import {
  getLifetimeSCWagered,
  getVipProgressForWagered,
  isVipWagerTransaction,
  vipTiers,
} from "./vipService";

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

const formatterCases = [
  [0, "GOLD", "0"],
  [999, "GOLD", "999"],
  [2_170, "BONUS", "2.17K"],
  [999_999, "GOLD", "999.9K"],
  [1_000_000, "GOLD", "1M"],
  [5_678_450, "GOLD", "5.68M"],
  [1_200_000_000, "GOLD", "1.2B"],
] as const;

for (const [amount, currency, expected] of formatterCases) {
  if (formatCurrencyDisplay(amount, currency) !== expected) {
    throw new Error(`Currency formatter expected ${amount} ${currency} to render as ${expected}.`);
  }
}

if (formatCurrencyDisplayWithCode(5_678_450.55, "BONUS") !== "5.68M SC") {
  throw new Error("Currency formatter should append the correct SC display code.");
}

if (formatCurrencyFullDisplay(5_678_450.55, "BONUS") !== "5,678,450.55") {
  throw new Error("Full currency formatter should preserve full SC balance values for wide balance cards.");
}

if (getCurrencyAmountFitClass("9,999,999,999.99") !== "currency-fit-long") {
  throw new Error("Large full currency values should use a tighter fit class.");
}

if (!validateDisplayName("") || !validateDisplayName("ab") || !validateDisplayName("bad/name")) {
  throw new Error("Display name validation should reject empty, short, and invalid names.");
}

const vipThresholdCases = [
  [0, "None"],
  [1_000, "Bronze"],
  [5_000, "Silver"],
  [25_000, "Gold"],
  [100_000, "Platinum"],
  [500_000, "Diamond"],
  [1_000_000, "Black Diamond"],
  [5_000_000, "Onyx"],
  [10_000_000, "Inferno"],
  [25_000_000, "Heater Elite"],
  [50_000_000, "Whale / Legend"],
] as const;

for (const [amount, tierName] of vipThresholdCases) {
  if (getVipProgressForWagered(amount).currentTier.name !== tierName) {
    throw new Error(`${amount} SC wagered should resolve to ${tierName}.`);
  }
}

const bronzeVipProgress = getVipProgressForWagered(2_420);
if (
  bronzeVipProgress.currentTier.name !== "Bronze" ||
  bronzeVipProgress.nextTier?.name !== "Silver" ||
  bronzeVipProgress.remainingToNext !== 2_580 ||
  Math.abs(bronzeVipProgress.progressPercent - 35.5) > 0.01
) {
  throw new Error("VIP progress to next tier should calculate remaining amount and tier-band progress.");
}

if (vipTiers.some((tier, index) => index > 0 && tier.threshold <= vipTiers[index - 1].threshold)) {
  throw new Error("VIP thresholds should increase monotonically.");
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

updateData((data) => {
  data.transactions.push(
    {
      id: "vip-user-sc-bet",
      userId: user.id,
      type: "GAME_BET",
      currency: "BONUS",
      amount: -2420,
      balanceAfter: 7580,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-sc-slot",
      userId: "vip-ledger-user",
      type: "GAME_BET",
      currency: "BONUS",
      amount: -1000,
      balanceAfter: 9000,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-sc-table",
      userId: "vip-ledger-user",
      type: "TABLE_BET",
      currency: "BONUS",
      amount: -1200,
      balanceAfter: 7800,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-sc-arcade",
      userId: "vip-ledger-user",
      type: "ARCADE_BET",
      currency: "BONUS",
      amount: -200,
      balanceAfter: 7600,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-sc-buy-bonus",
      userId: "vip-ledger-user",
      type: "BUY_BONUS",
      currency: "BONUS",
      amount: -20,
      balanceAfter: 7580,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-gc-bet",
      userId: "vip-ledger-user",
      type: "GAME_BET",
      currency: "GOLD",
      amount: -999999,
      balanceAfter: 0,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-sc-win",
      userId: "vip-ledger-user",
      type: "GAME_WIN",
      currency: "BONUS",
      amount: 999,
      balanceAfter: 8579,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-sc-grant",
      userId: "vip-ledger-user",
      type: "SWEEPS_BONUS_GRANT",
      currency: "BONUS",
      amount: 500,
      balanceAfter: 9079,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-gc-purchase",
      userId: "vip-ledger-user",
      type: "GOLD_PURCHASE_DEMO",
      currency: "GOLD",
      amount: 5000,
      balanceAfter: 5000,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-sc-refund",
      userId: "vip-ledger-user",
      type: "TABLE_REFUND",
      currency: "BONUS",
      amount: 20,
      balanceAfter: 9099,
      status: "COMPLETED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
    {
      id: "vip-ledger-failed-sc-bet",
      userId: "vip-ledger-user",
      type: "GAME_BET",
      currency: "BONUS",
      amount: -777,
      balanceAfter: 9099,
      status: "FAILED",
      createdAt: new Date().toISOString(),
      metadata: {},
    },
  );
});

if (getLifetimeSCWagered("vip-ledger-user") !== 2420) {
  throw new Error("VIP lifetime SC wagered should count only SC bet/wager debits.");
}

if (
  !isVipWagerTransaction({ type: "GAME_BET", currency: "BONUS", amount: -1 }) ||
  isVipWagerTransaction({ type: "GAME_BET", currency: "GOLD", amount: -1 }) ||
  isVipWagerTransaction({ type: "GAME_BET", currency: "BONUS", amount: -1, status: "FAILED" }) ||
  isVipWagerTransaction({ type: "GAME_WIN", currency: "BONUS", amount: 1 }) ||
  isVipWagerTransaction({ type: "SWEEPS_BONUS_GRANT", currency: "BONUS", amount: 1 }) ||
  isVipWagerTransaction({ type: "GOLD_PURCHASE_DEMO", currency: "GOLD", amount: 1 })
) {
  throw new Error("VIP wager predicate should exclude GC bets, wins, purchases, and grants.");
}

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

updateData((data) => {
  data.walletBalances[user.id] = { GOLD: 5_678_450, BONUS: 5_678_450.55 };
});

const accountMarkup = renderAccount({ ...user, username: "FreshName" });
for (const expected of [
  "FreshName",
  "Member since May 1, 2026",
  "5,678,450",
  "5,678,450.55",
  "currency-fit-medium",
  'aria-label="VIP: Bronze"',
  "vip_bronze.png",
  "VIP Status",
  "Bronze",
  "2,420 SC",
  "Silver at 5,000 SC",
  "2,580 SC to go",
  "View VIP",
  "VIP perks are promotional and subject to change.",
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

const storedHugeBalance = getBalance(user.id);
if (storedHugeBalance.GOLD !== 5_678_450 || storedHugeBalance.BONUS !== 5_678_450.55) {
  throw new Error("Display formatting should not mutate stored balances.");
}

const balanceToggleGoldMarkup = renderToStaticMarkup(
  createElement(BalanceToggle, {
    balances: { GOLD: 9_999_999_999, BONUS: 5_678_450.55 },
    selected: "GOLD",
    expanded: false,
    onSelect: () => undefined,
    onToggleExpanded: () => undefined,
  }),
);
const balanceToggleSweepsMarkup = renderToStaticMarkup(
  createElement(BalanceToggle, {
    balances: { GOLD: 9_999_999_999, BONUS: 5_678_450.55 },
    selected: "BONUS",
    expanded: false,
    onSelect: () => undefined,
    onToggleExpanded: () => undefined,
  }),
);
if (!balanceToggleGoldMarkup.includes("10B GC") || !balanceToggleSweepsMarkup.includes("5.68M SC")) {
  throw new Error("Header balance pill should handle billion and million display balances.");
}

const stressBalances = getDisplayBalances({ GOLD: 24_999, BONUS: 999.99 });
if (stressBalances.GOLD !== 24_999 || stressBalances.BONUS !== 999.99) {
  throw new Error("Display stress helper should leave balances untouched when disabled.");
}

if (!accountMarkup.includes("disabled")) {
  throw new Error("Initial save button should be disabled when no valid changes exist.");
}

if (accountMarkup.includes("<span>Gold Coins</span>") || accountMarkup.includes("<span>Sweeps Coins</span>")) {
  throw new Error("Account balance rows should not render visible coin-name labels.");
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
  "View VIP status",
  "TBD",
  "Tier levels coming soon",
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

const noneVipMarkup = renderAccount(otherUser);
if (noneVipMarkup.includes("account-hero-vip-mark")) {
  throw new Error("Account hero should not render a VIP image for the None tier.");
}
if (!noneVipMarkup.includes("vip_none.png")) {
  throw new Error("VIP status card should render the None badge image.");
}

const vipModalMarkup = renderToStaticMarkup(createElement(VipDetailsContent, { vip: bronzeVipProgress }));
for (const expected of [
  "Tier Ladder",
  "Bronze",
  "Silver at 5,000 SC",
  "Whale / Legend",
  "vip_none.png",
  "vip_bronze.png",
  "vip_silver.png",
  "vip_gold.png",
  "vip_platinum.png",
  "vip_diamond.png",
  "vip_black_diamond.png",
  "vip_onyx.png",
  "vip_inferno.png",
  "vip_heater_elite.png",
  "vip_legend.png",
  "VIP status is based on Sweeps Coins gameplay activity. Perks are promotional and may change.",
]) {
  if (!vipModalMarkup.includes(expected)) {
    throw new Error(`VIP modal should render: ${expected}`);
  }
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
