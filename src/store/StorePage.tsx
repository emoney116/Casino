import { ShoppingCart } from "lucide-react";
import { formatCoins } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import { coinPacks } from "./coinPacks";
import { fakePurchasePack } from "./fakePurchaseService";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { getCurrencyDisplayName } from "../config/currencyConfig";

export function StorePage({ onBack }: { onBack: () => void }) {
  const { user, refreshUser } = useAuth();

  function buy(packId: string) {
    if (!user) return;
    fakePurchasePack(user, packId);
    refreshUser();
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Fake checkout</p>
          <h2>Coin Store</h2>
          <p className="muted">{COMPLIANCE_COPY} Demo purchase only; no real money charged or card collection.</p>
        </div>
        <button className="ghost-button" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="grid three">
        {coinPacks.map((pack) => (
          <article className="card coin-pack" key={pack.id}>
            <ShoppingCart />
            <h3>{pack.name}</h3>
            <strong>{formatCoins(pack.goldCoins)} {getCurrencyDisplayName("GOLD")}</strong>
            <p className="muted">
              {pack.fakePrice} fake price. Includes {formatCoins(pack.promotionalSweepsCoins)} promotional {getCurrencyDisplayName("BONUS")} as a bonus placeholder.
            </p>
            <small>Direct purchase of {getCurrencyDisplayName("BONUS")} is not enabled.</small>
            <button className="primary-button" onClick={() => buy(pack.id)}>
              Confirm Demo Purchase
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
