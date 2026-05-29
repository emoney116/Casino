import { readData } from "../lib/storage";
import type { TransactionStatus, TransactionType } from "../types";

export type VipTierId =
  | "none"
  | "bronze"
  | "silver"
  | "gold"
  | "platinum"
  | "diamond"
  | "black-diamond"
  | "onyx"
  | "inferno"
  | "heater-elite"
  | "legend";

export interface VipTierConfig {
  id: VipTierId;
  name: string;
  threshold: number;
  accent: string;
  benefits: string[];
}

export interface VipProgress {
  lifetimeSCWagered: number;
  currentTier: VipTierConfig;
  nextTier?: VipTierConfig;
  progressPercent: number;
  remainingToNext: number;
}

export const VIP_LEDGER_UPDATED_EVENT = "playheater:vip-ledger-updated";

export const VIP_WAGER_TRANSACTION_TYPES = new Set<TransactionType>([
  "GAME_BET",
  "TABLE_BET",
  "ARCADE_BET",
  "BUY_BONUS",
]);

export const vipTiers: VipTierConfig[] = [
  {
    id: "none",
    name: "None",
    threshold: 0,
    accent: "none",
    benefits: ["Start playing with Sweeps Coins to unlock VIP status."],
  },
  {
    id: "bronze",
    name: "Bronze",
    threshold: 1_000,
    accent: "bronze",
    benefits: ["Daily GC boost", "Small loyalty badge"],
  },
  {
    id: "silver",
    name: "Silver",
    threshold: 5_000,
    accent: "silver",
    benefits: ["Higher daily GC boost", "Priority promo access"],
  },
  {
    id: "gold",
    name: "Gold",
    threshold: 25_000,
    accent: "gold",
    benefits: ["Weekly GC bonus", "Exclusive missions"],
  },
  {
    id: "platinum",
    name: "Platinum",
    threshold: 100_000,
    accent: "platinum",
    benefits: ["Higher promo access", "VIP badge"],
  },
  {
    id: "diamond",
    name: "Diamond",
    threshold: 500_000,
    accent: "diamond",
    benefits: ["Diamond badge", "Future VIP event access"],
  },
  {
    id: "black-diamond",
    name: "Black Diamond",
    threshold: 1_000_000,
    accent: "black-diamond",
    benefits: ["Black Diamond badge", "Future VIP support placeholder"],
  },
  {
    id: "onyx",
    name: "Onyx",
    threshold: 5_000_000,
    accent: "onyx",
    benefits: ["Onyx badge", "Enhanced promotional access"],
  },
  {
    id: "inferno",
    name: "Inferno",
    threshold: 10_000_000,
    accent: "inferno",
    benefits: ["Inferno badge", "Future premium missions"],
  },
  {
    id: "heater-elite",
    name: "Heater Elite",
    threshold: 25_000_000,
    accent: "heater-elite",
    benefits: ["Heater Elite badge", "Future host/support placeholder"],
  },
  {
    id: "legend",
    name: "Whale / Legend",
    threshold: 50_000_000,
    accent: "legend",
    benefits: ["Legend badge", "Top promotional tier"],
  },
];

export function isVipWagerTransaction(transaction: {
  type: TransactionType;
  currency: string;
  amount: number;
  status?: TransactionStatus;
}) {
  return transaction.currency === "BONUS"
    && transaction.amount < 0
    && (!transaction.status || transaction.status === "COMPLETED")
    && VIP_WAGER_TRANSACTION_TYPES.has(transaction.type);
}

export function getLifetimeSCWagered(userId: string) {
  return readData().transactions
    .filter((transaction) => transaction.userId === userId && isVipWagerTransaction(transaction))
    .reduce((total, transaction) => total + Math.abs(transaction.amount), 0);
}

export function getVipProgressForWagered(lifetimeSCWagered: number): VipProgress {
  const wagered = Math.max(0, lifetimeSCWagered);
  const currentTier = [...vipTiers].reverse().find((tier) => wagered >= tier.threshold) ?? vipTiers[0];
  const currentIndex = vipTiers.findIndex((tier) => tier.id === currentTier.id);
  const nextTier = vipTiers[currentIndex + 1];
  if (!nextTier) {
    return {
      lifetimeSCWagered: wagered,
      currentTier,
      progressPercent: 100,
      remainingToNext: 0,
    };
  }

  const tierRange = Math.max(1, nextTier.threshold - currentTier.threshold);
  const tierProgress = Math.max(0, Math.min(1, (wagered - currentTier.threshold) / tierRange));
  return {
    lifetimeSCWagered: wagered,
    currentTier,
    nextTier,
    progressPercent: tierProgress * 100,
    remainingToNext: Math.max(0, nextTier.threshold - wagered),
  };
}

export function getVipProgress(userId: string) {
  return getVipProgressForWagered(getLifetimeSCWagered(userId));
}

export function emitVipLedgerUpdated(userId: string) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function" || typeof CustomEvent === "undefined") return;
  window.dispatchEvent(new CustomEvent(VIP_LEDGER_UPDATED_EVENT, { detail: { userId } }));
}
