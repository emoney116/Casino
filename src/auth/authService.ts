import type { User as SupabaseAuthUser } from "@supabase/supabase-js";
import { createId } from "../lib/ids";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { readData, updateData } from "../lib/storage";
import { getRepository, mirrorToBackend } from "../repositories";
import { setDebugAuthContext, setDebugAuthProvider, setLastAuthError, setLastMirrorError } from "../lib/debugState";
import { emptyBalances, refreshWalletFromRepository } from "../wallet/walletService";
import type { User, WalletBalances } from "../types";

export interface AuthResult {
  user: User | null;
  message?: string;
  requiresEmailConfirmation?: boolean;
}

const GENERIC_LOGIN_ERROR = "Invalid username/email or password.";

export const RESERVED_USERNAMES = new Set([
  "admin",
  "administrator",
  "support",
  "help",
  "playheater",
  "official",
  "staff",
  "moderator",
  "mod",
  "owner",
  "system",
  "security",
  "cashier",
  "vip",
  "host",
]);

export function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

export function normalizeUsername(username: string) {
  return username.trim().replace(/\s+/g, " ");
}

export function normalizeUsernameForLookup(username: string) {
  return normalizeUsername(username).toLowerCase();
}

export function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function getUsernameValidationError(usernameInput: string) {
  const username = normalizeUsername(usernameInput);
  const normalized = normalizeUsernameForLookup(username);
  if (username.length < 3) return "Username must be at least 3 characters.";
  if (username.length > 20) return "Username must be 20 characters or fewer.";
  if (!/^[a-zA-Z0-9_]+$/.test(username)) return "Use letters, numbers, and underscores only.";
  if (RESERVED_USERNAMES.has(normalized)) return "That username is reserved.";
  return "";
}

function validateUsername(username: string) {
  const error = getUsernameValidationError(username);
  if (error) throw new Error(error);
}

function validatePassword(password: string) {
  if (password.length < 8) throw new Error("Password must be at least 8 characters.");
}

function clearLocalSession() {
  updateData((data) => {
    data.sessions = [];
  });
}

function cacheUserLocally(user: User) {
  updateData((data) => {
    const existing = data.users.find((candidate) => candidate.id === user.id);
    if (existing) Object.assign(existing, user);
    else data.users.push(user);
    data.sessions = [{ userId: user.id, createdAt: new Date().toISOString() }];
    if (!data.walletBalances[user.id]) data.walletBalances[user.id] = { ...emptyBalances };
  });
}

function getLocalCurrentUser() {
  const data = readData();
  const session = data.sessions[0];
  if (!session) return null;
  return data.users.find((user) => user.id === session.userId) ?? null;
}

function isSupabaseEmailVerified(authUser: SupabaseAuthUser) {
  return Boolean(authUser.email_confirmed_at || authUser.confirmed_at);
}

function getSupabasePhone(authUser: SupabaseAuthUser) {
  return typeof authUser.phone === "string" && authUser.phone ? authUser.phone : undefined;
}

function getSupabasePhoneVerified(authUser: SupabaseAuthUser) {
  return Boolean((authUser as SupabaseAuthUser & { phone_confirmed_at?: string | null }).phone_confirmed_at);
}

function assertActiveAccount(user: User) {
  if (user.accountStatus === "ACTIVE") return;
  const label = user.accountStatus.toLowerCase();
  throw new Error(`This account is ${label}. Contact support if you believe this is a mistake.`);
}

export async function isUsernameAvailable(username: string) {
  const normalized = normalizeUsername(username);
  validateUsername(normalized);

  if (isSupabaseConfigured) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.rpc("is_username_available", { candidate: normalized });
    if (error) throw new Error(error.message);
    return Boolean(data);
  }

  const candidate = normalized.toLowerCase();
  return !readData().users.some((user) => user.username.trim().toLowerCase() === candidate);
}

async function resolveLoginEmail(identifierInput: string) {
  const identifier = identifierInput.trim();
  if (identifier.includes("@")) {
    const email = normalizeEmail(identifier);
    if (!validateEmail(email)) throw new Error(GENERIC_LOGIN_ERROR);
    return email;
  }

  const username = normalizeUsernameForLookup(identifier);
  if (!username) throw new Error(GENERIC_LOGIN_ERROR);

  if (isSupabaseConfigured) {
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase
      .from("profiles")
      .select("email")
      .eq("username_normalized", username)
      .maybeSingle();
    if (error || !data?.email) throw new Error(GENERIC_LOGIN_ERROR);
    return normalizeEmail(String(data.email));
  }

  const found = readData().users.find((user) => normalizeUsernameForLookup(user.username) === username);
  if (!found) throw new Error(GENERIC_LOGIN_ERROR);
  return normalizeEmail(found.email);
}

async function getSupabaseProfile(authUser: SupabaseAuthUser, fallbackUsername?: string): Promise<User> {
  if (!supabase) throw new Error("Supabase is not configured.");
  if (!authUser.email) throw new Error("Unable to load Supabase user email.");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", authUser.id).maybeSingle();
  if (error) throw new Error(error.message);

  const now = new Date().toISOString();
  const roles = data?.roles ?? (data?.role ? [data.role] : ["USER"]);
  const accountStatus = String(data?.account_status ?? "ACTIVE").toUpperCase() as User["accountStatus"];
  const user = {
    id: authUser.id,
    email: data?.email ?? authUser.email,
    username: data?.username ?? fallbackUsername ?? authUser.email.split("@")[0],
    createdAt: data?.created_at ?? now,
    lastLoginAt: data?.last_login_at ?? now,
    roles,
    accountStatus,
    emailVerified: isSupabaseEmailVerified(authUser),
    phone: getSupabasePhone(authUser),
    phoneVerified: getSupabasePhoneVerified(authUser),
    avatarDataUrl: data?.avatar_data_url ?? undefined,
  };
  setDebugAuthContext({
    authUserId: authUser.id,
    profileId: data?.id ?? authUser.id,
    username: user.username,
    supabaseConfigured: isSupabaseConfigured,
  });
  return user;
}

async function syncSupabaseUser(user: User, options: { initialBalances?: WalletBalances; createMissingBalance?: boolean } = {}) {
  cacheUserLocally(user);
  setDebugAuthContext({
    authUserId: user.id,
    profileId: user.id,
    username: user.username,
    supabaseConfigured: isSupabaseConfigured,
  });
  const repository = getRepository();
  try {
    if (repository.ensureUserFoundation) {
      await repository.ensureUserFoundation(user, { initialBalances: options.initialBalances });
    } else {
      await repository.syncProfile(user);
      await repository.ensureVipProgress(user.id);
    }
    console.log("auth foundation sync result/error", { ok: true });
  } catch (error) {
    console.log("auth foundation sync result/error", { ok: false, error });
    setLastMirrorError(error);
    throw error;
  }
  await refreshWalletFromRepository(user.id, {
    missingBalances: options.initialBalances,
    createMissingBalance: options.createMissingBalance ?? true,
  });
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return getLocalCurrentUser();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const authUser = data.session?.user;
  if (!authUser?.email) return null;

  const user = await getSupabaseProfile(authUser);
  try {
    assertActiveAccount(user);
  } catch (statusError) {
    setLastAuthError(statusError);
    await supabase.auth.signOut();
    clearLocalSession();
    return null;
  }
  await syncSupabaseUser(user, { createMissingBalance: true });
  return user;
}

export async function registerUser(emailInput: string, usernameInput: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(emailInput);
  const username = normalizeUsername(usernameInput);

  if (!validateEmail(email)) throw new Error("Enter a valid email address.");
  validateUsername(username);
  validatePassword(password);
  if (!(await isUsernameAvailable(username))) throw new Error("Username already taken.");

  if (isSupabaseConfigured) {
    setDebugAuthProvider("Supabase");
    console.log("Using Supabase Auth");
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { username } },
    });
    console.log("Supabase signup result/error", { userId: data.user?.id, hasSession: Boolean(data.session), error });
    if (error) {
      setLastAuthError(error);
      throw new Error(error.message);
    }
    if (!data.user?.id || !data.user.email) throw new Error("Supabase signup did not return a user.");
    if (!data.session) {
      setLastAuthError(undefined);
      return {
        user: null,
        requiresEmailConfirmation: true,
        message: "Account created. Check your email to confirm your account, then log in.",
      };
    }

    const user = await getSupabaseProfile(data.user, username);
    assertActiveAccount(user);
    const initialBalances = { GOLD: 0, BONUS: 1000 };
    updateData((localData) => {
      localData.walletBalances[user.id] = initialBalances;
    });
    await syncSupabaseUser(user, { initialBalances, createMissingBalance: true });
    setLastAuthError(undefined);
    return { user };
  }

  setDebugAuthProvider("Local fallback");
  console.log("Using local fallback auth");
  let user: User | undefined;
  updateData((data) => {
    if (data.users.some((candidate) => candidate.email === email)) {
      const error = new Error("An account with that email already exists.");
      setLastAuthError(error);
      throw error;
    }

    const now = new Date().toISOString();
    user = {
      id: createId("user"),
      email,
      username,
      createdAt: now,
      lastLoginAt: now,
      roles: ["USER"],
      accountStatus: "ACTIVE",
    };

    data.users.push(user);
    data.passwordRecords[email] = password;
    data.sessions = [{ userId: user.id, createdAt: now }];
    data.walletBalances[user.id] = { GOLD: 0, BONUS: 1000 };
  });

  mirrorToBackend(() => getRepository().syncProfile(user as User));
  setLastAuthError(undefined);
  return { user: user as User };
}

export async function loginUser(emailInput: string, password: string): Promise<AuthResult> {
  const email = await resolveLoginEmail(emailInput);

  if (isSupabaseConfigured) {
    setDebugAuthProvider("Supabase");
    console.log("Using Supabase Auth");
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log("Supabase login result/error", { userId: data.user?.id, hasSession: Boolean(data.session), error });
    if (error) {
      setLastAuthError(error);
      throw new Error(GENERIC_LOGIN_ERROR);
    }
    if (!data.user?.id || !data.user.email) throw new Error("Unable to load Supabase user.");

    const user = await getSupabaseProfile(data.user);
    assertActiveAccount(user);
    user.lastLoginAt = new Date().toISOString();
    await syncSupabaseUser(user, { createMissingBalance: true });
    setLastAuthError(undefined);
    return { user };
  }

  setDebugAuthProvider("Local fallback");
  console.log("Using local fallback auth");
  let user: User | undefined;
  updateData((data) => {
    const found = data.users.find((candidate) => candidate.email === email);
    if (!found || data.passwordRecords[email] !== password) {
      const error = new Error(GENERIC_LOGIN_ERROR);
      setLastAuthError(error);
      throw error;
    }
    if (found.accountStatus !== "ACTIVE") {
      const error = new Error("This account is not active.");
      setLastAuthError(error);
      throw error;
    }

    found.lastLoginAt = new Date().toISOString();
    data.sessions = [{ userId: found.id, createdAt: new Date().toISOString() }];
    user = found;
  });

  mirrorToBackend(() => getRepository().syncProfile(user as User));
  setLastAuthError(undefined);
  return { user: user as User };
}

export async function logoutUser() {
  if (isSupabaseConfigured && supabase) {
    const { error } = await supabase.auth.signOut();
    if (error) throw new Error(error.message);
  }
  clearLocalSession();
}

export async function requestPasswordReset(emailInput: string) {
  const email = normalizeEmail(emailInput);
  if (!validateEmail(email)) throw new Error("Enter a valid email address.");
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Password reset requires Supabase authentication.");
  }

  const redirectTo = typeof window === "undefined"
    ? undefined
    : `${window.location.origin}/reset-password`;
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });
  if (error) {
    setLastAuthError(error);
    throw new Error(error.message);
  }
  setLastAuthError(undefined);
}

export async function updatePasswordFromRecovery(password: string) {
  validatePassword(password);
  if (!isSupabaseConfigured || !supabase) {
    throw new Error("Password reset requires Supabase authentication.");
  }

  const { error } = await supabase.auth.updateUser({ password });
  if (error) {
    setLastAuthError(error);
    throw new Error(error.message);
  }
  setLastAuthError(undefined);
}
