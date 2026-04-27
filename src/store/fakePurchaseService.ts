import { creditCurrency } from "../wallet/walletService";
import type { User } from "../types";
import { coinPacks } from "./coinPacks";

export function fakePurchasePack(user: User, packId: string) {
  const pack = coinPacks.find((candidate) => candidate.id === packId);
  if (!pack) throw new Error("Coin pack not found.");

  // TODO: Replace this with a real payment intent and compliance-reviewed purchase flow.
  return creditCurrency({
    userId: user.id,
    type: "PURCHASE_FAKE",
    currency: "GOLD",
    amount: pack.goldCoins,
    metadata: {
      packId: pack.id,
      fakePrice: pack.fakePrice,
      note: "Demo purchase only. No real money charged.",
    },
  });
}
