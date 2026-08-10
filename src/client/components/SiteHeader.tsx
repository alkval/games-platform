import { Link } from 'react-router-dom';
import { useAuth } from '../auth-context';

export function SiteHeader() {
  const { user, loading, googleIsConfigured, logout } = useAuth();

  return (
    <header className="site-header">
      <Link className="font-bold tracking-tight" to="/">
        Alexander's games
      </Link>
      <nav className="flex items-center gap-4 text-sm">
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
    </header>
  );
}



