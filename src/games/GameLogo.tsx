import type { SlotConfig } from "./types";

export function GameLogo({ game, small = false }: { game: SlotConfig; small?: boolean }) {
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
      <div className="logo-orbit">
        <span>{game.visual.logo}</span>
      </div>
      <strong>{game.name}</strong>
    </div>
  );
}
