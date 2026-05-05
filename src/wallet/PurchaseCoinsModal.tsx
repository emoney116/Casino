import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import { getCurrencyDisplayName, getCurrencyShortName } from "../config/currencyConfig";
import { formatCoins } from "../lib/format";
import { coinPacks, formatPackPrice, formatScBonusValue, getPackValueTag, type CoinPack } from "../store/coinPacks";
import { fakePurchasePack } from "../store/fakePurchaseService";
import { useAuth } from "../auth/AuthContext";
import { useState } from "react";
import { getBalance } from "./walletService";

const LOW_GOLD_BALANCE_THRESHOLD = 1000;

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
  const balances = user ? getBalance(user.id) : { GOLD: 0, BONUS: 0 };
  const isLowBalance = balances.GOLD < LOW_GOLD_BALANCE_THRESHOLD;

  function buy(pack: CoinPack) {
    if (!user) return;
    fakePurchasePack(user, pack.id);
    refreshUser();
    onPurchased?.();
    const message = `${pack.name} Pack added: ${formatCoins(pack.gcAmount)} ${getCurrencyShortName("GOLD")} + ${formatScBonusValue(pack)}.`;
    setSuccessMessage(message);
    setConfirmPack(null);
    notify(message, "success");
  }

  return (
    <Modal title={confirmPack ? "Confirm Purchase" : "Coin Store"} onClose={onClose}>
      <div className="modal-stack wallet-modal-stack">
        {successMessage && <div className="purchase-success-banner">{successMessage}</div>}

        {confirmPack ? (
          <div className="purchase-confirm-panel">
            <h3>{confirmPack.name} Pack</h3>
            <strong className="purchase-confirm-price">{formatPackPrice(confirmPack)}</strong>
            <div className="purchase-confirm-values">
              <div>
                <span>{getCurrencyDisplayName("GOLD")}</span>
                <strong>{formatCoins(confirmPack.gcAmount)}</strong>
              </div>
              <div>
                <span>{getCurrencyShortName("BONUS")} Bonus</span>
                <strong>{formatScBonusValue(confirmPack)}</strong>
              </div>
            </div>
            <div className="purchase-confirm-copy">
              <span>{getCurrencyDisplayName("GOLD")} have no cash value</span>
              <span>{getCurrencyShortName("BONUS")} are promotional bonus coins</span>
              <span>Prototype mode. Redemptions not enabled</span>
            </div>
            <div className="purchase-confirm-actions">
              <button className="ghost-button" type="button" onClick={() => setConfirmPack(null)}>
                Cancel
              </button>
              <button className="primary-button" type="button" onClick={() => buy(confirmPack)}>
                Confirm
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="coin-store-hero">
              <span>Play more. Get bonus {getCurrencyShortName("BONUS")}.</span>
              <p>{getCurrencyDisplayName("GOLD")} have no cash value. {getCurrencyShortName("BONUS")} are promotional bonus coins.</p>
            </div>
            {isLowBalance && (
              <div className="low-balance-store-banner">
                <strong>Running low on coins?</strong>
                <button type="button" onClick={() => setConfirmPack(coinPacks[0])}>Get Coins</button>
              </div>
            )}
            <div className="wallet-pack-grid">
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
                  <button className="primary-button purchase-buy-button" type="button" onClick={() => setConfirmPack(pack)}>
                    Buy
                  </button>
                </article>
              ))}
            </div>
            <p className="coin-store-footer-copy">No purchase necessary placeholder. Prototype mode. Redemptions not enabled.</p>
          </>
        )}
      </div>
    </Modal>
  );
}
