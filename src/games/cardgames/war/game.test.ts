import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import { createDeck, getWarResult, resolveTrick, WarGame, type WarState } from './game';

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

  it('gives the next lead to the trick winner, and to the other player after a tie', () => {
    const won = stateWithRanks(14, 10);
    resolveTrick(won);
    expect(won.leader).toBe('0');

    const lost = stateWithRanks(3, 10);
    resolveTrick(lost);
    expect(lost.leader).toBe('1');

    const tied = stateWithRanks(8, 8);
    resolveTrick(tied);
    expect(tied.leader).toBe('1');
  });

  it('lets both seats lead tricks over a full game', () => {
    const client = Client({ game: { ...WarGame, playerView: undefined, seed: 'lead-order' }, numPlayers: 2 });
    client.start();
    const leaders = new Set<string>();
    for (let move = 0; move < 52; move += 1) {
      const state = client.getState()!;
      if (state.G.currentTrick.length === 0) {
        leaders.add(state.ctx.currentPlayer);
        expect(state.ctx.currentPlayer).toBe(state.G.leader);
      }
      client.updatePlayerID(state.ctx.currentPlayer);
      client.moves.playCard(0);
    }
    expect(client.getState()?.ctx.gameover).toBeDefined();
    expect(leaders).toEqual(new Set(['0', '1']));
  });
});
