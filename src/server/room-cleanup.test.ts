import { describe, expect, it } from 'vitest';
import { isRoomExpired, joinedPlayerCount, roomExpiresAt } from './room-cleanup.js';

const createdAt = new Date('2026-01-01T00:00:00.000Z');

describe('room expiry policy', () => {
  it('expires rooms with no joined players after 24 hours', () => {
    const room = {
      createdAt,
      updatedAt: new Date('2026-01-01T12:00:00.000Z'),
      metadataJson: JSON.stringify({ players: { 0: { id: 0 }, 1: { id: 1 } } }),
    };
    expect(joinedPlayerCount(room.metadataJson)).toBe(0);
    expect(roomExpiresAt(room)).toEqual(new Date('2026-01-02T00:00:00.000Z'));
    expect(isRoomExpired(room, new Date('2026-01-02T00:00:00.000Z'))).toBe(true);
  });

  it('uses last activity and a longer window once somebody joins', () => {
    const room = {
      createdAt,
      updatedAt: new Date('2026-01-10T00:00:00.000Z'),
      metadataJson: JSON.stringify({ players: { 0: { id: 0, name: 'Alexander' }, 1: { id: 1 } } }),
    };
    expect(joinedPlayerCount(room.metadataJson)).toBe(1);
    expect(roomExpiresAt(room)).toEqual(new Date('2026-02-09T00:00:00.000Z'));
    expect(isRoomExpired(room, new Date('2026-02-08T23:59:59.000Z'))).toBe(false);
  });

  it('handles malformed legacy metadata as an empty room', () => {
    expect(joinedPlayerCount('not-json')).toBe(0);
  });
});
