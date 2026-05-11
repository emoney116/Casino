import type { SlotConfig } from "../games/types";
import { GameLogo } from "../games/GameLogo";
import { Flame, Star } from "lucide-react";
import type { CSSProperties } from "react";

export function GameCard({
  game,
  onPlay,
  favorite = false,
  onToggleFavorite,
  hot = false,
}: {
  game: SlotConfig;
  onPlay: (gameId: string) => void;
  favorite?: boolean;
  onToggleFavorite?: (gameId: string) => void;
  hot?: boolean;
}) {
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
      <div className="game-card-badges" aria-label={`${game.name} tags`}>
        {hot && <span className="hot-badge"><Flame size={12} /> HOT</span>}
        <span>{game.volatility}</span>
        <span>{game.maxPayoutMultiplier}x</span>
      </div>
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
