import type { Game } from 'boardgame.io';

const INVALID_MOVE = 'INVALID_MOVE' as const;

export type MattisSuit = 'clubs' | 'diamonds' | 'hearts' | 'spades';
export type MattisPhase = 'collecting' | 'shedding';

export interface MattisCard {
  id: string;
  rank: number;
  suit: MattisSuit;
  label: string;
}

export interface MattisPlay {
  playerID: string;
  card: MattisCard;
}

export interface MattisResult {
  winner: string;
  loser: string;
  scores: Record<string, number>;
  placements: Record<string, number>;
}

export interface MattisState {
  phase: MattisPhase;
  playerIDs: string[];
  activePlayer: string;
  leader: string;
  stock: MattisCard[];
  stockCount: number;
  removedCount: number;
  hands: Record<string, MattisCard[]>;
  handCounts: Record<string, number>;
  collected: Record<string, MattisCard[]>;
  collectedCounts: Record<string, number>;
  trick: MattisPlay[];
  contest: MattisPlay[];
  pendingPlayers: string[];
  trumpIndicator: MattisCard | null;
  trumpOwner: string | null;
  trumpSuit: MattisSuit | null;
  trickTarget: number;
  finishOrder: string[];
  mustPickUp: Record<string, boolean>;
  round: number;
  status: string;
}

const suits: MattisSuit[] = ['clubs', 'diamonds', 'hearts', 'spades'];
const labels = ['2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K', 'A'];

export function createMattisDeck(): MattisCard[] {
  return suits.flatMap((suit) => labels.map((label, index) => ({
    id: `${suit}-${label}`,
    rank: index + 2,
    suit,
    label,
  })));
}

function rotateFrom(playerIDs: string[], first: string): string[] {
  const index = Math.max(0, playerIDs.indexOf(first));
  return [...playerIDs.slice(index), ...playerIDs.slice(0, index)];
}

function nextRemainingPlayer(G: MattisState, after: string): string {
  const remaining = G.playerIDs.filter((id) => !G.finishOrder.includes(id));
  if (!remaining.length) return after;
  const start = G.playerIDs.indexOf(after);
  for (let step = 1; step <= G.playerIDs.length; step += 1) {
    const candidate = G.playerIDs[(start + step) % G.playerIDs.length];
    if (remaining.includes(candidate)) return candidate;
  }
  return remaining[0];
}

function syncCounts(G: MattisState): void {
  for (const id of G.playerIDs) {
    G.handCounts[id] = G.hands[id].length;
    G.collectedCounts[id] = G.collected[id].length;
  }
  G.stockCount = G.stock.length;
}

function drawReplacement(G: MattisState, playerID: string): void {
  if (G.hands[playerID].length >= 3) return;
  if (G.stock.length > 1) {
    G.hands[playerID].push(G.stock.pop()!);
  } else if (G.stock.length === 1) {
    G.trumpIndicator = G.stock.pop()!;
    G.trumpOwner = playerID;
  }
  syncCounts(G);
}

export function beginSheddingPhase(G: MattisState): void {
  for (const play of G.trick) G.hands[play.playerID].push(play.card);
  G.trick = [];
  G.contest = [];
  G.pendingPlayers = [];

  for (const id of G.playerIDs) {
    G.hands[id].push(...G.collected[id]);
    G.collected[id] = [];
  }

  if (G.trumpIndicator && G.trumpOwner) {
    G.trumpSuit = G.trumpIndicator.suit;
    G.hands[G.trumpOwner].push(G.trumpIndicator);
  }

  G.phase = 'shedding';
  G.activePlayer = G.trumpOwner ?? '0';
  G.leader = G.activePlayer;
  G.trickTarget = G.playerIDs.length;
  G.mustPickUp = Object.fromEntries(G.playerIDs.map((id) => [id, G.hands[id].length === 0]));
  G.status = `Trump is ${G.trumpSuit ?? 'unknown'}. Shed every card to avoid becoming Mattis.`;
  syncCounts(G);
}

function checkCollectingPlayer(G: MattisState): void {
  if (G.stock.length === 0 && G.hands[G.activePlayer].length === 0) beginSheddingPhase(G);
}

export function resolveCollectingContest(G: MattisState): void {
  if (G.pendingPlayers.length) return;
  const highest = Math.max(...G.contest.map((play) => play.card.rank));
  const tied = G.contest.filter((play) => play.card.rank === highest).map((play) => play.playerID);

  if (tied.length > 1) {
    G.pendingPlayers = tied;
    G.contest = [];
    G.activePlayer = tied[0];
    G.status = `Tie on ${highest === 14 ? 'aces' : highest}. The tied players go again.`;
    checkCollectingPlayer(G);
    return;
  }

  const winner = tied[0];
  G.collected[winner].push(...G.trick.map((play) => play.card));
  G.trick = [];
  G.contest = [];
  G.leader = winner;
  G.pendingPlayers = rotateFrom(G.playerIDs, winner);
  G.activePlayer = winner;
  G.round += 1;
  G.status = `Player ${Number(winner) + 1} collected the trick.`;
  syncCounts(G);
  checkCollectingPlayer(G);
}

function addCollectingPlay(G: MattisState, playerID: string, card: MattisCard): void {
  const play = { playerID, card };
  G.trick.push(play);
  G.contest.push(play);
  G.pendingPlayers = G.pendingPlayers.filter((id) => id !== playerID);
  drawReplacement(G, playerID);

  if (G.pendingPlayers.length) {
    G.activePlayer = G.pendingPlayers[0];
    checkCollectingPlayer(G);
  } else {
    resolveCollectingContest(G);
  }
}

export function canBeat(card: MattisCard, top: MattisCard, trumpSuit: MattisSuit): boolean {
  if (card.suit === top.suit) return card.rank > top.rank;
  return card.suit === trumpSuit && top.suit !== trumpSuit;
}

function markFinished(G: MattisState, playerID: string): void {
  if (G.hands[playerID].length === 0 && !G.mustPickUp[playerID] && !G.finishOrder.includes(playerID)) {
    G.finishOrder.push(playerID);
  }
}

function advanceShedding(G: MattisState, playerID: string, completedTrick: boolean): void {
  const remaining = G.playerIDs.filter((id) => !G.finishOrder.includes(id));
  if (remaining.length <= 1) return;

  if (completedTrick) {
    G.trick = [];
    G.round += 1;
    G.activePlayer = G.finishOrder.includes(playerID) ? nextRemainingPlayer(G, playerID) : playerID;
    G.leader = G.activePlayer;
    G.trickTarget = remaining.length;
    G.status = `Trick cleared. Player ${Number(G.activePlayer) + 1} leads.`;
    return;
  }

  G.activePlayer = nextRemainingPlayer(G, playerID);
}

export function getMattisResult(G: MattisState): MattisResult | undefined {
  const remaining = G.playerIDs.filter((id) => !G.finishOrder.includes(id));
  if (G.phase !== 'shedding' || remaining.length > 1) return undefined;

  const loser = remaining[0];
  const ordered = [...G.finishOrder, loser];
  const placements = Object.fromEntries(ordered.map((id, index) => [id, index + 1]));
  const scores = Object.fromEntries(ordered.map((id, index) => [id, ordered.length - index - 1]));
  return { winner: ordered[0], loser, placements, scores };
}

export function createInitialMattisState(shuffledDeck: MattisCard[], numPlayers: number): MattisState {
  const playerIDs = Array.from({ length: numPlayers }, (_, index) => String(index));
  const deck = [...shuffledDeck];
  const removedCount = numPlayers === 2 ? 10 : 0;
  if (removedCount) deck.splice(0, removedCount);

  const hands = Object.fromEntries(playerIDs.map((id) => [id, [] as MattisCard[]]));
  for (let pass = 0; pass < 3; pass += 1) {
    for (const id of playerIDs) hands[id].push(deck.pop()!);
  }

  return {
    phase: 'collecting',
    playerIDs,
    activePlayer: '0',
    leader: '0',
    stock: deck,
    stockCount: deck.length,
    removedCount,
    hands,
    handCounts: Object.fromEntries(playerIDs.map((id) => [id, hands[id].length])),
    collected: Object.fromEntries(playerIDs.map((id) => [id, []])),
    collectedCounts: Object.fromEntries(playerIDs.map((id) => [id, 0])),
    trick: [],
    contest: [],
    pendingPlayers: [...playerIDs],
    trumpIndicator: null,
    trumpOwner: null,
    trumpSuit: null,
    trickTarget: 0,
    finishOrder: [],
    mustPickUp: Object.fromEntries(playerIDs.map((id) => [id, false])),
    round: 1,
    status: 'Collect strong cards. Suits do not matter yet.',
  };
}

export const MattisGame: Game<MattisState> = {
  name: 'mattis',
  minPlayers: 2,
  maxPlayers: 6,
  setup: ({ ctx, random }) => createInitialMattisState(random.Shuffle(createMattisDeck()), ctx.numPlayers),
  moves: {
    playCard: ({ G, playerID }, cardIndex: number) => {
      if (playerID !== G.activePlayer || !Number.isInteger(cardIndex)) return INVALID_MOVE;
      const hand = G.hands[playerID];
      if (cardIndex < 0 || cardIndex >= hand.length) return INVALID_MOVE;
      const card = hand[cardIndex];

      if (G.phase === 'collecting') {
        hand.splice(cardIndex, 1);
        addCollectingPlay(G, playerID, card);
        return;
      }

      const top = G.trick.at(-1)?.card;
      if (top && (!G.trumpSuit || !canBeat(card, top, G.trumpSuit))) return INVALID_MOVE;
      if (G.mustPickUp[playerID]) return INVALID_MOVE;

      hand.splice(cardIndex, 1);
      G.trick.push({ playerID, card });
      syncCounts(G);
      markFinished(G, playerID);
      advanceShedding(G, playerID, G.trick.length >= G.trickTarget);
    },
    drawBlind: ({ G, playerID }) => {
      if (G.phase !== 'collecting' || playerID !== G.activePlayer || G.stock.length <= 1) return INVALID_MOVE;
      const card = G.stock.pop()!;
      addCollectingPlay(G, playerID, card);
    },
    pickUpOldest: ({ G, playerID }) => {
      if (G.phase !== 'shedding' || playerID !== G.activePlayer || G.trick.length === 0) return INVALID_MOVE;
      const [oldest] = G.trick.splice(0, 1);
      G.hands[playerID].push(oldest.card);
      G.mustPickUp[playerID] = false;
      syncCounts(G);

      const emptiedTable = G.trick.length === 0;
      if (emptiedTable) {
        G.round += 1;
        G.trickTarget = G.playerIDs.length - G.finishOrder.length;
        G.status = `Player ${Number(playerID) + 1} picked up. The next player leads.`;
      }
      advanceShedding(G, playerID, false);
      if (emptiedTable) G.leader = G.activePlayer;
    },
  },
  turn: {
    minMoves: 1,
    maxMoves: 1,
    order: {
      first: () => 0,
      next: ({ G }) => Number(G.activePlayer),
    },
  },
  endIf: ({ G }) => getMattisResult(G),
  playerView: ({ G, playerID }) => ({
    ...G,
    stock: [],
    trumpIndicator: G.phase === 'shedding' && G.trumpOwner === playerID ? G.trumpIndicator : null,
    hands: Object.fromEntries(Object.entries(G.hands).map(([id, hand]) => [id, id === playerID ? hand : []])),
    collected: Object.fromEntries(G.playerIDs.map((id) => [id, []])),
    contest: [],
  }),
};
