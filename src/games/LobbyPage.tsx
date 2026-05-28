import { ChevronRight, Dices, Flame, Gamepad2, Gift, Play, Sparkles, WalletCards } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "../auth/AuthContext";
import { GameCard } from "../components/GameCard";
import type { GameCardBadge } from "../components/GameCard";
import { getRecentGames } from "./recentGames";
import { exposedSlotConfigs } from "./slotConfigs";
import type { SlotConfig } from "./types";
import { getFavorites, toggleFavorite } from "./favorites";
import { tableGameConfigs } from "../tableGames/configs";
import { TableGameCard } from "../tableGames/TableGameCard";
import type { TableGameConfig, TableGameId } from "../tableGames/types";
import { PlayheaterWordmark } from "../branding/playheater";

type LobbyItem =
  | { kind: "slot"; game: SlotConfig; badges: GameCardBadge[] }
  | { kind: "table"; game: TableGameConfig; badges: GameCardBadge[] };

const liveWinItems = [
  { symbol: "$", game: "Ember Stack", action: "paid", value: "40x" },
  { symbol: "x", game: "Safecracker", action: "unlocked", value: "250x" },
  { symbol: "*", game: "Gold Rush", action: "hit", value: "112x" },
  { symbol: "+", game: "Balloon Pop", action: "won", value: "18x" },
  { symbol: "#", game: "Frontier Fortune", action: "landed", value: "64x" },
  { symbol: "x", game: "Lava Run", action: "cashed", value: "76x" },
  { symbol: "*", game: "Brick Break", action: "cleared", value: "29x" },
  { symbol: "#", game: "Crash", action: "flew", value: "8.7x" },
];

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
  const [, refreshFavorites] = useState(0);
  if (!user) return null;
  const currentUser = user;

  const favorites = getFavorites(currentUser.id);
  const favoriteSlots = favorites
    .map((id) => exposedSlotConfigs.find((game) => game.id === id))
    .filter(Boolean) as SlotConfig[];
  const recentSlots = getRecentGames()
    .map((id) => exposedSlotConfigs.find((game) => game.id === id))
    .filter(Boolean)
    .slice(0, 6) as SlotConfig[];
  const goldRush = exposedSlotConfigs.find((game) => game.id === "gold-rush-showdown") ?? exposedSlotConfigs[0];
  const frontier = exposedSlotConfigs.find((game) => game.id === "frontier-fortune") ?? exposedSlotConfigs[1] ?? exposedSlotConfigs[0];
  const tableGameById = (id: TableGameId) => tableGameConfigs.find((game) => game.id === id);
  const safecracker = tableGameById("safecracker");
  const emberStack = tableGameById("emberStack");
  const lavaRun = tableGameById("lavaRun");
  const balloonPop = tableGameById("balloonPop");
  const brickBreak = tableGameById("brickBreakBonus");
  const blackjack = tableGameById("blackjack");
  const roulette = tableGameById("roulette");
  const dice = tableGameById("dice");
  const crash = tableGameById("crash");

  const hotNow: LobbyItem[] = [
    { kind: "slot", game: goldRush, badges: ["HOT", "FEATURED"] },
    safecracker ? { kind: "table", game: safecracker, badges: ["HOT", "NEW"] } : null,
    emberStack ? { kind: "table", game: emberStack, badges: ["HOT", "ARCADE"] } : null,
    { kind: "slot", game: frontier, badges: ["FEATURED"] },
  ].filter(Boolean) as LobbyItem[];
  const trendingGames = [safecracker, emberStack, lavaRun, balloonPop, brickBreak].filter(Boolean) as TableGameConfig[];
  const tableGames = [blackjack, roulette, dice, crash].filter(Boolean) as TableGameConfig[];
  const arcadePicks = [balloonPop, brickBreak, lavaRun, emberStack].filter(Boolean) as TableGameConfig[];

  function onToggleFavorite(gameId: string) {
    toggleFavorite(currentUser.id, gameId);
    refreshFavorites((value) => value + 1);
  }

  function renderLobbyItem(item: LobbyItem) {
    if (item.kind === "slot") {
      return (
        <GameCard
          key={`slot-${item.game.id}`}
          game={item.game}
          onPlay={onPlay}
          favorite={favorites.includes(item.game.id)}
          onToggleFavorite={onToggleFavorite}
          badges={item.badges}
        />
      );
    }
    return <TableGameCard key={`table-${item.game.id}`} game={item.game} onPlay={onTablePlay} badges={item.badges} />;
  }

  return (
    <section className="page-stack playheater-lobby" aria-label="PLAYHEATER lobby">
      <div className="lobby-hero lobby-home playheater-home-hero">
        <span className="lobby-ember lobby-ember-one" aria-hidden="true" />
        <span className="lobby-ember lobby-ember-two" aria-hidden="true" />
        <span className="lobby-ember lobby-ember-three" aria-hidden="true" />
        <div className="lobby-hero-brand">
          <PlayheaterWordmark className="lobby-wordmark" />
          <div className="lobby-shortcuts">
            <button className="ghost-button icon-button" onClick={onSlots}>
              <Gamepad2 size={17} />
              Slots
            </button>
            <button className="ghost-button icon-button" onClick={onGames}>
              <Dices size={17} />
              Games
            </button>
            <button className="ghost-button icon-button" onClick={onRewards}>
              <Gift size={17} />
              Rewards
            </button>
            <button className="ghost-button icon-button" onClick={onWallet}>
              <WalletCards size={17} />
              Wallet
            </button>
          </div>
        </div>
      </div>

      <LiveWinTicker />
      <FeaturedSlotBanner game={goldRush} onPlay={onPlay} />

      {recentSlots.length > 0 && (
        <LobbyCarouselSection title="Continue Playing" countText={formatGameCount(recentSlots.length)} onViewAll={onSlots}>
          {recentSlots.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={onPlay}
              favorite={favorites.includes(game.id)}
              onToggleFavorite={onToggleFavorite}
              badges={["FEATURED"]}
            />
          ))}
        </LobbyCarouselSection>
      )}

      {favoriteSlots.length > 0 && (
        <LobbyCarouselSection title="Favorites" countText={formatGameCount(favoriteSlots.length)} onViewAll={onSlots}>
          {favoriteSlots.map((game) => (
            <GameCard
              key={game.id}
              game={game}
              onPlay={onPlay}
              favorite={favorites.includes(game.id)}
              onToggleFavorite={onToggleFavorite}
              badges={["FEATURED"]}
            />
          ))}
        </LobbyCarouselSection>
      )}

      <LobbyCarouselSection title="Hot Now" countText={formatGameCount(hotNow.length)} icon={<Flame size={18} />} onViewAll={onGames}>
        {hotNow.map(renderLobbyItem)}
      </LobbyCarouselSection>

      <LobbyCarouselSection title="New Slots" countText={formatGameCount(exposedSlotConfigs.length)} icon={<Sparkles size={18} />} onViewAll={onSlots}>
        {exposedSlotConfigs.map((game, index) => (
          <GameCard
            key={game.id}
            game={game}
            onPlay={onPlay}
            favorite={favorites.includes(game.id)}
            onToggleFavorite={onToggleFavorite}
            badges={index === 0 ? ["NEW", "FEATURED"] : ["NEW", "FEATURED"]}
          />
        ))}
      </LobbyCarouselSection>

      <LobbyCarouselSection title="Trending Games" countText={formatGameCount(trendingGames.length)} onViewAll={onGames}>
        {trendingGames.map((game, index) => (
          <TableGameCard
            key={game.id}
            game={game}
            onPlay={onTablePlay}
            badges={index === 0 ? ["HOT", "FEATURED"] : index < 3 ? ["HOT"] : ["ARCADE"]}
          />
        ))}
      </LobbyCarouselSection>

      <LobbyCarouselSection title="Table Games" countText={formatGameCount(tableGames.length)} onViewAll={onGames}>
        {tableGames.map((game) => (
          <TableGameCard key={game.id} game={game} onPlay={onTablePlay} badges={["TABLE"]} />
        ))}
      </LobbyCarouselSection>

      <LobbyCarouselSection title="Arcade Picks" countText={formatGameCount(arcadePicks.length)} onViewAll={onGames}>
        {arcadePicks.map((game, index) => (
          <TableGameCard key={game.id} game={game} onPlay={onTablePlay} badges={index === 0 ? ["ARCADE", "HOT"] : ["ARCADE"]} />
        ))}
      </LobbyCarouselSection>
    </section>
  );
}

function FeaturedSlotBanner({ game, onPlay }: { game: SlotConfig; onPlay: (gameId: string) => void }) {
  return (
    <article
      className="lobby-featured-banner"
      style={
        {
          "--accent": game.visual.accent,
          "--secondary": game.visual.secondary,
          "--panel": game.visual.panel,
        } as CSSProperties
      }
    >
      <div className="lobby-featured-art" aria-hidden="true">
        {game.visual.logoImage ? (
          <img className="lobby-featured-logo" src={game.visual.logoImage} alt="" />
        ) : (
          <span className="lobby-featured-fallback">{game.visual.logo}</span>
        )}
      </div>
      <div className="lobby-featured-copy">
        <span>Featured</span>
        <h2>{game.name}</h2>
        <p>Mine-clash heat, bonus spins, and a gold rush board built for heaters.</p>
      </div>
      <button className="primary-button icon-button lobby-featured-play" type="button" onClick={() => onPlay(game.id)}>
        <Play size={16} fill="currentColor" />
        Play
      </button>
    </article>
  );
}

function LiveWinTicker() {
  return (
    <section className="live-win-ticker" aria-label="Live wins">
      <div className="live-win-ticker-label">
        <Flame size={14} />
        Live wins
      </div>
      <div className="live-win-ticker-viewport">
        {[0, 1].map((group) => (
          <div key={group} className="live-win-ticker-track" aria-hidden={group === 1 ? "true" : undefined}>
            {liveWinItems.map((item) => (
              <span key={`${group}-${item.game}`}>
                <i aria-hidden="true">{item.symbol}</i>
                <strong>{item.game}</strong> {item.action} <em>{item.value}</em>
              </span>
            ))}
          </div>
        ))}
      </div>
    </section>
  );
}

function LobbyCarouselSection({
  title,
  countText,
  children,
  icon,
  onViewAll,
}: {
  title: string;
  countText: string;
  children: ReactNode;
  icon?: ReactNode;
  onViewAll?: () => void;
}) {
  return (
    <section className="lobby-game-section">
      <div className="section-title lobby-section-title">
        <div>
          <h2>{icon}{title}</h2>
          <span>{countText}</span>
        </div>
        {onViewAll && (
          <button className="lobby-view-all" type="button" onClick={onViewAll}>
            View all
            <ChevronRight size={15} />
          </button>
        )}
      </div>
      <div className="lobby-rail">
        {children}
      </div>
    </section>
  );
}

function formatGameCount(count: number) {
  return `${count} ${count === 1 ? "game" : "games"}`;
}
