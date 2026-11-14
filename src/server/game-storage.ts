import type { LogEntry, Server as ServerTypes, State, StorageAPI } from 'boardgame.io';
import { prisma } from './prisma.js';
import { verifyGameToken } from './auth.js';

function decode<T>(value: string): T {
  return JSON.parse(value) as T;
}

type SeatMetadata = { id: number; name?: string; data?: Record<string, unknown> };

/**
 * Moves account identity out of the public lobby metadata.
 * A joining client sends its signed game token in `data.gameToken`; boardgame.io would
 * store and publish that field, so it is verified here, recorded as a server-side seat
 * claim, and removed before the metadata is saved. Vacated seats lose their claim.
 */
export async function claimSeats(matchID: string, metadata: ServerTypes.MatchData, options: { ignoreExpiry?: boolean } = {}): Promise<boolean> {
  let changed = false;
  for (const player of Object.values(metadata.players ?? {}) as SeatMetadata[]) {
    const playerId = String(player.id);
    if (player.data && 'gameToken' in player.data) {
      const userId = await verifyGameToken(player.data.gameToken, options);
      delete player.data.gameToken;
      if (!Object.keys(player.data).length) delete player.data;
      changed = true;
      if (userId && await prisma.user.findUnique({ where: { id: userId }, select: { id: true } })) {
        await prisma.seatClaim.upsert({
          where: { matchId_playerId: { matchId: matchID, playerId } },
          create: { matchId: matchID, playerId, userId },
          update: { userId },
        });
      }
    }
    if (!player.name) await prisma.seatClaim.deleteMany({ where: { matchId: matchID, playerId } });
  }
  return changed;
}

/** Rewrites rooms saved by older versions, which kept the token in the public metadata. */
export async function scrubStoredGameTokens(): Promise<number> {
  const rooms = await prisma.gameState.findMany({ where: { metadataJson: { contains: 'gameToken' } }, select: { id: true, metadataJson: true } });
  let scrubbed = 0;
  for (const room of rooms) {
    const metadata = decode<ServerTypes.MatchData>(room.metadataJson);
    if (!await claimSeats(room.id, metadata, { ignoreExpiry: true })) continue;
    // Raw update so the room's updatedAt (used for expiry) is left alone.
    await prisma.$executeRaw`UPDATE "GameState" SET "metadataJson" = ${JSON.stringify(metadata)} WHERE "id" = ${room.id}`;
    scrubbed += 1;
  }
  return scrubbed;
}

async function saveMatchHistory(matchID: string, state: State, metadata: ServerTypes.MatchData): Promise<void> {
  if (await prisma.match.findUnique({ where: { id: matchID } })) return;

  const result = state.ctx.gameover as {
    winner?: string;
    draw?: boolean;
    scores?: Record<string, number>;
    placements?: Record<string, number>;
  } | undefined;
  if (!result) return;

  const claims = await prisma.seatClaim.findMany({ where: { matchId: matchID }, select: { playerId: true, userId: true } });
  const players = Object.values(metadata.players).map((player) => ({
    playerID: String(player.id),
    playerName: player.name ?? `Player ${player.id + 1}`,
    userId: claims.find((claim) => claim.playerId === String(player.id))?.userId ?? null,
  }));

  await prisma.match.create({
    data: {
      id: matchID,
      gameId: metadata.gameName,
      playerCount: players.length,
      resultJson: JSON.stringify(result),
      startedAt: new Date(metadata.createdAt),
      endedAt: new Date(),
      players: {
        create: players.map((player) => ({
          playerId: player.playerID,
          playerName: player.playerName,
          userId: player.userId,
          score: result.scores?.[player.playerID] ?? 0,
          placement: result.placements?.[player.playerID] ?? (result.draw ? 1 : result.winner === player.playerID ? 1 : 2),
        })),
      },
    },
  });

  for (const player of players) {
    if (!player.userId) continue;

    const didWin = !result.draw && result.winner === player.playerID;
    await prisma.playerStat.upsert({
      where: { userId_gameId: { userId: player.userId, gameId: metadata.gameName } },
      create: {
        userId: player.userId,
        gameId: metadata.gameName,
        played: 1,
        won: didWin ? 1 : 0,
        lost: didWin || result.draw ? 0 : 1,
        draws: result.draw ? 1 : 0,
      },
      update: {
        played: { increment: 1 },
        won: { increment: didWin ? 1 : 0 },
        lost: { increment: didWin || result.draw ? 0 : 1 },
        draws: { increment: result.draw ? 1 : 0 },
      },
    });
  }
}

export class PrismaGameStorage {
  type(): 1 {
    return 1;
  }

  async connect(): Promise<void> {
    await prisma.$connect();
  }

  async createMatch(matchID: string, options: StorageAPI.CreateMatchOpts): Promise<void> {
    await prisma.gameState.create({
      data: {
        id: matchID,
        gameName: options.metadata.gameName,
        stateJson: JSON.stringify(options.initialState),
        initialStateJson: JSON.stringify(options.initialState),
        metadataJson: JSON.stringify(options.metadata),
      },
    });
  }

  async setState(matchID: string, state: State, deltalog: LogEntry[] = []): Promise<void> {
    const stored = await prisma.gameState.findUnique({ where: { id: matchID } });
    if (!stored) throw new Error(`Match ${matchID} was not found`);

    const metadata = decode<ServerTypes.MatchData>(stored.metadataJson);
    const log = [...decode<LogEntry[]>(stored.logJson), ...deltalog];
    const isGameover = state.ctx.gameover !== undefined;

    await prisma.gameState.update({
      where: { id: matchID },
      data: {
        stateJson: JSON.stringify(state),
        logJson: JSON.stringify(log),
        isGameover,
      },
    });

    if (isGameover && !stored.isGameover) {
      await saveMatchHistory(matchID, state, metadata);
    }
  }

  async setMetadata(matchID: string, metadata: ServerTypes.MatchData): Promise<void> {
    await claimSeats(matchID, metadata);
    await prisma.gameState.update({
      where: { id: matchID },
      data: {
        metadataJson: JSON.stringify(metadata),
        isGameover: metadata.gameover !== undefined,
      },
    });
  }

  async fetch<O extends StorageAPI.FetchOpts>(matchID: string, options: O): Promise<StorageAPI.FetchResult<O>> {
    const stored = await prisma.gameState.findUnique({ where: { id: matchID } });
    if (!stored) return {} as StorageAPI.FetchResult<O>;

    const result: Partial<StorageAPI.FetchFields> = {};
    if (options.state) result.state = decode<State>(stored.stateJson);
    if (options.initialState) result.initialState = decode<State>(stored.initialStateJson);
    if (options.metadata) result.metadata = decode<ServerTypes.MatchData>(stored.metadataJson);
    if (options.log) result.log = decode<LogEntry[]>(stored.logJson);
    return result as StorageAPI.FetchResult<O>;
  }

  async wipe(matchID: string): Promise<void> {
    await prisma.gameState.deleteMany({ where: { id: matchID } });
  }

  async listMatches(options: StorageAPI.ListMatchesOpts = {}): Promise<string[]> {
    const rows = await prisma.gameState.findMany({
      where: {
        gameName: options.gameName,
        isGameover: options.where?.isGameover,
        updatedAt: {
          lt: options.where?.updatedBefore ? new Date(options.where.updatedBefore) : undefined,
          gt: options.where?.updatedAfter ? new Date(options.where.updatedAfter) : undefined,
        },
      },
      select: { id: true },
    });
    return rows.map((row) => row.id);
  }
}
