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
  const label = symbol?.label ?? symbolId;
  const color = symbol?.color ?? game.visual.accent;

  return (
    <div
      className={`symbol-tile ${symbol?.kind ?? "regular"} ${active ? "win" : ""} ${spinning ? "spinning" : ""} ${compact ? "compact" : ""}`}
      style={{ "--symbol": color } as React.CSSProperties}
      title={label}
    >
      {symbol?.image ? <img src={symbol.image} alt={label} /> : <span>{symbol?.icon ?? "?"}</span>}
      {!compact && <small>{label}</small>}
    </div>
  );
}
