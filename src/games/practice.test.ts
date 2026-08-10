import { RandomBot } from 'boardgame.io/ai';
import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import type { Game } from 'boardgame.io';
import { describe, expect, it } from 'vitest';
import { ChessGame } from './boardgames/chess/game';
import { MattisGame } from './cardgames/mattis/game';
import { WarGame } from './cardgames/war/game';
import { botNames, practicePlayerName } from './ai/bot-names';

describe('computer practice support', () => {
  it('enumerates legal opening actions for every game', () => {
    for (const game of [WarGame, MattisGame, ChessGame] as Game<any>[]) {
      const client = Client({ game, numPlayers: 2, playerID: '0' });
      client.start();
      const state = client.getState()!;
      expect(game.ai?.enumerate(state.G, state.ctx, '0').length).toBeGreaterThan(0);
      client.stop();
    }
  });

  it('lets a local chess bot answer a human move', async () => {
    const client = Client({
      game: ChessGame,
      numPlayers: 2,
      playerID: '0',
      multiplayer: Local({ bots: { '1': RandomBot } }),
    });
    client.start();
    client.moves.makeMove('e2', 'e4');

    const deadline = Date.now() + 2000;
    while ((client.getState()?.G.history.length ?? 0) < 2 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    expect(client.getState()?.G.history).toHaveLength(2);
    expect(client.getState()?.ctx.currentPlayer).toBe('0');
    client.stop();
  });

  it('supports several local bots and assigns their names in order', async () => {
    expect(botNames).toEqual(['Craig', 'Hubert', 'Eugene', 'Montgomery', 'Cornelius']);
    expect(Array.from({ length: 6 }, (_value, id) => practicePlayerName(id))).toEqual([
      'You', 'Craig', 'Hubert', 'Eugene', 'Montgomery', 'Cornelius',
    ]);

    const client = Client({
      game: MattisGame,
      numPlayers: 4,
      playerID: '0',
      multiplayer: Local({ bots: { '1': RandomBot, '2': RandomBot, '3': RandomBot } }),
    });
    client.start();
    const before = client.getState()!._stateID;
    client.moves.playCard(0);
    const deadline = Date.now() + 3000;
    while ((client.getState()?._stateID ?? before) <= before + 1 && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    expect(client.getState()?._stateID).toBeGreaterThan(before + 1);
    client.stop();
  });
});
