import { readData, updateData } from "../lib/storage";
import { getRepository, mirrorToBackend } from "../repositories";
import type { Currency, TransactionType } from "../types";

export type SessionReminderMinutes = 15 | 30 | 60;

export interface ResponsiblePlaySettings {
  sessionReminderEnabled: boolean;
  sessionReminderMinutes: SessionReminderMinutes;
  spendingLimitEnabled: boolean;
  dailyGcLimit: number;
  selfExclusionEnabled: boolean;
  selfExclusionStartedAt?: string;
}

export interface AccountProfilePreferences {
  displayName?: string;
  avatarDataUrl?: string;
  responsiblePlay: ResponsiblePlaySettings;
}

export const PROFILE_IMAGE_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";
export const PROFILE_IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
export const RESPONSIBLE_PLAY_UPDATED_EVENT = "playheater:responsible-play-updated";
export const SELF_EXCLUSION_WARNING =
  "This will lock gameplay, coin purchases, and wagering in this prototype. Access can only be restored after review by the support team.";

export const defaultResponsiblePlaySettings: ResponsiblePlaySettings = {
  sessionReminderEnabled: true,
  sessionReminderMinutes: 30,
  spendingLimitEnabled: false,
  dailyGcLimit: 10000,
  selfExclusionEnabled: false,
};

const PROFILE_PREFS_PREFIX = "playheater-profile-preferences-v1";
const RESPONSIBLE_PLAY_SPEND_TYPES = new Set<TransactionType>(["GAME_BET", "TABLE_BET", "ARCADE_BET", "BUY_BONUS"]);

function profilePrefsKey(userId: string) {
  return `${PROFILE_PREFS_PREFIX}:${userId}`;
}

export function normalizeDisplayName(value: string) {
  return value.trim().replace(/\s+/g, " ");
}

function comparableDisplayName(value: string) {
  return normalizeDisplayName(value).toLowerCase();
}

function localAvatarDataUrl(userId: string) {
  if (typeof localStorage === "undefined") return undefined;
  return readData().users.find((user) => user.id === userId)?.avatarDataUrl;
}

function isSameLocalDate(left: Date, right: Date) {
  return left.getFullYear() === right.getFullYear()
    && left.getMonth() === right.getMonth()
    && left.getDate() === right.getDate();
}

function emitResponsiblePlayUpdated(userId: string, settings: ResponsiblePlaySettings) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent(RESPONSIBLE_PLAY_UPDATED_EVENT, { detail: { userId, settings } }));
}

export function validateDisplayName(value: string) {
  const name = normalizeDisplayName(value);
  if (!name) return "Display name is required.";
  if (name.length < 3) return "Use at least 3 characters.";
  if (name.length > 24) return "Use 24 characters or fewer.";
  if (!/^[a-zA-Z0-9][a-zA-Z0-9 ._-]*$/.test(name)) {
    return "Use letters, numbers, spaces, dots, underscores, or hyphens.";
  }
  return "";
}

export function checkDisplayNameAvailable(name: string, currentUserId: string) {
  const candidate = comparableDisplayName(name);
  if (!candidate) return false;
  return !readData().users.some((user) => user.id !== currentUserId && comparableDisplayName(user.username) === candidate);
}

export function getDisplayNameError(name: string, currentUserId: string, currentDisplayName: string) {
  const validationError = validateDisplayName(name);
  if (validationError) return validationError;
  if (comparableDisplayName(name) !== comparableDisplayName(currentDisplayName) && !checkDisplayNameAvailable(name, currentUserId)) {
    return "Display name already taken.";
  }
  return "";
}

export function canSaveAccountProfile(input: {
  displayName: string;
  savedDisplayName: string;
  userId: string;
  avatarChanged: boolean;
  avatarError?: string;
}) {
  const displayNameChanged = normalizeDisplayName(input.displayName) !== normalizeDisplayName(input.savedDisplayName);
  const displayNameError = getDisplayNameError(input.displayName, input.userId, input.savedDisplayName);
  return displayNameChanged && !displayNameError;
}

export function getProfileImageValidationError(file: Pick<File, "type" | "size">) {
  if (!PROFILE_IMAGE_TYPES.has(file.type)) return "Image must be JPG, PNG, or WebP.";
  if (file.size > PROFILE_IMAGE_MAX_BYTES) return "Image must be 10 MB or smaller.";
  return "";
}

export function saveDisplayName(userId: string, displayName: string) {
  const normalized = normalizeDisplayName(displayName);
  const validationError = validateDisplayName(normalized);
  if (validationError) throw new Error(validationError);
  if (!checkDisplayNameAvailable(normalized, userId)) throw new Error("Display name already taken.");

  let saved = false;
  let savedUser = undefined as ReturnType<typeof readData>["users"][number] | undefined;
  updateData((data) => {
    const user = data.users.find((candidate) => candidate.id === userId);
    if (!user) return;
    user.username = normalized;
    savedUser = { ...user };
    saved = true;
  });
  const current = getProfilePreferences(userId);
  saveProfilePreferences(userId, {
    ...current,
    displayName: normalized,
  });
  const userToMirror = savedUser;
  if (userToMirror) mirrorToBackend(() => getRepository().syncProfile(userToMirror));
  if (!saved && readData().users.length > 0) throw new Error("Unable to save profile.");
  return normalized;
}

export function getProfilePreferences(userId: string): AccountProfilePreferences {
  const repository = getRepository();
  const repositoryAvatarDataUrl = localAvatarDataUrl(userId);
  const fallback = {
    avatarDataUrl: repositoryAvatarDataUrl,
    responsiblePlay: { ...defaultResponsiblePlaySettings },
  };
  if (typeof localStorage === "undefined") return fallback;

  try {
    const raw = localStorage.getItem(profilePrefsKey(userId));
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<AccountProfilePreferences>;
    return {
      displayName: typeof parsed.displayName === "string" ? parsed.displayName : undefined,
      avatarDataUrl: repository.mode === "supabase"
        ? repositoryAvatarDataUrl
        : typeof parsed.avatarDataUrl === "string"
          ? parsed.avatarDataUrl
          : fallback.avatarDataUrl,
      responsiblePlay: {
        ...defaultResponsiblePlaySettings,
        ...(parsed.responsiblePlay ?? {}),
      },
    };
  } catch {
    return fallback;
  }
}

export function saveProfilePreferences(userId: string, preferences: AccountProfilePreferences) {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(profilePrefsKey(userId), JSON.stringify(preferences));
}

function cacheAvatarDataUrl(userId: string, avatarDataUrl?: string) {
  let savedUser = undefined as ReturnType<typeof readData>["users"][number] | undefined;
  updateData((data) => {
    const user = data.users.find((candidate) => candidate.id === userId);
    if (!user) return;
    if (avatarDataUrl) user.avatarDataUrl = avatarDataUrl;
    else delete user.avatarDataUrl;
    savedUser = { ...user };
  });
  return savedUser;
}

export async function saveAvatarDataUrl(userId: string, avatarDataUrl?: string) {
  const current = getProfilePreferences(userId);
  const repository = getRepository();

  if (repository.mode === "supabase") {
    if (repository.syncProfileAvatar) await repository.syncProfileAvatar(userId, avatarDataUrl);
    const savedUser = cacheAvatarDataUrl(userId, avatarDataUrl);
    if (!savedUser && readData().users.length > 0) throw new Error("Unable to save profile photo.");
    return;
  }

  const savedUser = cacheAvatarDataUrl(userId, avatarDataUrl);
  saveProfilePreferences(userId, {
    ...current,
    avatarDataUrl: avatarDataUrl || undefined,
  });
  if (savedUser) {
    mirrorToBackend(async () => {
      if (repository.syncProfileAvatar) await repository.syncProfileAvatar(userId, avatarDataUrl);
      else await repository.syncProfile(savedUser);
    });
  }
}

export function saveResponsiblePlaySettings(userId: string, settings: ResponsiblePlaySettings) {
  const current = getProfilePreferences(userId);
  saveProfilePreferences(userId, {
    ...current,
    responsiblePlay: settings,
  });
  emitResponsiblePlayUpdated(userId, settings);
}

export function isSelfExcluded(userId: string) {
  return getProfilePreferences(userId).responsiblePlay.selfExclusionEnabled;
}

export function assertCanPurchaseCoins(userId: string) {
  if (!isSelfExcluded(userId)) return;
  throw new Error("Self-exclusion is active. Coin purchases are locked until the support team reviews the account.");
}

export function getDailyGcSpent(userId: string, now = new Date()) {
  return readData().transactions
    .filter((transaction) => {
      if (transaction.userId !== userId || transaction.currency !== "GOLD" || transaction.amount >= 0) return false;
      if (!RESPONSIBLE_PLAY_SPEND_TYPES.has(transaction.type)) return false;
      return isSameLocalDate(new Date(transaction.createdAt), now);
    })
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
}

export function assertResponsiblePlayAllowsDebit(input: {
  userId: string;
  type: TransactionType;
  currency: Currency;
  amount: number;
}) {
  const settings = getProfilePreferences(input.userId).responsiblePlay;
  if (settings.selfExclusionEnabled && RESPONSIBLE_PLAY_SPEND_TYPES.has(input.type)) {
    throw new Error("Self-exclusion is active. Gameplay and wagering are locked until the support team reviews the account.");
  }
  if (!settings.spendingLimitEnabled || input.currency !== "GOLD" || !RESPONSIBLE_PLAY_SPEND_TYPES.has(input.type)) return;

  const spentToday = getDailyGcSpent(input.userId);
  if (spentToday + input.amount > settings.dailyGcLimit) {
    throw new Error("Daily GC spending limit reached.");
  }
}
