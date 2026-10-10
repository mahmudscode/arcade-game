import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
import { Favorites } from './pages/Favorites';
import { Home } from './pages/Home';
import { Login } from './pages/Login';
import { Player } from './pages/Player';
import { Settings } from './pages/Settings';
import { Leaderboards, NotFound } from './pages/Simple';

function Layout() {
  const { pathname } = useLocation();
  const playing = pathname.startsWith('/play/');
  return (
    <div className="flex min-h-dvh flex-col">
      <Header hideOnMobile={playing} />
      <main className={`flex-1 ${playing ? 'pb-8' : 'pb-24 md:pb-0'}`}>
        <Outlet />
      </main>
      <Footer />
      {!playing && <TabBar />}
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="play/:slug" element={<Player />} />
        <Route path="favorites" element={<Favorites />} />
        <Route path="login" element={<Login />} />
        <Route path="settings" element={<Settings />} />
        <Route path="leaderboards" element={<Leaderboards />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
