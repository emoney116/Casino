import { CircleUserRound, Coins, Dices, FileText, Gamepad2, Gift, Home, ShieldCheck, WalletCards } from "lucide-react";
import type { Role } from "../types";

export type AppView =
  | "lobby"
  | "games"
  | "tableGames"
  | "rewards"
  | "wallet"
  | "redemption"
  | "account"
  | "terms"
  | "sweepstakesRules"
  | "privacy"
  | "responsiblePlay"
  | "eligibility"
  | "admin";

export const navItems: Array<{
  id: AppView;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
}> = [
  { id: "lobby", label: "Lobby", icon: Home },
  { id: "games", label: "Slots", icon: Gamepad2 },
  { id: "tableGames", label: "Games", icon: Dices },
  { id: "rewards", label: "Rewards", icon: Gift },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "account", label: "Account", icon: CircleUserRound },
  { id: "admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

export const legalNavItems: Array<{ id: AppView; label: string; icon: typeof FileText }> = [
  { id: "terms", label: "Terms", icon: FileText },
  { id: "sweepstakesRules", label: "Sweepstakes Rules", icon: FileText },
  { id: "privacy", label: "Privacy Policy", icon: FileText },
  { id: "responsiblePlay", label: "Responsible Play", icon: FileText },
  { id: "eligibility", label: "Eligibility", icon: FileText },
];

export function visibleNavItems(roles: Role[]) {
  return navItems.filter((item) => !item.adminOnly || roles.includes("ADMIN"));
}

export const BrandIcon = Coins;
