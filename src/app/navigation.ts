import { CircleUserRound, Coins, Dices, Gamepad2, Home, ShieldCheck, WalletCards } from "lucide-react";
import type { Role } from "../types";

export type AppView = "lobby" | "games" | "tableGames" | "wallet" | "account" | "admin";

export const navItems: Array<{
  id: AppView;
  label: string;
  icon: typeof Home;
  adminOnly?: boolean;
}> = [
  { id: "lobby", label: "Lobby", icon: Home },
  { id: "games", label: "Games", icon: Gamepad2 },
  { id: "tableGames", label: "Tables", icon: Dices },
  { id: "wallet", label: "Wallet", icon: WalletCards },
  { id: "account", label: "Account", icon: CircleUserRound },
  { id: "admin", label: "Admin", icon: ShieldCheck, adminOnly: true },
];

export function visibleNavItems(roles: Role[]) {
  return navItems.filter((item) => !item.adminOnly || roles.includes("ADMIN"));
}

export const BrandIcon = Coins;
