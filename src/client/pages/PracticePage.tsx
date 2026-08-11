import { Local } from 'boardgame.io/multiplayer';
import { Client } from 'boardgame.io/react';
import { useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { getGame, listGames } from '../../games/registry';
import { practicePlayerName } from '../../games/ai/bot-names';
import '../../games/catalog';
import { practiceBot, type Difficulty } from '../../games/ai/practice-bots';

const difficulties: Array<{ id: Difficulty; name: string; copy: string }> = [
  { id: 'easy', name: 'Easy', copy: 'Quick, random legal moves.' },
  { id: 'normal', name: 'Normal', copy: 'A short Monte Carlo search.' },
  { id: 'hard', name: 'Hard', copy: 'A longer, deeper Monte Carlo search.' },
];

function PracticeTable({ gameId, difficulty, numPlayers }: { gameId: string; difficulty: Difficulty; numPlayers: number }) {
  const [round, setRound] = useState(0);
  const definition = getGame(gameId)!;
  const PracticeClient = useMemo(() => {
    if (!definition.game.ai?.enumerate) throw new Error(`${definition.name} does not support computer play.`);
    const BotClass = practiceBot(difficulty);
    const bots = Object.fromEntries(
      Array.from({ length: numPlayers - 1 }, (_value, index) => [String(index + 1), BotClass]),
    );
    const NamedBoard = (props: any) => {
      const Board = definition.board;
      const matchData = Array.from({ length: numPlayers }, (_value, id) => ({ id, name: practicePlayerName(id) }));
      return <Board {...props} matchData={matchData} />;
    };
    return Client({
      game: definition.game,
      board: NamedBoard,
      multiplayer: Local({ bots }),
      debug: false,
    });
  }, [definition, difficulty, numPlayers]);

  return (
    <div>
      <div className="practice-bar">
        <div><b>You</b> vs <b>Computer</b><span className="ml-2 text-stone-500">({difficulty})</span></div>
        <button className="secondary-button" type="button" onClick={() => setRound((value) => value + 1)}>New game</button>
      </div>
      <PracticeClient key={round} matchID={`practice-${gameId}-${difficulty}-${numPlayers}-${round}`} playerID="0" numPlayers={numPlayers} />
    </div>
  );
}

export function PracticePage() {
  const [params, setParams] = useSearchParams();
  const gameId = params.get('game');
  const requestedDifficulty = params.get('difficulty');
  const difficulty: Difficulty = requestedDifficulty === 'easy' || requestedDifficulty === 'hard' ? requestedDifficulty : 'normal';
  const definition = gameId ? getGame(gameId) : undefined;
  const requestedPlayers = Number(params.get('players') ?? 2);
  const numPlayers = definition
    ? Math.min(definition.maxPlayers, Math.max(definition.minPlayers, Number.isInteger(requestedPlayers) ? requestedPlayers : 2))
    : 2;
  const games = listGames();

  if (!definition) {
    return (
      <main className="page-shell">
        <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Solo practice</p>
        <h1 className="mt-2 text-5xl font-bold tracking-tight">Play against the computer</h1>
        <p className="mt-4 max-w-2xl text-stone-600">Pick any game and start immediately. These are local practice matches, so they do not change profiles or leaderboards.</p>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {games.map((game) => (
            <Link className="game-list-card" key={game.id} to={`/practice?game=${game.id}&difficulty=normal`}>
              <p className="text-sm font-semibold uppercase tracking-[0.12em] text-amber-700">{game.category === 'card' ? 'Card game' : 'Board game'}</p>
              <h2 className="mt-2 text-3xl font-bold">{game.name}</h2>
              <p className="mt-3 text-stone-600">{game.description}</p>
              <p className="mt-8 font-semibold">Play vs computer &rarr;</p>
            </Link>
          ))}
        </div>
      </main>
    );
  }

  return (
    <div>
      <div className="practice-setup">
        <div className="flex flex-wrap items-center gap-4">
          <Link className="header-link" to="/practice">&larr; All practice games</Link>
          <strong>{definition.name}</strong>
        </div>
        <div className="flex flex-wrap gap-2" aria-label="Computer difficulty">
          {difficulties.map((option) => (
            <button
              className={difficulty === option.id ? 'primary-button' : 'secondary-button'}
              key={option.id}
              type="button"
              title={option.copy}
              onClick={() => setParams({ game: definition.id, difficulty: option.id, ...(definition.maxPlayers > 2 ? { players: String(numPlayers) } : {}) })}
            >{option.name}</button>
          ))}
        </div>
        {definition.maxPlayers > 2 && (
          <label className="flex items-center gap-3 text-sm font-semibold">
            Players
            <select
              className="form-input !mt-0 !w-auto"
              value={numPlayers}
              onChange={(event) => setParams({ game: definition.id, difficulty, players: event.target.value })}
            >
              {Array.from({ length: definition.maxPlayers - definition.minPlayers + 1 }, (_value, index) => definition.minPlayers + index).map((count) => (
                <option key={count} value={count}>{count} ({count - 1} {count === 2 ? 'bot' : 'bots'})</option>
              ))}
            </select>
          </label>
        )}
      </div>
      <PracticeTable key={`${definition.id}-${difficulty}-${numPlayers}`} gameId={definition.id} difficulty={difficulty} numPlayers={numPlayers} />
    </div>
  );
}
