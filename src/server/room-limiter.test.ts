import { describe, expect, it } from 'vitest';
import { createRoomLimiter } from './server.js';

describe('room creation limit', () => {
  it('allows a burst up to the limit per visitor, then recovers after the window', () => {
    const allow = createRoomLimiter(3, 1000);
    expect([allow('a', 0), allow('a', 10), allow('a', 20)]).toEqual([true, true, true]);
    expect(allow('a', 30)).toBe(false);
    expect(allow('b', 30)).toBe(true);
    expect(allow('a', 1011)).toBe(true);
  });
});
