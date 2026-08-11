import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { publicGames } from '../../games/public-games';

interface Player {
  id: string;
  rank: number;
  displayName: string;
  avatarUrl?: string;
  played: number;
  won: number;
  draws: number;
  lost: number;
  winRate: number;
  points: number;
}

interface Board { players: Player[] }

export function LeaderboardPage() {
  const [params, setParams] = useSearchParams();
  const scope = params.get('game') ?? 'all';
  const [data, setData] = useState<Board | null>(null);
  const [error, setError] = useState('');
  const tabs = [{ id: 'all', name: 'Global' }, ...publicGames.map((game) => ({ id: game.id, name: game.name }))];

  useEffect(() => {
    const controller = new AbortController();
    setError('');
    fetch(`/api/leaderboard?game=${encodeURIComponent(scope)}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Could not load the leaderboard.');
        return response.json() as Promise<Board>;
      })
      .then(setData)
      .catch((loadError: unknown) => {
        if (!(loadError instanceof DOMException && loadError.name === 'AbortError')) {
          setError(loadError instanceof Error ? loadError.message : 'Could not load the leaderboard.');
        }
      });
    return () => controller.abort();
  }, [scope]);

  return (
    <main className="page-shell">
      <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Players</p>
      <h1 className="mt-2 text-5xl font-bold tracking-tight">Leaderboard</h1>
      <p className="mt-4 max-w-2xl text-stone-600">Every registered player is listed. Wins earn three points and draws earn one; the global table combines all games.</p>
      <nav className="mt-8 flex flex-wrap gap-2" aria-label="Leaderboard game">
        {tabs.map((tab) => (
          <button className={scope === tab.id ? 'primary-button' : 'secondary-button'} key={tab.id} onClick={() => setParams(tab.id === 'all' ? {} : { game: tab.id })}>
            {tab.name}
          </button>
        ))}
      </nav>
      {error && <p className="mt-8 text-red-700">{error}</p>}
      <div className="leaderboard-table mt-8">
        <div className="leaderboard-row leaderboard-head"><span>Rank</span><span>Player</span><span>Played</span><span>W / D / L</span><span>Win rate</span><span>Points</span></div>
        {data?.players.map((player) => (
          <Link className="leaderboard-row" key={player.id} to={`/players/${player.id}`}>
            <b>#{player.rank}</b>
            <span className="flex min-w-0 items-center gap-3">
              {player.avatarUrl
                ? <img className="profile-avatar" src={player.avatarUrl} alt="" referrerPolicy="no-referrer" />
                : <span className="profile-avatar profile-avatar-fallback">{player.displayName[0]}</span>}
              <b className="truncate">{player.displayName}</b>
            </span>
            <span data-label="Played">{player.played}</span>
            <span data-label="W / D / L">{player.won} / {player.draws} / {player.lost}</span>
            <span data-label="Win rate">{player.winRate}%</span>
            <b data-label="Points">{player.points}</b>
          </Link>
        ))}
      </div>
      {data && !data.players.length && <p className="mt-8 text-stone-500">No registered players yet.</p>}
    </main>
  );
}
