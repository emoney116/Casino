import { useMemo, useState } from "react";
import type { TableGameId } from "./types";
import { tableGameConfigs } from "./configs";
import { TableGameCard } from "./TableGameCard";
import { BlackjackPage } from "./BlackjackPage";
import { RoulettePage } from "./RoulettePage";
import { DicePage } from "./DicePage";
import { CrashPage } from "./CrashPage";

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
  const visibleGames = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return tableGameConfigs;
    return tableGameConfigs.filter((game) => (
      game.name.toLowerCase().includes(normalized) ||
      game.theme.toLowerCase().includes(normalized) ||
      game.rules.some((rule) => rule.toLowerCase().includes(normalized))
    ));
  }, [query]);

  if (activeGameId) {
    return (
      <section className={activeGameId === "blackjack" ? "page-stack blackjack-game-host" : activeGameId === "dice" ? "page-stack over-under-game-host" : activeGameId === "crash" ? "page-stack crash-game-host" : "page-stack"}>
        {activeGameId === "blackjack" && <BlackjackPage onExit={onExit} />}
        {activeGameId === "roulette" && <RoulettePage onExit={onExit} />}
        {activeGameId === "dice" && <DicePage onExit={onExit} />}
        {activeGameId === "crash" && <CrashPage onExit={onExit} />}
      </section>
    );
  }

  return (
    <section className="page-stack table-games-lobby">
      <div className="page-heading table-games-lobby-heading">
        <div>
          <p className="eyebrow">Virtual table games</p>
          <h1>Table Games</h1>
        </div>
        <label className="table-game-search">
          <span>Search games</span>
          <input
            type="search"
            value={query}
            placeholder="Search table games"
            onChange={(event) => setQuery(event.target.value)}
          />
        </label>
      </div>
      <div className="game-grid table-game-grid">
        {visibleGames.map((game) => <TableGameCard key={game.id} game={game} onPlay={onGameChange} />)}
      </div>
      {visibleGames.length === 0 && <div className="table-game-empty">No table games found.</div>}
    </section>
  );
}
