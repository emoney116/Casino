import { Gift, WalletCards } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { BalanceCard } from "../components/BalanceCard";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { MissionsPanel } from "../missions/MissionsPanel";
import { ProgressionBar } from "../progression/ProgressionBar";
import { getProgression } from "../progression/progressionService";
import { StreakCard } from "../streaks/StreakCard";
import { canClaimDailyBonus, claimDailyBonus, DAILY_BONUS_AMOUNT } from "../wallet/dailyBonusService";
import { getBalance } from "../wallet/walletService";
import { RetentionPanel } from "./RetentionPanel";
import { getCurrencyDisplayName } from "../config/currencyConfig";

export function RewardsPage({ onWallet }: { onWallet: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [version, setVersion] = useState(0);
  if (!user) return null;
  const currentUser = user;

  const balances = getBalance(currentUser.id);
  const progression = getProgression(currentUser.id);
  const dailyAvailable = canClaimDailyBonus(currentUser);

  function refreshRewards() {
    refreshUser();
    setVersion((value) => value + 1);
  }

  function claimDaily() {
    try {
      claimDailyBonus(currentUser.id);
      refreshRewards();
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Daily bonus unavailable.", "error");
    }
  }

  return (
    <section className="page-stack rewards-page" key={version}>
      <div className="lobby-hero rewards-hero">
        <div>
          <p className="eyebrow">Rewards</p>
          <h1>Rewards</h1>
          <div className="hero-actions">
            <button className="primary-button icon-button" onClick={claimDaily} disabled={!dailyAvailable}>
              <Gift size={18} />
              {dailyAvailable ? `Claim ${formatCoins(DAILY_BONUS_AMOUNT)}` : "Daily Bonus Claimed"}
            </button>
            <button className="ghost-button icon-button" onClick={onWallet}>
              <WalletCards size={18} />
              Wallet
            </button>
          </div>
        </div>
        <div className="hero-balances">
          <BalanceCard label={getCurrencyDisplayName("GOLD")} amount={balances.GOLD} tone="gold" currency="GOLD" />
          <BalanceCard label={getCurrencyDisplayName("BONUS")} amount={balances.BONUS} tone="bonus" currency="BONUS" />
        </div>
      </div>

      <RetentionPanel onClaimed={refreshRewards} />
      <ProgressionBar progress={progression} />
      <StreakCard onClaimed={refreshRewards} />
      <MissionsPanel />
    </section>
  );
}
