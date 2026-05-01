import { Volume2, VolumeX } from "lucide-react";
import { useEffect, useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { formatCoins } from "../lib/format";
import { isSoundEnabled, setSoundEnabled } from "./feedbackService";

export type GameResultTone = "win" | "big-win" | "loss" | "push" | "error" | "bonus";

export const feedbackUiMarkers = {
  soundTogglePersists: true,
  gameResultBanner: true,
  winOverlay: true,
  coinBurst: true,
  screenShake: true,
  countUpWinAmount: true,
};

export function SoundToggle({ className = "", compact = false }: { className?: string; compact?: boolean }) {
  const [enabled, setEnabled] = useState(() => isSoundEnabled());

  function toggle() {
    const next = !enabled;
    setEnabled(next);
    setSoundEnabled(next);
  }

  return (
    <button
      type="button"
      className={`${className || "ghost-button"} casino-sound-toggle ${enabled ? "active" : ""}`.trim()}
      onClick={toggle}
      aria-pressed={enabled}
      title={enabled ? "Sound on" : "Sound off"}
    >
      {enabled ? <Volume2 size={compact ? 15 : 18} /> : <VolumeX size={compact ? 15 : 18} />}
      {!compact && <span>Sound</span>}
    </button>
  );
}

export function GameResultBanner({
  tone,
  title,
  amount,
  message,
  compact = false,
}: {
  tone: GameResultTone;
  title: string;
  amount?: number;
  message?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`game-result-banner ${tone} ${compact ? "compact" : ""}`.trim()} role={tone === "error" ? "alert" : "status"} aria-live="polite">
      <strong>{title}</strong>
      {typeof amount === "number" && amount > 0 && <CountUpAmount value={amount} />}
      {message && <span>{message}</span>}
    </div>
  );
}

export function WinOverlay({
  show,
  title = "Win",
  amount,
  big = false,
  bonus = false,
  children,
  onDismiss,
}: {
  show: boolean;
  title?: string;
  amount: number;
  big?: boolean;
  bonus?: boolean;
  children?: ReactNode;
  onDismiss?: () => void;
}) {
  if (!show) return null;
  return (
    <button type="button" className={`win-overlay ${big ? "big" : ""} ${bonus ? "bonus" : ""}`.trim()} onClick={onDismiss}>
      <span>{title}</span>
      <CountUpAmount value={amount} large />
      {children && <small>{children}</small>}
      <CoinBurst count={big ? 20 : 12} />
    </button>
  );
}

export function CoinBurst({ count = 12 }: { count?: number }) {
  const coins = useMemo(() => Array.from({ length: count }, (_, index) => index), [count]);
  return (
    <div className="coin-burst-shared" aria-hidden="true">
      {coins.map((coin) => (
        <i
          key={coin}
          style={{
            "--coin-angle": `${(360 / count) * coin}deg`,
            "--coin-distance": `${34 + (coin % 4) * 9}px`,
            "--coin-delay": `${(coin % 5) * 35}ms`,
          } as CSSProperties}
        />
      ))}
    </div>
  );
}

export function ScreenShake({ active, children }: { active: boolean; children: ReactNode }) {
  return <div className={active ? "screen-shake active" : "screen-shake"}>{children}</div>;
}

function CountUpAmount({ value, large = false }: { value: number; large?: boolean }) {
  const [display, setDisplay] = useState(value);

  useEffect(() => {
    if (typeof window === "undefined") {
      setDisplay(value);
      return;
    }
    const duration = 720;
    const start = performance.now();
    let frame = 0;
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(value * eased));
      if (progress < 1) frame = window.requestAnimationFrame(tick);
    }
    setDisplay(0);
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [value]);

  return <em className={large ? "count-up-amount large" : "count-up-amount"}>+{formatCoins(display)}</em>;
}
