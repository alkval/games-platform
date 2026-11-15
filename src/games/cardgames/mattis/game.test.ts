import { describe, expect, it } from 'vitest';
import { Client } from 'boardgame.io/client';
import {
  beginSheddingPhase,
  canBeat,
  createInitialMattisState,
  createMattisDeck,
  enumerateMattisSeries,
  getMattisResult,
  isMattisSeries,
  MattisGame,
  playSheddingCards,
  resolveCollectingContest,
  type MattisCard,
  type MattisState,
} from './game';

const card = (rank: number, suit: MattisCard['suit'] = 'clubs'): MattisCard => ({
  id: `${suit}-${rank}`,
  rank,
  suit,
  label: rank === 14 ? 'A' : String(rank),
});

describe('Mattis game', () => {
  it('creates a unique standard deck', () => {
    const deck = createMattisDeck();
    expect(deck).toHaveLength(52);
    expect(new Set(deck.map((entry) => entry.id)).size).toBe(52);
  });

  it('uses the Norwegian two-player setup with ten unseen cards removed', () => {
    const state = createInitialMattisState(createMattisDeck(), 2);
    expect(state.removedCount).toBe(10);
    expect(state.hands['0']).toHaveLength(3);
    expect(state.hands['1']).toHaveLength(3);
    expect(state.stock).toHaveLength(36);
  });

  it('collects the complete first-phase trick for its unique high player', () => {
    const state = createInitialMattisState(createMattisDeck(), 3);
    state.trick = [
      { playerID: '0', card: card(7) },
      { playerID: '1', card: card(13) },
      { playerID: '2', card: card(9) },
    ];
    state.contest = [...state.trick];
    state.pendingPlayers = [];
    resolveCollectingContest(state);
    expect(state.collected['1']).toHaveLength(3);
    expect(state.activePlayer).toBe('1');
    expect(state.trick).toEqual([]);
    expect(state.lastTrick).toHaveLength(3);
  });

  it('sends only the tied high players into another contest', () => {
    const state = createInitialMattisState(createMattisDeck(), 3);
    state.trick = [
      { playerID: '0', card: card(12) },
      { playerID: '1', card: card(6) },
      { playerID: '2', card: card(12) },
    ];
    state.contest = [...state.trick];
    state.pendingPlayers = [];
    resolveCollectingContest(state);
    expect(state.pendingPlayers).toEqual(['0', '2']);
    expect(state.trick).toHaveLength(3);
  });

  it('uses same-suit higher cards or trump to beat the current card', () => {
    expect(canBeat(card(10, 'hearts'), card(9, 'hearts'), 'spades')).toBe(true);
    expect(canBeat(card(8, 'hearts'), card(9, 'hearts'), 'spades')).toBe(false);
    expect(canBeat(card(2, 'spades'), card(14, 'hearts'), 'spades')).toBe(true);
    expect(canBeat(card(14, 'clubs'), card(2, 'spades'), 'spades')).toBe(false);
  });

  it('recognises and plays a consecutive same-suit series as one turn', () => {
    const series = [card(7, 'hearts'), card(8, 'hearts'), card(9, 'hearts')];
    expect(isMattisSeries(series)).toBe(true);
    expect(isMattisSeries([card(7, 'hearts'), card(9, 'hearts')])).toBe(false);
    expect(isMattisSeries([card(7, 'hearts'), card(8, 'clubs')])).toBe(false);

    const state = createInitialMattisState(createMattisDeck(), 3);
    state.phase = 'shedding';
    state.activePlayer = '0';
    state.trumpSuit = 'spades';
    state.hands['0'] = series;
    state.handCounts['0'] = series.length;
    state.trick = [{ playerID: '2', card: card(6, 'hearts') }];
    state.trickTarget = 3;

    expect(playSheddingCards(state, '0', [0, 1, 2])).toBe(true);
    expect(state.hands['0']).toEqual([]);
    expect(state.trick).toHaveLength(2);
    expect(state.trick[1].cards?.map((entry) => entry.rank)).toEqual([7, 8, 9]);
    expect(state.trick[1].card.rank).toBe(9);
  });

  it('enumerates every consecutive same-suit series for computer players', () => {
    const hand = [card(5, 'clubs'), card(6, 'clubs'), card(7, 'clubs'), card(8, 'hearts')];
    expect(enumerateMattisSeries(hand)).toEqual([[0, 1], [0, 1, 2], [1, 2]]);
  });

  it('returns an incomplete trick and exposes trump when phase two begins', () => {
    const state = createInitialMattisState(createMattisDeck(), 2);
    state.hands = { '0': [], '1': [] };
    state.collected = { '0': [card(10)], '1': [card(11)] };
    state.trick = [{ playerID: '0', card: card(4) }];
    state.trumpIndicator = card(7, 'diamonds');
    state.trumpOwner = '1';
    beginSheddingPhase(state);
    expect(state.phase).toBe('shedding');
    expect(state.trumpSuit).toBe('diamonds');
    expect(state.hands['0']).toHaveLength(2);
    expect(state.hands['1']).toHaveLength(2);
    expect(state.activePlayer).toBe('1');
  });

  it('names the last player holding cards as Mattis', () => {
    const state = createInitialMattisState(createMattisDeck(), 3);
    state.phase = 'shedding';
    state.finishOrder = ['2', '0'];
    const result = getMattisResult(state);
    expect(result).toMatchObject({ winner: '2', loser: '1' });
    expect(result?.placements).toEqual({ '2': 1, '0': 2, '1': 3 });
  });

  it.each([2, 3, 6])('can play a complete deterministic %i-player match', (numPlayers) => {
    const client = Client({ game: { ...MattisGame, seed: `mattis-test-${numPlayers}` }, numPlayers, playerID: '0' });
    client.start();

    for (let move = 0; move < 10000 && !client.getState()!.ctx.gameover; move += 1) {
      const currentPlayer = client.getState()!.ctx.currentPlayer;
      client.updatePlayerID(currentPlayer);
      const state = client.getState()!;
      const G = state.G as MattisState;
      const hand = G.hands[currentPlayer];

      if (G.phase === 'collecting') {
        client.moves.playCard(0);
        continue;
      }

      const top = G.trick.at(-1)?.card;
      const legalIndex = G.mustPickUp[currentPlayer]
        ? -1
        : hand.findIndex((entry) => !top || Boolean(G.trumpSuit && canBeat(entry, top, G.trumpSuit)));
      if (legalIndex >= 0) client.moves.playCard(legalIndex);
      else client.moves.pickUpOldest();
    }

    const finalState = client.getState()!;
    client.stop();
    expect(finalState.ctx.gameover).toMatchObject({ winner: expect.any(String), loser: expect.any(String) });
  });

  it('passes the lead on when the next player has no cards and nothing to pick up', () => {
    const G = createInitialMattisState(createMattisDeck(), 3);
    G.stock = [];
    G.hands = { '0': [card(5)], '1': [], '2': [card(7, 'hearts')] };
    G.trumpIndicator = card(2, 'spades');
    G.trumpOwner = '2';
    beginSheddingPhase(G);
    expect(G.mustPickUp).toEqual({ '0': false, '1': true, '2': false });

    // Player 1 sheds their last card and the trick clears. Player 2 would lead next,
    // but holds nothing and has nothing to pick up, so the lead goes to player 3.
    G.activePlayer = '0';
    G.trickTarget = 1;
    expect(playSheddingCards(G, '0', [0])).toBe(true);
    expect(G.finishOrder).toEqual(['0']);
    expect(G.trick).toEqual([]);
    expect(G.activePlayer).toBe('2');
    expect(G.leader).toBe('2');
  });

  it('never leaves the active player without a legal move in six-player games', () => {
    for (let seed = 0; seed < 60; seed += 1) {
      let random = seed + 1;
      const pick = (count: number) => {
        random = (random * 1103515245 + 12345) % 2147483648;
        return Math.floor(random / 2147483648 * count);
      };
      const client = Client({ game: { ...MattisGame, playerView: undefined, seed: `six-${seed}` }, numPlayers: 6 });
      client.start();
      for (let step = 0; step < 4000 && !client.getState()!.ctx.gameover; step += 1) {
        const state = client.getState()!;
        const player = state.ctx.currentPlayer;
        const options = MattisGame.ai!.enumerate(state.G, state.ctx, player) as Array<{ move: string; args?: unknown[] }>;
        const choice = options[pick(options.length)];
        client.updatePlayerID(player);
        (client.moves as Record<string, (...args: unknown[]) => void>)[choice.move](...(choice.args ?? []));
        expect(client.getState()!._stateID, `seed ${seed}, step ${step}: "${choice.move}" was rejected`).toBeGreaterThan(state._stateID);
      }
      expect(client.getState()!.ctx.gameover, `seed ${seed} did not finish`).toBeDefined();
      client.stop();
    }
  });

  it('makes a player who gives up Mattis and ranks the rest', () => {
    const client = Client({ game: { ...MattisGame, playerView: undefined, seed: 'give-up' }, numPlayers: 4 });
    client.start();
    client.updatePlayerID('2');
    client.moves.playCard(0);                 // not their turn: ignored
    expect(client.getState()?.G.trick).toEqual([]);
    client.moves.giveUp();
    const result = client.getState()?.ctx.gameover;
    expect(result).toMatchObject({ loser: '2' });
    expect(result.placements['2']).toBe(4);
    expect(Object.values(result.placements).sort()).toEqual([1, 2, 3, 4]);
    expect(result.winner).not.toBe('2');
  });
});
