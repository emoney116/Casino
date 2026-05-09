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

export const goldRushPaylines: Payline[] = [
  { id: "middle-low", name: "Lower Mine Run", rows: [2, 2, 2, 2, 2, 2] },
  { id: "middle-high", name: "Upper Mine Run", rows: [1, 1, 1, 1, 1, 1] },
  { id: "top", name: "Top Tunnel", rows: [0, 0, 0, 0, 0, 0] },
  { id: "bottom", name: "Bottom Tunnel", rows: [3, 3, 3, 3, 3, 3] },
  { id: "diag-down", name: "Diamond Vein Down", rows: [0, 1, 1, 2, 2, 3] },
  { id: "diag-up", name: "Gold Vein Up", rows: [3, 2, 2, 1, 1, 0] },
  { id: "v", name: "Mine Cart V", rows: [0, 1, 2, 2, 1, 0] },
  { id: "inverted-v", name: "Vault Peak", rows: [3, 2, 1, 1, 2, 3] },
];
