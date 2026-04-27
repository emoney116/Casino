import { useEffect } from "react";
import { GameCard } from "../components/GameCard";
import { getSlotConfig, slotConfigs } from "./slotConfigs";
import { SlotMachine } from "./SlotMachine";

export function GamesPage({
  activeGameId,
  onGameChange,
}: {
  activeGameId: string | null;
  onGameChange: (gameId: string | null) => void;
}) {
  const game = activeGameId ? getSlotConfig(activeGameId) : null;

  useEffect(() => {
    if (!activeGameId) onGameChange(slotConfigs[0].id);
  }, [activeGameId, onGameChange]);

  if (!game) return null;

  return (
    <section className="page-stack">
      <div className="game-selector">
        {slotConfigs.map((candidate) => (
          <button
            className={candidate.id === game.id ? "active" : ""}
            key={candidate.id}
            onClick={() => onGameChange(candidate.id)}
          >
            {candidate.name}
          </button>
        ))}
      </div>
      <SlotMachine game={game} />
      <section className="page-stack">
        <div className="section-title">
          <h2>More Games</h2>
          <span>Virtual coins only</span>
        </div>
        <div className="game-grid compact">
          {slotConfigs
            .filter((candidate) => candidate.id !== game.id)
            .map((candidate) => (
              <GameCard key={candidate.id} game={candidate} onPlay={onGameChange} />
            ))}
        </div>
      </section>
    </section>
  );
}
