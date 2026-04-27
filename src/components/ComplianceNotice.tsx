export function ComplianceNotice({ compact = false }: { compact?: boolean }) {
  return (
    <footer className={compact ? "compliance compact" : "compliance"}>
      Demo social casino prototype. Gold Coins and Bonus Coins have no cash value. No real-money
      gambling, deposits, withdrawals, prizes, or redemptions are available in this prototype.
    </footer>
  );
}
