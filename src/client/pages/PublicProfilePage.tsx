import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { PlayerProfileView, type PlayerProfileData } from '../components/PlayerProfileView';

export function PublicProfilePage() {
  const { playerId } = useParams();
  const [data, setData] = useState<PlayerProfileData | null>(null);
  const [error, setError] = useState('');

  useEffect(() => {
    const controller = new AbortController();
    setData(null);
    setError('');
    fetch(`/api/players/${encodeURIComponent(playerId ?? '')}`, { signal: controller.signal })
      .then((response) => {
        if (!response.ok) throw new Error('Player not found.');
        return response.json() as Promise<PlayerProfileData>;
      })
      .then(setData)
      .catch((requestError: unknown) => {
        if (requestError instanceof DOMException && requestError.name === 'AbortError') return;
        setError(requestError instanceof Error ? requestError.message : 'Player not found.');
      });
    return () => controller.abort();
  }, [playerId]);

  if (error) return <main className="page-shell"><h1 className="text-4xl font-bold">Player unavailable</h1><p className="mt-3">{error}</p></main>;
  if (!data) return <main className="page-shell text-stone-500">Loading player...</main>;
  return <PlayerProfileView data={data} />;
}
