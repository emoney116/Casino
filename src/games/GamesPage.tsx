import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import { GameCard } from "../components/GameCard";
import { getSlotConfig, exposedSlotConfigs } from "./slotConfigs";
import { SlotMachine as EagerSlotMachine } from "./SlotMachine";
import type { SlotConfig } from "./types";

const SlotMachine = lazy(() => import("./SlotMachine").then((module) => ({ default: module.SlotMachine })));

export type SlotGameSortKey = "name" | "popular" | "recent";
export type SlotGameSortDirection = "asc" | "desc";

export const slotGameSortOptions: Array<{ key: SlotGameSortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
];

const slotGameSortRanks: Record<string, { popular: number; recent: number }> = {
  "gold-rush-showdown": { popular: 100, recent: 90 },
  "frontier-fortune": { popular: 92, recent: 100 },
};

export function sortSlotGames(games: SlotConfig[], sortKey: SlotGameSortKey, direction: SlotGameSortDirection) {
  const factor = direction === "asc" ? 1 : -1;
  return games.slice().sort((left, right) => {
    if (sortKey === "name") return left.name.localeCompare(right.name) * factor;
    const leftRank = slotGameSortRanks[left.id]?.[sortKey] ?? 0;
    const rightRank = slotGameSortRanks[right.id]?.[sortKey] ?? 0;
    if (leftRank !== rightRank) return (leftRank - rightRank) * factor;
    return left.name.localeCompare(right.name);
  });
}

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
  const [sortKey, setSortKey] = useState<SlotGameSortKey>("popular");
  const [sortDirection, setSortDirection] = useState<SlotGameSortDirection>("desc");
  const game = activeGameId ? getSlotConfig(activeGameId) : null;
  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filteredGames = normalized
      ? exposedSlotConfigs.filter((candidate) => (
        candidate.name.toLowerCase().includes(normalized) ||
        candidate.theme.toLowerCase().includes(normalized) ||
        candidate.featureTypes?.some((feature) => feature.toLowerCase().includes(normalized))
      ))
      : exposedSlotConfigs;
    return sortSlotGames(filteredGames, sortKey, sortDirection);
  }, [query, sortDirection, sortKey]);

  if (!game) {
    return (
      <section className="page-stack slot-games-lobby">
        <div className="page-heading table-games-lobby-heading">
          <h1>Slots</h1>
          <div className="table-games-lobby-tools">
            <label className="table-game-search compact">
              <Search className="table-game-search-icon" size={17} aria-hidden="true" />
              <input
                type="search"
                value={query}
                aria-label="Search slots"
                placeholder="Search"
                onChange={(event) => setQuery(event.target.value)}
              />
            </label>
            <div className="table-game-sort" aria-label="Sort slots">
              <div className="table-game-sort-tabs" role="tablist" aria-label="Sort slots by">
                {slotGameSortOptions.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={sortKey === option.key ? "active" : ""}
                    role="tab"
                    aria-selected={sortKey === option.key}
                    onClick={() => setSortKey(option.key)}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
              <button
                className="table-game-sort-direction"
                type="button"
                aria-label={`Sort ${sortDirection === "asc" ? "up" : "down"}`}
                onClick={() => setSortDirection((current) => (current === "asc" ? "desc" : "asc"))}
              >
                {sortDirection === "asc" ? <ArrowUp size={16} aria-hidden="true" /> : <ArrowDown size={16} aria-hidden="true" />}
              </button>
            </div>
          </div>
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
      {game.id === "gold-rush-showdown" ? (
        <EagerSlotMachine game={game} onExit={onExit} />
      ) : (
        <Suspense fallback={<div className="card loading-card">Loading slot...</div>}>
          <SlotMachine game={game} onExit={onExit} />
        </Suspense>
      )}
    </section>
  );
}
