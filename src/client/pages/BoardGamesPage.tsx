import { PageIntro } from '../components/PageIntro';

export function BoardGamesPage() {
  return (
    <main className="page-shell">
      <PageIntro eyebrow="Board games" title="The board is empty for now" copy="New games will show up here when they are ready to play." />
      <div className="mt-12 rounded-3xl border border-dashed border-stone-300 p-12 text-center text-stone-500">No tables open yet.</div>
    </main>
  );
}

