import { LobbyClient } from 'boardgame.io/client';
import { useEffect, useState } from 'react';
import { freshGameToken, roomErrorMessage, saveRoomSession, type RoomSession } from '../room-session';

const lobby = new LobbyClient({ server: window.location.origin });

/**
 * Appears once the match is over. The first player to click opens a new room for the same
 * table; the others see that a rematch is waiting and join it with one click.
 */
export function RematchButton({ game, session, swapSeats = false, onJoined, className }: {
  game: string;
  session: RoomSession;
  /** Chess swaps colours for the rematch. */
  swapSeats?: boolean;
  onJoined: (matchID: string) => void;
  className?: string;
}) {
  const [finished, setFinished] = useState(false);
  const [waiting, setWaiting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let stopped = false;
    const check = async () => {
      try {
        const match = await lobby.getMatch(game, session.matchID) as { gameover?: unknown; nextMatchID?: string };
        if (stopped) return;
        setFinished(match.gameover !== undefined);
        setWaiting(Boolean(match.nextMatchID));
      } catch {
        /* the room may have been removed; the button simply stays hidden */
      }
    };
    void check();
    const timer = setInterval(check, 4000);
    return () => { stopped = true; clearInterval(timer); };
  }, [game, session.matchID]);

  async function rematch() {
    setBusy(true);
    setError('');
    try {
      const { nextMatchID } = await lobby.playAgain(game, session.matchID, { playerID: session.playerID, credentials: session.credentials });
      const next = await lobby.getMatch(game, nextMatchID);
      const wanted = swapSeats && next.players.length === 2 ? String(1 - Number(session.playerID)) : session.playerID;
      const seat = next.players.find((player) => String(player.id) === wanted && !player.name) ?? next.players.find((player) => !player.name);
      if (!seat) throw new Error('The rematch is already full.');
      const joined = await lobby.joinMatch(game, nextMatchID, { playerID: String(seat.id), playerName: session.playerName, data: { gameToken: await freshGameToken() } });
      saveRoomSession(game, { matchID: nextMatchID, playerID: joined.playerID, credentials: joined.playerCredentials, playerName: session.playerName });
      onJoined(nextMatchID);
    } catch (rematchError) {
      setError(roomErrorMessage(rematchError, 'Could not start a rematch.'));
    } finally {
      setBusy(false);
    }
  }

  if (!finished) return null;
  return (
    <button className={className} type="button" disabled={busy} onClick={rematch} title={error || undefined}>
      {error || (busy ? 'Opening...' : waiting ? 'Join the rematch' : 'Play again')}
    </button>
  );
}
