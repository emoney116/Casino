import type { SlotConfig } from "../games/types";
import { GameLogo } from "../games/GameLogo";
import { Flame, Star } from "lucide-react";
import type { CSSProperties } from "react";

export type GameCardBadge = "HOT" | "NEW" | "FEATURED" | "ARCADE" | "TABLE";

export function GameCard({
  game,
  onPlay,
  favorite = false,
  onToggleFavorite,
  hot = false,
  badges = [],
}: {
  game: SlotConfig;
  onPlay: (gameId: string) => void;
  favorite?: boolean;
  onToggleFavorite?: (gameId: string) => void;
  hot?: boolean;
  badges?: GameCardBadge[];
}) {
  const cardBadges = [...new Set([...(hot ? ["HOT" as GameCardBadge] : []), ...badges])];

  return (
    <article
      className="game-card title-card"
      style={
        {
          "--accent": game.visual.accent,
          "--secondary": game.visual.secondary,
          "--panel": game.visual.panel,
        } as CSSProperties
      }
      >
      {cardBadges.length > 0 && (
        <div className="game-card-badges" aria-label={`${game.name} tags`}>
          {cardBadges.map((badge) => (
            <span key={badge} className={badge === "HOT" ? "hot-badge" : `game-badge-${badge.toLowerCase().replace(/\s+/g, "-")}`}>
              {badge === "HOT" && <Flame size={12} />}
              {badge}
            </span>
          ))}
        </div>
      )}
      {onToggleFavorite && (
        <button className={`favorite-button ${favorite ? "active" : ""}`} onClick={() => onToggleFavorite(game.id)} title="Favorite" aria-label={`${favorite ? "Remove" : "Add"} ${game.name} favorite`}>
          <Star size={17} />
        </button>
      )}
      <button type="button" className="game-card-link" onClick={() => onPlay(game.id)}>
        <div className="game-art">
          <GameLogo game={game} showName={false} />
        </div>
        <strong>{game.name}</strong>
      </button>
    </article>
  );
}
