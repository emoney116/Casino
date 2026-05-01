import { Gift, WalletCards } from "lucide-react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { BalanceCard } from "../components/BalanceCard";
import { GameCard } from "../components/GameCard";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { canClaimDailyBonus, claimDailyBonus, DAILY_BONUS_AMOUNT } from "../wallet/dailyBonusService";
import { getBalance } from "../wallet/walletService";
import { getRecentGames } from "./recentGames";
import { exposedSlotConfigs } from "./slotConfigs";
import type { SlotConfig } from "./types";
import { getProgression } from "../progression/progressionService";
import { ProgressionBar } from "../progression/ProgressionBar";
import { StreakCard } from "../streaks/StreakCard";
import { MissionsPanel } from "../missions/MissionsPanel";
import { getFavorites, toggleFavorite } from "./favorites";
import { tableGameConfigs } from "../tableGames/configs";
import { TableGameCard } from "../tableGames/TableGameCard";
import type { TableGameId } from "../tableGames/types";

export function LobbyPage({
  onPlay,
  onTablePlay,
  onWallet,
}: {
  onPlay: (gameId: string) => void;
  onTablePlay: (gameId: TableGameId) => void;
  onWallet: () => void;
}) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [version, setVersion] = useState(0);
  if (!user) return null;
  const currentUser = user;

  const balances = getBalance(currentUser.id);
  const progression = getProgression(currentUser.id);
  const favorites = getFavorites(currentUser.id);
  const dailyAvailable = canClaimDailyBonus(currentUser);
  const recent = getRecentGames()
    .map((id) => exposedSlotConfigs.find((game) => game.id === id))
    .filter(Boolean)
    .slice(0, 3) as SlotConfig[];

  function claim() {
    try {
      claimDailyBonus(currentUser.id);
      refreshUser();
      notify(`Claimed ${formatCoins(DAILY_BONUS_AMOUNT)} Bonus Coins.`, "success");
    } catch (caught) {
      notify(caught instanceof Error ? caught.message : "Daily bonus unavailable.", "error");
    }
  }

  return (
    <section className="page-stack">
      <div className="lobby-hero">
        <div>
          <p className="eyebrow">Virtual casino</p>
          <h1>Casino Lobby</h1>
          <div className="hero-actions">
            <button className="primary-button icon-button" onClick={claim} disabled={!dailyAvailable}>
              <Gift size={18} />
              {dailyAvailable ? "Claim Daily Bonus" : "Daily Bonus Claimed"}
            </button>
            <button className="ghost-button icon-button" onClick={onWallet}>
              <WalletCards size={18} />
              Wallet
            </button>
          </div>
        </div>
        <div className="hero-balances">
          <BalanceCard label="Gold Coins" amount={balances.GOLD} tone="gold" />
          <BalanceCard label="Bonus Coins" amount={balances.BONUS} tone="bonus" />
        </div>
      </div>

      <ProgressionBar progress={progression} />
      <StreakCard onClaimed={() => setVersion((value) => value + 1)} />
      <MissionsPanel compact />

      {favorites.length > 0 && (
        <GameSection title="Favorites" games={favorites.map((id) => exposedSlotConfigs.find((game) => game.id === id)).filter(Boolean) as SlotConfig[]} onPlay={onPlay} favorites={favorites} onToggleFavorite={(id) => { toggleFavorite(currentUser.id, id); setVersion((value) => value + 1); }} />
      )}
      <GameSection title="Slots" games={exposedSlotConfigs} onPlay={onPlay} favorites={favorites} onToggleFavorite={(id) => { toggleFavorite(currentUser.id, id); setVersion((value) => value + 1); }} />
      <TableGameSection onPlay={onTablePlay} />
      {recent.length > 0 && <GameSection title="Recently Played" games={recent} onPlay={onPlay} />}
    </section>
  );
}

function TableGameSection({ onPlay }: { onPlay: (gameId: TableGameId) => void }) {
  return (
    <section className="page-stack">
      <div className="section-title">
        <h2>Games</h2>
        <span>{formatGameCount(tableGameConfigs.length)}</span>
      </div>
      <div className="game-grid table-game-grid">
        {tableGameConfigs.map((game) => <TableGameCard key={game.id} game={game} onPlay={onPlay} />)}
      </div>
    </section>
  );
}

function GameSection({
  title,
  games,
  onPlay,
  emptyText,
  favorites = [],
  onToggleFavorite,
}: {
  title: string;
  games: SlotConfig[];
  onPlay: (gameId: string) => void;
  emptyText?: string;
  favorites?: string[];
  onToggleFavorite?: (gameId: string) => void;
}) {
  return (
    <section className="page-stack">
      <div className="section-title">
        <h2>{title}</h2>
        <span>{formatGameCount(games.length)}</span>
      </div>
      {games.length === 0 ? (
        <div className="empty-state">{emptyText ?? "No games found."}</div>
      ) : (
        <div className="game-grid">
          {games.map((game) => (
            <GameCard key={game.id} game={game} onPlay={onPlay} favorite={favorites.includes(game.id)} onToggleFavorite={onToggleFavorite} />
          ))}
        </div>
      )}
    </section>
  );
}

function formatGameCount(count: number) {
  return `${count} ${count === 1 ? "game" : "games"}`;
}
