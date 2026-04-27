import type { Payline } from "./types";

export const standardPaylines: Payline[] = [
  { id: "middle", name: "Middle Row", rows: [1, 1, 1, 1, 1] },
  { id: "top", name: "Top Row", rows: [0, 0, 0, 0, 0] },
  { id: "bottom", name: "Bottom Row", rows: [2, 2, 2, 2, 2] },
  { id: "diag-down", name: "Diagonal Down", rows: [0, 0, 1, 2, 2] },
  { id: "diag-up", name: "Diagonal Up", rows: [2, 2, 1, 0, 0] },
  { id: "v", name: "V Shape", rows: [0, 1, 2, 1, 0] },
  { id: "inverted-v", name: "Inverted V", rows: [2, 1, 0, 1, 2] },
  { id: "zigzag", name: "Zigzag", rows: [0, 2, 0, 2, 0] },
];
