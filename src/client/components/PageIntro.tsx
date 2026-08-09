import { Link } from 'react-router-dom';

export function PageIntro({ eyebrow, title, copy }: { eyebrow: string; title: string; copy: string }) {
  return (
    <div>
      <Link className="text-sm text-stone-500 hover:text-stone-900" to="/">Back to games</Link>
      <p className="mt-12 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">{eyebrow}</p>
      <h1 className="mt-2 text-4xl font-bold tracking-tight sm:text-6xl">{title}</h1>
      <p className="mt-4 max-w-2xl text-lg text-stone-600">{copy}</p>
    </div>
  );
}

