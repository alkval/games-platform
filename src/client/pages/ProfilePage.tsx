import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { publicGameName } from '../../games/public-games';

interface ProfileData {
  profile: {
    displayName: string;
    email: string;
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

export function ProfilePage() {
  const { user, loading, googleIsConfigured } = useAuth();
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!user) {
      setProfile(null);
      return;
    }

    const controller = new AbortController();
    setProfileLoading(true);
    setError('');
    fetch('/api/profile', { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(response.status === 401 ? 'Your session has expired. Sign in again.' : 'Could not load your profile.');
        return response.json() as Promise<ProfileData>;
      })
      .then(setProfile)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : 'Could not load your profile.');
      })
      .finally(() => setProfileLoading(false));

    return () => controller.abort();
  }, [user]);

  if (loading) {
    return <main className="page-shell text-stone-500">Loading your profile...</main>;
  }

  if (!user) {
    return (
      <main className="page-shell">
        <section className="profile-panel mx-auto max-w-xl text-center">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Player profile</p>
          <h1 className="mt-3 text-4xl font-bold tracking-tight">Sign in to see your stats</h1>
          <p className="mt-4 text-stone-600">Your completed games, wins and recent matches will live here.</p>
          {googleIsConfigured && <a className="primary-button mt-8" href="/api/auth/google">Sign in with Google</a>}
        </section>
      </main>
    );
  }

  if (profileLoading && !profile) {
    return <main className="page-shell text-stone-500">Loading your profile...</main>;
  }

  if (error || !profile) {
    return (
      <main className="page-shell">
        <section className="profile-panel">
          <h1 className="text-3xl font-bold">Profile unavailable</h1>
          <p className="mt-3 text-stone-600">{error || 'Could not load your profile.'}</p>
          <Link className="secondary-button mt-6" to="/">Back home</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="page-shell">
      <section className="profile-hero">
        {profile.profile.avatarUrl ? (
          <img className="profile-hero-avatar" src={profile.profile.avatarUrl} alt="" referrerPolicy="no-referrer" />
        ) : (
          <span className="profile-hero-avatar profile-avatar-fallback text-2xl" aria-hidden="true">
            {profile.profile.displayName.slice(0, 1).toUpperCase()}
          </span>
        )}
        <div className="min-w-0">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Player profile</p>
          <h1 className="mt-1 truncate text-4xl font-bold tracking-tight sm:text-5xl">{profile.profile.displayName}</h1>
          <p className="mt-2 truncate text-stone-600">{profile.profile.email}</p>
          <p className="mt-1 text-sm text-stone-500">Playing here since {formatDate(profile.profile.memberSince)}</p>
        </div>
      </section>

      <section className="mt-10" aria-labelledby="stats-heading">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Your record</p>
            <h2 className="mt-1 text-3xl font-bold" id="stats-heading">All games</h2>
          </div>
          <p className="text-sm text-stone-500">Completed matches only</p>
        </div>
        <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
          <div className="stat-card"><p className="text-sm text-stone-500">Played</p><p className="mt-2 text-4xl font-bold">{profile.totals.played}</p></div>
          <div className="stat-card"><p className="text-sm text-stone-500">Won</p><p className="mt-2 text-4xl font-bold">{profile.totals.won}</p></div>
          <div className="stat-card"><p className="text-sm text-stone-500">Draws</p><p className="mt-2 text-4xl font-bold">{profile.totals.draws}</p></div>
          <div className="stat-card"><p className="text-sm text-stone-500">Win rate</p><p className="mt-2 text-4xl font-bold">{profile.totals.winRate}%</p></div>
        </div>
      </section>

      <div className="mt-10 grid gap-5 lg:grid-cols-2">
        <section className="profile-panel" aria-labelledby="games-heading">
          <h2 className="text-2xl font-bold" id="games-heading">By game</h2>
          {profile.byGame.length ? (
            <div className="mt-5 divide-y divide-stone-200">
              {profile.byGame.map((stat) => (
                <div className="flex items-center justify-between gap-4 py-4" key={stat.gameId}>
                  <div><p className="font-semibold">{publicGameName(stat.gameId)}</p><p className="text-sm text-stone-500">{stat.played} played &middot; {stat.winRate}% win rate</p></div>
                  <p className="text-sm text-stone-600">{stat.won}W &middot; {stat.draws}D &middot; {stat.lost}L</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-stone-300 p-8 text-center">
              <p className="font-semibold">No game stats yet</p>
              <p className="mt-2 text-sm text-stone-500">Finish a game while signed in and your record will appear here.</p>
              <Link className="secondary-button mt-5" to="/cardgames">Choose a game</Link>
            </div>
          )}
        </section>

        <section className="profile-panel" aria-labelledby="recent-heading">
          <h2 className="text-2xl font-bold" id="recent-heading">Recent matches</h2>
          {profile.recentMatches.length ? (
            <div className="mt-5 divide-y divide-stone-200">
              {profile.recentMatches.map((match) => (
                <div className="flex items-center justify-between gap-4 py-4" key={match.id}>
                  <div><p className="font-semibold">{publicGameName(match.gameId)}</p><p className="text-sm text-stone-500">{formatDate(match.endedAt)} &middot; Score {match.score}</p></div>
                  <span className={`rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wider ${match.outcome === 'win' ? 'bg-emerald-100 text-emerald-800' : match.outcome === 'draw' ? 'bg-amber-100 text-amber-800' : 'bg-stone-200 text-stone-700'}`}>{match.outcome}</span>
                </div>
              ))}
            </div>
          ) : (
            <div className="mt-5 rounded-xl border border-dashed border-stone-300 p-8 text-center text-stone-500">
              Your finished matches will show up here.
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

