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
  if (first.card.rank === second.card.rank) {
    state.ties += 1;
    state.lastResult = `Both players drew ${first.card.label}. No trick awarded.`;
  } else {
    const winner = first.card.rank > second.card.rank ? first : second;
    state.tricksWon[winner.playerID] += 1;
    state.lastResult = `Player ${Number(winner.playerID) + 1} won with ${winner.card.label}.`;
  }

  state.lastTrick = [...state.currentTrick];
  state.currentTrick = [];
  state.round += 1;
}

export function getWarResult(state: WarState): { winner?: string; draw?: boolean; scores: Record<string, number> } {
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
    };
  },
  moves: {
    playCard: ({ G, playerID }, cardIndex: number) => {
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
  turn: {
    minMoves: 1,
    maxMoves: 1,
  },
  endIf: ({ G }) => {
    const handsAreEmpty = G.handCounts['0'] === 0 && G.handCounts['1'] === 0;
    return handsAreEmpty && G.currentTrick.length === 0 ? getWarResult(G) : undefined;
  },
  ai: {
    enumerate: (G, _ctx, playerID) =>
      (G.hands[playerID] ?? []).map((_card, index) => ({ move: 'playCard', args: [index] })),
  },
  playerView: ({ G, playerID }) => ({
    ...G,
    hands: Object.fromEntries(
      Object.entries(G.hands).map(([id, hand]) => [id, id === playerID ? hand : []]),
    ),
  }),
};
