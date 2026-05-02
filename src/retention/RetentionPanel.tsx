import { Gift, Sparkles, WalletCards } from "lucide-react";
import { useEffect, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import {
  canClaimLowBalanceOffer,
  canClaimPromotion,
  claimLowBalanceOffer,
  claimPromotion,
  getActivePromotions,
  getMostPlayedGames,
  getRetentionState,
  isLowBalance,
} from "./retentionService";

export function RetentionPanel({ onClaimed }: { onClaimed?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [now, setNow] = useState(() => new Date());
  const [version, setVersion] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  if (!user) return null;
  const currentUser = user;
  const state = getRetentionState(currentUser.id);
  const low = isLowBalance(currentUser.id);
  const promotions = getActivePromotions(now).filter((promo) => promo.active);
  const mostPlayed = getMostPlayedGames(currentUser.id);

  function claimLow() {
    try {
      claimLowBalanceOffer(currentUser.id);
      refreshUser();
      setVersion((value) => value + 1);
      onClaimed?.();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Offer unavailable.", "error");
    }
  }

  function claimPromo(id: string) {
    try {
      claimPromotion(currentUser.id, id);
      refreshUser();
      setVersion((value) => value + 1);
      onClaimed?.();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Promotion unavailable.", "error");
    }
  }

  return (
    <article className="card retention-panel" key={version}>
      <div className="section-title">
        <div>
          <p className="eyebrow">Rewards</p>
          <h2>Comeback Rewards</h2>
        </div>
        <span>{state.dailyGameIds.length}/3 games</span>
      </div>

      {low && (
        <div className="retention-offer low">
          <WalletCards size={18} />
          <div>
            <strong>You&apos;re running low</strong>
            <span>Claim a virtual coin boost and keep playing.</span>
          </div>
          <button className="primary-button" disabled={!canClaimLowBalanceOffer(currentUser.id)} onClick={claimLow}>
            Claim
          </button>
        </div>
      )}

      <div className="retention-promo-row">
        {promotions.map((promo) => (
          <div className="retention-offer promo" key={promo.id}>
            {promo.id === "bonus-2x" ? <Sparkles size={18} /> : <Gift size={18} />}
            <div>
              <strong>{promo.title}</strong>
              <span>{formatTimeLeft(promo.endsAt, now)} left</span>
            </div>
            <button className="ghost-button" disabled={!canClaimPromotion(currentUser.id, promo.id)} onClick={() => claimPromo(promo.id)}>
              {formatCoins(promo.reward)}
            </button>
          </div>
        ))}
      </div>

      <div className="retention-stats">
        <div>
          <strong>Switch Bonus</strong>
          <span>{state.dailyGameIds.length >= 3 ? "Reward earned today" : `Play ${3 - state.dailyGameIds.length} more game${3 - state.dailyGameIds.length === 1 ? "" : "s"}`}</span>
        </div>
        <div>
          <strong>Most Played</strong>
          <span>{mostPlayed.length ? mostPlayed.map((game) => `${game.gameId} (${game.plays})`).join(", ") : "Play a round to start tracking"}</span>
        </div>
      </div>
    </article>
  );
}

function formatTimeLeft(endsAt: string, now: Date) {
  const ms = Math.max(0, new Date(endsAt).getTime() - now.getTime());
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}
