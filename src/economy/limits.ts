export const DEMO_MAX_SINGLE_BET = 100000;
export const DEMO_MAX_TOTAL_BET = 100000;
export const DEMO_MAX_PAYOUT = 100000000;

export function capDemoPayout(amount: number) {
  return Math.min(Math.max(0, Math.round(amount * 100) / 100), DEMO_MAX_PAYOUT);
}
