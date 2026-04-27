export interface SessionStats {
  spins: number;
  wagered: number;
  won: number;
}

export const emptySessionStats: SessionStats = { spins: 0, wagered: 0, won: 0 };

export function nextSessionStats(stats: SessionStats, wagered: number, won: number): SessionStats {
  return {
    spins: stats.spins + 1,
    wagered: stats.wagered + wagered,
    won: stats.won + won,
  };
}
