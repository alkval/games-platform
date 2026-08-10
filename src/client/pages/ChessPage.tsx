import { LobbyClient } from 'boardgame.io/client';
import { SocketIO } from 'boardgame.io/multiplayer';
import { Client } from 'boardgame.io/react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ChessBoard } from '../../games/boardgames/chess/ChessBoard';
import { ChessGame } from '../../games/boardgames/chess/game';
import { useAuth } from '../auth-context';

interface RoomSession { matchID: string; playerID: string; credentials: string; playerName: string }
const serverUrl = window.location.origin;
const lobby = new LobbyClient({ server: serverUrl });
const ChessClient = Client({ game: ChessGame, board: ChessBoard, multiplayer: SocketIO({ server: serverUrl }), debug: false });
const key = (matchID: string) => `chess-room:${matchID}`;
function load(matchID: string | null): RoomSession | null { if (!matchID) return null; try { return JSON.parse(sessionStorage.getItem(key(matchID)) ?? 'null') as RoomSession | null; } catch { return null; } }
function matchFrom(value: string) { try { return new URL(value.trim()).searchParams.get('match') ?? value.trim(); } catch { return value.trim(); } }

export function ChessPage() {
  const { user, gameToken } = useAuth();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const matchID = params.get('match');
  const [session, setSession] = useState<RoomSession | null>(() => load(matchID));
  const [name, setName] = useState(user?.displayName ?? sessionStorage.getItem('chess-player-name') ?? '');
  const [room, setRoom] = useState(matchID ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  useEffect(() => { if (user?.displayName && !name) setName(user.displayName); }, [name, user]);
  const invite = useMemo(() => matchID ? `${location.origin}/boardgames/chess?match=${encodeURIComponent(matchID)}` : '', [matchID]);
  function save(value: RoomSession) { sessionStorage.setItem(key(value.matchID), JSON.stringify(value)); sessionStorage.setItem('chess-player-name', value.playerName); setSession(value); }
  async function create(event: FormEvent) { event.preventDefault(); if (!name.trim()) return setError('Enter your name first.'); setBusy(true); setError(''); try { const created = await lobby.createMatch('chess', { numPlayers: 2 }); const joined = await lobby.joinMatch('chess', created.matchID, { playerID: '0', playerName: name.trim(), data: { gameToken } }); save({ matchID: created.matchID, playerID: joined.playerID, credentials: joined.playerCredentials, playerName: name.trim() }); navigate(`/boardgames/chess?match=${encodeURIComponent(created.matchID)}`, { replace: true }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not create the room.'); } finally { setBusy(false); } }
  async function join(event: FormEvent) { event.preventDefault(); const id = matchFrom(room); if (!name.trim() || !id) return setError('Enter your name and an invite link.'); setBusy(true); setError(''); try { const found = await lobby.getMatch('chess', id); const open = found.players.find((player) => !player.name); if (!open) throw new Error('That room is full.'); const joined = await lobby.joinMatch('chess', id, { playerID: String(open.id), playerName: name.trim(), data: { gameToken } }); save({ matchID: id, playerID: joined.playerID, credentials: joined.playerCredentials, playerName: name.trim() }); navigate(`/boardgames/chess?match=${encodeURIComponent(id)}`, { replace: true }); } catch (e) { setError(e instanceof Error ? e.message : 'Could not join the room.'); } finally { setBusy(false); } }
  if (session?.matchID === matchID) return <div><div className="mx-auto flex max-w-6xl items-center justify-between px-5 py-3 text-sm"><Link to="/boardgames">Leave table</Link><button className="secondary-button" type="button" onClick={() => { void navigator.clipboard.writeText(invite); setCopied(true); setTimeout(() => setCopied(false), 1800); }}>{copied ? 'Link copied' : 'Copy invite link'}</button></div><ChessClient matchID={session.matchID} playerID={session.playerID} credentials={session.credentials} /></div>;
  return <main className="page-shell max-w-4xl"><Link className="text-sm text-stone-500" to="/boardgames">Back to board games</Link><div className="mt-12 grid gap-10 md:grid-cols-[1fr_1.1fr]"><div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Classic board game</p><h1 className="mt-2 text-6xl font-bold tracking-tight">Chess</h1><p className="mt-5 text-lg text-stone-600">Complete rules, legal move checking, promotion, castling, en passant, checkmate and draws.</p><p className="mt-6 text-sm text-stone-500">The room creator plays White. Share the invite link with the player taking Black.</p></div><div className="profile-panel"><form onSubmit={create}><label className="form-label" htmlFor="chess-name">Your name</label><input id="chess-name" className="form-input" value={name} maxLength={40} onChange={(e) => setName(e.target.value)} /><button className="primary-button mt-4 w-full" disabled={busy}>{busy ? 'Opening room...' : 'Create a room'}</button></form><div className="my-7 flex items-center gap-3 text-xs uppercase text-stone-400"><span className="h-px flex-1 bg-stone-200" />or<span className="h-px flex-1 bg-stone-200" /></div><form onSubmit={join}><label className="form-label" htmlFor="chess-room">Invite link or match ID</label><input id="chess-room" className="form-input" value={room} onChange={(e) => setRoom(e.target.value)} /><button className="secondary-button mt-4 w-full" disabled={busy}>Join room</button></form>{error && <p className="mt-5 rounded-lg bg-red-50 p-3 text-sm text-red-800">{error}</p>}{!user && <p className="mt-5 text-xs text-stone-500">Guest play works. Sign in to save stats.</p>}</div></div></main>;
}
