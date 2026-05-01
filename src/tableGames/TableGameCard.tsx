import { ArrowUpDown, CircleDot, Spade } from "lucide-react";
import type { TableGameConfig } from "./types";

const icons = {
  blackjack: Spade,
  roulette: CircleDot,
  dice: ArrowUpDown,
};

export function TableGameCard({ game, onPlay }: { game: TableGameConfig; onPlay: (gameId: TableGameConfig["id"]) => void }) {
  const Icon = icons[game.id];
  return (
    <article className={`table-game-card ${game.id}`}>
      <div className="table-game-art">
        <Icon size={52} />
      </div>
      <div className="game-card-body">
        <div>
          <h3>{game.name}</h3>
          <p>{game.theme}</p>
        </div>
        <div className="game-meta">
          <span>House edge {(game.houseEdgeTarget * 100).toFixed(1)}%</span>
          <span>{game.minBet}-{game.maxBet} coins</span>
          <span>Virtual only</span>
        </div>
        <button className="primary-button" onClick={() => onPlay(game.id)}>Play {game.name}</button>
      </div>
    </article>
  );
}
