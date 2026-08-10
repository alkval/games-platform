import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';

export function HomePage() {
  return (
    <main className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }}>
        <p className="mb-4 text-sm font-semibold uppercase tracking-[0.16em] text-amber-700">Card &amp; board games</p>
        <h1 className="max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl">Pick a game. Invite a friend. Start playing.</h1>
        <p className="mt-6 max-w-2xl text-lg text-stone-600">
          A small collection of card and board games for quick matches with friends.
        </p>
      </motion.div>

      <section className="mt-14 grid gap-5 md:mt-20 md:grid-cols-2" aria-label="Choose a game category">
        <Link className="portal-card portal-card-warm" to="/cardgames">
          <span className="portal-mark">â™ </span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-red-800">Cards</p>
            <h2 className="mt-2 text-3xl font-bold">War is ready</h2>
            <p className="mt-3 text-stone-700">Create a private room and send the link to a friend.</p>
          </div>
        </Link>
        <Link className="portal-card portal-card-cool" to="/boardgames">
          <span className="portal-mark">â™Ÿ</span>
          <div>
            <p className="text-sm font-semibold uppercase tracking-wider text-emerald-900">Boards</p>
            <h2 className="mt-2 text-3xl font-bold">More to come</h2>
            <p className="mt-3 text-stone-700">This side of the table is being saved for later.</p>
          </div>
        </Link>
      </section>
    </main>
  );
}


