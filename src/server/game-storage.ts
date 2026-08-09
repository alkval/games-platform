import type { LogEntry, Server as ServerTypes, State, StorageAPI } from 'boardgame.io';
import { prisma } from './prisma.js';
import { verifyGameToken } from './auth.js';

function decode<T>(value: string): T {
  return JSON.parse(value) as T;
}

async function saveMatchHistory(matchID: string, state: State, metadata: ServerTypes.MatchData): Promise<void> {
  if (await prisma.match.findUnique({ where: { id: matchID } })) return;

  const result = state.ctx.gameover as { winner?: string; draw?: boolean; scores?: Record<string, number> } | undefined;
  if (!result) return;

  const players = await Promise.all(
    Object.values(metadata.players).map(async (player) => ({
      playerID: String(player.id),
      playerName: player.name ?? `Player ${player.id + 1}`,
      userId: await verifyGameToken(player.data?.gameToken),
    })),
  );

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
          placement: result.draw ? 1 : result.winner === player.playerID ? 1 : 2,
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
