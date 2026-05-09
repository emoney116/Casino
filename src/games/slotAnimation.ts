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

export function getReelStopSchedule(mode: SlotAnimationMode, reelCount?: number) {
  const timing = slotAnimation[mode];
  const schedule: number[] = [...timing.reelStopMs];
  const targetReelCount = reelCount ?? schedule.length;
  if (targetReelCount <= schedule.length) return schedule.slice(0, targetReelCount);
  const lastGap = schedule[schedule.length - 1] - schedule[schedule.length - 2];
  while (schedule.length < targetReelCount) {
    schedule.push(schedule[schedule.length - 1] + lastGap);
  }
  return schedule;
}

export function getSpinDuration(mode: SlotAnimationMode, reelCount?: number) {
  const timing = slotAnimation[mode];
  const reelStopMs = getReelStopSchedule(mode, reelCount);
  return reelStopMs[reelStopMs.length - 1] + timing.settleMs + timing.evaluateMs;
}
