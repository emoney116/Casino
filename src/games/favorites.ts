import { readData, updateData } from "../lib/storage";

export function getFavorites(userId: string) {
  return readData().favorites[userId] ?? [];
}

export function isFavorite(userId: string, gameId: string) {
  return getFavorites(userId).includes(gameId);
}

export function toggleFavorite(userId: string, gameId: string) {
  let favorites: string[] = [];
  updateData((data) => {
    const current = data.favorites[userId] ?? [];
    favorites = current.includes(gameId) ? current.filter((id) => id !== gameId) : [gameId, ...current];
    data.favorites[userId] = favorites;
  });
  return favorites;
}
