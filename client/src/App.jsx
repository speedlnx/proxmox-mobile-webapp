import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DetailsPage from './pages/DetailsPage';
import SettingsPage from './pages/SettingsPage';
import ClusterPage from './pages/StoragePage';
import TasksPage from './pages/TasksPage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import UsersPage from './pages/UsersPage';

function ScrollJumpButton() {
  const [scrollState, setScrollState] = useState({
    visible: false,
    direction: 'down',
  });

  useEffect(() => {
    function updateScrollState() {
      const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
      const viewportHeight = window.innerHeight || 0;
      const documentHeight = document.documentElement.scrollHeight || 0;
      const maxScroll = Math.max(0, documentHeight - viewportHeight);
      const hasScrollableContent = maxScroll > 160;
      const progress = maxScroll > 0 ? scrollTop / maxScroll : 0;

      setScrollState({
        visible: hasScrollableContent,
        direction: progress > 0.55 ? 'up' : 'down',
      });
    }

    updateScrollState();
    window.addEventListener('scroll', updateScrollState, { passive: true });
    window.addEventListener('resize', updateScrollState);
    return () => {
      window.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, []);

  function handleJump() {
    const isUp = scrollState.direction === 'up';
    window.scrollTo({
      top: isUp ? 0 : document.documentElement.scrollHeight,
      behavior: 'smooth',
    });
  }

  if (!scrollState.visible) return null;

  const isUp = scrollState.direction === 'up';
  return (
    <button
      type="button"
      className="scroll-jump-button"
      onClick={handleJump}
      aria-label={isUp ? 'Torna in alto' : 'Vai in fondo'}
      title={isUp ? 'Torna in alto' : 'Vai in fondo'}
    >
      {isUp ? '↑' : '↓'}
    </button>
  );
}

export default function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    setupRequired: false,
    user: null,
    capabilities: {
      canManageResources: false,
    },
  });
  const [authError, setAuthError] = useState('');

  async function loadAuthState() {
    setAuthError('');
    try {
      const response = await fetch('/api/auth/status');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Errore nel caricamento stato autenticazione');
      setAuthState({
        loading: false,
        authenticated: Boolean(payload.authenticated),
        setupRequired: Boolean(payload.setupRequired),
        user: payload.user || null,
        capabilities: payload.capabilities || { canManageResources: false },
      });
    } catch (error) {
      setAuthError(error.message);
      setAuthState({
        loading: false,
        authenticated: false,
        setupRequired: false,
        user: null,
        capabilities: { canManageResources: false },
      });
    }
  }

  useEffect(() => {
    loadAuthState();
  }, []);

  async function handleLogout() {
    await fetch('/api/auth/logout', { method: 'POST' });
    await loadAuthState();
  }

  if (authState.loading) {
    return (
      <div className="app-shell">
        <div className="empty-state">Verifica sessione in corso…</div>
      </div>
    );
  }

  if (authError) {
    return (
      <div className="app-shell">
        <div className="empty-state error">{authError}</div>
      </div>
    );
  }

  if (authState.setupRequired) {
    return <SetupPage onSuccess={loadAuthState} />;
  }

  if (!authState.authenticated) {
    return <LoginPage onSuccess={loadAuthState} />;
  }

  const isAdmin = authState.user?.role === 'admin';

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Proxmox Mobile</h1>
          <p>Interfaccia mobile-first per VM e container</p>
        </div>
        <div className="header-actions">
          <NavLink to="/" className="header-link">
            Dashboard
          </NavLink>
          <NavLink to="/cluster" className="header-link">
            Cluster
          </NavLink>
          <NavLink to="/tasks" className="header-link">
            Task
          </NavLink>
          {isAdmin ? (
            <NavLink to="/settings" className="header-link">
              Impostazioni
            </NavLink>
          ) : null}
          {isAdmin ? (
            <NavLink to="/users" className="header-link">
              Utenti
            </NavLink>
          ) : null}
          <div className="session-chip">
            <span>{authState.user?.username}</span>
            <span className="session-role">{authState.user?.role}</span>
          </div>
          <button type="button" onClick={handleLogout}>
            Logout
          </button>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage canManageResources={authState.capabilities.canManageResources} />} />
          <Route path="/cluster" element={<ClusterPage />} />
          <Route path="/storage" element={<Navigate to="/cluster" replace />} />
          <Route path="/tasks" element={<TasksPage />} />
          <Route path="/settings" element={isAdmin ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/users" element={isAdmin ? <UsersPage currentUser={authState.user} /> : <Navigate to="/" replace />} />
          <Route path="/resource/:type/:node/:vmid" element={<DetailsPage canManageResources={authState.capabilities.canManageResources} />} />
        </Routes>
      </main>
      <ScrollJumpButton />
    </div>
  );
}
