export const DEMO_MAX_SINGLE_BET = 500;
export const DEMO_MAX_TOTAL_BET = 1000;
export const DEMO_MAX_PAYOUT = 50000;

export function capDemoPayout(amount: number) {
  return Math.min(Math.max(0, Math.round(amount)), DEMO_MAX_PAYOUT);
}
