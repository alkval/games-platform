import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { PlayerProfileView, type PlayerProfileData } from '../components/PlayerProfileView';

export function ProfilePage() {
  const { user, loading, googleIsConfigured } = useAuth();
  const [profile, setProfile] = useState<PlayerProfileData | null>(null);
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
        return response.json() as Promise<PlayerProfileData>;
      })
      .then(setProfile)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : 'Could not load your profile.');
      })
      .finally(() => setProfileLoading(false));

    return () => controller.abort();
  }, [user]);

  if (loading) return <main className="page-shell text-stone-500">Loading your profile...</main>;

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

  if (profileLoading && !profile) return <main className="page-shell text-stone-500">Loading your profile...</main>;

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

  return <PlayerProfileView data={profile} isOwnProfile />;
}
