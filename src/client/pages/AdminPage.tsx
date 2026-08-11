import { useEffect, useState } from 'react';
import { useAuth } from '../auth-context';
import { publicGameName } from '../../games/public-games';

interface AdminData {
  users: Array<{
    id: string;
    email: string;
    displayName: string;
    avatarUrl: string | null;
    createdAt: string;
    _count: { matchPlayers: number };
  }>;
  matches: Array<{
    id: string;
    gameId: string;
    playerCount: number;
    endedAt: string;
    players: Array<{ playerName: string; userId: string | null }>;
  }>;
  rooms: Array<{
    id: string;
    gameName: string;
    createdAt: string;
    updatedAt: string;
  }>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value));
}

export function AdminPage() {
  const { user, loading } = useAuth();
  const [data, setData] = useState<AdminData | null>(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const load = async (signal?: AbortSignal) => {
    const response = await fetch('/api/admin/overview', { signal });
    if (!response.ok) {
      const body = await response.json().catch(() => ({ error: 'Could not load administration.' })) as { error?: string };
      throw new Error(body.error || 'Could not load administration.');
    }
    setData(await response.json() as AdminData);
  };

  useEffect(() => {
    if (!user?.isAdmin) return;
    const controller = new AbortController();
    setError('');
    load(controller.signal).catch((requestError: unknown) => {
      if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
      setError(requestError instanceof Error ? requestError.message : 'Could not load administration.');
    });
    return () => controller.abort();
  }, [user]);

  const remove = async (kind: 'matches' | 'rooms' | 'users', id: string, description: string) => {
    if (!window.confirm(`Permanently remove ${description}? This cannot be undone.`)) return;
    setBusy(`${kind}:${id}`);
    setError('');
    try {
      const response = await fetch(`/api/admin/${kind}/${encodeURIComponent(id)}`, { method: 'DELETE' });
      if (!response.ok) {
        const body = await response.json().catch(() => ({ error: 'The delete request failed.' })) as { error?: string };
        throw new Error(body.error || 'The delete request failed.');
      }
      await load();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : 'The delete request failed.');
    } finally {
      setBusy('');
    }
  };

  if (loading) return <main className="page-shell text-stone-500">Checking administrator access...</main>;
  if (!user?.isAdmin) return <main className="page-shell"><section className="profile-panel"><p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Administration</p><h1 className="mt-3 text-4xl font-bold">Access denied</h1><p className="mt-3 text-stone-600">This page is restricted to the site administrator.</p></section></main>;
  if (!data && !error) return <main className="page-shell text-stone-500">Loading administration...</main>;

  return (
    <main className="page-shell">
      <section className="border-b border-stone-300 pb-8">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Private administration</p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight">Manage the platform</h1>
        <p className="mt-4 max-w-2xl text-stone-600">Review accounts and stored games. Every destructive action asks for confirmation.</p>
      </section>

      {error && <p className="mt-6 rounded-xl bg-red-50 p-4 text-red-800" role="alert">{error}</p>}

      {data && (
        <>
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="stat-card"><p className="text-sm text-stone-500">Accounts</p><p className="mt-2 text-4xl font-bold">{data.users.length}</p></div>
            <div className="stat-card"><p className="text-sm text-stone-500">Matches</p><p className="mt-2 text-4xl font-bold">{data.matches.length}</p></div>
            <div className="stat-card"><p className="text-sm text-stone-500">Active rooms</p><p className="mt-2 text-4xl font-bold">{data.rooms.length}</p></div>
          </div>

          <section className="profile-panel mt-8" aria-labelledby="accounts-heading">
            <h2 className="text-2xl font-bold" id="accounts-heading">Accounts</h2>
            <div className="admin-list mt-4">
              {data.users.map((account) => (
                <div className="admin-row" key={account.id}>
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{account.displayName}</p>
                    <p className="truncate text-sm text-stone-500">{account.email}</p>
                    <p className="mt-1 text-xs text-stone-500">Joined {formatDate(account.createdAt)} &middot; {account._count.matchPlayers} recorded matches</p>
                  </div>
                  {account.id === user.userId ? <span className="admin-you">You</span> : <button className="danger-button" disabled={Boolean(busy)} type="button" onClick={() => void remove('users', account.id, `the account “${account.displayName}”`)}>{busy === `users:${account.id}` ? 'Removing...' : 'Remove account'}</button>}
                </div>
              ))}
            </div>
          </section>

          <section className="profile-panel mt-6" aria-labelledby="matches-heading">
            <h2 className="text-2xl font-bold" id="matches-heading">Completed matches</h2>
            {data.matches.length ? <div className="admin-list mt-4">{data.matches.map((match) => (
              <div className="admin-row" key={match.id}>
                <div className="min-w-0"><p className="font-semibold">{publicGameName(match.gameId)}</p><p className="truncate text-sm text-stone-500">{match.players.map((player) => player.playerName).join(' vs ')}</p><p className="mt-1 text-xs text-stone-500">{formatDate(match.endedAt)} &middot; {match.id}</p></div>
                <button className="danger-button" disabled={Boolean(busy)} type="button" onClick={() => void remove('matches', match.id, `this ${publicGameName(match.gameId)} match`)}>{busy === `matches:${match.id}` ? 'Removing...' : 'Remove match'}</button>
              </div>
            ))}</div> : <p className="mt-4 text-stone-500">No completed matches.</p>}
          </section>

          <section className="profile-panel mt-6" aria-labelledby="rooms-heading">
            <h2 className="text-2xl font-bold" id="rooms-heading">Active rooms</h2>
            {data.rooms.length ? <div className="admin-list mt-4">{data.rooms.map((room) => (
              <div className="admin-row" key={room.id}>
                <div className="min-w-0"><p className="font-semibold">{publicGameName(room.gameName)}</p><p className="truncate text-sm text-stone-500">{room.id}</p><p className="mt-1 text-xs text-stone-500">Updated {formatDate(room.updatedAt)}</p></div>
                <button className="danger-button" disabled={Boolean(busy)} type="button" onClick={() => void remove('rooms', room.id, `this ${publicGameName(room.gameName)} room`)}>{busy === `rooms:${room.id}` ? 'Removing...' : 'Remove room'}</button>
              </div>
            ))}</div> : <p className="mt-4 text-stone-500">No active rooms.</p>}
          </section>
        </>
      )}
    </main>
  );
}
