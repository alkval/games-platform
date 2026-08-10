import { Route, Routes } from 'react-router-dom';
import '../games/catalog';
import { SiteHeader } from './components/SiteHeader';
import { BoardGamesPage } from './pages/BoardGamesPage';
import { CardGamesPage } from './pages/CardGamesPage';
import { HomePage } from './pages/HomePage';
import { MattisPage } from './pages/MattisPage';
import { ProfilePage } from './pages/ProfilePage';
import { WarRoomPage } from './pages/WarRoomPage';
import { ChessPage } from './pages/ChessPage';
import { LeaderboardPage } from './pages/LeaderboardPage';
import { PublicProfilePage } from './pages/PublicProfilePage';
import { PracticePage } from './pages/PracticePage';

export function App() {
  return (
    <>
      <SiteHeader />
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
    </>
  );
}

