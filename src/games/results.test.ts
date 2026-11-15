import { describe, expect, it } from 'vitest';
import { outcomeFor } from './results';

describe('game outcomes for statistics', () => {
  it('counts a two-player game by its winner', () => {
    expect(outcomeFor({ winner: '1' }, '1')).toBe('win');
    expect(outcomeFor({ winner: '1' }, '0')).toBe('loss');
    expect(outcomeFor({ draw: true }, '0')).toBe('draw');
  });

  it('counts only Mattis as the loser of a Mattis game', () => {
    const result = { winner: '2', loser: '0' };
    expect(outcomeFor(result, '2')).toBe('win');
    expect(outcomeFor(result, '1')).toBe('win');
    expect(outcomeFor(result, '3')).toBe('win');
    expect(outcomeFor(result, '0')).toBe('loss');
  });
});
