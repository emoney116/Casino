export type SlotAnimationMode = "normal" | "fast";

export type SlotAnimationState =
  | "idle"
  | "spinning"
  | "settling"
  | "bonusIdle"
  | "bonusRespinning"
  | "bonusReveal"
  | "bonusComplete";

export type ReelVisualState = "idle" | "spinning" | "settling" | "stopped";

export const slotAnimation = {
  normal: {
    cycleMs: 64,
    anticipationMs: 620,
    reelStopMs: [640, 850, 1060, 1270, 1500],
    settleMs: 320,
    evaluateMs: 220,
  },
  fast: {
    cycleMs: 38,
    anticipationMs: 120,
    reelStopMs: [110, 150, 190, 235, 285],
    settleMs: 120,
    evaluateMs: 80,
  },
  bonus: {
    respinMs: 540,
    revealMs: 620,
    completeHoldMs: 2200,
  },
} as const;

export function getSpinDuration(mode: SlotAnimationMode) {
  const timing = slotAnimation[mode];
  return timing.reelStopMs[timing.reelStopMs.length - 1] + timing.settleMs + timing.evaluateMs;
}
