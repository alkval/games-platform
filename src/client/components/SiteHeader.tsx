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
            {user.avatarUrl && <img className="h-8 w-8 rounded-full" src={user.avatarUrl} alt="" referrerPolicy="no-referrer" />}
            <span className="hidden sm:inline">{user.displayName}</span>
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


