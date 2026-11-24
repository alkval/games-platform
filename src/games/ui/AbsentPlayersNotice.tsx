import { useEffect, useState } from 'react';

/** Must match ABANDON_GRACE_SECONDS on the server (src/server/env.ts, default 120). */
export const ABANDON_GRACE_SECONDS = 120;

interface SeatInfo {
  id: number;
  name?: string;
  isConnected?: boolean;
}

/**
 * Tells the players still at the table that someone left, and when that counts as giving up.
 * The server decides; this countdown starts when this browser noticed, so it is approximate.
 */
export function AbsentPlayersNotice({ matchData, playerID, gameover, className }: {
  matchData?: SeatInfo[];
  playerID?: string | null;
  gameover?: unknown;
  className?: string;
}) {
  const absent = (matchData ?? []).filter((seat) => seat.name && seat.isConnected === false && String(seat.id) !== playerID);
  const absentKey = absent.map((seat) => seat.id).join(',');
  const [since, setSince] = useState<Record<string, number>>({});
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    setSince((previous) => {
      const next: Record<string, number> = {};
      for (const id of absentKey ? absentKey.split(',') : []) next[id] = previous[id] ?? Date.now();
      return next;
    });
  }, [absentKey]);

  useEffect(() => {
    if (!absentKey) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [absentKey]);

  if (!playerID || gameover || !absent.length) return null;

  return (
    <div className={className} role="status">
      {absent.map((seat) => {
        const left = Math.max(0, ABANDON_GRACE_SECONDS - Math.floor((now - (since[seat.id] ?? now)) / 1000));
        const clock = `${Math.floor(left / 60)}:${String(left % 60).padStart(2, '0')}`;
        return (
          <p key={seat.id}>
            {seat.name} left the game.{' '}
            {left > 0 ? `If they don't come back within ${clock}, they give up.` : 'They give up now.'}
          </p>
        );
      })}
    </div>
  );
}
