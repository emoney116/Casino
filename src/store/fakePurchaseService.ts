import { creditCurrency } from "../wallet/walletService";
import type { Currency, User } from "../types";
import { coinPacks, formatPackPrice } from "./coinPacks";
import { getCurrencyMeta } from "../config/currencyConfig";

export function fakePurchasePack(user: User, packId: string) {
  const pack = coinPacks.find((candidate) => candidate.id === packId);
  if (!pack) throw new Error("Coin pack not found.");

  // TODO: Replace this with a real payment intent and compliance-reviewed purchase flow.
  const goldTx = creditCurrency({
    userId: user.id,
    type: "GOLD_PURCHASE_DEMO",
    currency: "GOLD",
    amount: pack.gcAmount,
    metadata: {
      packId: pack.id,
      usdPrice: pack.usdPrice,
      displayPrice: formatPackPrice(pack),
      note: "Demo purchase only. No real money charged.",
    },
  });
  if (pack.scBonus > 0) {
    creditCurrency({
      userId: user.id,
      type: "SWEEPS_BONUS_GRANT",
      currency: "BONUS",
      amount: pack.scBonus,
      metadata: {
        packId: pack.id,
        usdPrice: pack.usdPrice,
        source: "promotional_bonus_placeholder",
        note: "Promotional Sweeps Coins grant placeholder. Redemptions are not currently enabled.",
      },
    });
  }
  return goldTx;
}

export function assertCurrencyCanBePurchasedDirectly(currency: Currency) {
  if (!getCurrencyMeta(currency).canPurchaseDirectly) {
    throw new Error(`${getCurrencyMeta(currency).displayName} cannot be purchased directly.`);
  }
}

export function fakeDirectCurrencyPurchase(user: User, currency: Currency, amount: number) {
  assertCurrencyCanBePurchasedDirectly(currency);
  return creditCurrency({
    userId: user.id,
    type: "GOLD_PURCHASE_DEMO",
    currency,
    amount,
    metadata: { source: "direct_demo_purchase" },
  });
}
