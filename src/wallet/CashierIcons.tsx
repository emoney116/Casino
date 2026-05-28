export type CashierIconKind = "badge" | "goldStack" | "purchaseBag" | "receipt" | "rewardSafe" | "sweepsToken" | "vault";

const cashierBadgeSrc = new URL("../assets/cashier/cashier_badge.png", import.meta.url).href;
const gcStackSrc = new URL("../assets/cashier/gc_reference.png", import.meta.url).href;
const purchaseChestSrc = new URL("../assets/cashier/purchase_chest.png", import.meta.url).href;
const receiptIconSrc = new URL("../assets/cashier/receipt_icon.png", import.meta.url).href;
const rewardSafeSrc = new URL("../assets/cashier/reward_safe.png", import.meta.url).href;
const sweepsTokenSrc = new URL("../assets/cashier/sc_reference.png", import.meta.url).href;
const vaultIconSrc = new URL("../assets/cashier/vault_icon.png", import.meta.url).href;

export function CashierIcon({ kind, className = "" }: { kind: CashierIconKind; className?: string }) {
  const srcByKind: Record<CashierIconKind, string> = {
    badge: cashierBadgeSrc,
    goldStack: gcStackSrc,
    purchaseBag: purchaseChestSrc,
    receipt: receiptIconSrc,
    rewardSafe: rewardSafeSrc,
    sweepsToken: sweepsTokenSrc,
    vault: vaultIconSrc,
  };

  return (
    <img
      className={`cashier-icon cashier-icon-${kind}${className ? ` ${className}` : ""}`}
      src={srcByKind[kind]}
      alt=""
      aria-hidden="true"
      draggable={false}
    />
  );
}
