import { Link } from 'react-router-dom';
import { publicGameName } from '../../games/public-games';

export interface PlayerProfileData {
  profile: {
    id?: string;
    displayName: string;
    email?: string;
    avatarUrl: string | null;
    memberSince: string;
  };
  totals: {
    played: number;
    won: number;
    lost: number;
    draws: number;
    winRate: number;
  };
  byGame: Array<{
    gameId: string;
    played: number;
    won: number;
    lost: number;
    draws: number;
    winRate: number;
  }>;
  recentMatches: Array<{
    id: string;
    gameId: string;
    playerName: string;
    score: number;
    placement: number | null;
    outcome: 'win' | 'loss' | 'draw';
    endedAt: string;
  }>;
}

function formatDate(value: string): string {
  return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(value));
}

export function PlayerProfileView({ data, isOwnProfile = false }: { data: PlayerProfileData; isOwnProfile?: boolean }) {
  return (
    <main className="page-shell">
      <section className="profile-hero">
        {data.profile.avatarUrl ? (
          <img className="profile-hero-avatar" src={data.profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="profile-hero-avatar profile-avatar-fallback text-2xl" aria-hidden="true">
            {data.profile.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Player profile</p>
          <h1 className="mt-1 truncate text-4xl font-bold tracking-tight sm:text-5xl">{data.profile.displayName}</h1>
          {data.profile.email && <p className="mt-2 truncate text-stone-600">{data.profile.email}</p>}
          <p className="mt-1 text-sm text-stone-500">Playing here since {formatDate(data.profile.memberSince)}</p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="stats-heading">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">{isOwnProfile ? 'Your record' : 'Player record'}</p>
          <h2 className="mt-1 text-3xl font-bold" id="stats-heading">All games</h2>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="stat-card"><p className="text-sm text-stone-500">Played</p><p className="mt-2 text-4xl font-bold">{data.totals.played}</p></div>
          <div className="stat-card"><p className="text-sm text-stone-500">Won</p><p className="mt-2 text-4xl font-bold">{data.totals.won}</p></div>
          <div className="stat-card"><p className="text-sm text-stone-500">Draws</p><p className="mt-2 text-4xl font-bold">{data.totals.draws}</p></div>
          <div className="stat-card"><p className="text-sm text-stone-500">Win rate</p><p className="mt-2 text-4xl font-bold">{data.totals.winRate}%</p></div>
        </div>
      </section>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="profile-panel" aria-labelledby="games-heading">
          <h2 className="text-2xl font-bold" id="games-heading">By game</h2>
          {data.byGame.length ? (
            <div className="mt-5 divide-y divide-stone-200">
              {data.byGame.map((stat) => (
                <div className="flex items-center justify-between gap-4 py-4" key={stat.gameId}>
                  <div><p className="font-semibold">{publicGameName(stat.gameId)}</p><p className="text-sm text-stone-500">{stat.played} played &middot; {stat.winRate}% win rate</p></div>
                  <p className="text-sm text-stone-600">{stat.won}W &middot; {stat.draws}D &middot; {stat.lost}L</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-stone-300 p-8 text-center">
              <p className="font-semibold">No game stats yet</p>
              <p className="mt-2 text-sm text-stone-500">{isOwnProfile ? 'Finish a game while signed in and your record will appear here.' : 'This player has not finished a game yet.'}</p>
              {isOwnProfile && <Link className="secondary-button mt-5" to="/cardgames">Choose a game</Link>}
            </div>
          )}
        </section>

        <section className="profile-panel" aria-labelledby="recent-heading">
          <h2 className="text-2xl font-bold" id="recent-heading">Recent matches</h2>
          {data.recentMatches.length ? (
            <div className="mt-5 divide-y divide-stone-200">
              {data.recentMatches.map((match) => (
                <div className="flex items-center justify-between gap-4 py-4" key={match.id}>
                  <div><p className="font-semibold">{publicGameName(match.gameId)}</p><p className="text-sm text-stone-500">{formatDate(match.endedAt)} &middot; Score {match.score}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${match.outcome === 'win' ? 'bg-emerald-100 text-emerald-800' : match.outcome === 'draw' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'}`}>{match.outcome}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
              Finished matches will show up here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}
