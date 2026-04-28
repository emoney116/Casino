import { Download } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { BalanceCard } from "../components/BalanceCard";
import { Modal } from "../components/Modal";
import { TransactionTable } from "../components/TransactionTable";
import { useToast } from "../components/ToastContext";
import { formatCoins, formatDateTime } from "../lib/format";
import { coinPacks } from "../store/coinPacks";
import { fakePurchasePack } from "../store/fakePurchaseService";
import type { Transaction, TransactionType } from "../types";
import { getBalance, getTransactions } from "./walletService";
import { StreakCard } from "../streaks/StreakCard";

type Filter = "ALL" | "PURCHASES" | "BONUSES" | "BETS" | "WINS" | "ADMIN";

const filterMap: Record<Filter, TransactionType[]> = {
  ALL: [],
  PURCHASES: ["PURCHASE_FAKE"],
  BONUSES: ["DAILY_BONUS", "STREAK_REWARD", "MISSION_REWARD", "LEVEL_REWARD"],
  BETS: ["GAME_BET"],
  WINS: ["GAME_WIN"],
  ADMIN: ["ADMIN_ADJUSTMENT"],
};

export function WalletPage() {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [filter, setFilter] = useState<Filter>("ALL");
  const [selectedTx, setSelectedTx] = useState<Transaction | null>(null);
  const [version, setVersion] = useState(0);

  if (!user) return null;
  const currentUser = user;
  const balances = getBalance(currentUser.id);
  const transactions = getTransactions(currentUser.id).filter((tx) => {
    const allowed = filterMap[filter];
    return allowed.length === 0 || allowed.includes(tx.type);
  });

  function buy(packId: string) {
    fakePurchasePack(currentUser, packId);
    refreshUser();
    setVersion((value) => value + 1);
    notify("Demo purchase completed. No real money was charged.", "success");
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(getTransactions(currentUser.id), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "casino-demo-transactions.json";
    link.click();
    URL.revokeObjectURL(url);
  }

  return (
    <section className="page-stack" key={version}>
      <div className="page-heading">
        <div>
          <p className="eyebrow">Wallet</p>
          <h1>Balances and Ledger</h1>
          <p className="muted">Gold Coins and Bonus Coins have no cash value.</p>
        </div>
        <button className="ghost-button icon-button wallet-export-button" onClick={exportJson}>
          <Download size={17} />
          Export JSON
        </button>
      </div>

      <div className="grid two wallet-balances">
        <BalanceCard label="Gold Coins" amount={balances.GOLD} tone="gold" />
        <BalanceCard label="Bonus Coins" amount={balances.BONUS} tone="bonus" />
      </div>

      <StreakCard onClaimed={() => setVersion((value) => value + 1)} />

      <section className="card">
        <div className="section-title">
          <h2>Fake Coin Store</h2>
          <span>Demo purchase only</span>
        </div>
        <div className="store-grid">
          {coinPacks.map((pack) => (
            <article className="mini-pack" key={pack.id}>
              <strong>{pack.name}</strong>
              <span>{formatCoins(pack.goldCoins)} Gold Coins</span>
              <small>{pack.fakePrice} fake price</small>
              <button className="primary-button" onClick={() => buy(pack.id)}>
                Demo Buy
              </button>
            </article>
          ))}
        </div>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Transactions</h2>
          <span>{transactions.length} records</span>
        </div>
        <div className="filter-row">
          {(["ALL", "PURCHASES", "BONUSES", "BETS", "WINS", "ADMIN"] as Filter[]).map((item) => (
            <button className={filter === item ? "active" : ""} key={item} onClick={() => setFilter(item)}>
              {item.toLowerCase()}
            </button>
          ))}
        </div>
        <TransactionTable transactions={transactions} onSelect={setSelectedTx} />
      </section>

      {selectedTx && (
        <Modal title="Transaction Detail" onClose={() => setSelectedTx(null)}>
          <div className="detail-list">
            <span>ID</span><strong>{selectedTx.id}</strong>
            <span>Type</span><strong>{selectedTx.type}</strong>
            <span>Currency</span><strong>{selectedTx.currency}</strong>
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
