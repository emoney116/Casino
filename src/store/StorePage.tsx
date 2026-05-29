import { useState } from "react";
import { formatCoins, formatCurrencyDisplay } from "../lib/format";
import { coinPacks, formatPackPrice, formatScBonusValue } from "./coinPacks";
import { getCurrencyDisplayName } from "../config/currencyConfig";
import { PurchaseCoinsModal } from "../wallet/PurchaseCoinsModal";
import { useAuth } from "../auth/AuthContext";
import { getBalance } from "../wallet/walletService";

const LOW_GOLD_BALANCE_THRESHOLD = 1000;

export function StorePage({ onBack }: { onBack: () => void }) {
  const { user } = useAuth();
  const [selectedPackId, setSelectedPackId] = useState<string | null>(null);
  const balances = user ? getBalance(user.id) : { GOLD: 0, BONUS: 0 };
  const isLowBalance = balances.GOLD < LOW_GOLD_BALANCE_THRESHOLD;

  return (
    <section className="page-stack coin-store-page">
      <div className="page-heading coin-store-heading">
        <div>
          <h2>Coin Store</h2>
          <p>GC packages with bonus SC.</p>
        </div>
        <button className="ghost-button" onClick={onBack}>
          Back
        </button>
      </div>

      {isLowBalance && (
        <div className="low-balance-store-banner">
          <strong>Running low on coins?</strong>
          <button type="button" onClick={() => setSelectedPackId("starter")}>Get Coins</button>
        </div>
      )}

      <div className="wallet-pack-grid coin-store-grid">
        {coinPacks.map((pack) => (
          <article className={`wallet-pack-card compact purchase-pack-tile${pack.highlight ? " featured" : ""}`} key={pack.id}>
            <strong className="purchase-pack-gc" title={`${formatCoins(pack.gcAmount)} GC`}>{formatCurrencyDisplay(pack.gcAmount, "GOLD")} GC</strong>
            <em className="purchase-pack-sc">+{formatScBonusValue(pack)}</em>
            <button
              className="primary-button purchase-buy-button"
              aria-label={`Buy ${formatCoins(pack.gcAmount)} GC package`}
              onClick={() => setSelectedPackId(pack.id)}
            >
              Buy {formatPackPrice(pack)}
            </button>
          </article>
        ))}
      </div>
      <p className="coin-store-footer-copy">
        SC included as promotional Sweeps Coins. {getCurrencyDisplayName("GOLD")} have no cash value.
      </p>

      {selectedPackId && (
        <PurchaseCoinsModal initialPackId={selectedPackId} onClose={() => setSelectedPackId(null)} />
      )}
    </section>
  );
}
