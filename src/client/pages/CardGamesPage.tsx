import { Link } from 'react-router-dom';
import { publicGames } from '../../games/public-games';
import { PageIntro } from '../components/PageIntro';

export function CardGamesPage() {
  const games = publicGames.filter((game) => game.category === 'card');

  return (
    <main className="page-shell">
      <PageIntro eyebrow="Card games" title="Choose your table" copy="Start a room, share the link, and play in your browser." />
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {games.map((game) => (
          <Link className="game-list-card" key={game.id} to={`/cardgames/${game.id}`}>
            <div className="flex items-start justify-between gap-6">
              <div>
                <p className="text-sm text-stone-500">{game.minPlayers === game.maxPlayers ? game.minPlayers : `${game.minPlayers}-${game.maxPlayers}`} players</p>
                <h2 className="mt-1 text-3xl font-bold">{game.name}</h2>
                <p className="mt-3 text-stone-600">{game.description}</p>
              </div>
              <span className="text-5xl text-red-800" aria-hidden="true">{game.id === 'mattis' ? '\u2660' : '\u2665'}</span>
            </div>
            <p className="mt-8 font-semibold">Play now</p>
          </Link>
        ))}
      </div>
    </main>
  );
}
