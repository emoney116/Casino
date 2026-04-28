import { formatCoins, formatDateTime } from "../lib/format";
import type { Transaction } from "../types";

export function TransactionTable({
  transactions,
  onSelect,
}: {
  transactions: Transaction[];
  onSelect?: (transaction: Transaction) => void;
}) {
  if (transactions.length === 0) {
    return <div className="empty-state">No transactions yet. Ledger entries will appear here.</div>;
  }

  return (
    <>
      <div className="table-wrap transaction-table-wrap">
        <table>
          <thead>
            <tr>
              <th>Time</th>
              <th>Type</th>
              <th>Currency</th>
              <th>Amount</th>
              <th>Balance After</th>
            </tr>
          </thead>
          <tbody>
            {transactions.map((tx) => (
              <tr key={tx.id} onClick={() => onSelect?.(tx)} className={onSelect ? "clickable-row" : ""}>
                <td>{formatDateTime(tx.createdAt)}</td>
                <td>{tx.type.replaceAll("_", " ")}</td>
                <td>{tx.currency}</td>
                <td className={tx.amount >= 0 ? "positive" : "negative"}>
                  {tx.amount >= 0 ? "+" : ""}
                  {formatCoins(tx.amount)}
                </td>
                <td>{formatCoins(tx.balanceAfter)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="transaction-card-list">
        {transactions.map((tx) => (
          <button
            className="transaction-card"
            key={tx.id}
            type="button"
            onClick={() => onSelect?.(tx)}
            disabled={!onSelect}
          >
            <span className="transaction-card-top">
              <strong>{tx.type.replaceAll("_", " ")}</strong>
              <span className={`status-chip ${tx.status.toLowerCase()}`}>{tx.status}</span>
            </span>
            <span className="transaction-card-row">
              <span>{tx.currency}</span>
              <strong className={tx.amount >= 0 ? "positive" : "negative"}>
                {tx.amount >= 0 ? "+" : ""}
                {formatCoins(tx.amount)}
              </strong>
            </span>
            <span className="transaction-card-row">
              <span>Balance after</span>
              <strong>{formatCoins(tx.balanceAfter)}</strong>
            </span>
            <span className="transaction-card-row muted">
              <span>Date</span>
              <span>{formatDateTime(tx.createdAt)}</span>
            </span>
          </button>
        ))}
      </div>
    </>
  );
}
