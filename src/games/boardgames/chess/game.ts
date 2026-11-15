import type { Game } from 'boardgame.io';
import { Chess } from 'chess.js';

const INVALID_MOVE = 'INVALID_MOVE' as const;

export interface ChessState {
  fen: string;
  history: string[];
  lastMove: { from: string; to: string } | null;
  resigned: string | null;
  /** How often each position has occurred. Optional so rooms started before this field keep working. */
  positions?: Record<string, number>;
  /** The seat that has offered a draw and is waiting for an answer. */
  drawOffer?: string | null;
  agreedDraw?: boolean;
}

/** A position for repetition purposes: pieces, side to move, castling rights and en passant square. */
export function positionKey(fen: string): string {
  return fen.split(' ').slice(0, 4).join(' ');
}

export function getChessResult(state: ChessState) {
  if (state.resigned) {
    const winner = state.resigned === '0' ? '1' : '0';
    return { winner, scores: { '0': winner === '0' ? 1 : 0, '1': winner === '1' ? 1 : 0 } };
  }

  if (state.agreedDraw) return { draw: true, scores: { '0': 0, '1': 0 } };

  const chess = new Chess(state.fen);
  // chess.js rebuilt from a FEN has no move history, so repetition is counted in the game state.
  if ((state.positions?.[positionKey(state.fen)] ?? 0) >= 3) return { draw: true, scores: { '0': 0, '1': 0 } };
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
  setup: () => {
    const fen = new Chess().fen();
    return { fen, history: [], lastMove: null, resigned: null, positions: { [positionKey(fen)]: 1 } };
  },
  moves: {
    makeMove: ({ G, playerID }, from: string, to: string, promotion = 'q') => {
      const chess = new Chess(G.fen);
      const expected = playerID === '0' ? 'w' : 'b';
      if (chess.turn() !== expected || !/^[a-h][1-8]$/.test(from) || !/^[a-h][1-8]$/.test(to)) return INVALID_MOVE;
      try {
        const move = chess.move({ from, to, promotion });
        G.fen = chess.fen();
        // Playing on withdraws your own offer and declines the opponent's.
        G.drawOffer = null;
        G.positions ??= {};
        G.positions[positionKey(G.fen)] = (G.positions[positionKey(G.fen)] ?? 0) + 1;
        G.history.push(move.san);
        G.lastMove = { from, to };
      } catch {
        return INVALID_MOVE;
      }
    },
    // Resigning is allowed on either player's turn and does not use up the turn's move.
    resign: {
      move: ({ G, playerID }) => {
        if (G.resigned) return INVALID_MOVE;
        G.resigned = playerID;
      },
      noLimit: true,
    },
    offerDraw: {
      move: ({ G, playerID }) => {
        if (G.drawOffer || G.resigned) return INVALID_MOVE;
        G.drawOffer = playerID;
      },
      noLimit: true,
    },
    answerDraw: {
      move: ({ G, playerID }, accept: boolean) => {
        if (!G.drawOffer || G.drawOffer === playerID) return INVALID_MOVE;
        if (accept === true) G.agreedDraw = true;
        G.drawOffer = null;
      },
      noLimit: true,
    },
  },
  // Both players stay active so the waiting player can resign; makeMove itself rejects
  // a move from the side that is not to play. Only the current player's move ends the turn.
  // (`{ all: null }` is boardgame.io's ActivePlayers.ALL; importing it would pull in a
  // module path that Node's ESM loader cannot resolve on the server.)
  turn: { minMoves: 1, maxMoves: 1, activePlayers: { all: null } as never },
  endIf: ({ G }) => getChessResult(G),
  ai: {
    enumerate: (G, _ctx, playerID) => {
      const chess = new Chess(G.fen);
      const expected = playerID === '0' ? 'w' : 'b';
      if (chess.turn() !== expected) return [];
      return chess.moves({ verbose: true }).map((move) => ({
        move: 'makeMove',
        args: [move.from, move.to, move.promotion ?? 'q'],
      }));
    },
  },
};
