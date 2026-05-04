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
  badge = "",
  highlight = false,
}: Omit<CoinPack, "scBonus" | "gcPerDollar" | "badge" | "highlight"> & Partial<Pick<CoinPack, "badge" | "highlight">>): CoinPack {
  return {
    id,
    name,
    usdPrice,
    gcAmount,
    scBonus: Math.round(usdPrice),
    gcPerDollar: Math.round(gcAmount / usdPrice),
    badge,
    highlight,
  };
}

export const coinPacks = [
  createCoinPack({
    id: "starter",
    name: "Starter",
    usdPrice: 4.99,
    gcAmount: 5000,
  }),
  createCoinPack({
    id: "value",
    name: "Value",
    usdPrice: 19.99,
    gcAmount: 25000,
    badge: "Most Popular",
    highlight: true,
  }),
  createCoinPack({
    id: "mega",
    name: "Mega",
    usdPrice: 49.99,
    gcAmount: 75000,
    badge: "Big Boost",
  }),
  createCoinPack({
    id: "whale",
    name: "Whale",
    usdPrice: 99.99,
    gcAmount: 190000,
    badge: "Best Value",
    highlight: true,
  }),
] satisfies CoinPack[];

const starterGcPerDollar = coinPacks[0].gcPerDollar;

export function formatPackPrice(pack: CoinPack) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(pack.usdPrice);
}

export function getPackValueTag(pack: CoinPack) {
  if (pack.id === "starter") return "Base GC value";
  const lift = Math.round(((pack.gcPerDollar - starterGcPerDollar) / starterGcPerDollar) * 100);
  return `+${lift}% more GC`;
}
