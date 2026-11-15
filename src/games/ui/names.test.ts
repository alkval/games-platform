import { describe, expect, it } from 'vitest';
import { allSeatsTaken, withPlayerNames } from './names';

describe('board text helpers', () => {
  const names = (id: string) => ({ '0': 'You', '1': 'Craig', '2': 'Eugene' })[id] ?? `Player ${Number(id) + 1}`;

  it('replaces seat numbers with player names', () => {
    expect(withPlayerNames('Player 3 collected the trick.', names)).toBe('Eugene collected the trick.');
    expect(withPlayerNames('Trick cleared. Player 2 leads.', names)).toBe('Trick cleared. Craig leads.');
  });

  it('keeps the grammar right when the name is "You"', () => {
    expect(withPlayerNames('Player 1 starts.', names)).toBe('You start.');
    expect(withPlayerNames('Trick cleared. Player 1 leads.', names)).toBe('Trick cleared. You lead.');
    expect(withPlayerNames('Player 1 won with K.', names)).toBe('You won with K.');
  });

  it('treats a table as ready only when every seat has a name', () => {
    expect(allSeatsTaken(undefined)).toBe(true);
    expect(allSeatsTaken([{ name: 'A' }, { name: 'B' }])).toBe(true);
    expect(allSeatsTaken([{ name: 'A' }, {}])).toBe(false);
  });
});
