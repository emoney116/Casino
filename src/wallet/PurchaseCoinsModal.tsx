import { Modal } from "../components/Modal";
import { useToast } from "../components/ToastContext";
import { getCurrencyDisplayName, getCurrencyShortName } from "../config/currencyConfig";
import { formatCoins } from "../lib/format";
import { coinPacks } from "../store/coinPacks";
import { fakePurchasePack } from "../store/fakePurchaseService";
import { useAuth } from "../auth/AuthContext";

export function PurchaseCoinsModal({
  onClose,
  onPurchased,
}: {
  onClose: () => void;
  onPurchased?: () => void;
}) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();

  function buy(packId: string) {
    if (!user) return;
    const pack = coinPacks.find((candidate) => candidate.id === packId);
    fakePurchasePack(user, packId);
    refreshUser();
    onPurchased?.();
    if (pack) {
      notify(
        `${formatCoins(pack.goldCoins)} ${getCurrencyShortName("GOLD")} and ${formatCoins(pack.promotionalSweepsCoins)} ${getCurrencyShortName("BONUS")} credited in demo mode.`,
        "success",
      );
    }
  }

  return (
    <Modal title="Purchase Coins" onClose={onClose}>
      <div className="modal-stack wallet-modal-stack">
        <div className="notice-card">
          Demo purchase only. Packs add {getCurrencyDisplayName("GOLD")} and grant promotional {getCurrencyDisplayName("BONUS")} as a bonus.
          Direct purchase of {getCurrencyDisplayName("BONUS")} is not enabled.
        </div>
        <div className="wallet-pack-grid">
          {coinPacks.map((pack) => (
            <article className="wallet-pack-card" key={pack.id}>
              <div>
                <p className="eyebrow">{pack.fakePrice} fake price</p>
                <h3>{pack.name}</h3>
              </div>
              <div className="pack-value-list">
                <span>{getCurrencyShortName("GOLD")}</span><strong>{formatCoins(pack.goldCoins)} {getCurrencyDisplayName("GOLD")}</strong>
                <span>{getCurrencyShortName("BONUS")}</span><strong>{formatCoins(pack.promotionalSweepsCoins)} promotional {getCurrencyDisplayName("BONUS")}</strong>
              </div>
              <button className="primary-button" type="button" onClick={() => buy(pack.id)}>
                Confirm Demo Purchase
              </button>
            </article>
          ))}
        </div>
      </div>
    </Modal>
  );
}
