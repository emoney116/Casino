import type { SlotConfig } from "./types";

export function GameLogo({ game, small = false, showName = true }: { game: SlotConfig; small?: boolean; showName?: boolean }) {
  return (
    <div
      className={`game-logo ${small ? "small" : ""}`}
      style={
        {
          "--accent": game.visual.accent,
          "--secondary": game.visual.secondary,
          "--panel": game.visual.panel,
        } as React.CSSProperties
      }
    >
      <div className={`logo-orbit${game.visual.logoImage ? " has-logo-image" : ""}`}>
        {game.visual.logoImage ? (
          <img src={game.visual.logoImage} alt={`${game.name} logo`} />
        ) : (
          <span>{game.visual.logo}</span>
        )}
      </div>
      {showName && <strong>{game.name}</strong>}
    </div>
  );
}
