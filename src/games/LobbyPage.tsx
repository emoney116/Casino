import { Dices, Flame, Gamepad2, Gift, Sparkles, WalletCards } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { GameCard } from "../components/GameCard";
import { getRecentGames } from "./recentGames";
import { exposedSlotConfigs } from "./slotConfigs";
import type { SlotConfig } from "./types";
import { getFavorites, toggleFavorite } from "./favorites";
import { tableGameConfigs } from "../tableGames/configs";
import { TableGameCard } from "../tableGames/TableGameCard";
import type { TableGameId } from "../tableGames/types";

export function LobbyPage({
  onPlay,
  onTablePlay,
  onWallet,
  onRewards,
  onSlots,
  onGames,
}: {
  onPlay: (gameId: string) => void;
  onTablePlay: (gameId: TableGameId) => void;
  onWallet: () => void;
  onRewards: () => void;
  onSlots: () => void;
  onGames: () => void;
}) {
  const { user } = useAuth();
  const [version, setVersion] = useState(0);
  if (!user) return null;
  const currentUser = user;

  const favorites = getFavorites(currentUser.id);
  const recent = getRecentGames()
    .map((id) => exposedSlotConfigs.find((game) => game.id === id))
    .filter(Boolean)
    .slice(0, 3) as SlotConfig[];
  const newSlots = exposedSlotConfigs.slice(0, 4);
  const trendingTables = tableGameConfigs.slice(0, 4);

  return (
    <section className="page-stack">
      <div className="lobby-hero lobby-home">
        <div>
          <p className="eyebrow">Virtual casino</p>
          <h1>Casino Lobby</h1>
          <div className="lobby-shortcuts">
            <button className="ghost-button icon-button" onClick={onSlots}>
              <Gamepad2 size={18} />
              Slots
            </button>
            <button className="ghost-button icon-button" onClick={onGames}>
              <Dices size={18} />
              Games
            </button>
            <button className="ghost-button icon-button" onClick={onRewards}>
              <Gift size={18} />
              Rewards
            </button>
            <button className="ghost-button icon-button" onClick={onWallet}>
              <WalletCards size={18} />
              Wallet
            </button>
          </div>
        </div>
      </div>

      {favorites.length > 0 && (
        <GameSection title="Favorites" games={favorites.map((id) => exposedSlotConfigs.find((game) => game.id === id)).filter(Boolean) as SlotConfig[]} onPlay={onPlay} favorites={favorites} onToggleFavorite={(id) => { toggleFavorite(currentUser.id, id); setVersion((value) => value + 1); }} />
      )}
      {recent.length > 0 && <GameSection title="Recently Played" games={recent} onPlay={onPlay} />}
      <GameSection title="New Slots" games={newSlots} onPlay={onPlay} favorites={favorites} onToggleFavorite={(id) => { toggleFavorite(currentUser.id, id); setVersion((value) => value + 1); }} icon={<Sparkles size={18} />} />
      <TableGameSection title="Trending Games" games={trendingTables} onPlay={onTablePlay} icon={<Flame size={18} />} />
    </section>
  );
}

function TableGameSection({
  title,
  games,
  onPlay,
  icon,
}: {
  title: string;
  games: typeof tableGameConfigs;
  onPlay: (gameId: TableGameId) => void;
  icon?: ReactNode;
}) {
  return (
    <section className="page-stack">
      <div className="section-title">
        <h2>{icon}{title}</h2>
        <span>{formatGameCount(games.length)}</span>
      </div>
      <div className="game-grid table-game-grid">
        {games.map((game) => <TableGameCard key={game.id} game={game} onPlay={onPlay} />)}
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
  icon,
}: {
  title: string;
  games: SlotConfig[];
  onPlay: (gameId: string) => void;
  emptyText?: string;
  favorites?: string[];
  onToggleFavorite?: (gameId: string) => void;
  icon?: ReactNode;
}) {
  return (
    <section className="page-stack">
      <div className="section-title">
        <h2>{icon}{title}</h2>
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
