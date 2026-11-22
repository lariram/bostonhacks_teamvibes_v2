import { useEffect, type ReactNode } from 'react';
import { BrowserRouter, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { NavBar } from './components/NavBar';
import { AuthProvider, useAuth } from './lib/auth';
import { RecSessionProvider } from './lib/session';
import Discover from './pages/Discover';
import Feed from './pages/Feed';
import GroupPage from './pages/GroupPage';
import History from './pages/History';
import Login from './pages/Login';
import Next from './pages/Next';
import Onboarding from './pages/Onboarding';
import Person from './pages/Person';
import PlanDetails from './pages/PlanDetails';
import Profile from './pages/Profile';
import Rate from './pages/Rate';
import Results from './pages/Results';
import Signup from './pages/Signup';
import Start from './pages/Start';

/** New screen, start at the top (SPA navigation keeps the old scroll otherwise) */
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

function Frame({ children, nav }: { children: ReactNode; nav?: boolean }) {
  return (
    <div className={`app${nav ? ' has-nav' : ''}`}>
      <main className="app__main">{children}</main>
      {nav && <NavBar />}
    </div>
  );
}

function RequireAuth({ nav = true }: { nav?: boolean }) {
  const { me, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Frame><div className="screen center muted">Loading…</div></Frame>;
  if (!me) return <Navigate to="/" replace state={{ from: location.pathname }} />;
  return (
    <Frame nav={nav}>
      <Outlet />
    </Frame>
  );
}

function PublicOnly() {
  const { me, loading, landing } = useAuth();
  if (loading) return <Frame><div className="screen center muted">Loading…</div></Frame>;
  if (me) return <Navigate to={landing} replace />;
  return (
    <Frame>
      <Outlet />
    </Frame>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <AuthProvider>
        <RecSessionProvider>
          <Routes>
            <Route element={<PublicOnly />}>
              <Route path="/" element={<Start />} />
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
            </Route>
            <Route element={<RequireAuth nav={false} />}>
              <Route path="/onboarding" element={<Onboarding />} />
              <Route path="/plan/:id/rate" element={<Rate />} />
            </Route>
            <Route element={<RequireAuth />}>
              <Route path="/discover" element={<Discover />} />
              <Route path="/discover/results" element={<Results />} />
              <Route path="/plan/:id" element={<PlanDetails />} />
              <Route path="/plan/:id/next" element={<Next />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/history" element={<History />} />
              <Route path="/profile" element={<Profile />} />
              <Route path="/groups/:id" element={<GroupPage />} />
              <Route path="/people/:id" element={<Person />} />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </RecSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
