import type { SlotConfig } from "./types";

export function SymbolTile({
  game,
  symbolId,
  active = false,
  spinning = false,
  compact = false,
}: {
  game: SlotConfig;
  symbolId: string;
  active?: boolean;
  spinning?: boolean;
  compact?: boolean;
}) {
  const symbol = game.symbols.find((candidate) => candidate.id === symbolId);
  return (
    <div
      className={`symbol-tile ${active ? "win" : ""} ${spinning ? "spinning" : ""} ${compact ? "compact" : ""}`}
      style={{ "--symbol": symbol?.color ?? game.visual.accent } as React.CSSProperties}
      title={symbol?.label ?? symbolId}
    >
      <span>{symbol?.icon ?? "?"}</span>
      {!compact && <small>{symbol?.label ?? symbolId}</small>}
    </div>
  );
}
