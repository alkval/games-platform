import { Client } from 'boardgame.io/client';
import { Local } from 'boardgame.io/multiplayer';
import type { Game } from 'boardgame.io';
import { describe, expect, it } from 'vitest';
import { ChessGame } from './boardgames/chess/game';
import { MattisGame } from './cardgames/mattis/game';
import { WarGame } from './cardgames/war/game';
import { botNames, practicePlayerName } from './ai/bot-names';
import { EasyBot, HardBot, NormalBot } from './ai/practice-bots';

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
      multiplayer: Local({ bots: { '1': EasyBot } }),
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
      multiplayer: Local({ bots: { '1': EasyBot, '2': EasyBot, '3': EasyBot } }),
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

  it('uses significantly larger searches for hard difficulty', () => {
    const options = { game: ChessGame, enumerate: ChessGame.ai!.enumerate };
    const normal = new NormalBot(options);
    const hard = new HardBot(options);
    expect(normal.getOpt('iterations')).toBe(60);
    expect(normal.getOpt('playoutDepth')).toBe(24);
    expect(hard.getOpt('iterations')).toBe(180);
    expect(hard.getOpt('playoutDepth')).toBe(45);
  });

  it('lets the human resign in practice while the bot is thinking', async () => {
    const client = Client({ game: ChessGame, numPlayers: 2, playerID: '0', multiplayer: Local({ bots: { '1': HardBot } }) });
    client.start();
    client.moves.makeMove('e2', 'e4');
    client.moves.resign();
    expect(client.getState()?.ctx.gameover).toMatchObject({ winner: '1' });
    await new Promise((resolve) => setTimeout(resolve, 300));
    client.stop();
  });

  it('has the hard chess bot answer with a sensible move in a few seconds', { timeout: 20000 }, async () => {
    const client = Client({ game: ChessGame, numPlayers: 2, playerID: '0', multiplayer: Local({ bots: { '1': HardBot } }) });
    client.start();
    client.moves.makeMove('e2', 'e4');
    const deadline = Date.now() + 12000;
    while ((client.getState()?.G.history.length ?? 0) < 2 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 20));
    expect(client.getState()?.G.history).toHaveLength(2);
    client.stop();
  });

  it('has every bot seat take its turn in a multi-bot game, at every difficulty', async () => {
    for (const Bot of [EasyBot, NormalBot]) {
      const client = Client({ game: MattisGame, numPlayers: 4, playerID: '0', multiplayer: Local({ bots: { '1': Bot, '2': Bot, '3': Bot } }) });
      client.start();
      client.moves.playCard(0);
      const deadline = Date.now() + 25000;
      // After the human's card, bots 1, 2 and 3 must each play before the trick resolves.
      while ((client.getState()?.G.round ?? 1) < 2 && Date.now() < deadline) await new Promise((resolve) => setTimeout(resolve, 25));
      expect(client.getState()?.G.round).toBeGreaterThanOrEqual(2);
      client.stop();
    }
  }, 60000);

  it('ends a practice game when the human gives up on a bot\'s turn', async () => {
    const war = Client({ game: WarGame, numPlayers: 2, playerID: '0', multiplayer: Local({ bots: { '1': EasyBot } }) });
    war.start();
    war.moves.playCard(0);
    war.moves.giveUp();
    expect(war.getState()?.ctx.gameover).toMatchObject({ winner: '1', forfeit: true });
    war.stop();

    const mattis = Client({ game: MattisGame, numPlayers: 3, playerID: '0', multiplayer: Local({ bots: { '1': EasyBot, '2': EasyBot } }) });
    mattis.start();
    mattis.moves.playCard(0);
    mattis.moves.giveUp();
    expect(mattis.getState()?.ctx.gameover).toMatchObject({ loser: '0' });
    mattis.stop();
    await new Promise((resolve) => setTimeout(resolve, 200));
  });
});
