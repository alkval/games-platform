import type { BoardProps } from 'boardgame.io/react';
import { Chess, type Color, type PieceSymbol, type Square } from 'chess.js';
import { useEffect, useMemo, useState } from 'react';
import { allSeatsTaken } from '../../ui/names';
import type { ChessState } from './game';

const glyphs: Record<Color, Record<PieceSymbol, string>> = {
  w: { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' },
  b: { k: '\u265A', q: '\u265B', r: '\u265C', b: '\u265D', n: '\u265E', p: '\u265F' },
};
const files = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'];
const ranks = ['8', '7', '6', '5', '4', '3', '2', '1'];

export function ChessBoard({ G, ctx, moves, playerID, isConnected, matchData }: BoardProps<ChessState>) {
  const chess = useMemo(() => new Chess(G.fen), [G.fen]);
  const [selected, setSelected] = useState<Square | null>(null);
  const [promotion, setPromotion] = useState<{ from: Square; to: Square } | null>(null);
  const [confirmResign, setConfirmResign] = useState(false);
  const blackView = playerID === '1';
  const orderedFiles = blackView ? [...files].reverse() : files;
  const orderedRanks = blackView ? [...ranks].reverse() : ranks;
  const legalTargets = useMemo(() => selected ? chess.moves({ square: selected, verbose: true }).map((move) => move.to) : [], [chess, selected]);
  const name = (id: string) => matchData?.find((player) => String(player.id) === id)?.name ?? (id === '0' ? 'White' : 'Black');
  const gameover = ctx.gameover as { winner?: string; draw?: boolean } | undefined;
  const ownColor = playerID === '0' ? 'w' : playerID === '1' ? 'b' : null;
  const ready = allSeatsTaken(matchData);
  // Both players are always "active" so either can resign, so whose move it is comes from the position.
  const myTurn = Boolean(ready && ownColor && !gameover && chess.turn() === ownColor);

  // A pending resignation should not stay armed forever: it resets after a moment and after any move.
  useEffect(() => {
    if (!confirmResign) return;
    const timer = setTimeout(() => setConfirmResign(false), 5000);
    return () => clearTimeout(timer);
  }, [confirmResign]);
  useEffect(() => setConfirmResign(false), [G.fen]);

  useEffect(() => {
    if (!promotion) return;
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') setPromotion(null); };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [promotion]);

  function attemptMove(from: Square, to: Square) {
    const candidates = chess.moves({ square: from, verbose: true }).filter((move) => move.to === to);
    if (!candidates.length) return false;
    if (candidates.some((move) => move.promotion)) setPromotion({ from, to });
    else moves.makeMove(from, to);
    setSelected(null);
    return true;
  }

  function choose(square: Square) {
    if (!myTurn) return;
    const piece = chess.get(square);
    if (!selected) {
      if (piece?.color === ownColor) setSelected(square);
      return;
    }
    if (piece?.color === ownColor) {
      setSelected(square);
      return;
    }
    attemptMove(selected, square);
  }

  const status = !ready ? 'Waiting for your opponent to join'
    : gameover
    ? gameover.draw ? 'Draw' : gameover.winner === playerID ? 'You win' : `${name(gameover.winner ?? '0')} wins`
    : chess.inCheck() ? `${chess.turn() === 'w' ? name('0') : name('1')} is in check`
    : `${chess.turn() === 'w' ? name('0') : name('1')} to move`;

  return (
    <main className="chess-table min-h-screen px-4 py-6 sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <div><p className="text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Board game</p><h1 className="text-3xl font-bold">Chess</h1></div>
          <span className="rounded-full border border-stone-300 px-4 py-2 text-sm">{isConnected ? 'Connected' : 'Reconnecting'}</span>
        </header>
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,44rem)_1fr]">
          <div className="chess-board" aria-label="Chess board">
            {orderedRanks.flatMap((rank) => orderedFiles.map((file) => {
              const square = `${file}${rank}` as Square;
              const piece = chess.get(square);
              const light = (files.indexOf(file) + Number(rank)) % 2 === 1;
              const target = legalTargets.includes(square);
              const last = G.lastMove?.from === square || G.lastMove?.to === square;
              const canDrag = Boolean(myTurn && piece?.color === ownColor);
              return <button
                key={square}
                type="button"
                className={`chess-square ${light ? 'chess-light' : 'chess-dark'} ${selected === square ? 'chess-selected' : ''} ${last ? 'chess-last' : ''}`}
                onClick={() => choose(square)}
                onDragOver={(event) => { if (legalTargets.includes(square)) { event.preventDefault(); event.dataTransfer.dropEffect = 'move'; } }}
                onDrop={(event) => { event.preventDefault(); const from = event.dataTransfer.getData('text/plain') as Square; if (/^[a-h][1-8]$/.test(from)) attemptMove(from, square); }}
                aria-label={`${square}${piece ? ` ${piece.color === 'w' ? 'white' : 'black'} ${piece.type}` : ''}`}
              >
                {target && <span className={`chess-target ${piece ? 'chess-capture' : ''}`} />}
                {piece && <span
                  className={`chess-piece chess-piece-${piece.color === 'w' ? 'white' : 'black'}`}
                  draggable={canDrag}
                  onDragStart={(event) => { if (!canDrag) return; event.dataTransfer.setData('text/plain', square); event.dataTransfer.effectAllowed = 'move'; setSelected(square); }}
                  onDragEnd={() => setSelected(null)}
                  aria-hidden="true"
                >{glyphs[piece.color][piece.type]}</span>}
                {file === orderedFiles[0] && <span className="chess-rank">{rank}</span>}
                {rank === orderedRanks[orderedRanks.length - 1] && <span className="chess-file">{file}</span>}
              </button>;
            }))}
          </div>
          <aside className="profile-panel">
            <p className="label">Status</p><h2 className="mt-2 text-2xl font-bold">{status}</h2>
            <div className="mt-6 space-y-2 text-sm"><p><b>White:</b> {name('0')}</p><p><b>Black:</b> {name('1')}</p><p className="text-stone-500">You are {playerID === '0' ? 'White' : playerID === '1' ? 'Black' : 'spectating'}.</p></div>
            <div className="mt-6 max-h-64 overflow-auto border-t border-stone-200 pt-4 text-sm text-stone-600">
              {G.history.length ? G.history.map((move, index) => index % 2 ? null : <span key={index} className="mr-3 inline-block"><b>{index / 2 + 1}.</b> {move}{G.history[index + 1] ? ` ${G.history[index + 1]}` : ''}</span>) : ready ? 'No moves yet.' : 'Share the invite link above. The game starts when both players are here.'}
            </div>
            {!gameover && ready && playerID && G.drawOffer && G.drawOffer !== playerID && <div className="mt-6 rounded-lg border border-stone-300 p-3 text-sm"><p className="font-semibold">{name(G.drawOffer)} offers a draw.</p><div className="mt-3 flex gap-2"><button className="primary-button flex-1" type="button" onClick={() => moves.answerDraw(true)}>Accept</button><button className="secondary-button flex-1" type="button" onClick={() => moves.answerDraw(false)}>Decline</button></div></div>}
            {!gameover && ready && playerID && G.drawOffer === playerID && <p className="mt-6 text-sm text-stone-500">Draw offered. Waiting for {name(playerID === '0' ? '1' : '0')} to answer; it is withdrawn if either of you moves.</p>}
            {!gameover && ready && playerID && !G.drawOffer && <button className="secondary-button mt-6 w-full" type="button" onClick={() => moves.offerDraw()}>Offer a draw</button>}
            {!gameover && ready && playerID && <button className="secondary-button mt-3 w-full" type="button" onClick={() => { if (confirmResign) { moves.resign(); setConfirmResign(false); } else setConfirmResign(true); }}>{confirmResign ? 'Click again to confirm resignation' : 'Resign'}</button>}
          </aside>
        </div>
      </div>
      {promotion && <div className="promotion-backdrop" role="dialog" aria-modal="true" aria-label="Choose promotion piece" onClick={(event) => { if (event.target === event.currentTarget) setPromotion(null); }}><div className="promotion-picker"><p className="font-semibold">Promote pawn to</p><div className="mt-4 flex gap-2">{(['q', 'r', 'b', 'n'] as const).map((piece) => <button className="promotion-piece" key={piece} type="button" onClick={() => { moves.makeMove(promotion.from, promotion.to, piece); setPromotion(null); }}>{glyphs[playerID === '1' ? 'b' : 'w'][piece]}</button>)}</div><button className="secondary-button mt-4 w-full" type="button" onClick={() => setPromotion(null)}>Cancel</button></div></div>}
    </main>
  );
}
