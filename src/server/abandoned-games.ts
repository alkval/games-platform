import { createRequire } from 'node:module';
import type { Game, LogEntry, Server as ServerTypes, State } from 'boardgame.io';
import { env } from './env.js';
import { prisma } from './prisma.js';

const require = createRequire(import.meta.url);
const { Master } = require('boardgame.io/master') as typeof import('boardgame.io/master');

/**
 * A player who leaves a running online game (closes the tab, loses the connection) and does not
 * come back within the grace period gives up, exactly as if they had pressed Give up / Resign.
 * Only counts while someone else is still at the table: if everybody left, nobody wins, and
 * the room simply expires later. A quick refresh or a phone briefly switching apps reconnects
 * well within the grace period (ABANDON_GRACE_SECONDS, default 2 minutes).
 *
 * Who is connected comes from the live sockets, not from the stored `isConnected` flags:
 * boardgame.io writes those without a lock, so two players connecting at the same moment can
 * overwrite each other's flag.
 */
export const ABANDON_GRACE_MS = env.ABANDON_GRACE_SECONDS * 1000;
const SWEEP_INTERVAL_MS = Math.min(15 * 1000, ABANDON_GRACE_MS / 4);

/** The move that means "I give up" in each game. */
export const GIVE_UP_MOVES: Record<string, string> = { war: 'giveUp', mattis: 'giveUp', chess: 'resign' };

export interface SeatPresence {
  playerID: string;
  /** Someone has taken this seat (it has a name). */
  seated: boolean;
  /** A socket for this seat is connected right now. */
  connected: boolean;
  /** This seat has been connected at some point, so leaving is a real departure. */
  wasConnected: boolean;
}

/**
 * Seats whose player has been gone for at least `graceMs` while another player is connected.
 * `goneSince` remembers when each seat (`matchID:playerID`) was first seen gone; it is updated here.
 */
export function findAbandonedSeats(
  matchID: string,
  seats: SeatPresence[],
  goneSince: Map<string, number>,
  now: number,
  graceMs = ABANDON_GRACE_MS,
): string[] {
  const allSeated = seats.length > 1 && seats.every((seat) => seat.seated);
  const someoneHere = seats.some((seat) => seat.connected);
  const abandoned: string[] = [];

  for (const seat of seats) {
    const key = `${matchID}:${seat.playerID}`;
    if (!allSeated || !someoneHere || seat.connected || !seat.wasConnected) {
      goneSince.delete(key);
      continue;
    }
    const since = goneSince.get(key) ?? now;
    goneSince.set(key, since);
    if (now - since >= graceMs) abandoned.push(seat.playerID);
  }
  return abandoned;
}

interface Storage {
  fetch(matchID: string, opts: { state?: true; metadata?: true }): Promise<{ state?: State; metadata?: ServerTypes.MatchData }>;
  setState(matchID: string, state: State, deltalog?: LogEntry[]): Promise<void>;
  setMetadata(matchID: string, metadata: ServerTypes.MatchData): Promise<void>;
}

/** The parts of boardgame.io's SocketIO transport used here (see its SocketIO class). */
interface Transport {
  pubSub: { publish(channelId: string, payload: unknown): void };
  getMatchQueue(matchID: string): { add<T>(fn: () => Promise<T>): Promise<T> };
  /** matchID -> socket IDs connected to that match. */
  roomInfo: Map<string, Set<string>>;
  /** socket ID -> the match and seat it plays. */
  clientInfo: Map<string, { matchID: string; playerID?: string | null }>;
}

function connectedSeats(transport: Transport, matchID: string): Set<string> {
  const seats = new Set<string>();
  for (const socketID of transport.roomInfo.get(matchID) ?? []) {
    const playerID = transport.clientInfo.get(socketID)?.playerID;
    if (playerID != null) seats.add(String(playerID));
  }
  return seats;
}

/**
 * Make the stored (and displayed) connection flags match the live sockets again, after
 * boardgame.io's unlocked writes let one player's change overwrite another's.
 */
async function repairConnectionFlags(storage: Storage, transport: Transport, matchID: string) {
  return transport.getMatchQueue(matchID).add(async () => {
    const { metadata } = await storage.fetch(matchID, { metadata: true });
    if (!metadata?.players) return;
    const connected = connectedSeats(transport, matchID);
    let changed = false;
    for (const [playerID, player] of Object.entries(metadata.players)) {
      const here = connected.has(playerID);
      // Leave "never connected" (undefined) alone unless the player is here now.
      if (player.isConnected === here || (!here && player.isConnected === undefined)) continue;
      player.isConnected = here;
      changed = true;
    }
    if (!changed) return;
    await storage.setMetadata(matchID, metadata);
    const players = Object.values(metadata.players).map(({ credentials: _credentials, ...player }) => player);
    transport.pubSub.publish(`MATCH-${matchID}`, { type: 'matchData', args: [matchID, players] });
  });
}

async function giveUpFor(game: Game, storage: Storage, transport: Transport, matchID: string, playerID: string, move: string) {
  // Same queue as player moves, so this never races a move that is being processed.
  return transport.getMatchQueue(matchID).add(async () => {
    if (connectedSeats(transport, matchID).has(playerID)) return false; // came back meanwhile
    const { state } = await storage.fetch(matchID, { state: true });
    if (!state || state.ctx.gameover !== undefined) return false;
    // No auth object: this runs on the server on the absent player's behalf.
    const master = new Master(game, storage as never, {
      send: () => {},
      sendAll: (payload) => transport.pubSub.publish(`MATCH-${matchID}`, payload),
    });
    const result = await master.onUpdate(
      { type: 'MAKE_MOVE', payload: { type: move, args: [], playerID } } as never,
      state._stateID,
      matchID,
      playerID,
    );
    return !(result && typeof result === 'object' && 'error' in result);
  });
}

export function startAbandonedGameWatcher(games: Game[], storage: Storage, socketTransport: unknown): () => void {
  const transport = socketTransport as Transport;
  const byName = new Map(games.map((game) => [game.name, game]));
  const goneSince = new Map<string, number>();
  const seenConnected = new Set<string>(); // `matchID:playerID` seen on a live socket since this server started
  let running = false;

  const sweep = async () => {
    if (running) return;
    running = true;
    try {
      const now = Date.now();
      const rooms = await prisma.gameState.findMany({
        where: { isGameover: false, updatedAt: { gt: new Date(now - 24 * 60 * 60 * 1000) } },
        select: { id: true, gameName: true, metadataJson: true },
      });
      const live = new Set<string>();
      for (const room of rooms) {
        const game = byName.get(room.gameName);
        const move = GIVE_UP_MOVES[room.gameName];
        if (!game || !move) continue;
        let metadata: ServerTypes.MatchData;
        try {
          metadata = JSON.parse(room.metadataJson) as ServerTypes.MatchData;
        } catch {
          continue;
        }
        const connected = connectedSeats(transport, room.id);
        const seats: SeatPresence[] = Object.entries(metadata.players ?? {}).map(([playerID, player]) => {
          const key = `${room.id}:${playerID}`;
          live.add(key);
          if (connected.has(playerID)) seenConnected.add(key);
          return {
            playerID,
            seated: Boolean(player.name?.trim()),
            connected: connected.has(playerID),
            // The stored flag is only ever set once a player has connected (it survives restarts).
            wasConnected: seenConnected.has(key) || player.isConnected !== undefined,
          };
        });
        const stale = Object.entries(metadata.players ?? {}).some(([playerID, player]) =>
          connected.has(playerID) ? player.isConnected !== true : player.isConnected === true);
        // Only rooms someone is watching: the corrected list goes to the connected players.
        if (stale && connected.size) await repairConnectionFlags(storage, transport, room.id);
        for (const playerID of findAbandonedSeats(room.id, seats, goneSince, now)) {
          const applied = await giveUpFor(game, storage, transport, room.id, playerID, move);
          if (applied) console.log(`Player ${playerID} left ${room.gameName} room ${room.id}; counted as giving up`);
          goneSince.delete(`${room.id}:${playerID}`);
        }
      }
      for (const key of goneSince.keys()) if (!live.has(key)) goneSince.delete(key);
      for (const key of seenConnected) if (!live.has(key)) seenConnected.delete(key);
    } catch (error) {
      console.error('Could not check for abandoned games', error);
    } finally {
      running = false;
    }
  };

  const timer = setInterval(() => void sweep(), SWEEP_INTERVAL_MS);
  timer.unref();
  return () => clearInterval(timer);
}
