import type { Game } from 'boardgame.io';
import { Chess } from 'chess.js';

const INVALID_MOVE = 'INVALID_MOVE' as const;

export interface ChessState {
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  resigned: string | null;
}

export function getChessResult(state: ChessState) {
  if (state.resigned) {
    const winner = state.resigned === '0' ? '1' : '0';
    return { winner, scores: { '0': winner === '0' ? 1 : 0, '1': winner === '1' ? 1 : 0 } };
  }

  const chess = new Chess(state.fen);
  if (chess.isCheckmate()) {
    const winner = chess.turn() === 'w' ? '1' : '0';
    return { winner, scores: { '0': winner === '0' ? 1 : 0, '1': winner === '1' ? 1 : 0 } };
  }
  if (chess.isGameOver()) return { draw: true, scores: { '0': 0, '1': 0 } };
  return undefined;
}

export const ChessGame: Game<ChessState> = {
  name: 'chess',
  minPlayers: 2,
  maxPlayers: 2,
  setup: () => ({ fen: new Chess().fen(), history: [], lastMove: null, resigned: null }),
  moves: {
    makeMove: ({ G, playerID }, from: string, to: string, promotion = 'q') => {
      const chess = new Chess(G.fen);
      const expected = playerID === '0' ? 'w' : 'b';
      if (chess.turn() !== expected || !/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return INVALID_MOVE;
      try {
        const move = chess.move({ from, to, promotion });
        G.fen = chess.fen();
        G.history.push(move.san);
        G.lastMove = { from, to };
      } catch {
        return INVALID_MOVE;
      }
    },
    resign: ({ G, playerID }) => {
      G.resigned = playerID;
    },
  },
  turn: { minMoves: 1, maxMoves: 1 },
  endIf: ({ G }) => getChessResult(G),
};

