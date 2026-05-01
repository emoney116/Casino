import type { SlotConfig } from "../games/types";
import { GameLogo } from "../games/GameLogo";
import { Star } from "lucide-react";

export function GameCard({
  game,
  onPlay,
  favorite = false,
  onToggleFavorite,
}: {
  game: SlotConfig;
  onPlay: (gameId: string) => void;
  favorite?: boolean;
  onToggleFavorite?: (gameId: string) => void;
}) {
  return (
    <article
      className="game-card title-card"
      style={
        {
          "--accent": game.visual.accent,
          "--secondary": game.visual.secondary,
          "--panel": game.visual.panel,
        } as React.CSSProperties
      }
    >
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
