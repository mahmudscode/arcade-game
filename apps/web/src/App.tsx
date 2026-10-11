import { Suspense, lazy } from 'react';
import { Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { AchievementToast } from './components/AchievementToast';
const Achievements = lazy(() => import('./pages/Achievements').then((m) => ({ default: m.Achievements })));
import { Footer } from './components/Footer';
import { Header } from './components/Header';
import { TabBar } from './components/TabBar';
const Favorites = lazy(() => import('./pages/Favorites').then((m) => ({ default: m.Favorites })));
import { Home } from './pages/Home';
const Login = lazy(() => import('./pages/Login').then((m) => ({ default: m.Login })));
const Player = lazy(() => import('./pages/Player').then((m) => ({ default: m.Player })));
const Settings = lazy(() => import('./pages/Settings').then((m) => ({ default: m.Settings })));
const Leaderboards = lazy(() => import('./pages/Leaderboards').then((m) => ({ default: m.Leaderboards })));
const MyProfile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.MyProfile })));
const Profile = lazy(() => import('./pages/Profile').then((m) => ({ default: m.Profile })));
import { NotFound } from './pages/Simple';

function Layout() {
  const { pathname } = useLocation();
  const playing = pathname.startsWith('/play/');
  return (
    <div className="flex min-h-dvh flex-col">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-[60] focus:rounded-lg focus:bg-gold focus:px-4 focus:py-2 focus:text-ink">Skip to content</a>
      <Header hideOnMobile={playing} />
      <main id="main" tabIndex={-1} className={`flex-1 outline-none ${playing ? 'pb-8' : 'pb-24 md:pb-0'}`}>
        <Suspense fallback={<p className="page-x pt-10 font-pixel text-xs text-muted">LOADING…</p>}>
          <Outlet />
        </Suspense>
      </main>
      <Footer />
      <AchievementToast />
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
        <Route path="achievements" element={<Achievements />} />
        <Route path="login" element={<Login />} />
        <Route path="profile" element={<MyProfile />} />
        <Route path="profile/:username" element={<Profile />} />
        <Route path="settings" element={<Settings />} />
        <Route path="leaderboards" element={<Leaderboards />} />
        <Route path="*" element={<NotFound />} />
      </Route>
    </Routes>
  );
}
