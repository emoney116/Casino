const RECENT_KEY = "casino-recent-games-v1";

export function getRecentGames() {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]") as string[];
  } catch {
    return [];
  }
}

export function recordRecentGame(gameId: string) {
  const next = [gameId, ...getRecentGames().filter((id) => id !== gameId)].slice(0, 6);
  localStorage.setItem(RECENT_KEY, JSON.stringify(next));
}

export function clearRecentGames() {
  localStorage.removeItem(RECENT_KEY);
}
