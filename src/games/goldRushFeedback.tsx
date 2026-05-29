import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { isSoundEnabled } from "../feedback/feedbackService";
import { formatCoins, formatCurrencyDisplay } from "../lib/format";
import type { SlotSpinResult } from "./types";

export type GoldRushWinTier = "none" | "small" | "nice" | "big" | "mega" | "epic";

export type GoldRushSoundEvent =
  | "music_loop"
  | "spin_start"
  | "reel_tick"
  | "symbol_land"
  | "vs_land"
  | "vs_expand"
  | "clash_hit"
  | "multiplier_reveal"
  | "interior_expand"
  | "bonus_land"
  | "free_spins_start"
  | "free_spin_counter_tick"
  | "meter_collect"
  | "meter_threshold_hit"
  | "big_win_count_up"
  | "button_tap"
  | "error_insufficient_balance";

type GoldRushTone = {
  frequency: number;
  duration: number;
  gain: number;
  delay?: number;
  type?: OscillatorType;
};

type GoldRushSoundConfig = {
  label: string;
  tones: GoldRushTone[];
  throttleMs?: number;
  duckMusic?: boolean;
};

export const goldRushAudioManifest = {
  music_loop: "src/assets/gold-rush-showdown/audio/music_loop.mp3",
  spin_start: "src/assets/gold-rush-showdown/audio/spin_start.mp3",
  reel_tick: "src/assets/gold-rush-showdown/audio/reel_tick.mp3",
  vs_land: "src/assets/gold-rush-showdown/audio/vs_land.mp3",
  vs_expand: "src/assets/gold-rush-showdown/audio/vs_expand.mp3",
  clash_hit: "src/assets/gold-rush-showdown/audio/clash_hit.mp3",
  multiplier_reveal: "src/assets/gold-rush-showdown/audio/multiplier_reveal.mp3",
  interior_expand: "src/assets/gold-rush-showdown/audio/interior_expand.mp3",
  bonus_land: "src/assets/gold-rush-showdown/audio/bonus_land.mp3",
  free_spins_start: "src/assets/gold-rush-showdown/audio/free_spins_start.mp3",
  meter_collect: "src/assets/gold-rush-showdown/audio/meter_collect.mp3",
  big_win: "src/assets/gold-rush-showdown/audio/big_win.mp3",
  button_tap: "src/assets/gold-rush-showdown/audio/button_tap.mp3",
} as const;

export const goldRushSoundEventConfig: Record<GoldRushSoundEvent, GoldRushSoundConfig> = {
  music_loop: {
    label: "Soft mine music loop",
    throttleMs: 1600,
    tones: [
      { frequency: 147, duration: 0.18, gain: 0.006, type: "sine" },
      { frequency: 220, duration: 0.16, gain: 0.005, delay: 0.16, type: "triangle" },
      { frequency: 294, duration: 0.18, gain: 0.004, delay: 0.34, type: "sine" },
      { frequency: 370, duration: 0.12, gain: 0.003, delay: 0.58, type: "triangle" },
    ],
  },
  spin_start: {
    label: "Reel spin start",
    throttleMs: 160,
    tones: [
      { frequency: 160, duration: 0.08, gain: 0.018, type: "sawtooth" },
      { frequency: 240, duration: 0.1, gain: 0.014, delay: 0.055, type: "triangle" },
      { frequency: 330, duration: 0.07, gain: 0.012, delay: 0.13, type: "sine" },
    ],
  },
  reel_tick: {
    label: "Reel stop tick",
    throttleMs: 65,
    tones: [{ frequency: 520, duration: 0.026, gain: 0.009, type: "triangle" }],
  },
  symbol_land: {
    label: "Symbol land",
    throttleMs: 80,
    tones: [{ frequency: 410, duration: 0.036, gain: 0.008, type: "triangle" }],
  },
  vs_land: {
    label: "VS land",
    throttleMs: 180,
    tones: [
      { frequency: 230, duration: 0.07, gain: 0.019, type: "square" },
      { frequency: 690, duration: 0.08, gain: 0.015, delay: 0.055, type: "triangle" },
    ],
  },
  vs_expand: {
    label: "VS expand",
    throttleMs: 220,
    duckMusic: true,
    tones: [
      { frequency: 210, duration: 0.2, gain: 0.014, type: "sawtooth" },
      { frequency: 760, duration: 0.16, gain: 0.018, delay: 0.12, type: "triangle" },
      { frequency: 1020, duration: 0.11, gain: 0.012, delay: 0.24, type: "sine" },
    ],
  },
  clash_hit: {
    label: "Miner clash impact",
    throttleMs: 140,
    duckMusic: true,
    tones: [
      { frequency: 92, duration: 0.075, gain: 0.025, type: "sawtooth" },
      { frequency: 420, duration: 0.045, gain: 0.02, delay: 0.035, type: "square" },
      { frequency: 880, duration: 0.03, gain: 0.01, delay: 0.075, type: "triangle" },
    ],
  },
  multiplier_reveal: {
    label: "Multiplier reveal",
    throttleMs: 260,
    tones: [
      { frequency: 520, duration: 0.09, gain: 0.019, type: "triangle" },
      { frequency: 780, duration: 0.1, gain: 0.018, delay: 0.08, type: "triangle" },
      { frequency: 1040, duration: 0.13, gain: 0.015, delay: 0.18, type: "sine" },
    ],
  },
  interior_expand: {
    label: "Interior expand",
    throttleMs: 300,
    duckMusic: true,
    tones: [
      { frequency: 180, duration: 0.16, gain: 0.016, type: "triangle" },
      { frequency: 440, duration: 0.12, gain: 0.017, delay: 0.09, type: "triangle" },
      { frequency: 660, duration: 0.14, gain: 0.014, delay: 0.19, type: "sine" },
    ],
  },
  bonus_land: {
    label: "Bonus symbol land",
    throttleMs: 95,
    tones: [
      { frequency: 620, duration: 0.055, gain: 0.013, type: "triangle" },
      { frequency: 930, duration: 0.052, gain: 0.011, delay: 0.045, type: "sine" },
    ],
  },
  free_spins_start: {
    label: "Free spins start",
    throttleMs: 500,
    duckMusic: true,
    tones: [
      { frequency: 392, duration: 0.1, gain: 0.02, type: "triangle" },
      { frequency: 588, duration: 0.11, gain: 0.018, delay: 0.09, type: "triangle" },
      { frequency: 784, duration: 0.16, gain: 0.018, delay: 0.19, type: "sine" },
      { frequency: 1176, duration: 0.12, gain: 0.011, delay: 0.34, type: "sine" },
    ],
  },
  free_spin_counter_tick: {
    label: "Free spin counter tick",
    throttleMs: 120,
    tones: [{ frequency: 720, duration: 0.035, gain: 0.01, type: "triangle" }],
  },
  meter_collect: {
    label: "Bonus meter collect",
    throttleMs: 110,
    tones: [
      { frequency: 680, duration: 0.04, gain: 0.011, type: "triangle" },
      { frequency: 880, duration: 0.045, gain: 0.01, delay: 0.04, type: "sine" },
    ],
  },
  meter_threshold_hit: {
    label: "Bonus meter threshold hit",
    throttleMs: 420,
    duckMusic: true,
    tones: [
      { frequency: 330, duration: 0.09, gain: 0.016, type: "triangle" },
      { frequency: 660, duration: 0.12, gain: 0.019, delay: 0.08, type: "triangle" },
      { frequency: 990, duration: 0.14, gain: 0.015, delay: 0.19, type: "sine" },
    ],
  },
  big_win_count_up: {
    label: "Big win count-up",
    throttleMs: 320,
    duckMusic: true,
    tones: [
      { frequency: 500, duration: 0.08, gain: 0.014, type: "triangle" },
      { frequency: 700, duration: 0.08, gain: 0.014, delay: 0.075, type: "triangle" },
      { frequency: 940, duration: 0.1, gain: 0.012, delay: 0.16, type: "sine" },
    ],
  },
  button_tap: {
    label: "Button tap",
    throttleMs: 45,
    tones: [{ frequency: 360, duration: 0.032, gain: 0.01, type: "triangle" }],
  },
  error_insufficient_balance: {
    label: "Error",
    throttleMs: 200,
    tones: [
      { frequency: 132, duration: 0.07, gain: 0.017, type: "sawtooth" },
      { frequency: 92, duration: 0.08, gain: 0.014, delay: 0.075, type: "sawtooth" },
    ],
  },
};

export const goldRushWinTierConfig: Record<Exclude<GoldRushWinTier, "none">, {
  label: string;
  minMultiplier: number;
  durationMs: number;
  particles: number;
}> = {
  small: { label: "Small Win", minMultiplier: 1, durationMs: 500, particles: 10 },
  nice: { label: "Nice Win", minMultiplier: 5, durationMs: 900, particles: 16 },
  big: { label: "Big Win", minMultiplier: 15, durationMs: 1600, particles: 24 },
  mega: { label: "Mega Win", minMultiplier: 50, durationMs: 2500, particles: 34 },
  epic: { label: "Epic Win", minMultiplier: 150, durationMs: 3500, particles: 46 },
};

const orderedGoldRushWinTiers: GoldRushWinTier[] = ["epic", "mega", "big", "nice", "small"];
const goldRushAudioDebugCounts: Partial<Record<GoldRushSoundEvent, number>> = {};
const goldRushLastPlayedAt: Partial<Record<GoldRushSoundEvent, number>> = {};
let goldRushAudioContext: AudioContext | null = null;
let goldRushMusicTimer: number | null = null;
let goldRushMusicDuckUntil = 0;

function getGoldRushAudioContext() {
  const AudioContextCtor = globalThis.AudioContext ?? (globalThis as typeof globalThis & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextCtor) return null;
  goldRushAudioContext ??= new AudioContextCtor();
  return goldRushAudioContext;
}

function playGoldRushTone(tone: GoldRushTone, volumeScale = 1) {
  if (!isSoundEnabled()) return false;
  try {
    const ctx = getGoldRushAudioContext();
    if (!ctx) return false;
    if (ctx.state === "suspended") void ctx.resume();
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    const start = ctx.currentTime + (tone.delay ?? 0);
    const duration = Math.max(0.01, tone.duration);
    oscillator.type = tone.type ?? "triangle";
    oscillator.frequency.setValueAtTime(tone.frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(Math.max(0.0001, tone.gain * volumeScale), start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(gain);
    gain.connect(ctx.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
    return true;
  } catch {
    goldRushAudioContext = null;
    return false;
  }
}

export function getGoldRushWinTier(winAmount: number, betAmount: number): GoldRushWinTier {
  if (winAmount <= 0 || betAmount <= 0) return "none";
  const multiplier = winAmount / betAmount;
  return orderedGoldRushWinTiers.find((tier) => tier !== "none" && multiplier >= goldRushWinTierConfig[tier].minMultiplier) ?? "none";
}

export function getGoldRushWinOverlayDuration(tier: GoldRushWinTier) {
  return tier === "none" ? 0 : goldRushWinTierConfig[tier].durationMs;
}

export function getGoldRushAudioDebugCount(event: GoldRushSoundEvent) {
  return goldRushAudioDebugCounts[event] ?? 0;
}

export function resetGoldRushAudioDebugCounts() {
  Object.keys(goldRushAudioDebugCounts).forEach((key) => delete goldRushAudioDebugCounts[key as GoldRushSoundEvent]);
}

export function duckGoldRushMusic(durationMs = 1200) {
  goldRushMusicDuckUntil = Math.max(goldRushMusicDuckUntil, Date.now() + durationMs);
}

export function playGoldRushSound(event: GoldRushSoundEvent) {
  goldRushAudioDebugCounts[event] = (goldRushAudioDebugCounts[event] ?? 0) + 1;
  if (!isSoundEnabled()) return false;
  const config = goldRushSoundEventConfig[event];
  const now = Date.now();
  if (config.throttleMs && now - (goldRushLastPlayedAt[event] ?? 0) < config.throttleMs) return false;
  goldRushLastPlayedAt[event] = now;
  if (config.duckMusic) duckGoldRushMusic(1400);
  const volumeScale = now < goldRushMusicDuckUntil && event === "music_loop" ? 0.38 : 1;
  let played = false;
  config.tones.forEach((tone) => {
    played = playGoldRushTone(tone, volumeScale) || played;
  });
  return played;
}

export function startGoldRushMusic() {
  if (!isSoundEnabled() || typeof window === "undefined") return false;
  if (goldRushMusicTimer !== null) return true;
  playGoldRushSound("music_loop");
  goldRushMusicTimer = window.setInterval(() => {
    if (!isSoundEnabled()) {
      stopGoldRushMusic();
      return;
    }
    playGoldRushSound("music_loop");
  }, 2300);
  return true;
}

export function stopGoldRushMusic() {
  if (typeof window !== "undefined" && goldRushMusicTimer !== null) {
    window.clearInterval(goldRushMusicTimer);
  }
  goldRushMusicTimer = null;
}

function GoldRushParticles({ count, tone }: { count: number; tone: "gold" | "diamond" | "mixed" }) {
  const particles = useMemo(() => Array.from({ length: count }, (_, index) => index), [count]);
  return (
    <span className={`gold-rush-particles tone-${tone}`} aria-hidden="true">
      {particles.map((particle) => (
        <i
          key={particle}
          style={{
            "--particle-angle": `${(360 / count) * particle}deg`,
            "--particle-distance": `${34 + (particle % 6) * 10}px`,
            "--particle-delay": `${(particle % 8) * 38}ms`,
          } as CSSProperties}
        />
      ))}
    </span>
  );
}

export function GoldRushWinOverlay({
  result,
  betAmount,
  currencyLabel,
  onDismiss,
}: {
  result: SlotSpinResult;
  betAmount: number;
  currencyLabel: string;
  onDismiss: () => void;
}) {
  const amount = Math.max(0, result.payout);
  const tier = getGoldRushWinTier(amount, betAmount);
  const tierConfig = tier === "none" ? null : goldRushWinTierConfig[tier];
  const duration = getGoldRushWinOverlayDuration(tier);
  const [displayAmount, setDisplayAmount] = useState(amount);
  const [complete, setComplete] = useState(false);
  const dismissedRef = useRef(false);

  useEffect(() => {
    if (!tierConfig || amount <= 0 || typeof window === "undefined") {
      setDisplayAmount(amount);
      setComplete(true);
      return undefined;
    }
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const actualDuration = reducedMotion ? Math.min(520, duration) : duration;
    const start = performance.now();
    let frame = 0;
    dismissedRef.current = false;
    setDisplayAmount(0);
    setComplete(false);
    playGoldRushSound(tier === "small" || tier === "nice" ? "meter_collect" : "big_win_count_up");
    if (tier === "mega" || tier === "epic") duckGoldRushMusic(actualDuration + 900);
    function tick(now: number) {
      const progress = Math.min(1, (now - start) / actualDuration);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplayAmount(amount * eased);
      if (progress < 1 && !dismissedRef.current) {
        frame = window.requestAnimationFrame(tick);
      } else {
        setDisplayAmount(amount);
        setComplete(true);
      }
    }
    frame = window.requestAnimationFrame(tick);
    return () => {
      dismissedRef.current = true;
      window.cancelAnimationFrame(frame);
    };
  }, [amount, duration, tier, tierConfig]);

  useEffect(() => {
    if (!complete || tier === "none" || typeof window === "undefined") return undefined;
    const holdMs = tier === "epic" ? 1800 : tier === "mega" ? 1450 : tier === "big" ? 1150 : 820;
    const timer = window.setTimeout(onDismiss, holdMs);
    return () => window.clearTimeout(timer);
  }, [complete, onDismiss, tier]);

  if (!tierConfig || amount <= 0) return null;

  const tone = result.expansionBonus?.vsWinnerSide === "diamond" || result.goldRush?.vsWinnerSide === "diamond" ? "diamond" : tier === "mega" || tier === "epic" ? "mixed" : "gold";

  function handleClick() {
    if (!complete) {
      dismissedRef.current = true;
      setDisplayAmount(amount);
      setComplete(true);
      return;
    }
    onDismiss();
  }

  return (
    <button
      type="button"
      className={`gold-rush-win-overlay tier-${tier} ${complete ? "complete" : "counting"}`}
      onClick={handleClick}
      aria-label={`${tierConfig.label}: ${formatCoins(amount)} ${currencyLabel}`}
    >
      <span className="gold-rush-win-eyebrow">{tierConfig.label}</span>
      <strong>+{formatCurrencyDisplay(displayAmount)} <small>{currencyLabel}</small></strong>
      <em>{complete ? "Tap to continue" : "Tap to skip"}</em>
      <GoldRushParticles count={tierConfig.particles} tone={tone} />
    </button>
  );
}

export function GoldRushFeatureToast({
  title,
  primary,
  secondary,
  tone = "mixed",
}: {
  title: string;
  primary: string;
  secondary?: string;
  tone?: "gold" | "diamond" | "mixed";
}) {
  return (
    <div className={`gold-rush-feature-toast tone-${tone}`} role="status" aria-live="polite">
      <span>{title}</span>
      <strong>{primary}</strong>
      {secondary && <em>{secondary}</em>}
      <GoldRushParticles count={18} tone={tone} />
    </div>
  );
}
