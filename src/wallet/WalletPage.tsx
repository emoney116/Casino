import { Download, History, Landmark, ShoppingCart } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "../components/Modal";
import { TransactionTable } from "../components/TransactionTable";
import { redemptionConfig } from "../config/complianceConfig";
import { getCurrencyDisplayName, getCurrencyMeta, getCurrencyShortName, redeemableCurrency } from "../config/currencyConfig";
import { COMPLIANCE_COPY } from "../lib/compliance";
import { formatCoins, formatDateTime } from "../lib/format";
import { getEligibilityFlags, getKycStatus, getRedemptionRequests } from "../redemption/redemptionService";
import type { Transaction, TransactionType } from "../types";
import { PurchaseCoinsModal } from "./PurchaseCoinsModal";
import { getBalance, getTransactions } from "./walletService";

type Filter = "ALL" | "PURCHASES" | "BONUSES" | "BETS" | "WINS" | "ADMIN";
export type WalletPanel = "purchase" | "redeem" | "history" | null;

const filterMap: Record<Filter, TransactionType[]> = {
  ALL: [],
  PURCHASES: ["PURCHASE_FAKE", "GOLD_PURCHASE_DEMO"],
  BONUSES: ["DAILY_BONUS", "STREAK_REWARD", "MISSION_REWARD", "LEVEL_REWARD", "RETENTION_REWARD", "PROMO_REWARD", "SWEEPS_BONUS_GRANT"],
  BETS: ["GAME_BET", "BUY_BONUS", "TABLE_BET", "ARCADE_BET"],
  WINS: ["GAME_WIN", "BONUS_WIN", "JACKPOT_WIN", "TABLE_WIN", "TABLE_PUSH", "TABLE_REFUND", "TABLE_LOSS", "ARCADE_WIN"],
  ADMIN: ["ADMIN_ADJUSTMENT", "ADMIN_REDEMPTION_ADJUSTMENT", "REDEMPTION_REQUEST_CREATED", "REDEMPTION_REQUEST_APPROVED", "REDEMPTION_REQUEST_REJECTED", "REDEMPTION_REQUEST_CANCELLED", "KYC_REQUIRED"],
};

function titleCase(value: string) {
  return value.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

export function WalletPage({ initialPanel = null }: { initialPanel?: WalletPanel } = {}) {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<WalletPanel>(initialPanel);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [version, setVersion] = useState(0);

  if (!user) return null;
  const currentUser = user;
  const filters: Filter[] = currentUser.roles.includes("ADMIN")
    ? ["ALL", "PURCHASES", "BONUSES", "BETS", "WINS", "ADMIN"]
    : ["ALL", "PURCHASES", "BONUSES", "BETS", "WINS"];
  const balances = getBalance(currentUser.id);
  const kycStatus = getKycStatus(currentUser.id);
  const eligibilityFlags = getEligibilityFlags(currentUser.id);
  const redemptionRequests = getRedemptionRequests(currentUser.id);
  const redeemableMeta = getCurrencyMeta(redeemableCurrency);
  const allTransactions = getTransactions(currentUser.id);
  const transactions = allTransactions.filter((tx) => {
    const allowed = filterMap[filter];
    return allowed.length === 0 || allowed.includes(tx.type);
  });
  const latestTransactions = allTransactions.slice(0, 4);

  function exportJson() {
    const blob = new Blob([JSON.stringify(getTransactions(currentUser.id), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "casino-demo-transactions.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  function closePanel() {
    setActivePanel(null);
    setSelectedTx(null);
  }

  return (
    <section className="page-stack wallet-dashboard">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Wallet & Redemption</p>
          <h1>Coins at a glance</h1>
          <p className="muted">{COMPLIANCE_COPY}</p>
        </div>
      </div>

      <section className="wallet-command-center">
        <div className="wallet-balance-panel">
          <article className="wallet-balance-tile gold">
            <span>{getCurrencyDisplayName("GOLD")}</span>
            <strong>{formatCoins(balances.GOLD)}</strong>
            <small>Entertainment balance. Gold Coins have no cash value.</small>
          </article>
          <article className="wallet-balance-tile sweeps">
            <span>{getCurrencyDisplayName("BONUS")}</span>
            <strong>{formatCoins(balances.BONUS)}</strong>
            <small>{getCurrencyDisplayName("BONUS")} promotional balance. Prototype mode. Redemptions are not currently enabled.</small>
          </article>
        </div>

        <div className="wallet-action-panel">
          <p className="eyebrow">Wallet actions</p>
          <button className="wallet-action-button purchase" type="button" onClick={() => setActivePanel("purchase")}>
            <ShoppingCart size={20} />
            <span>
              <strong>Purchase Coins</strong>
              <small>Open demo packs and Sweeps bonus details</small>
            </span>
          </button>
          <button className="wallet-action-button redeem" type="button" onClick={() => setActivePanel("redeem")}>
            <Landmark size={20} />
            <span>
              <strong>Redemption Status</strong>
              <small>View disabled prototype redemption details</small>
            </span>
          </button>
          <button className="wallet-action-button history" type="button" onClick={() => setActivePanel("history")}>
            <History size={20} />
            <span>
              <strong>Transaction History</strong>
              <small>See ledger records and export JSON</small>
            </span>
          </button>
        </div>
      </section>

      <div className="wallet-summary-grid">
        <article className="card wallet-summary-card">
          <div>
            <Landmark size={18} />
            <h2>Redemption Status</h2>
          </div>
          <div className="compact-detail-list">
            <span>Redeemable balance</span><strong>{formatCoins(balances[redeemableCurrency])} {getCurrencyShortName(redeemableCurrency)}</strong>
            <span>Minimum placeholder</span><strong>{formatCoins(redemptionConfig.minimumRedemptionAmount)}</strong>
            <span>Status</span><strong>Not enabled</strong>
          </div>
          <button className="ghost-button" type="button" onClick={() => setActivePanel("redeem")}>View Status</button>
        </article>

        <article className="card wallet-summary-card">
          <div>
            <History size={18} />
            <h2>Recent Activity</h2>
          </div>
          {latestTransactions.length === 0 ? (
            <p className="muted">No transactions yet. Your ledger will appear here after play or demo purchases.</p>
          ) : (
            <div className="wallet-mini-ledger">
              {latestTransactions.map((tx) => (
                <div key={tx.id}>
                  <span>{titleCase(tx.type.replaceAll("_", " "))}</span>
                  <strong className={tx.amount >= 0 ? "positive" : "negative"}>
                    {tx.amount >= 0 ? "+" : ""}{formatCoins(tx.amount)}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <button className="ghost-button" type="button" onClick={() => setActivePanel("history")}>Open History</button>
        </article>
      </div>

      {activePanel === "purchase" && (
        <PurchaseCoinsModal onClose={closePanel} onPurchased={() => setVersion((value) => value + 1)} />
      )}

      {activePanel === "redeem" && (
        <Modal title="Redemption" onClose={closePanel}>
          <div className="modal-stack wallet-modal-stack">
            <div className="wallet-redeem-hero">
              <span>Redeemable balance placeholder</span>
              <strong>{formatCoins(balances[redeemableCurrency])} {getCurrencyShortName(redeemableCurrency)}</strong>
              <small>{getCurrencyDisplayName(redeemableCurrency)} redemption is disabled in this prototype.</small>
            </div>
            <div className="grid two wallet-modal-grid">
              <article className="card detail-card">
                <h3>Status</h3>
                <div className="detail-list">
                  <span>Currency</span><strong>{redeemableMeta.displayName}</strong>
                  <span>Minimum placeholder</span><strong>{formatCoins(redemptionConfig.minimumRedemptionAmount)}</strong>
                  <span>Redemption enabled</span><strong>{String(redeemableMeta.redemptionEnabled && redemptionConfig.enabled)}</strong>
                  <span>KYC</span><strong>{kycStatus}</strong>
                  <span>Eligibility</span><strong>{eligibilityFlags.reviewRequired ? "Review required" : "Not evaluated"}</strong>
                </div>
              </article>
              <article className="card detail-card">
                <h3>Future Requirements</h3>
                <p className="muted">
                  Future redemption would require eligibility review, identity checks, applicable terms, and operational approval.
                </p>
                <button className="primary-button" type="button" disabled>Request Disabled</button>
              </article>
            </div>
            <article className="card">
              <div className="section-title">
                <h3>Request History Placeholder</h3>
                <span>{redemptionRequests.length} requests</span>
              </div>
              {redemptionRequests.length === 0 ? (
                <div className="empty-state">No redemption requests. Request creation is disabled.</div>
              ) : (
                <div className="redemption-request-list">
                  {redemptionRequests.map((request) => (
                    <div className="detail-list" key={request.id}>
                      <span>{request.status}</span>
                      <strong>{formatCoins(request.amount)} {request.currency}</strong>
                    </div>
                  ))}
                </div>
              )}
            </article>
          </div>
        </Modal>
      )}

      {activePanel === "history" && (
        <Modal title="Transaction History" onClose={closePanel}>
          <div className="modal-stack wallet-modal-stack">
            <div className="section-title">
              <p className="muted">{transactions.length} ledger records</p>
              <button className="ghost-button icon-button wallet-export-button" type="button" onClick={exportJson}>
                <Download size={17} />
                Export JSON
              </button>
            </div>
            <div className="filter-row">
              {filters.map((item) => (
                <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
                  {titleCase(item)}
                </button>
              ))}
            </div>
            <TransactionTable transactions={transactions} onSelect={setSelectedTx} />
          </div>
        </Modal>
      )}

      {selectedTx && (
        <Modal title="Transaction Detail" onClose={() => setSelectedTx(null)}>
          <div className="detail-list">
            <span>ID</span><strong>{selectedTx.id}</strong>
            <span>Type</span><strong>{titleCase(selectedTx.type.replaceAll("_", " "))}</strong>
            <span>Currency</span><strong>{titleCase(selectedTx.currency)}</strong>
            <span>Amount</span><strong>{formatCoins(selectedTx.amount)}</strong>
            <span>Balance After</span><strong>{formatCoins(selectedTx.balanceAfter)}</strong>
            <span>Created</span><strong>{formatDateTime(selectedTx.createdAt)}</strong>
            <span>Metadata</span><pre>{JSON.stringify(selectedTx.metadata, null, 2)}</pre>
          </div>
        </Modal>
      )}
    </section>
  );
}
