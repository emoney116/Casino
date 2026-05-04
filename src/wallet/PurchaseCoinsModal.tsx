import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import { getCurrencyDisplayName, getCurrencyShortName } from "../config/currencyConfig";
import { formatCoins } from "../lib/format";
import { coinPacks, formatPackPrice, getPackValueTag, type CoinPack } from "../store/coinPacks";
import { fakePurchasePack } from "../store/fakePurchaseService";
import { useAuth } from "../auth/AuthContext";
import { useState } from "react";

export function PurchaseCoinsModal({
  onClose,
  onPurchased,
  initialPackId,
}: {
  onClose: () => void;
  onPurchased?: () => void;
  initialPackId?: string;
}) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [confirmPack, setConfirmPack] = useState<CoinPack | null>(
    () => coinPacks.find((pack) => pack.id === initialPackId) ?? null,
  );
  const [successMessage, setSuccessMessage] = useState("");

  function buy(pack: CoinPack) {
    if (!user) return;
    fakePurchasePack(user, pack.id);
    refreshUser();
    onPurchased?.();
    const message = `${formatCoins(pack.gcAmount)} ${getCurrencyShortName("GOLD")} and ${formatCoins(pack.scBonus)} ${getCurrencyShortName("BONUS")} credited in demo mode.`;
    setSuccessMessage(message);
    setConfirmPack(null);
    notify(message, "success");
  }

  return (
    <Modal title={confirmPack ? "Confirm Demo Purchase" : "Purchase Gold Coins"} onClose={onClose}>
      <div className="modal-stack wallet-modal-stack">
        {successMessage && <div className="purchase-success-banner">{successMessage}</div>}

        {confirmPack ? (
          <div className="purchase-confirm-panel">
            <h3>{confirmPack.name} Pack</h3>
            <strong className="purchase-confirm-price">{formatPackPrice(confirmPack)}</strong>
            <div className="purchase-confirm-values">
              <div>
                <span>{getCurrencyShortName("GOLD")}</span>
                <strong>{formatCoins(confirmPack.gcAmount)}</strong>
              </div>
              <div>
                <span>{getCurrencyShortName("BONUS")}</span>
                <strong>{formatCoins(confirmPack.scBonus)}</strong>
              </div>
            </div>
            <small>Prototype mode. Redemptions not enabled.</small>
            <div className="purchase-confirm-actions">
              <button className="ghost-button" type="button" onClick={() => setConfirmPack(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={() => buy(confirmPack)}>
                Confirm Demo Purchase
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="purchase-store-copy">
              <strong>Purchase {getCurrencyDisplayName("GOLD")} for gameplay. Receive {getCurrencyShortName("BONUS")} as a promotional bonus.</strong>
              <span>No purchase necessary placeholder. {getCurrencyDisplayName("BONUS")} are not directly purchasable.</span>
            </div>
            <div className="wallet-pack-grid">
              {coinPacks.map((pack) => (
                <article className={`wallet-pack-card${pack.highlight ? " highlight" : ""}`} key={pack.id}>
                  {pack.badge && <span className="purchase-pack-badge">{pack.badge}</span>}
                  <p className="purchase-pack-price">{formatPackPrice(pack)}</p>
                  <div>
                    <h3>{pack.name} Pack</h3>
                    <div className="purchase-pack-amounts">
                      <strong>{formatCoins(pack.gcAmount)} {getCurrencyShortName("GOLD")}</strong>
                      <span>+{formatCoins(pack.scBonus)} {getCurrencyShortName("BONUS")}</span>
                    </div>
                  </div>
                  <span className="purchase-pack-value-tag">{getPackValueTag(pack)}</span>
                  <button className="primary-button purchase-buy-button" type="button" onClick={() => setConfirmPack(pack)}>
                    Buy {getCurrencyDisplayName("GOLD")}
                  </button>
                </article>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
