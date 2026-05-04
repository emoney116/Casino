import { lazy, Suspense, useMemo, useState } from "react";
import { GameCard } from "../components/GameCard";
import { getSlotConfig, exposedSlotConfigs } from "./slotConfigs";

const SlotMachine = lazy(() => import("./SlotMachine").then((module) => ({ default: module.SlotMachine })));

export function GamesPage({
  activeGameId,
  onGameChange,
  onExit,
}: {
  activeGameId: string | null;
  onGameChange: (gameId: string | null) => void;
  onExit?: () => void;
}) {
  const [query, setQuery] = useState("");
  const game = activeGameId ? getSlotConfig(activeGameId) : null;
  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return exposedSlotConfigs;
    return exposedSlotConfigs.filter((candidate) => (
      candidate.name.toLowerCase().includes(normalized) ||
      candidate.theme.toLowerCase().includes(normalized) ||
      candidate.featureTypes?.some((feature) => feature.toLowerCase().includes(normalized))
    ));
  }, [query]);

  if (!game) {
    return (
      <section className="page-stack slot-games-lobby">
        <div className="page-heading table-games-lobby-heading">
          <div>
            <p className="eyebrow">Slot games</p>
            <h1>Slots</h1>
          </div>
          <label className="table-game-search">
            <span>Search games</span>
            <input
              type="search"
              value={query}
              placeholder="Search slots"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
        </div>
        <div className="game-grid">
          {visibleGames.map((candidate) => (
            <GameCard key={candidate.id} game={candidate} onPlay={onGameChange} />
          ))}
        </div>
        {visibleGames.length === 0 && <div className="table-game-empty">No slot games found.</div>}
      </section>
    );
  }

  return (
    <section className="page-stack flagship-game-page">
      <Suspense fallback={<div className="card loading-card">Loading slot...</div>}>
        <SlotMachine game={game} onExit={onExit} />
      </Suspense>
    </section>
  );
}
