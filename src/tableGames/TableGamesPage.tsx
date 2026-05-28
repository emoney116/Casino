import { lazy, Suspense, useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Search } from "lucide-react";
import type { TableGameConfig, TableGameId } from "./types";
import { tableGameConfigs } from "./configs";
import { TableGameCard } from "./TableGameCard";

const BlackjackPage = lazy(() => import("./BlackjackPage").then((module) => ({ default: module.BlackjackPage })));
const RoulettePage = lazy(() => import("./RoulettePage").then((module) => ({ default: module.RoulettePage })));
const DicePage = lazy(() => import("./DicePage").then((module) => ({ default: module.DicePage })));
const CrashPage = lazy(() => import("./CrashPage").then((module) => ({ default: module.CrashPage })));
const TreasureDigPage = lazy(() => import("./TreasureDigPage").then((module) => ({ default: module.TreasureDigPage })));
const BrickBreakBonusPage = lazy(() => import("./BrickBreakBonusPage").then((module) => ({ default: module.BrickBreakBonusPage })));
const BalloonPopPage = lazy(() => import("./BalloonPopPage").then((module) => ({ default: module.BalloonPopPage })));
const LavaRunPage = lazy(() => import("./LavaRunPage").then((module) => ({ default: module.LavaRunPage })));
const EmberStackPage = lazy(() => import("./EmberStackPage").then((module) => ({ default: module.EmberStackPage })));
const SafecrackerPage = lazy(() => import("./SafecrackerPage").then((module) => ({ default: module.SafecrackerPage })));

export type TableGameSortKey = "name" | "popular" | "recent";
export type TableGameSortDirection = "asc" | "desc";

export const tableGameSortOptions: Array<{ key: TableGameSortKey; label: string }> = [
  { key: "name", label: "Name" },
  { key: "popular", label: "Popular" },
  { key: "recent", label: "Recent" },
];

const tableGameSortRanks: Record<TableGameId, { popular: number; recent: number }> = {
  safecracker: { popular: 100, recent: 100 },
  emberStack: { popular: 92, recent: 90 },
  lavaRun: { popular: 84, recent: 80 },
  balloonPop: { popular: 96, recent: 70 },
  brickBreakBonus: { popular: 72, recent: 60 },
  blackjack: { popular: 78, recent: 10 },
  roulette: { popular: 70, recent: 20 },
  dice: { popular: 58, recent: 30 },
  crash: { popular: 64, recent: 40 },
  treasureDig: { popular: 62, recent: 50 },
};

export function sortTableGames(games: TableGameConfig[], sortKey: TableGameSortKey, direction: TableGameSortDirection) {
  const factor = direction === "asc" ? 1 : -1;
  return games.slice().sort((left, right) => {
    if (sortKey === "name") return left.name.localeCompare(right.name) * factor;
    const leftRank = tableGameSortRanks[left.id]?.[sortKey] ?? 0;
    const rightRank = tableGameSortRanks[right.id]?.[sortKey] ?? 0;
    if (leftRank !== rightRank) return (leftRank - rightRank) * factor;
    return left.name.localeCompare(right.name);
  });
}

export function TableGamesPage({
  activeGameId,
  onGameChange,
  onExit,
}: {
  activeGameId: TableGameId | null;
  onGameChange: (gameId: TableGameId) => void;
  onExit: () => void;
}) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<TableGameSortKey>("popular");
  const [sortDirection, setSortDirection] = useState<TableGameSortDirection>("desc");
  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const filteredGames = normalized
      ? tableGameConfigs.filter((game) => (
        game.name.toLowerCase().includes(normalized) ||
        game.theme.toLowerCase().includes(normalized) ||
        game.rules.some((rule) => rule.toLowerCase().includes(normalized))
      ))
      : tableGameConfigs;
    return sortTableGames(filteredGames, sortKey, sortDirection);
  }, [query, sortDirection, sortKey]);

  if (activeGameId) {
    return (
      <section className={activeGameId === "blackjack" ? "page-stack blackjack-game-host" : activeGameId === "dice" ? "page-stack over-under-game-host" : activeGameId === "crash" ? "page-stack crash-game-host" : activeGameId === "treasureDig" ? "page-stack treasure-dig-game-host" : activeGameId === "brickBreakBonus" ? "page-stack brick-break-game-host" : activeGameId === "balloonPop" ? "page-stack balloon-pop-game-host" : activeGameId === "lavaRun" ? "page-stack lava-run-game-host" : activeGameId === "emberStack" ? "page-stack ember-stack-game-host" : activeGameId === "safecracker" ? "page-stack safecracker-game-host" : "page-stack"}>
        <Suspense fallback={<div className="card loading-card">Loading game...</div>}>
          {activeGameId === "blackjack" && <BlackjackPage onExit={onExit} />}
          {activeGameId === "roulette" && <RoulettePage onExit={onExit} />}
          {activeGameId === "dice" && <DicePage onExit={onExit} />}
          {activeGameId === "crash" && <CrashPage onExit={onExit} />}
          {activeGameId === "treasureDig" && <TreasureDigPage onExit={onExit} />}
          {activeGameId === "brickBreakBonus" && <BrickBreakBonusPage onExit={onExit} />}
          {activeGameId === "balloonPop" && <BalloonPopPage onExit={onExit} />}
          {activeGameId === "lavaRun" && <LavaRunPage onExit={onExit} />}
          {activeGameId === "emberStack" && <EmberStackPage onExit={onExit} />}
          {activeGameId === "safecracker" && <SafecrackerPage onExit={onExit} />}
        </Suspense>
      </section>
    );
  }

  return (
    <section className="page-stack table-games-lobby">
      <div className="page-heading table-games-lobby-heading">
        <h1>Playheater Games</h1>
        <div className="table-games-lobby-tools">
          <label className="table-game-search compact">
            <Search className="table-game-search-icon" size={17} aria-hidden="true" />
            <input
              type="search"
              value={query}
              aria-label="Search games"
              placeholder="Search"
              onChange={(event) => setQuery(event.target.value)}
            />
          </label>
          <div className="table-game-sort" aria-label="Sort games">
            <div className="table-game-sort-tabs" role="tablist" aria-label="Sort games by">
              {tableGameSortOptions.map((option) => (
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
      <div className="game-grid table-game-grid">
        {visibleGames.map((game) => <TableGameCard key={game.id} game={game} onPlay={onGameChange} />)}
      </div>
      {visibleGames.length === 0 && <div className="table-game-empty">No games found.</div>}
    </section>
  );
}
