import type { SlotConfig } from "./types";
import type { ReelVisualState } from "./slotAnimation";
import { useEffect, useState } from "react";

export function SymbolTile({
  game,
  symbolId,
  active = false,
  spinning = false,
  reelState = "idle",
  reelIndex = 0,
  compact = false,
  sticky = false,
  multiplierLabel,
  multiplierWild = false,
  winnerSide,
}: {
  game: SlotConfig;
  symbolId: string;
  active?: boolean;
  spinning?: boolean;
  reelState?: ReelVisualState;
  reelIndex?: number;
  compact?: boolean;
  sticky?: boolean;
  multiplierLabel?: string;
  multiplierWild?: boolean;
  winnerSide?: "gold" | "diamond";
}) {
  const symbol = game.symbols.find((candidate) => candidate.id === symbolId);
  const label = symbol?.label ?? symbolId;
  const color = symbol?.color ?? game.visual.accent;
  const [imageReady, setImageReady] = useState(!symbol?.image);
  const [imageError, setImageError] = useState(false);

  useEffect(() => {
    if (!symbol?.image) {
      setImageReady(true);
      setImageError(false);
      return;
    }
    let cancelled = false;
    setImageReady(false);
    setImageError(false);
    const image = new Image();
    image.onload = () => {
      if (!cancelled) setImageReady(true);
    };
    image.onerror = () => {
      if (!cancelled) setImageError(true);
    };
    image.src = symbol.image;
    if (image.complete && image.naturalWidth > 0) {
      setImageReady(true);
    }
    return () => {
      cancelled = true;
    };
  }, [symbol?.image]);

  return (
    <div
      className={`symbol-tile ${symbol?.kind ?? "regular"} ${active ? "win" : ""} ${sticky ? "sticky-wild" : ""} ${spinning ? "spinning" : ""} ${reelState} ${compact ? "compact" : ""}`}
      style={{ "--symbol": color, "--reel-index": reelIndex } as React.CSSProperties}
      data-symbol-id={symbolId}
      data-symbol-kind={symbol?.kind ?? "regular"}
      data-symbol-icon={symbol?.icon ?? "?"}
      data-symbol-label={label}
      data-multiplier-wild={multiplierWild ? "true" : "false"}
      data-winner-side={winnerSide ?? "none"}
      title={label}
    >
      {(!symbol?.image || !imageReady || imageError) && <span className="symbol-fallback">{symbol?.icon ?? "?"}</span>}
      {symbol?.image && !imageError ? (
        <img
          src={symbol.image}
          alt={label}
          loading="eager"
          decoding="async"
          onLoad={() => setImageReady(true)}
          onError={() => setImageError(true)}
        />
      ) : null}
      {symbol?.kind === "coin" && <b className="coin-symbol-badge">{symbol.icon}</b>}
      {multiplierLabel && <b className="multiplier-wild-badge">{multiplierLabel}</b>}
      {!compact && <small>{label}</small>}
    </div>
  );
}
