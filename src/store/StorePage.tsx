import { ShoppingCart } from "lucide-react";
import { formatCoins } from "../lib/format";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { coinPacks } from "./coinPacks";
import { fakePurchasePack } from "./fakePurchaseService";

export function StorePage({ onBack }: { onBack: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();

  function buy(packId: string) {
    if (!user) return;
    fakePurchasePack(user, packId);
    refreshUser();
    notify("Demo purchase completed. No real money was charged.", "success");
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Fake checkout</p>
          <h2>Coin Store</h2>
          <p className="muted">Demo purchase only - no real money charged, no card collection.</p>
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
            <strong>{formatCoins(pack.goldCoins)} Gold Coins</strong>
            <p className="muted">{pack.fakePrice} fake price</p>
            <button className="primary-button" onClick={() => buy(pack.id)}>
              Confirm Demo Purchase
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}
