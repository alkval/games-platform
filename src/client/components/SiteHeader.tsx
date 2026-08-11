import { Link } from 'react-router-dom';
import { useAuth } from '../auth-context';
import { ThemeToggle } from './ThemeToggle';

export function SiteHeader() {
  const { user, loading, googleIsConfigured, logout } = useAuth();

  return (
    <header className="site-header">
      <Link className="brand-lockup" to="/" aria-label="Games home">
        <img className="brand-mark" src="/favicon.png" alt="" />
        <span>games</span>
      </Link>
      <nav className="flex items-center gap-4 text-sm">
        <Link className="desktop-navigation-link header-link" to="/practice">Vs computer</Link>
        <Link className="desktop-navigation-link header-link" to="/leaderboard">Leaderboard</Link>
        <ThemeToggle />
        {!loading && user ? (
          <div className="flex items-center gap-2">
            <Link className="profile-link" to="/profile" aria-label={`Open ${user.displayName}'s profile`}>
              {user.avatarUrl ? (
                <img className="profile-avatar" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />
              ) : (
                <span className="profile-avatar profile-avatar-fallback" aria-hidden="true">
                  {user.displayName.slice(0, 1).toUpperCase()}
                </span>
              )}
              <span className="hidden sm:inline">{user.displayName}</span>
            </Link>
            <button className="header-link" type="button" onClick={() => void logout()}>Sign out</button>
          </div>
        ) : googleIsConfigured ? (
          <a className="small-button" href="/api/auth/google">Sign in with Google</a>
        ) : (
          <span className="text-xs text-stone-500">Guest mode</span>
        )}
      </nav>
      <nav className="mobile-navigation" aria-label="Mobile navigation">
        <Link to="/practice">Vs computer</Link>
        <Link to="/leaderboard">Leaderboard</Link>
      </nav>
    </header>
  );
}



