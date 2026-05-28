export interface CoinPack {
  id: string;
  name: string;
  usdPrice: number;
  gcAmount: number;
  scBonus: number;
  gcPerDollar: number;
  badge: string;
  highlight: boolean;
}

function createCoinPack({
  id,
  name,
  usdPrice,
  gcAmount,
  scBonus,
  badge = "",
  highlight = false,
}: Omit<CoinPack, "gcPerDollar" | "badge" | "highlight"> & Partial<Pick<CoinPack, "badge" | "highlight">>): CoinPack {
  return {
    id,
    name,
    usdPrice,
    gcAmount,
    scBonus,
    gcPerDollar: Math.round(gcAmount / usdPrice),
    badge,
    highlight,
  };
}

export const coinPacks = [
  createCoinPack({
    id: "starter",
    name: "Mini",
    usdPrice: 5,
    gcAmount: 5000,
    scBonus: 5,
  }),
  createCoinPack({
    id: "value",
    name: "Standard",
    usdPrice: 10,
    gcAmount: 12500,
    scBonus: 10,
  }),
  createCoinPack({
    id: "popular",
    name: "Popular",
    usdPrice: 20,
    gcAmount: 30000,
    scBonus: 20,
    highlight: true,
  }),
  createCoinPack({
    id: "mega",
    name: "Mega",
    usdPrice: 50,
    gcAmount: 85000,
    scBonus: 50,
  }),
  createCoinPack({
    id: "whale",
    name: "Elite",
    usdPrice: 100,
    gcAmount: 200000,
    scBonus: 100,
  }),
  createCoinPack({
    id: "vault",
    name: "Vault",
    usdPrice: 200,
    gcAmount: 450000,
    scBonus: 200,
  }),
] satisfies CoinPack[];

export function formatPackPrice(pack: CoinPack) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(pack.usdPrice);
}

export function formatScBonusValue(pack: CoinPack) {
  return `${pack.scBonus.toLocaleString("en-US")} SC`;
}
