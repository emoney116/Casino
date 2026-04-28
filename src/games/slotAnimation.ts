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
    cycleMs: 82,
    anticipationMs: 430,
    reelStopMs: [560, 720, 880, 1040, 1220],
    settleMs: 260,
    evaluateMs: 180,
  },
  fast: {
    cycleMs: 42,
    anticipationMs: 95,
    reelStopMs: [90, 125, 160, 195, 235],
    settleMs: 105,
    evaluateMs: 70,
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
