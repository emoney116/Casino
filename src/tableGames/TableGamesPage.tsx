import type { TableGameId } from "./types";
import { tableGameConfigs } from "./configs";
import { TableGameCard } from "./TableGameCard";
import { BlackjackPage } from "./BlackjackPage";
import { RoulettePage } from "./RoulettePage";
import { DicePage } from "./DicePage";

export function TableGamesPage({
  activeGameId,
  onGameChange,
  onExit,
}: {
  activeGameId: TableGameId | null;
  onGameChange: (gameId: TableGameId) => void;
  onExit: () => void;
}) {
  if (activeGameId) {
    return (
      <section className="page-stack">
        <button className="ghost-button table-back-button" onClick={onExit}>Back to Table Games</button>
        {activeGameId === "blackjack" && <BlackjackPage />}
        {activeGameId === "roulette" && <RoulettePage />}
        {activeGameId === "dice" && <DicePage />}
      </section>
    );
  }

  return (
    <section className="page-stack">
      <div className="page-heading">
        <div>
          <p className="eyebrow">Virtual table games</p>
          <h1>Table Games</h1>
          <p className="muted">
            Blackjack, American roulette, and dice built with virtual coins, configurable limits, and ledgered outcomes.
          </p>
        </div>
      </div>
      <div className="game-grid table-game-grid">
        {tableGameConfigs.map((game) => <TableGameCard key={game.id} game={game} onPlay={onGameChange} />)}
      </div>
      <div className="notice-card">
        Demo social casino prototype. Table games use Gold Coins or Bonus Coins only. No real-money gambling,
        deposits, withdrawals, prizes, or redemptions are available.
      </div>
    </section>
  );
}
