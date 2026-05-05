import { useState } from "react";
import { formatCoins } from "../lib/format";
import { coinPacks, formatPackPrice, formatScBonusValue, getPackValueTag } from "./coinPacks";
import { getCurrencyDisplayName, getCurrencyShortName } from "../config/currencyConfig";
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
          <p>Play more. Get bonus {getCurrencyShortName("BONUS")}.</p>
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
          <article className={`wallet-pack-card${pack.highlight ? " highlight" : ""}`} key={pack.id}>
            {pack.badge && <span className="purchase-pack-badge">{pack.badge.toUpperCase()}</span>}
            <div className="purchase-pack-heading">
              <h3>{pack.name} Pack</h3>
              <p className="purchase-pack-price">{formatPackPrice(pack)}</p>
            </div>
            <div className="purchase-pack-amounts">
              <strong><span>{formatCoins(pack.gcAmount)}</span> {getCurrencyDisplayName("GOLD")}</strong>
              <em>+ {formatScBonusValue(pack)}</em>
            </div>
            <span className="purchase-pack-value-tag">{getPackValueTag(pack)}</span>
            <button className="primary-button purchase-buy-button" onClick={() => setSelectedPackId(pack.id)}>
              Buy
            </button>
          </article>
        ))}
      </div>
      <p className="coin-store-footer-copy">
        {getCurrencyDisplayName("GOLD")} have no cash value. {getCurrencyShortName("BONUS")} are promotional bonus coins. Prototype mode. Redemptions not enabled.
      </p>

      {selectedPackId && (
        <PurchaseCoinsModal initialPackId={selectedPackId} onClose={() => setSelectedPackId(null)} />
      )}
    </section>
  );
}
