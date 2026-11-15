/** The part of a finished game's result that statistics depend on. */
export interface GameResult {
  winner?: string;
  loser?: string;
  draw?: boolean;
}

/**
 * How a finished game counts for one seat.
 * Two-player games name a winner. Mattis names a loser instead: the one player left
 * holding cards is Mattis, and everyone who got out counts as having won.
 */
export function outcomeFor(result: GameResult, playerID: string): 'win' | 'loss' | 'draw' {
  if (result.draw) return 'draw';
  if (result.loser !== undefined) return result.loser === playerID ? 'loss' : 'win';
  return result.winner === playerID ? 'win' : 'loss';
}
