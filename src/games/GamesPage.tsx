import { useEffect } from "react";
import { getSlotConfig, exposedSlotConfigs } from "./slotConfigs";
import { SlotMachine } from "./SlotMachine";

export function GamesPage({
  activeGameId,
  onGameChange,
  onExit,
}: {
  activeGameId: string | null;
  onGameChange: (gameId: string | null) => void;
  onExit?: () => void;
}) {
  const game = activeGameId ? getSlotConfig(activeGameId) : null;

  useEffect(() => {
    if (!activeGameId || !exposedSlotConfigs.some((candidate) => candidate.id === activeGameId)) {
      onGameChange(exposedSlotConfigs[0].id);
    }
  }, [activeGameId, onGameChange]);

  if (!game) return null;

  return (
    <section className="page-stack flagship-game-page">
      <div className="game-selector">
        {exposedSlotConfigs.map((candidate) => (
          <button
            className={candidate.id === game.id ? "active" : ""}
            key={candidate.id}
            onClick={() => onGameChange(candidate.id)}
          >
            {candidate.name}
          </button>
        ))}
      </div>
      <SlotMachine game={game} onExit={onExit} />
    </section>
  );
}
