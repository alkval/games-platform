export const publicGames = [
  { id: 'war', name: 'War', category: 'card' },
  { id: 'mattis', name: 'Mattis', category: 'card' },
  { id: 'chess', name: 'Chess', category: 'board' },
] as const;

export type PublicGameId = (typeof publicGames)[number]['id'];

export function publicGameName(gameId: string): string {
  return publicGames.find((game) => game.id === gameId)?.name ?? gameId;
}

