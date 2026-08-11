import { lazy, Suspense } from 'react';
import { Route, Routes } from 'react-router-dom';
import { SiteHeader } from './components/SiteHeader';

const HomePage = lazy(() => import('./pages/HomePage').then((module) => ({ default: module.HomePage })));
const CardGamesPage = lazy(() => import('./pages/CardGamesPage').then((module) => ({ default: module.CardGamesPage })));
const WarRoomPage = lazy(() => import('./pages/WarRoomPage').then((module) => ({ default: module.WarRoomPage })));
const MattisPage = lazy(() => import('./pages/MattisPage').then((module) => ({ default: module.MattisPage })));
const BoardGamesPage = lazy(() => import('./pages/BoardGamesPage').then((module) => ({ default: module.BoardGamesPage })));
const ChessPage = lazy(() => import('./pages/ChessPage').then((module) => ({ default: module.ChessPage })));
const LeaderboardPage = lazy(() => import('./pages/LeaderboardPage').then((module) => ({ default: module.LeaderboardPage })));
const PublicProfilePage = lazy(() => import('./pages/PublicProfilePage').then((module) => ({ default: module.PublicProfilePage })));
const PracticePage = lazy(() => import('./pages/PracticePage').then((module) => ({ default: module.PracticePage })));
const ProfilePage = lazy(() => import('./pages/ProfilePage').then((module) => ({ default: module.ProfilePage })));

function PageLoading() {
  return <main className="page-shell text-stone-500">Loading...</main>;
}

export function App() {
  return (
    <>
      <SiteHeader />
      <Suspense fallback={<PageLoading />}>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/cardgames" element={<CardGamesPage />} />
          <Route path="/cardgames/war" element={<WarRoomPage />} />
          <Route path="/cardgames/mattis" element={<MattisPage />} />
          <Route path="/boardgames" element={<BoardGamesPage />} />
          <Route path="/boardgames/chess" element={<ChessPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/players/:playerId" element={<PublicProfilePage />} />
          <Route path="/practice" element={<PracticePage />} />
          <Route path="/profile" element={<ProfilePage />} />
        </Routes>
      </Suspense>
    </>
  );
}
