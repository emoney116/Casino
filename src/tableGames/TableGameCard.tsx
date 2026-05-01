import { ArrowUpDown, CircleDot, Spade } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TableGameConfig } from "./types";

const icons = {
  blackjack: Spade,
  roulette: CircleDot,
  dice: ArrowUpDown,
};

export function TableGameCard({ game, onPlay }: { game: TableGameConfig; onPlay: (gameId: TableGameConfig["id"]) => void }) {
  const Icon = icons[game.id];
  return (
    <button type="button" className={`table-game-card title-card ${game.id}`} onClick={() => onPlay(game.id)}>
      <div className="table-game-art">
        <GamePreview gameId={game.id} Icon={Icon} />
      </div>
      <strong>{game.name}</strong>
    </button>
  );
}

function GamePreview({ gameId, Icon }: { gameId: TableGameConfig["id"]; Icon: LucideIcon }) {
  return (
    <div className={`table-game-preview ${gameId}`} aria-hidden="true">
      {gameId === "blackjack" && (
        <>
          <div className="preview-card back" />
          <div className="preview-card face"><Icon size={42} /></div>
        </>
      )}
      {gameId === "roulette" && (
        <div className="preview-wheel">
          <span><Icon size={20} /></span>
        </div>
      )}
      {gameId === "dice" && (
        <div className="preview-over-under">
          <span>48</span>
          <Icon size={48} />
          <span>52</span>
        </div>
      )}
    </div>
  );
}
