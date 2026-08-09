import type { BoardProps } from 'boardgame.io/react';
import { motion } from 'framer-motion';
import type { Card, Suit, WarState } from './game';

const suitSymbols: Record<Suit, string> = {
  clubs: '♣',
  diamonds: '♦',
  hearts: '♥',
  spades: '♠',
};

function PlayingCard({ card, onClick, disabled }: { card: Card; onClick?: () => void; disabled?: boolean }) {
  const red = card.suit === 'diamonds' || card.suit === 'hearts';

  return (
    <motion.button
      whileHover={disabled ? undefined : { y: -8 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      type="button"
      className={`playing-card ${red ? 'playing-card-red' : ''}`}
      disabled={disabled}
      onClick={onClick}
      aria-label={`Play ${card.label} of ${card.suit}`}
    >
      <span>{card.label}</span>
      <span className="text-3xl">{suitSymbols[card.suit]}</span>
    </motion.button>
  );
}

export function WarBoard({ G, ctx, moves, playerID, isActive, isConnected, matchData }: BoardProps<WarState>) {
  const hand = playerID ? G.hands[playerID] ?? [] : [];
  const playerName = (id: string) => matchData?.find((player) => String(player.id) === id)?.name ?? `Player ${Number(id) + 1}`;
  const gameover = ctx.gameover as { winner?: string; draw?: boolean } | undefined;

  return (
    <main className="game-table min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4 text-stone-100">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">High Card</p>
            <h1 className="text-3xl font-bold">War</h1>
          </div>
          <div className="rounded-full bg-black/20 px-4 py-2 text-sm">
            {isConnected ? 'Connected' : 'Reconnecting'}
          </div>
        </header>

        <section className="mt-8 grid gap-6 lg:grid-cols-[1fr_2fr_1fr]">
          <aside className="score-panel">
            <p className="score-label">{playerName('0')}</p>
            <p className="score-number">{G.tricksWon['0']}</p>
            <p className="text-sm text-stone-300">{G.handCounts['0']} cards left</p>
          </aside>

          <div className="rounded-3xl border border-white/10 bg-black/15 p-5 text-center text-white sm:p-8">
            <p className="text-sm text-emerald-100/70">Round {Math.min(G.round, 26)} of 26</p>
            <div className="mt-8 flex min-h-44 items-center justify-center gap-5">
              {G.currentTrick.length === 0 ? (
                <p className="max-w-xs text-emerald-100/70">Choose a card when it is your turn.</p>
              ) : (
                G.currentTrick.map((played) => (
                  <div key={played.playerID}>
                    <p className="mb-2 text-xs text-emerald-100/70">{playerName(played.playerID)}</p>
                    <PlayingCard card={played.card} disabled />
                  </div>
                ))
              )}
            </div>
            <p className="mt-5 min-h-6 text-sm text-amber-200">{G.lastResult}</p>
            <p className="mt-2 text-xs text-emerald-100/60">Ties: {G.ties}</p>
          </div>

          <aside className="score-panel">
            <p className="score-label">{playerName('1')}</p>
            <p className="score-number">{G.tricksWon['1']}</p>
            <p className="text-sm text-stone-300">{G.handCounts['1']} cards left</p>
          </aside>
        </section>

        {gameover ? (
          <section className="mx-auto mt-8 max-w-xl rounded-2xl bg-amber-100 p-6 text-center text-stone-900 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wider">Game over</p>
            <h2 className="mt-2 text-3xl font-bold">
              {gameover.draw ? 'It is a draw' : `${playerName(gameover.winner ?? '0')} wins`}
            </h2>
          </section>
        ) : (
          <section className="mt-8">
            <div className="mb-3 flex items-center justify-between text-sm text-stone-100">
              <p>{playerID ? `You are ${playerName(playerID)}` : 'Spectating'}</p>
              <p>{isActive ? 'Your turn' : `Waiting for ${playerName(ctx.currentPlayer)}`}</p>
            </div>
            <div className="card-hand">
              {hand.map((card, index) => (
                <PlayingCard
                  key={card.id}
                  card={card}
                  disabled={!isActive}
                  onClick={() => moves.playCard(index)}
                />
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
}

