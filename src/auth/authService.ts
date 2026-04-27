import { createId } from "../lib/ids";
import { isSupabaseConfigured, supabase } from "../lib/supabaseClient";
import { readData, updateData } from "../lib/storage";
import { getRepository, mirrorToBackend } from "../repositories";
import { setDebugAuthProvider, setLastAuthError, setLastMirrorError } from "../lib/debugState";
import { emptyBalances } from "../wallet/walletService";
import type { User } from "../types";

export interface AuthResult {
  user: User;
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function validateEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
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

async function getSupabaseProfile(authUserId: string, email: string): Promise<User> {
  if (!supabase) throw new Error("Supabase is not configured.");
  const { data, error } = await supabase.from("profiles").select("*").eq("id", authUserId).maybeSingle();
  if (error) throw new Error(error.message);

  const now = new Date().toISOString();
  const roles = data?.roles ?? (data?.role ? [data.role] : ["USER"]);
  return {
    id: authUserId,
    email: data?.email ?? email,
    username: data?.username ?? email.split("@")[0],
    createdAt: data?.created_at ?? now,
    lastLoginAt: data?.last_login_at ?? now,
    roles,
    accountStatus: data?.account_status ?? "ACTIVE",
  };
}

async function syncSupabaseUser(user: User) {
  cacheUserLocally(user);
  const repository = getRepository();
  try {
    await repository.syncProfile(user);
    console.log("profile sync result/error", { ok: true });
  } catch (error) {
    console.log("profile sync result/error", { ok: false, error });
    setLastMirrorError(error);
    throw error;
  }
  try {
    await repository.syncWalletBalance(user.id, readData().walletBalances[user.id] ?? { GOLD: 0, BONUS: 1000 });
    console.log("wallet init result/error", { ok: true });
  } catch (error) {
    console.log("wallet init result/error", { ok: false, error });
    setLastMirrorError(error);
    throw error;
  }
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured) return getLocalCurrentUser();
  if (!supabase) return null;

  const { data, error } = await supabase.auth.getSession();
  if (error) throw new Error(error.message);
  const authUser = data.session?.user;
  if (!authUser?.email) return null;

  const user = await getSupabaseProfile(authUser.id, authUser.email);
  cacheUserLocally(user);
  return user;
}

export async function registerUser(emailInput: string, usernameInput: string, password: string): Promise<AuthResult> {
  const email = normalizeEmail(emailInput);
  const username = usernameInput.trim();

  if (!validateEmail(email)) throw new Error("Enter a valid email address.");
  if (username.length < 3) throw new Error("Username must be at least 3 characters.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

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
      throw new Error("Signup created. Confirm the email or disable email confirmations for this prototype, then log in.");
    }

    const now = new Date().toISOString();
    const user: User = {
      id: data.user.id,
      email: data.user.email,
      username,
      createdAt: now,
      lastLoginAt: now,
      roles: ["USER"],
      accountStatus: "ACTIVE",
    };
    updateData((localData) => {
      localData.walletBalances[user.id] = { GOLD: 0, BONUS: 1000 };
    });
    await syncSupabaseUser(user);
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
  const email = normalizeEmail(emailInput);

  if (isSupabaseConfigured) {
    setDebugAuthProvider("Supabase");
    console.log("Using Supabase Auth");
    if (!supabase) throw new Error("Supabase is not configured.");
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    console.log("Supabase login result/error", { userId: data.user?.id, hasSession: Boolean(data.session), error });
    if (error) {
      setLastAuthError(error);
      throw new Error(error.message);
    }
    if (!data.user?.id || !data.user.email) throw new Error("Unable to load Supabase user.");

    const user = await getSupabaseProfile(data.user.id, data.user.email);
    user.lastLoginAt = new Date().toISOString();
    updateData((localData) => {
      if (!localData.walletBalances[user.id]) localData.walletBalances[user.id] = { GOLD: 0, BONUS: 1000 };
    });
    await syncSupabaseUser(user);
    setLastAuthError(undefined);
    return { user };
  }

  setDebugAuthProvider("Local fallback");
  console.log("Using local fallback auth");
  let user: User | undefined;
  updateData((data) => {
    const found = data.users.find((candidate) => candidate.email === email);
    if (!found || data.passwordRecords[email] !== password) {
      const error = new Error("Email or password is incorrect.");
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
  updateData((data) => {
    data.sessions = [];
  });
}
