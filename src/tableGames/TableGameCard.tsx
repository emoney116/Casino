import { ArrowUpDown, CircleDot, Gem, Grid3X3, Rocket, Spade, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TableGameConfig } from "./types";

const icons = {
  blackjack: Spade,
  roulette: CircleDot,
  dice: ArrowUpDown,
  crash: Rocket,
  treasureDig: Gem,
  brickBreakBonus: Grid3X3,
  balloonPop: Target,
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
        <div className="preview-roulette-wheel">
          <Icon size={46} />
          <span />
        </div>
      )}
      {gameId === "dice" && (
        <div className="preview-over-under">
          <span>48</span>
          <Icon size={48} />
          <span>52</span>
        </div>
      )}
      {gameId === "crash" && (
        <div className="preview-crash">
          <Icon size={42} />
          <strong>2.38x</strong>
          <span />
        </div>
      )}
      {gameId === "treasureDig" && (
        <div className="preview-treasure">
          {Array.from({ length: 9 }, (_, index) => (
            <span key={index} className={index === 4 ? "gem" : index === 7 ? "trap" : ""}>
              {index === 4 ? <Icon size={18} /> : index === 7 ? "!" : ""}
            </span>
          ))}
        </div>
      )}
      {gameId === "brickBreakBonus" && (
        <div className="preview-brick-break">
          {Array.from({ length: 18 }, (_, index) => <span key={index} className={index % 5 === 0 ? "hot" : ""} />)}
          <i />
          <b />
        </div>
      )}
      {gameId === "balloonPop" && (
        <div className="preview-balloon-pop">
          {Array.from({ length: 12 }, (_, index) => <span key={index} className={index % 4 === 0 ? "gold" : index % 3 === 0 ? "blue" : ""} />)}
          <i />
          <b />
        </div>
      )}
    </div>
  );
}
