import { describe, expect, it } from 'vitest';
import { createDeck, getWarResult, resolveTrick, type WarState } from './game';

function stateWithRanks(first: number, second: number): WarState {
  const deck = createDeck();
  return {
    deck: [],
    hands: { '0': [], '1': [] },
    handCounts: { '0': 0, '1': 0 },
    currentTrick: [
      { playerID: '0', card: { ...deck[0], rank: first } },
      { playerID: '1', card: { ...deck[1], rank: second } },
    ],
    lastTrick: [],
    tricksWon: { '0': 0, '1': 0 },
    ties: 0,
    round: 1,
    lastResult: '',
  };
}

describe('War game', () => {
  it('creates a standard deck with unique cards', () => {
    const deck = createDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((card) => card.id)).size).toBe(52);
  });

  it('awards the trick to the higher card', () => {
    const state = stateWithRanks(14, 10);
    resolveTrick(state);
    expect(state.tricksWon['0']).toBe(1);
    expect(state.currentTrick).toEqual([]);
    expect(state.lastTrick).toHaveLength(2);
    expect(state.round).toBe(2);
  });

  it('records tied tricks without awarding a point', () => {
    const state = stateWithRanks(8, 8);
    resolveTrick(state);
    expect(state.ties).toBe(1);
    expect(state.tricksWon).toEqual({ '0': 0, '1': 0 });
  });

  it('returns the final winner from trick scores', () => {
    const state = stateWithRanks(2, 3);
    state.tricksWon = { '0': 9, '1': 14 };
    expect(getWarResult(state).winner).toBe('1');
  });
});
