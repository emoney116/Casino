import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import { getCurrencyDisplayName, getCurrencyShortName } from "../config/currencyConfig";
import { formatCoins } from "../lib/format";
import { coinPacks, formatPackPrice, formatScBonusValue, type CoinPack } from "../store/coinPacks";
import { usePurchasePackage } from "../store/purchaseFlow";
import { useAuth } from "../auth/AuthContext";
import { useState } from "react";
import { CashierIcon } from "./CashierIcons";

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
  const { paymentError, paymentStatus, provider, purchasePackage, resetPaymentStatus } = usePurchasePackage({
    user,
    onPurchased: () => {
      void refreshUser();
      onPurchased?.();
    },
  });
  const isSubmitting = paymentStatus === "loading";

  function buy(pack: CoinPack) {
    const transaction = purchasePackage(pack.id);
    if (!transaction) return;
    const message = `Added ${formatCoins(pack.gcAmount)} ${getCurrencyShortName("GOLD")} + ${formatScBonusValue(pack)}.`;
    setSuccessMessage(message);
    setConfirmPack(null);
    notify(message, "success");
  }

  function choosePack(pack: CoinPack) {
    resetPaymentStatus();
    setSuccessMessage("");
    setConfirmPack(pack);
  }

  function renderPackCard(pack: CoinPack, featured = false) {
    return (
      <article className={`wallet-pack-card compact purchase-pack-tile${featured ? " featured" : ""}`} key={pack.id}>
        <strong className="purchase-pack-gc">{formatCoins(pack.gcAmount)} GC</strong>
        <em className="purchase-pack-sc">+{formatScBonusValue(pack)}</em>
        <button
          className="primary-button purchase-buy-button"
          type="button"
          aria-label={`Buy ${formatCoins(pack.gcAmount)} GC package`}
          onClick={() => choosePack(pack)}
        >
          Buy {formatPackPrice(pack)}
        </button>
      </article>
    );
  }

  return (
    <Modal
      title={confirmPack ? "Confirm Purchase" : <span className="modal-title-with-icon"><CashierIcon kind="purchaseBag" /> Coin Store</span>}
      onClose={onClose}
      className={`cashier-modal-card${confirmPack ? " cashier-confirm-modal" : " cashier-store-modal"}`}
    >
      <div className="modal-stack wallet-modal-stack cashier-purchase-modal">
        {successMessage && <div className="purchase-success-banner">{successMessage}</div>}
        {paymentError && <div className="purchase-error-banner">{paymentError}</div>}

        {confirmPack ? (
          <div className="purchase-confirm-panel">
            <div className="purchase-confirm-topline">
              <span className="purchase-provider-chip"><CashierIcon kind="badge" /> Demo cashier</span>
              <span>{provider.label}</span>
            </div>
            <h3>Coin Package</h3>
            <strong className="purchase-confirm-price">{formatPackPrice(confirmPack)}</strong>
            <div className="purchase-confirm-values">
              <div>
                <span>{getCurrencyDisplayName("GOLD")}</span>
                <strong>{formatCoins(confirmPack.gcAmount)}</strong>
              </div>
              <div>
                <span>{getCurrencyShortName("BONUS")} bonus</span>
                <strong>{formatScBonusValue(confirmPack)}</strong>
              </div>
            </div>
            <div className="purchase-confirm-copy">
              <span>{getCurrencyDisplayName("GOLD")} have no cash value</span>
              <span>{getCurrencyShortName("BONUS")} are promotional bonus coins</span>
              <span>Demo purchase only - real payments not enabled yet.</span>
            </div>
            <div className="purchase-confirm-actions cashier-sticky-actions">
              <button className="ghost-button" type="button" onClick={() => setConfirmPack(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={() => buy(confirmPack)} disabled={isSubmitting}>
                {isSubmitting ? "Adding..." : "Add Demo Coins"}
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="wallet-pack-grid compact purchase-pack-tile-grid">
              {coinPacks.map((pack) => renderPackCard(pack, pack.highlight))}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
