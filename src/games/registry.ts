import type { Game } from 'boardgame.io';
import type { ComponentType } from 'react';

export type GameCategory = 'card' | 'board';

export interface GameDefinition {
  id: string;
  name: string;
  category: GameCategory;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  game: Game;
  board: ComponentType<any>;
}

const games = new Map<string, GameDefinition>();

export function registerGame(definition: GameDefinition): void {
  if (games.has(definition.id)) {
    throw new Error(`Game ${definition.id} is already registered`);
  }

  games.set(definition.id, definition);
}

export function getGame(id: string): GameDefinition | undefined {
  return games.get(id);
}

export function listGames(category?: GameCategory): GameDefinition[] {
  const definitions = [...games.values()];
  return category
    ? definitions.filter((definition) => definition.category === category)
    : definitions;
}

