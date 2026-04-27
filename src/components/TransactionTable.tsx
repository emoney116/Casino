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
    <div className="table-wrap">
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
  );
}
