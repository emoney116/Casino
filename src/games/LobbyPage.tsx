import { Gift, WalletCards } from "lucide-react";
import { useMemo, useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { BalanceCard } from "../components/BalanceCard";
import { GameCard } from "../components/GameCard";
import { useToast } from "../components/ToastContext";
import { formatCoins } from "../lib/format";
import { canClaimDailyBonus, claimDailyBonus, DAILY_BONUS_AMOUNT } from "../wallet/dailyBonusService";
import { getBalance } from "../wallet/walletService";
import { getRecentGames } from "./recentGames";
import { slotConfigs } from "./slotConfigs";
import type { SlotConfig, Volatility } from "./types";
import { getProgression } from "../progression/progressionService";
import { ProgressionBar } from "../progression/ProgressionBar";
import { StreakCard } from "../streaks/StreakCard";
import { MissionsPanel } from "../missions/MissionsPanel";
import { getFavorites, toggleFavorite } from "./favorites";

export function LobbyPage({ onPlay, onWallet }: { onPlay: (gameId: string) => void; onWallet: () => void }) {
  const { user, refreshUser } = useAuth();
  const notify = useToast();
  const [search, setSearch] = useState("");
  const [volatility, setVolatility] = useState<"All" | Volatility>("All");
  const [version, setVersion] = useState(0);
  if (!user) return null;
  const currentUser = user;

  const balances = getBalance(currentUser.id);
  const progression = getProgression(currentUser.id);
  const favorites = getFavorites(currentUser.id);
  const dailyAvailable = canClaimDailyBonus(currentUser);
  const filteredGames = useMemo(() => {
    const term = search.trim().toLowerCase();
    return slotConfigs.filter((game) => {
      const matchesSearch = !term || `${game.name} ${game.theme}`.toLowerCase().includes(term);
      const matchesVolatility = volatility === "All" || game.volatility === volatility;
      return matchesSearch && matchesVolatility;
    });
  }, [search, volatility]);
  const recent = getRecentGames()
    .map((id) => slotConfigs.find((game) => game.id === id))
    .filter(Boolean)
    .slice(0, 3) as typeof slotConfigs;

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
          <p className="eyebrow">Virtual casino lobby</p>
          <h1>Play demo slots with virtual coins</h1>
          <p className="muted">
            No real-money gambling, deposits, withdrawals, prizes, or redemptions are available.
          </p>
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

      <div className="lobby-filters card">
        <label>
          Search games
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Theme or title" />
        </label>
        <label>
          Volatility
          <select value={volatility} onChange={(event) => setVolatility(event.target.value as "All" | Volatility)}>
            <option value="All">All</option>
            <option value="Low">Low</option>
            <option value="Medium">Medium</option>
            <option value="High">High</option>
          </select>
        </label>
      </div>

      {search || volatility !== "All" ? (
        <GameSection title="Filtered Games" games={filteredGames} onPlay={onPlay} emptyText="No games match those filters." />
      ) : (
        <>
          <GameSection title="Favorites" games={favorites.map((id) => slotConfigs.find((game) => game.id === id)).filter(Boolean) as SlotConfig[]} onPlay={onPlay} emptyText="No favorites yet. Tap the star on any game tile." favorites={favorites} onToggleFavorite={(id) => { toggleFavorite(currentUser.id, id); setVersion((value) => value + 1); }} />
          <GameSection title="Featured Games" games={slotConfigs} onPlay={onPlay} favorites={favorites} onToggleFavorite={(id) => { toggleFavorite(currentUser.id, id); setVersion((value) => value + 1); }} />
          <GameSection title="New Releases" games={[slotConfigs[2], slotConfigs[3], slotConfigs[4]]} onPlay={onPlay} />
          <GameSection title="High Volatility" games={slotConfigs.filter((game) => game.volatility === "High")} onPlay={onPlay} />
          <GameSection title="Bonus Games" games={slotConfigs.filter((game) => game.freeSpins || game.pickBonus)} onPlay={onPlay} />
          <GameSection title="Recently Played" games={recent} onPlay={onPlay} emptyText="No recently played games yet. Pick a game to start your history." />
        </>
      )}
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
        <span>{games.length} games</span>
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
