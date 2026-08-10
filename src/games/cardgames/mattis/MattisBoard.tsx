import type { BoardProps } from 'boardgame.io/react';
import { motion } from 'framer-motion';
import type { MattisCard, MattisState, MattisSuit } from './game';
import { canBeat } from './game';

const suitSymbols: Record<MattisSuit, string> = {
  clubs: '\u2663',
  diamonds: '\u2666',
  hearts: '\u2665',
  spades: '\u2660',
};

const suitNames: Record<MattisSuit, string> = {
  clubs: 'clubs',
  diamonds: 'diamonds',
  hearts: 'hearts',
  spades: 'spades',
};

function PlayingCard({ card, disabled, onClick, compact = false }: {
  card: MattisCard;
  disabled?: boolean;
  onClick?: () => void;
  compact?: boolean;
}) {
  const red = card.suit === 'diamonds' || card.suit === 'hearts';
  return (
    <motion.button
      type="button"
      className={`playing-card ${red ? 'playing-card-red' : ''} ${compact ? 'playing-card-compact' : ''}`}
      disabled={disabled}
      onClick={onClick}
      whileHover={disabled ? undefined : { y: -8 }}
      whileTap={disabled ? undefined : { scale: 0.97 }}
      aria-label={`Play ${card.label} of ${card.suit}`}
    >
      <span>{card.label}</span>
      <span className="text-3xl">{suitSymbols[card.suit]}</span>
    </motion.button>
  );
}

export function MattisBoard({ G, ctx, moves, playerID, isActive, isConnected, matchData }: BoardProps<MattisState>) {
  const hand = playerID ? G.hands[playerID] ?? [] : [];
  const gameover = ctx.gameover as { winner: string; loser: string } | undefined;
  const allSeatsFilled = Boolean(matchData?.length) && matchData!.every((player) => Boolean(player.name));
  const playerName = (id: string) => matchData?.find((player) => String(player.id) === id)?.name ?? `Player ${Number(id) + 1}`;
  const top = G.trick.at(-1)?.card;
  const canAct = Boolean(playerID && isActive && G.activePlayer === playerID && allSeatsFilled && !gameover);
  const legalCard = (card: MattisCard) => {
    if (G.phase === 'collecting') return true;
    if (G.mustPickUp[playerID ?? '']) return false;
    return !top || Boolean(G.trumpSuit && canBeat(card, top, G.trumpSuit));
  };

  if (!allSeatsFilled) {
    const joined = matchData?.filter((player) => player.name).length ?? 1;
    return (
      <main className="mattis-table min-h-[calc(100vh-3.5rem)] px-5 py-14 text-center text-stone-100">
        <div className="mx-auto max-w-lg rounded-3xl border border-white/10 bg-black/20 p-8">
          <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">Mattis</p>
          <h1 className="mt-3 text-4xl font-bold">Waiting for the table</h1>
          <p className="mt-4 text-emerald-100/70">{joined} of {G.playerIDs.length} players have joined. Share the invite link above.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="mattis-table min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-wrap items-center justify-between gap-4 text-stone-100">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-300">
              {G.phase === 'collecting' ? 'Phase one / collect' : 'Phase two / shed'}
            </p>
            <h1 className="text-3xl font-bold">Mattis</h1>
          </div>
          <div className="flex flex-wrap gap-2 text-sm">
            {G.phase === 'collecting' ? (
              <span className="rounded-full bg-black/20 px-4 py-2">Stock: {G.stockCount}</span>
            ) : G.trumpSuit ? (
              <span className="rounded-full bg-black/20 px-4 py-2">Trump: {suitSymbols[G.trumpSuit]} {suitNames[G.trumpSuit]}</span>
            ) : null}
            <span className="rounded-full bg-black/20 px-4 py-2">{isConnected ? 'Connected' : 'Reconnecting'}</span>
          </div>
        </header>

        <section className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {G.playerIDs.map((id) => {
            const finished = G.finishOrder.includes(id);
            return (
              <div className={`mattis-player ${G.activePlayer === id && !gameover ? 'mattis-player-active' : ''}`} key={id}>
                <div className="min-w-0">
                  <p className="truncate font-semibold">{playerName(id)}{id === playerID ? ' (you)' : ''}</p>
                  <p className="text-xs text-emerald-100/65">
                    {finished ? `Finished #${G.finishOrder.indexOf(id) + 1}` : `${G.handCounts[id]} cards in hand`}
                  </p>
                </div>
                {G.phase === 'collecting' && <span className="text-xs text-emerald-100/65">{G.collectedCounts[id]} collected</span>}
              </div>
            );
          })}
        </section>

        <section className="mt-6 rounded-3xl border border-white/10 bg-black/20 p-5 text-center text-white sm:p-8">
          <div className="flex flex-wrap items-center justify-between gap-3 text-sm text-emerald-100/70">
            <span>Round {G.round}</span>
            <span>{G.phase === 'collecting' ? 'Highest rank collects the trick' : `${G.trick.length} / ${G.trickTarget} cards toward avstikk`}</span>
          </div>

          <div className="mattis-trick mt-7 min-h-44">
            {G.trick.length ? G.trick.map((play, index) => (
              <div className="mattis-trick-card" key={`${play.card.id}-${index}`}>
                <p className="mb-2 max-w-24 truncate text-xs text-emerald-100/70">{playerName(play.playerID)}</p>
                <PlayingCard card={play.card} disabled compact />
                {G.phase === 'shedding' && index === 0 && <span className="mt-2 block text-[0.68rem] uppercase tracking-wider text-amber-200">picked up first</span>}
              </div>
            )) : (
              <p className="self-center text-emerald-100/65">{G.phase === 'collecting' ? 'A new collection trick is ready.' : 'Lead any card.'}</p>
            )}
          </div>
          <p className="mt-5 min-h-6 text-sm text-amber-200">{G.status}</p>
        </section>

        {gameover ? (
          <section className="mx-auto mt-8 max-w-2xl rounded-2xl bg-amber-100 p-7 text-center text-stone-900 shadow-xl">
            <p className="text-sm font-semibold uppercase tracking-wider">Game over</p>
            <h2 className="mt-2 text-3xl font-bold">{playerName(gameover.loser)} is Mattis</h2>
            <p className="mt-2">{playerName(gameover.winner)} got rid of their cards first.</p>
          </section>
        ) : (
          <section className="mt-7">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3 text-sm text-stone-100">
              <p>{playerID ? `Your hand (${hand.length})` : 'Spectating'}</p>
              <p>{canAct ? 'Your turn' : `Waiting for ${playerName(G.activePlayer)}`}</p>
            </div>
            {canAct && G.phase === 'shedding' && G.trick.length > 0 && (
              <button className="mattis-pickup-button" type="button" onClick={() => moves.pickUpOldest()}>
                Pick up oldest card
              </button>
            )}
            {canAct && G.phase === 'collecting' && G.stockCount > 1 && (
              <button className="mattis-dare-button" type="button" onClick={() => moves.drawBlind()}>
                Dare: play blind from stock
              </button>
            )}
            <div className="card-hand">
              {hand.map((entry, index) => (
                <PlayingCard
                  key={entry.id}
                  card={entry}
                  disabled={!canAct || !legalCard(entry)}
                  onClick={() => moves.playCard(index)}
                />
              ))}
            </div>
            {canAct && G.phase === 'shedding' && top && !hand.some(legalCard) && (
              <p className="mt-2 text-sm text-amber-200">No card can beat the table. Pick up the oldest card.</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}
