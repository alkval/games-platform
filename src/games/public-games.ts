export const publicGames = [
  { id: 'war', name: 'War', category: 'card', description: 'Pick a card. Highest rank takes the trick. Most tricks wins.', minPlayers: 2, maxPlayers: 2 },
  { id: 'mattis', name: 'Mattis', category: 'card', description: 'Collect strong cards, reveal trump, then race to shed your hand.', minPlayers: 2, maxPlayers: 6 },
  { id: 'chess', name: 'Chess', category: 'board', description: 'Classic two-player chess with complete legal move checking.', minPlayers: 2, maxPlayers: 2 },
] as const;

export type PublicGameId = (typeof publicGames)[number]['id'];

export function publicGameName(gameId: string): string {
  return publicGames.find((game) => game.id === gameId)?.name ?? gameId;
}
