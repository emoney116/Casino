import { ShoppingCart } from "lucide-react";
import { useState } from "react";
import { formatCoins } from "../lib/format";
import { coinPacks, formatPackPrice, getPackValueTag } from "./coinPacks";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { getCurrencyDisplayName, getCurrencyShortName } from "../config/currencyConfig";
import { PurchaseCoinsModal } from "../wallet/PurchaseCoinsModal";

export function StorePage({ onBack }: { onBack: () => void }) {
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Fake checkout</p>
          <h2>Coin Store</h2>
          <p className="muted">
            Purchase {getCurrencyDisplayName("GOLD")} for gameplay. Receive {getCurrencyShortName("BONUS")} as a promotional bonus. No purchase necessary placeholder. {COMPLIANCE_COPY}
          </p>
        </div>
        <button className="ghost-button" onClick={onBack}>
          Back
        </button>
      </div>

      <div className="grid three">
        {coinPacks.map((pack) => (
          <article className="card coin-pack" key={pack.id}>
            <ShoppingCart />
            <h3>{pack.name} Pack</h3>
            <p className="purchase-pack-price">{formatPackPrice(pack)}</p>
            <strong>{formatCoins(pack.gcAmount)} {getCurrencyDisplayName("GOLD")}</strong>
            <strong>+{formatCoins(pack.scBonus)} {getCurrencyShortName("BONUS")}</strong>
            <span className="purchase-pack-value-tag">{getPackValueTag(pack)}</span>
            <small>Prototype mode. Redemptions not enabled.</small>
            <button className="primary-button" onClick={() => setSelectedPackId(pack.id)}>
              Buy {getCurrencyDisplayName("GOLD")}
            </button>
          </article>
        ))}
      </div>

      {selectedPackId && (
        <PurchaseCoinsModal initialPackId={selectedPackId} onClose={() => setSelectedPackId(null)} />
      )}
    </section>
  );
}
