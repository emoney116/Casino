import type { SlotSpinResult } from "./types";

export function nextFreeSpinTotal(currentTotal: number, result: SlotSpinResult) {
  return currentTotal + result.payout;
}
