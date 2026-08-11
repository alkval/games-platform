import { PageIntro } from '../components/PageIntro';
import { Link } from 'react-router-dom';
import { publicGames } from '../../games/public-games';

export function BoardGamesPage() {
  const games = publicGames.filter((game) => game.category === 'board');
  return (
    <main className="page-shell">
      <PageIntro eyebrow="Board games" title="Choose a board" copy="Create a private room, send the link, and play in your browser." />
      <div className="mt-12 grid gap-5 sm:grid-cols-2">{games.map((game) => <Link className="game-card" key={game.id} to={`/boardgames/${game.id}`}><p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">{game.minPlayers} players</p><h2 className="mt-2 text-3xl font-bold">{game.name}</h2><p className="mt-3 text-stone-600">{game.description}</p><span className="mt-7 inline-block font-semibold">Play now &rarr;</span></Link>)}</div>
    </main>
  );
}
