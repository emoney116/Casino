import type { CasinoData } from "../types";

const STORAGE_KEY = "casino-prototype-data-v1";

const initialData: CasinoData = {
  users: [],
  passwordRecords: {},
  sessions: [],
  walletBalances: {},
  transactions: [],
  progression: {},
  streaks: {},
  missions: {},
  favorites: {},
  retention: {},
};

export function readData(): CasinoData {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return structuredClone(initialData);

  try {
    return { ...structuredClone(initialData), ...JSON.parse(raw) };
  } catch {
    return structuredClone(initialData);
  }
}

export function writeData(data: CasinoData) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function updateData(mutator: (data: CasinoData) => void): CasinoData {
  const data = readData();
  mutator(data);
  writeData(data);
  return data;
}

export function resetData() {
  localStorage.removeItem(STORAGE_KEY);
}
