import { Play } from "lucide-react";
import { formatCoins } from "../lib/format";
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
      className="game-card"
      style={
        {
          "--accent": game.visual.accent,
          "--secondary": game.visual.secondary,
          "--panel": game.visual.panel,
        } as React.CSSProperties
      }
    >
      <div className="game-art">
        {onToggleFavorite && (
          <button className={`favorite-button ${favorite ? "active" : ""}`} onClick={() => onToggleFavorite(game.id)} title="Favorite">
            <Star size={17} />
          </button>
        )}
        <GameLogo game={game} />
      </div>
      <div className="game-card-body">
        <div>
          <h3>{game.name}</h3>
          <p>{game.theme}</p>
        </div>
        <div className="game-meta">
          <span>{game.volatility}</span>
          <span>RTP {(game.targetRtp * 100).toFixed(1)}%</span>
          <span>
            {formatCoins(game.minBet)}-{formatCoins(game.maxBet)}
          </span>
        </div>
        <div className="card-footer-row">
          <small>Virtual coins only</small>
          <button className="primary-button icon-button" onClick={() => onPlay(game.id)}>
            <Play size={16} />
            Play
          </button>
        </div>
      </div>
    </article>
  );
}
