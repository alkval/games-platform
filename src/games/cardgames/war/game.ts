import type { Game } from 'boardgame.io';

const INVALID_MOVE = 'INVALID_MOVE' as const;

export type Suit = 'clubs' | 'diamonds' | 'hearts' | 'spades';

export interface Card {
  id: string;
  rank: number;
  suit: Suit;
  label: string;
}

export interface PlayedCard {
  playerID: string;
  card: Card;
}

export interface WarState {
  deck: Card[];
  hands: Record<string, Card[]>;
  handCounts: Record<string, number>;
  currentTrick: PlayedCard[];
  lastTrick: PlayedCard[];
  tricksWon: Record<string, number>;
  ties: number;
  round: number;
  lastResult: string;
  /** Who plays first in the current trick. Optional so rooms started before this field keep working. */
  leader?: string;
  /** Set when a player gives up; the other player wins. */
  forfeitedBy?: string | null;
}

const suits: Suit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const labels = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createDeck(): Card[] {
  return suits.flatMap((suit) =>
    labels.map((label, index) => ({
      id: `${suit}-${label}`,
      rank: index + 2,
      suit,
      label,
    })),
  );
}

export function resolveTrick(state: WarState): void {
  if (state.currentTrick.length !== 2) return;

  const [first, second] = state.currentTrick;
  // The second card is played with the first one in view, so the lead must change hands:
  // the trick winner leads next, and a tie passes the lead to the other player.
  if (first.card.rank === second.card.rank) {
    state.leader = second.playerID;
    state.ties += 1;
    state.lastResult = `Both players drew ${first.card.label}. No trick awarded.`;
  } else {
    const winner = first.card.rank > second.card.rank ? first : second;
    state.tricksWon[winner.playerID] += 1;
    state.leader = winner.playerID;
    state.lastResult = `Player ${Number(winner.playerID) + 1} won with ${winner.card.label}.`;
  }

  state.lastTrick = [...state.currentTrick];
  state.currentTrick = [];
  state.round += 1;
}

export function getWarResult(state: WarState): { winner?: string; draw?: boolean; forfeit?: boolean; scores: Record<string, number> } {
  if (state.forfeitedBy) {
    return { winner: state.forfeitedBy === '0' ? '1' : '0', forfeit: true, scores: state.tricksWon };
  }

  const playerZero = state.tricksWon['0'];
  const playerOne = state.tricksWon['1'];

  if (playerZero === playerOne) {
    return { draw: true, scores: state.tricksWon };
  }

  return {
    winner: playerZero > playerOne ? '0' : '1',
    scores: state.tricksWon,
  };
}

export const WarGame: Game<WarState> = {
  name: 'war',
  minPlayers: 2,
  maxPlayers: 2,
  setup: ({ random }) => {
    const shuffled = random.Shuffle(createDeck());
    const hands: Record<string, Card[]> = { '0': [], '1': [] };

    shuffled.forEach((card, index) => hands[String(index % 2)].push(card));

    return {
      deck: [],
      hands,
      handCounts: { '0': hands['0'].length, '1': hands['1'].length },
      currentTrick: [],
      lastTrick: [],
      tricksWon: { '0': 0, '1': 0 },
      ties: 0,
      round: 1,
      lastResult: 'Player 1 starts.',
      leader: '0',
    };
  },
  moves: {
    // Hands are hidden, so a browser cannot predict the result of a move. Running moves
    // only on the server keeps a fast double tap from playing a second card locally.
    playCard: {
      client: false,
      move: ({ G, ctx, playerID }, cardIndex: number) => {
        // Both players stay active so either can give up; only the player to move may play.
        if (playerID !== ctx.currentPlayer) return INVALID_MOVE;
        const hand = G.hands[playerID];
        if (!hand || !Number.isInteger(cardIndex) || cardIndex < 0 || cardIndex >= hand.length) {
          return INVALID_MOVE;
        }

        if (G.currentTrick.length === 0) G.lastTrick = [];
        const [card] = hand.splice(cardIndex, 1);
        G.handCounts[playerID] = hand.length;
        G.currentTrick.push({ playerID, card });
        resolveTrick(G);
      },
    },
    // Allowed on either player's turn and does not use up the turn's move.
    giveUp: {
      client: false,
      noLimit: true,
      move: ({ G, playerID }) => {
        if (G.forfeitedBy) return INVALID_MOVE;
        G.forfeitedBy = playerID;
      },
    },
  },
  turn: {
    minMoves: 1,
    maxMoves: 1,
    activePlayers: { all: null } as never, // boardgame.io's ActivePlayers.ALL
    order: {
      first: () => 0,
      next: ({ G, ctx }) => (G.currentTrick.length === 1 ? 1 - Number(ctx.currentPlayer) : Number(G.leader ?? '0')),
    },
  },
  endIf: ({ G }) => {
    if (G.forfeitedBy) return getWarResult(G);
    const handsAreEmpty = G.handCounts['0'] === 0 && G.handCounts['1'] === 0;
    return handsAreEmpty && G.currentTrick.length === 0 ? getWarResult(G) : undefined;
  },
  ai: {
    enumerate: (G, ctx, playerID) =>
      (playerID === ctx.currentPlayer ? G.hands[playerID] ?? [] : []).map((_card, index) => ({ move: 'playCard', args: [index] })),
  },
  playerView: ({ G, playerID }) => ({
    ...G,
    hands: Object.fromEntries(
      Object.entries(G.hands).map(([id, hand]) => [id, id === playerID ? hand : []]),
    ),
  }),
};
