import { describe, expect, it } from 'vitest';
import { ABANDON_GRACE_MS, findAbandonedSeats, type SeatPresence } from './abandoned-games.js';

const seat = (playerID: string, connected: boolean, extra: Partial<SeatPresence> = {}): SeatPresence => ({
  playerID,
  seated: true,
  connected,
  wasConnected: true,
  ...extra,
});

describe('findAbandonedSeats', () => {
  it('gives up for a player who stays gone for the whole grace period while the other is here', () => {
    const gone = new Map<string, number>();
    const table = [seat('0', true), seat('1', false)];
    expect(findAbandonedSeats('m', table, gone, 0)).toEqual([]);
    expect(findAbandonedSeats('m', table, gone, ABANDON_GRACE_MS - 1)).toEqual([]);
    expect(findAbandonedSeats('m', table, gone, ABANDON_GRACE_MS)).toEqual(['1']);
  });

  it('forgets the absence when the player comes back', () => {
    const gone = new Map<string, number>();
    findAbandonedSeats('m', [seat('0', true), seat('1', false)], gone, 0);
    findAbandonedSeats('m', [seat('0', true), seat('1', true)], gone, 1000);
    expect(findAbandonedSeats('m', [seat('0', true), seat('1', false)], gone, ABANDON_GRACE_MS)).toEqual([]);
  });

  it('does nothing when everybody left', () => {
    const gone = new Map<string, number>();
    const table = [seat('0', false), seat('1', false)];
    findAbandonedSeats('m', table, gone, 0);
    expect(findAbandonedSeats('m', table, gone, ABANDON_GRACE_MS * 10)).toEqual([]);
  });

  it('ignores rooms still waiting for players and players who never connected', () => {
    const gone = new Map<string, number>();
    const waiting = [seat('0', true), seat('1', false, { seated: false })];
    findAbandonedSeats('m', waiting, gone, 0);
    expect(findAbandonedSeats('m', waiting, gone, ABANDON_GRACE_MS)).toEqual([]);
    const neverOpened = [seat('0', true), seat('1', false, { wasConnected: false })];
    findAbandonedSeats('n', neverOpened, gone, 0);
    expect(findAbandonedSeats('n', neverOpened, gone, ABANDON_GRACE_MS)).toEqual([]);
  });

  it('handles more than two seats', () => {
    const gone = new Map<string, number>();
    const table = [seat('0', true), seat('1', false), seat('2', true)];
    findAbandonedSeats('m', table, gone, 0);
    expect(findAbandonedSeats('m', table, gone, ABANDON_GRACE_MS)).toEqual(['1']);
  });
});
