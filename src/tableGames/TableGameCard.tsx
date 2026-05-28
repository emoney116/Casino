import { ArrowUpDown, CircleDot, Flame, Gem, Grid3X3, KeyRound, Rocket, Spade, Target } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import type { TableGameConfig } from "./types";
import type { GameCardBadge } from "../components/GameCard";

const icons = {
  blackjack: Spade,
  roulette: CircleDot,
  dice: ArrowUpDown,
  crash: Rocket,
  treasureDig: Gem,
  brickBreakBonus: Grid3X3,
  balloonPop: Target,
  lavaRun: Flame,
  emberStack: Flame,
  safecracker: KeyRound,
};

export function TableGameCard({
  game,
  onPlay,
  badges = [],
}: {
  game: TableGameConfig;
  onPlay: (gameId: TableGameConfig["id"]) => void;
  badges?: GameCardBadge[];
}) {
  const Icon = icons[game.id];
  return (
    <button type="button" className={`table-game-card title-card ${game.id}`} onClick={() => onPlay(game.id)}>
      {badges.length > 0 && (
        <div className="game-card-badges table-badges" aria-label={`${game.name} tags`}>
          {badges.map((badge) => (
            <span key={badge} className={badge === "HOT" ? "hot-badge" : `game-badge-${badge.toLowerCase().replace(/\s+/g, "-")}`}>
              {badge === "HOT" && <Flame size={12} />}
              {badge}
            </span>
          ))}
        </div>
      )}
      <div className="table-game-art">
        {game.artwork ? (
          <img className="table-game-raster-art" src={game.artwork} alt={`${game.name} game art`} />
        ) : (
          <GamePreview gameId={game.id} Icon={Icon} />
        )}
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
