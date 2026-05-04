import { useAuth } from "../auth/AuthContext";
import { canClaimStreak, claimStreak, getStreak, streakRewards } from "./streakService";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { getCurrencyShortName } from "../config/currencyConfig";

export function StreakCard({ onClaimed }: { onClaimed?: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  if (!user) return null;
  const currentUser = user;
  const streak = getStreak(currentUser.id);
  const available = canClaimStreak(currentUser.id);

  function claim() {
    try {
      claimStreak(currentUser.id);
      refreshUser();
      onClaimed?.();
    } catch (error) {
      notify(error instanceof Error ? error.message : "Streak unavailable.", "error");
    }
  }

  return (
    <article className="card streak-card">
      <div className="section-title">
        <div>
          <p className="eyebrow">Daily streak</p>
          <h2>Day {streak.day}</h2>
        </div>
        <button className="primary-button" disabled={!available} onClick={claim}>{available ? "Claim" : "Claimed"}</button>
      </div>
      <div className="streak-grid">
        {streakRewards.map((reward) => {
          const state = reward.day < streak.day ? "claimed" : reward.day === streak.day ? "available" : "locked";
          return (
            <div className={`streak-day ${state}`} key={reward.day}>
              <strong>D{reward.day}</strong>
              <span>{formatCoins(reward.bonus)} {getCurrencyShortName("BONUS")}</span>
              {reward.gold > 0 && <small>+{reward.gold} {getCurrencyShortName("GOLD")}</small>}
            </div>
          );
        })}
      </div>
      <small>Virtual currency only. Streak resets if more than 48 hours are missed.</small>
    </article>
  );
}
