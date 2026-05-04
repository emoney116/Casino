import type { Currency } from "../types";

export interface CurrencyMetadata {
  code: Currency;
  displayName: string;
  shortName: string;
  legacyName?: string;
  role: "ENTERTAINMENT" | "PROMOTIONAL";
  canPurchaseDirectly: boolean;
  canBeGrantedAsBonus: boolean;
  canBeUsedInGames: boolean;
  canBeRedeemed: boolean;
  redemptionEnabled: boolean;
  displayDisclaimer: string;
}

export const currencyConfig: Record<Currency, CurrencyMetadata> = {
  GOLD: {
    code: "GOLD",
    displayName: "Gold Coins",
    shortName: "GC",
    role: "ENTERTAINMENT",
    canPurchaseDirectly: true,
    canBeGrantedAsBonus: true,
    canBeUsedInGames: true,
    canBeRedeemed: false,
    redemptionEnabled: false,
    displayDisclaimer: "Gold Coins have no cash value. Prototype mode. Redemptions are not currently enabled.",
  },
  BONUS: {
    code: "BONUS",
    displayName: "Sweeps Coins",
    shortName: "SC",
    legacyName: "Bonus Coins",
    role: "PROMOTIONAL",
    canPurchaseDirectly: false,
    canBeGrantedAsBonus: true,
    canBeUsedInGames: true,
    canBeRedeemed: true,
    redemptionEnabled: false,
    displayDisclaimer: "Sweeps Coins are promotional in this prototype. Prototype mode. Redemptions are not currently enabled.",
  },
};

export const redeemableCurrency: Currency = "BONUS";

export function getCurrencyMeta(currency: Currency) {
  return currencyConfig[currency];
}

export function getCurrencyDisplayName(currency: Currency) {
  return getCurrencyMeta(currency).displayName;
}

export function getCurrencyShortName(currency: Currency) {
  return getCurrencyMeta(currency).shortName;
}

export function isRedemptionEnabled(currency: Currency) {
  const meta = getCurrencyMeta(currency);
  return meta.canBeRedeemed && meta.redemptionEnabled;
}
