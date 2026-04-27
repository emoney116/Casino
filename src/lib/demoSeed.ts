import { createId } from "./ids";
import { readData, writeData } from "./storage";
import type { User } from "../types";

export function seedDemoAdmin() {
  const data = readData();
  const hasAdmin = data.users.some((user) => user.roles.includes("ADMIN"));
  if (hasAdmin) return;

  const now = new Date().toISOString();
  const admin: User = {
    id: createId("user"),
    email: "admin@demo.local",
    username: "DemoAdmin",
    createdAt: now,
    lastLoginAt: now,
    roles: ["USER", "ADMIN"],
    accountStatus: "ACTIVE",
  };

  data.users.push(admin);
  data.passwordRecords[admin.email] = "admin123";
  data.walletBalances[admin.id] = { GOLD: 25000, BONUS: 5000 };
  writeData(data);
}

export function seedDemoUsers() {
  const data = readData();
  const now = new Date().toISOString();
  const seeds = [
    { email: "player1@demo.local", username: "NeonPlayer", gold: 15000, bonus: 2500 },
    { email: "player2@demo.local", username: "LuckyTester", gold: 8000, bonus: 6000 },
  ];

  for (const seed of seeds) {
    if (data.users.some((user) => user.email === seed.email)) continue;
    const user: User = {
      id: createId("user"),
      email: seed.email,
      username: seed.username,
      createdAt: now,
      lastLoginAt: now,
      roles: ["USER"],
      accountStatus: "ACTIVE",
    };
    data.users.push(user);
    data.passwordRecords[user.email] = "demo123";
    data.walletBalances[user.id] = { GOLD: seed.gold, BONUS: seed.bonus };
  }

  writeData(data);
}
