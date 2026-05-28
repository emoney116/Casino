import { ChevronRight, Download } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { Modal } from "../components/Modal";
import { TransactionTable } from "../components/TransactionTable";
import { redemptionConfig } from "../config/complianceConfig";
import { getCurrencyShortName, redeemableCurrency } from "../config/currencyConfig";
import { formatCoins, formatDateTime } from "../lib/format";
import { getEligibilityFlags, getKycStatus, getRedemptionRequests } from "../redemption/redemptionService";
import type { Transaction, TransactionType } from "../types";
import { CashierIcon } from "./CashierIcons";
import { PurchaseCoinsModal } from "./PurchaseCoinsModal";
import { getBalance, getTransactions } from "./walletService";

export type WalletTransactionFilter = "ALL" | "PURCHASES" | "BONUSES" | "BETS" | "WINS" | "ADMIN";
export type WalletPanel = "purchase" | "redeem" | "history" | null;

export const walletTransactionFilterMap: Record<WalletTransactionFilter, TransactionType[]> = {
  ALL: [],
  PURCHASES: ["PURCHASE_FAKE", "GOLD_PURCHASE_DEMO"],
  BONUSES: ["DAILY_BONUS", "STREAK_REWARD", "MISSION_REWARD", "LEVEL_REWARD", "RETENTION_REWARD", "PROMO_REWARD", "SWEEPS_BONUS_GRANT"],
  BETS: ["GAME_BET", "BUY_BONUS", "TABLE_BET", "ARCADE_BET"],
  WINS: ["GAME_WIN", "BONUS_WIN", "JACKPOT_WIN", "TABLE_WIN", "TABLE_PUSH", "TABLE_REFUND", "TABLE_LOSS", "ARCADE_WIN"],
  ADMIN: ["ADMIN_ADJUSTMENT", "ADMIN_REDEMPTION_ADJUSTMENT", "REDEMPTION_REQUEST_CREATED", "REDEMPTION_REQUEST_APPROVED", "REDEMPTION_REQUEST_REJECTED", "REDEMPTION_REQUEST_CANCELLED", "KYC_REQUIRED"],
};

function titleCase(value: string) {
  return value.toLowerCase().replaceAll("_", " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

const walletActivityGameNames: Record<string, string> = {
  "gold-rush-showdown": "Gold Rush",
  "frontier-fortune": "Frontier Fortune",
  "frontier-fortune-legacy": "Frontier Fortune",
  blackjack: "Blackjack",
  roulette: "Roulette",
  dice: "Over/Under",
  crash: "Crash",
  treasureDig: "Treasure Dig",
  "treasure-dig": "Treasure Dig",
  brickBreakBonus: "Brick Break",
  "brick-break-bonus": "Brick Break",
  balloonPop: "Balloon Pop",
  "balloon-pop": "Balloon Pop",
  lavaRun: "Lava Run",
  "lava-run": "Lava Run",
  emberStack: "Ember Stack",
  "ember-stack": "Ember Stack",
  safecracker: "Safecracker",
};

function stringFromMetadata(value: unknown) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function getMetadataString(metadata: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = stringFromMetadata(metadata[key]);
    if (value) return value;
  }
  return null;
}

function displayGameName(value: string) {
  return walletActivityGameNames[value] ?? walletActivityGameNames[value.replaceAll("_", "-")] ?? titleCase(value.replace(/[-_]+/g, " "));
}

function getActivityGameName(tx: Transaction) {
  const metadata = tx.metadata ?? {};
  const displayName = getMetadataString(metadata, ["gameName", "tableGame", "arcadeGame", "slotName", "gameTitle"]);
  if (displayName) return walletActivityGameNames[displayName] ?? displayName.replace(" Showdown", "");
  const gameId = getMetadataString(metadata, ["gameId", "tableGameId", "arcadeGameId", "game", "slotId"]);
  return gameId ? displayGameName(gameId) : null;
}

function getActivityAction(tx: Transaction) {
  const metadata = tx.metadata ?? {};
  const result = getMetadataString(metadata, ["result", "attemptResult"])?.toLowerCase().replaceAll("_", "-");

  if (tx.type === "TABLE_LOSS") return "Loss";
  if (tx.type === "TABLE_PUSH") return "Push";
  if (tx.type === "TABLE_REFUND") return "Refund";
  if (tx.type === "GAME_BET" || tx.type === "TABLE_BET" || tx.type === "ARCADE_BET") return "Bet";
  if (tx.type === "BUY_BONUS") return "Bonus Buy";
  if (tx.type === "JACKPOT_WIN") return "Jackpot";
  if (tx.type === "BONUS_WIN") return "Bonus Win";

  if (result === "cashout" || typeof metadata.cashOutMultiplier === "number") return "Cashout";
  if (result === "unlock") return "Unlock";
  if (result === "bust" || result === "fail" || result === "trap") return "Loss";

  if (tx.type === "GAME_WIN" || tx.type === "TABLE_WIN" || tx.type === "ARCADE_WIN") return "Win";
  if (tx.type === "GOLD_PURCHASE_DEMO" || tx.type === "PURCHASE_FAKE") return "Purchase";
  if (tx.type.includes("BONUS") || tx.type.includes("REWARD")) return "Reward";
  if (tx.type.includes("REDEMPTION")) return "Redemption";
  if (tx.type.includes("ADMIN")) return "Admin";
  return titleCase(tx.type);
}

export function getWalletActivityLabel(tx: Transaction) {
  const gameName = getActivityGameName(tx);
  const action = getActivityAction(tx);
  return gameName ? `${gameName} ${action}` : action;
}

export function getWalletActivityTone(tx: Transaction) {
  const action = getActivityAction(tx);
  if (action === "Loss" || tx.amount < 0) return "negative";
  if (tx.amount > 0 && ["Win", "Cashout", "Unlock", "Bonus Win", "Jackpot", "Reward"].includes(action)) return "positive";
  if (tx.amount > 0) return "positive";
  return "neutral";
}

export function filterWalletTransactions(transactions: Transaction[], filter: WalletTransactionFilter) {
  const allowed = walletTransactionFilterMap[filter];
  return transactions.filter((tx) => allowed.length === 0 || allowed.includes(tx.type));
}

export function WalletPage({ initialPanel = null }: { initialPanel?: WalletPanel } = {}) {
  const { user } = useAuth();
  const [activePanel, setActivePanel] = useState<WalletPanel>(initialPanel);
  const [filter, setFilter] = useState<WalletTransactionFilter>("ALL");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [, setVersion] = useState(0);

  if (!user) return null;
  const currentUser = user;
  const filters: WalletTransactionFilter[] = currentUser.roles.includes("ADMIN")
    ? ["ALL", "PURCHASES", "BONUSES", "BETS", "WINS", "ADMIN"]
    : ["ALL", "PURCHASES", "BONUSES", "BETS", "WINS"];
  const balances = getBalance(currentUser.id);
  const kycStatus = getKycStatus(currentUser.id);
  const eligibilityFlags = getEligibilityFlags(currentUser.id);
  const redemptionRequests = getRedemptionRequests(currentUser.id);
  const allTransactions = getTransactions(currentUser.id);
  const transactions = filterWalletTransactions(allTransactions, filter);
  const latestTransactions = allTransactions.slice(0, 3);

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
    <section className="page-stack wallet-dashboard wallet-cashier-page">
      <div className="page-heading wallet-cashier-heading">
        <div>
          <h1>Wallet</h1>
        </div>
      </div>

      <section className="wallet-balance-hero">
        <div className="wallet-balance-panel">
          <article className="wallet-balance-tile gold">
            <CashierIcon kind="goldStack" />
            <span>Gold Coins</span>
            <strong>{formatCoins(balances.GOLD)} <small>GC</small></strong>
          </article>
          <article className="wallet-balance-tile sweeps">
            <CashierIcon kind="sweepsToken" />
            <span>Sweeps Coins</span>
            <strong>{formatCoins(balances.BONUS)} <small>SC</small></strong>
          </article>
        </div>
        <button className="wallet-cashier-cta" type="button" onClick={() => setActivePanel("purchase")}>
          <CashierIcon kind="purchaseBag" />
          <span>
            <strong>Buy Coins</strong>
          </span>
          <ChevronRight size={19} />
        </button>
      </section>

      <div className="wallet-summary-grid cashier-summary-grid">
        <article className="card wallet-summary-card cashier-status-card">
          <div>
            <h2>Redemption Status</h2>
          </div>
          <div className="compact-detail-list">
            <span>Redeemable SC</span><strong>{formatCoins(balances[redeemableCurrency])} {getCurrencyShortName(redeemableCurrency)}</strong>
            <span>Minimum</span><strong>{formatCoins(redemptionConfig.minimumRedemptionAmount)} {getCurrencyShortName(redeemableCurrency)}</strong>
            <span>Status</span><strong>Not enabled</strong>
          </div>
          <button className="ghost-button" type="button" onClick={() => setActivePanel("redeem")}>Redeem</button>
        </article>

        <article className="card wallet-summary-card cashier-activity-card">
          <div>
            <h2>Recent Activity</h2>
          </div>
          {latestTransactions.length === 0 ? (
            <p className="muted">No wallet activity yet.</p>
          ) : (
            <div className="wallet-mini-ledger">
              {latestTransactions.map((tx) => (
                <div key={tx.id}>
                  <span>
                    <strong>{getWalletActivityLabel(tx)}</strong>
                    <small>{formatDateTime(tx.createdAt)}</small>
                  </span>
                  <strong className={getWalletActivityTone(tx)}>
                    {tx.amount > 0 ? "+" : ""}{formatCoins(tx.amount)} {getCurrencyShortName(tx.currency)}
                  </strong>
                </div>
              ))}
            </div>
          )}
          <button className="ghost-button" type="button" onClick={() => setActivePanel("history")}>View All</button>
        </article>
      </div>

      {activePanel === "purchase" && (
        <PurchaseCoinsModal onClose={closePanel} onPurchased={() => setVersion((value) => value + 1)} />
      )}

      {activePanel === "redeem" && (
        <Modal title="Redemption Status" onClose={closePanel} className="cashier-modal-card cashier-redemption-modal">
          <div className="modal-stack wallet-modal-stack">
            <div className="wallet-redeem-hero">
              <span>Redeemable SC</span>
              <strong>{formatCoins(balances[redeemableCurrency])} {getCurrencyShortName(redeemableCurrency)}</strong>
              <small>Status: Not enabled</small>
            </div>

            <div className="cashier-redemption-grid">
              <article className="cashier-redemption-panel">
                <CashierIcon kind="rewardSafe" />
                <span>Minimum redemption</span>
                <strong>{formatCoins(redemptionConfig.minimumRedemptionAmount)} {getCurrencyShortName(redeemableCurrency)}</strong>
              </article>
              <article className="cashier-redemption-panel">
                <CashierIcon kind="rewardSafe" />
                <span>KYC</span>
                <strong>{titleCase(kycStatus)}</strong>
              </article>
            </div>

            <div className="cashier-requirements">
              <span>Identity check</span>
              <span>Eligible balance</span>
              <span>Terms approval</span>
            </div>

            <div className="cashier-redemption-status">
              <div className="compact-detail-list">
                <span>Status</span><strong>Not enabled</strong>
                <span>Eligibility</span><strong>{eligibilityFlags.reviewRequired ? "Review required" : "Not started"}</strong>
                <span>Requests</span><strong>{redemptionRequests.length}</strong>
              </div>
              <button className="primary-button" type="button" disabled>Request Disabled</button>
            </div>
          </div>
        </Modal>
      )}

      {activePanel === "history" && (
        <Modal title="Transaction History" onClose={closePanel} className="cashier-modal-card cashier-history-modal">
          <div className="modal-stack wallet-modal-stack">
            <div className="cashier-history-toolbar">
              <p className="muted">{transactions.length} records</p>
              <button className="ghost-button icon-button wallet-export-button" type="button" onClick={exportJson}>
                <Download size={16} />
                Export JSON
              </button>
            </div>
            <div className="filter-row cashier-filter-row">
              {filters.map((item) => (
                <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
                  {titleCase(item)}
                </button>
              ))}
            </div>
            <TransactionTable transactions={transactions} onSelect={setSelectedTx} variant="cashier" />
          </div>
        </Modal>
      )}

      {selectedTx && (
        <Modal title="Transaction Detail" onClose={() => setSelectedTx(null)} className="cashier-modal-card">
          <div className="detail-list">
            <span>ID</span><strong>{selectedTx.id}</strong>
            <span>Type</span><strong>{titleCase(selectedTx.type)}</strong>
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
