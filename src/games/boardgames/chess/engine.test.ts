import { Chess } from 'chess.js';
import { describe, expect, it } from 'vitest';
import { chooseChessMove } from './engine';

describe('chess practice engine', () => {
  it('returns a legal move from the starting position', () => {
    const chess = new Chess();
    const move = chooseChessMove(chess.fen(), 2)!;
    expect(() => chess.move(move)).not.toThrow();
  });

  it('takes a queen that is left hanging', () => {
    expect(chooseChessMove('rnb1kbnr/ppp1pppp/8/3q4/8/2N5/PPPP1PPP/R1BQKBNR w KQkq - 0 3', 2)).toMatchObject({ from: 'c3', to: 'd5' });
  });

  it('plays a mate in one', () => {
    expect(chooseChessMove('6k1/5ppp/8/8/8/8/5PPP/R5K1 w - - 0 1', 2)).toMatchObject({ from: 'a1', to: 'a8' });
  });

  it('answers within its time budget and has no move when the game is over', () => {
    const started = Date.now();
    expect(chooseChessMove('r1bq1rk1/pp2bppp/2n1pn2/2pp4/3P1B2/2PBPN2/PP1N1PPP/R2QK2R w KQ - 0 8', 6, 150)).not.toBeNull();
    expect(Date.now() - started).toBeLessThan(1500);
    expect(chooseChessMove('7k/5Q2/6K1/8/8/8/8/8 b - - 0 1', 2)).toBeNull();
  });
});
