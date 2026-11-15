import { Chess, type Move, type PieceSymbol } from 'chess.js';

/**
 * A small chess engine for practice play: negamax with alpha-beta pruning over
 * material and piece placement. It is deliberately modest (a few plies), but unlike
 * a random playout it takes hanging pieces, avoids losing its own, and finds short mates.
 */

const pieceValue: Record<PieceSymbol, number> = { p: 100, n: 320, b: 330, r: 500, q: 900, k: 0 };
const MATE = 100_000;

// Bonus by distance from the centre (0 = one of the four centre squares, 3 = edge ring).
const centreBonus: Record<PieceSymbol, number[]> = {
  p: [14, 8, 2, 0],
  n: [24, 14, 2, -18],
  b: [14, 10, 4, -6],
  r: [4, 4, 2, 0],
  q: [6, 4, 2, 0],
  k: [-24, -16, -6, 8],
};

function evaluate(chess: Chess): number {
  let score = 0;
  const board = chess.board();
  for (let row = 0; row < 8; row += 1) {
    for (let column = 0; column < 8; column += 1) {
      const piece = board[row][column];
      if (!piece) continue;
      const ring = Math.max(Math.abs(row - 3.5), Math.abs(column - 3.5)) - 0.5;
      let value = pieceValue[piece.type] + centreBonus[piece.type][ring];
      // Pawns are worth more the closer they are to promoting.
      if (piece.type === 'p') value += (piece.color === 'w' ? 6 - row : row - 1) * 6;
      score += piece.color === 'w' ? value : -value;
    }
  }
  return chess.turn() === 'w' ? score : -score;
}

function ordered(moves: Move[]): Move[] {
  const weight = (move: Move) => (move.captured ? 10 * pieceValue[move.captured] - pieceValue[move.piece] : 0) + (move.promotion ? 800 : 0);
  return moves.sort((left, right) => weight(right) - weight(left));
}

class OutOfTime extends Error {}
let deadline = Infinity;
let visited = 0;

function search(chess: Chess, depth: number, alpha: number, beta: number, ply: number): number {
  visited += 1;
  if (visited % 32 === 0 && Date.now() > deadline) throw new OutOfTime();
  const moves = chess.moves({ verbose: true });
  if (!moves.length) return chess.inCheck() ? -MATE + ply : 0;
  if (depth === 0) return evaluate(chess);

  let best = -Infinity;
  for (const move of ordered(moves)) {
    chess.move(move);
    const score = -search(chess, depth - 1, -beta, -alpha, ply + 1);
    chess.undo();
    if (score > best) best = score;
    if (best > alpha) alpha = best;
    if (alpha >= beta) break;
  }
  return best;
}

export interface EngineMove { from: string; to: string; promotion?: string }

function bestAtDepth(chess: Chess, moves: Move[], depth: number, random: () => number): Move {
  let bestScore = -Infinity;
  let best: Move[] = [];
  for (const move of moves) {
    chess.move(move);
    let score: number;
    try {
      // The window stays slightly below the best score so near-equal moves keep exact
      // scores (ties are broken at random) while clearly worse ones are cut off early.
      score = -search(chess, depth - 1, -Infinity, -(bestScore - 5), 1);
    } finally {
      chess.undo();
    }
    if (score > bestScore + 4) {
      bestScore = score;
      best = [move];
    } else if (Math.abs(score - bestScore) <= 4) {
      best.push(move);
    }
  }
  return best[Math.floor(random() * best.length)] ?? moves[0];
}

/**
 * Picks a move for the side to play, or null when there is none.
 * Searches one ply deeper at a time up to `maxDepth` and returns the deepest finished
 * result when `budgetMs` runs out, so a slow phone answers as promptly as a fast laptop.
 */
export function chooseChessMove(fen: string, maxDepth: number, budgetMs = 1000, random: () => number = Math.random): EngineMove | null {
  const chess = new Chess(fen);
  const moves = ordered(chess.moves({ verbose: true }));
  if (!moves.length) return null;

  let choice = moves[0];
  deadline = Date.now() + budgetMs;
  visited = 0;
  try {
    for (let depth = 1; depth <= maxDepth; depth += 1) {
      choice = bestAtDepth(chess, moves, depth, random);
      // Try the previous best first on the next pass: better ordering, more cut-offs.
      moves.sort((left, right) => Number(right === choice) - Number(left === choice));
    }
  } catch (error) {
    if (!(error instanceof OutOfTime)) throw error;
  } finally {
    deadline = Infinity;
  }
  return { from: choice.from, to: choice.to, promotion: choice.promotion };
}
