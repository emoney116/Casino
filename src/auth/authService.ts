import { createId } from "../lib/ids";
import { readData, updateData } from "../lib/storage";
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

export function getCurrentUser() {
  const data = readData();
  const session = data.sessions[0];
  if (!session) return null;
  return data.users.find((user) => user.id === session.userId) ?? null;
}

export function registerUser(emailInput: string, usernameInput: string, password: string): AuthResult {
  const email = normalizeEmail(emailInput);
  const username = usernameInput.trim();

  if (!validateEmail(email)) throw new Error("Enter a valid email address.");
  if (username.length < 3) throw new Error("Username must be at least 3 characters.");
  if (password.length < 6) throw new Error("Password must be at least 6 characters.");

  let user: User | undefined;
  updateData((data) => {
    if (data.users.some((candidate) => candidate.email === email)) {
      throw new Error("An account with that email already exists.");
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

  return { user: user as User };
}

export function loginUser(emailInput: string, password: string): AuthResult {
  const email = normalizeEmail(emailInput);
  let user: User | undefined;

  updateData((data) => {
    const found = data.users.find((candidate) => candidate.email === email);
    if (!found || data.passwordRecords[email] !== password) {
      throw new Error("Email or password is incorrect.");
    }
    if (found.accountStatus !== "ACTIVE") {
      throw new Error("This account is not active.");
    }

    found.lastLoginAt = new Date().toISOString();
    data.sessions = [{ userId: found.id, createdAt: new Date().toISOString() }];
    user = found;
  });

  return { user: user as User };
}

export function logoutUser() {
  updateData((data) => {
    data.sessions = [];
  });
}
