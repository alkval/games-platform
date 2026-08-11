import { env } from './env.js';
import { prisma } from './prisma.js';

const hour = 60 * 60 * 1000;
const day = 24 * hour;

interface StoredRoom {
  createdAt: Date;
  updatedAt: Date;
  metadataJson: string;
}

interface RoomMetadata {
  players?: Record<string, { name?: string | null }>;
}

export function joinedPlayerCount(metadataJson: string): number {
  try {
    const metadata = JSON.parse(metadataJson) as RoomMetadata;
    return Object.values(metadata.players ?? {}).filter((player) => Boolean(player.name?.trim())).length;
  } catch {
    return 0;
  }
}

export function roomExpiresAt(room: StoredRoom): Date {
  const joinedPlayers = joinedPlayerCount(room.metadataJson);
  const base = joinedPlayers ? room.updatedAt : room.createdAt;
  const ttl = joinedPlayers ? env.STALE_ROOM_TTL_DAYS * day : env.EMPTY_ROOM_TTL_HOURS * hour;
  return new Date(base.getTime() + ttl);
}

export function isRoomExpired(room: StoredRoom, now = new Date()): boolean {
  return roomExpiresAt(room).getTime() <= now.getTime();
}

export async function cleanupExpiredRooms(now = new Date()): Promise<number> {
  const oldestPossibleExpiry = new Date(now.getTime() - Math.min(env.EMPTY_ROOM_TTL_HOURS * hour, env.STALE_ROOM_TTL_DAYS * day));
  const candidates = await prisma.gameState.findMany({
    where: { isGameover: false, createdAt: { lte: oldestPossibleExpiry } },
    select: { id: true, createdAt: true, updatedAt: true, metadataJson: true },
  });
  let removed = 0;

  for (const room of candidates) {
    if (!isRoomExpired(room, now)) continue;
    const result = await prisma.gameState.deleteMany({
      where: { id: room.id, isGameover: false, updatedAt: room.updatedAt },
    });
    removed += result.count;
  }

  return removed;
}

export function startRoomCleanup(): () => void {
  const timer = setInterval(() => {
    cleanupExpiredRooms().then((removed) => {
      if (removed) console.log(`Expired ${removed} abandoned game room${removed === 1 ? '' : 's'}`);
    }).catch((error: unknown) => console.error('Could not clean up expired game rooms', error));
  }, env.ROOM_CLEANUP_INTERVAL_MINUTES * 60 * 1000);
  timer.unref();
  return () => clearInterval(timer);
}
