import { LobbyClient } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Client } from 'boardgame.io/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { MattisBoard } from '../../games/cardgames/mattis/MattisBoard';
import { MattisGame } from '../../games/cardgames/mattis/game';
import { useAuth } from '../auth-context';

interface RoomSession {
  matchID: string;
  playerID: string;
  credentials: string;
  playerName: string;
}

const serverUrl = window.location.origin;
const lobby = new LobbyClient({ server: serverUrl });
const MattisClient = Client({ game: MattisGame, board: MattisBoard, multiplayer: SocketIO({ server: serverUrl }), debug: false });
const sessionKey = (matchID: string) => `mattis-room:${matchID}`;

function loadSession(matchID: string | null): RoomSession | null {
  if (!matchID) return null;
  const saved = sessionStorage.getItem(sessionKey(matchID));
  if (!saved) return null;
  try { return JSON.parse(saved) as RoomSession; } catch { return null; }
}

function readMatchID(value: string): string {
  const trimmed = value.trim();
  try {
    const url = new URL(trimmed);
    return url.searchParams.get('match') ?? trimmed;
  } catch { return trimmed; }
}

export function MattisPage() {
  const { user, gameToken } = useAuth();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const matchID = searchParams.get('match');
  const [session, setSession] = useState<RoomSession | null>(() => loadSession(matchID));
  const [name, setName] = useState(user?.displayName ?? sessionStorage.getItem('mattis-player-name') ?? '');
  const [roomInput, setRoomInput] = useState(matchID ?? '');
  const [numPlayers, setNumPlayers] = useState(2);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user?.displayName && !name) setName(user.displayName);
  }, [name, user]);

  const roomLink = useMemo(
    () => (matchID ? `${window.location.origin}/cardgames/mattis?match=${encodeURIComponent(matchID)}` : ''),
    [matchID],
  );

  function saveSession(next: RoomSession) {
    sessionStorage.setItem(sessionKey(next.matchID), JSON.stringify(next));
    sessionStorage.setItem('mattis-player-name', next.playerName);
    setSession(next);
  }

  async function createRoom(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError('Enter your name first.');
    setBusy(true);
    setError('');
    try {
      const created = await lobby.createMatch('mattis', { numPlayers });
      const joined = await lobby.joinMatch('mattis', created.matchID, { playerID: '0', playerName: name.trim(), data: { gameToken } });
      saveSession({ matchID: created.matchID, playerID: joined.playerID, credentials: joined.playerCredentials, playerName: name.trim() });
      navigate(`/cardgames/mattis?match=${encodeURIComponent(created.matchID)}`, { replace: true });
    } catch (roomError) {
      setError(roomError instanceof Error ? roomError.message : 'Could not create the room.');
    } finally { setBusy(false); }
  }

  async function joinRoom(event: FormEvent) {
    event.preventDefault();
    const requestedMatchID = readMatchID(roomInput);
    if (!name.trim()) return setError('Enter your name first.');
    if (!requestedMatchID) return setError('Paste a room link or match ID.');
    setBusy(true);
    setError('');
    try {
      const match = await lobby.getMatch('mattis', requestedMatchID);
      const openPlayer = match.players.find((player) => !player.name);
      if (!openPlayer) throw new Error('That room is full.');
      const joined = await lobby.joinMatch('mattis', requestedMatchID, {
        playerID: String(openPlayer.id), playerName: name.trim(), data: { gameToken },
      });
      saveSession({ matchID: requestedMatchID, playerID: joined.playerID, credentials: joined.playerCredentials, playerName: name.trim() });
      navigate(`/cardgames/mattis?match=${encodeURIComponent(requestedMatchID)}`, { replace: true });
    } catch (roomError) {
      setError(roomError instanceof Error ? roomError.message : 'Could not join the room.');
    } finally { setBusy(false); }
  }

  if (session && session.matchID === matchID) {
    return (
      <div className="bg-emerald-950">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-3 text-sm text-emerald-50">
          <Link className="hover:text-amber-200" to="/cardgames">Leave table</Link>
          <button className="rounded-full border border-white/20 px-4 py-2 hover:bg-white/10" type="button" onClick={() => {
            void navigator.clipboard.writeText(roomLink);
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1800);
          }}>{copied ? 'Link copied' : 'Copy invite link'}</button>
        </div>
        <MattisClient matchID={session.matchID} playerID={session.playerID} credentials={session.credentials} />
      </div>
    );
  }

  return (
    <main className="page-shell max-w-5xl">
      <Link className="text-sm text-stone-500 hover:text-stone-900" to="/cardgames">Back to card games</Link>
      <div className="mt-12 grid gap-10 md:grid-cols-[1fr_1.05fr]">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-red-800">Norwegian card game</p>
          <h1 className="mt-2 text-6xl font-bold tracking-tight">Mattis</h1>
          <p className="mt-5 text-lg text-stone-600">Collect strong cards first. Then use suit and trump to shed the lot. The last player holding cards becomes Mattis.</p>
          <ol className="mt-8 space-y-3 text-sm text-stone-600">
            <li><strong>1. Collect:</strong> everyone plays; the unique highest rank takes the trick. Tied high players go again.</li>
            <li><strong>2. Trump:</strong> the final hidden stock card reveals trump and its owner leads.</li>
            <li><strong>3. Shed:</strong> beat with a higher card of the same suit or trump, or pick up the oldest card.</li>
          </ol>
          <details className="mattis-rules mt-7">
            <summary>Rules used on this site</summary>
            <p>This is the all-player first-phase variant documented by Pagat, with the Norwegian two-player setup from KortRegler.no and single-card play in phase two. Ten unseen cards are removed for two players; the optional sequence rule is not used.</p>
            <p><a href="https://www.pagat.com/beating/skitgubbe.html#mattis" target="_blank" rel="noreferrer noopener">Pagat rules</a> &middot; <a href="https://kortregler.no/mattis/" target="_blank" rel="noreferrer noopener">KortRegler.no</a></p>
          </details>
        </div>

        <div className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
          <form onSubmit={createRoom}>
            <label className="form-label" htmlFor="mattis-player-name">Your name</label>
            <input id="mattis-player-name" className="form-input" value={name} maxLength={40} onChange={(event) => setName(event.target.value)} placeholder="Alexander" />
            <label className="form-label mt-4" htmlFor="mattis-player-count">Players</label>
            <select id="mattis-player-count" className="form-input" value={numPlayers} onChange={(event) => setNumPlayers(Number(event.target.value))}>
              {[2, 3, 4, 5, 6].map((count) => <option value={count} key={count}>{count} players</option>)}
            </select>
            <button className="primary-button mt-4 w-full" type="submit" disabled={busy}>{busy ? 'Opening room...' : 'Create a room'}</button>
          </form>
          <div className="my-7 flex items-center gap-3 text-xs uppercase tracking-wider text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div>
          <form onSubmit={joinRoom}>
            <label className="form-label" htmlFor="mattis-room-id">Invite link or match ID</label>
            <input id="mattis-room-id" className="form-input" value={roomInput} onChange={(event) => setRoomInput(event.target.value)} placeholder="Paste it here" />
            <button className="secondary-button mt-4 w-full" type="submit" disabled={busy}>Join room</button>
          </form>
          {error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}
          {!user && <p className="mt-5 text-xs text-stone-500">You can play as a guest. Sign in to save stats.</p>}
        </div>
      </div>
    </main>
  );
}
