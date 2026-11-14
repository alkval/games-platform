import { Client } from 'boardgame.io/client';
import { describe, expect, it } from 'vitest';
import { Chess } from 'chess.js';
import { ChessGame, getChessResult } from './game';

describe('ChessGame', () => {
  it('starts from the standard position', () => {
    const client = Client({ game: ChessGame, numPlayers: 2 });
    client.start();
    expect(client.getState()?.G.fen).toBe(new Chess().fen());
  });

  it('plays legal moves and detects checkmate', () => {
    const client = Client({ game: ChessGame, numPlayers: 2 });
    client.start();
    client.moves.makeMove('f2', 'f3');
    client.moves.makeMove('e7', 'e5');
    client.moves.makeMove('g2', 'g4');
    client.moves.makeMove('d8', 'h4');
    expect(client.getState()?.ctx.gameover).toMatchObject({ winner: '1' });
  });

  it('records resignation as a win for the opponent', () => {
    const client = Client({ game: ChessGame, numPlayers: 2 });
    client.start();
    client.moves.resign();
    expect(client.getState()?.ctx.gameover).toMatchObject({ winner: '1' });
  });

  it('recognises a drawn position', () => {
    expect(getChessResult({ fen: '8/8/8/8/8/8/5k2/7K w - - 0 1', history: [], lastMove: null, resigned: null })).toMatchObject({ draw: true });
  });

  it('draws when the same position occurs three times', () => {
    const client = Client({ game: ChessGame, numPlayers: 2 });
    client.start();
    const shuffle: Array<[string, string]> = [['g1', 'f3'], ['g8', 'f6'], ['f3', 'g1'], ['f6', 'g8']];
    for (const [from, to] of [...shuffle, ...shuffle]) {
      expect(client.getState()?.ctx.gameover).toBeUndefined();
      client.moves.makeMove(from, to);
    }
    expect(client.getState()?.ctx.gameover).toMatchObject({ draw: true });
  });
});
