import { useEffect, useState } from 'react';
import { Navigate, NavLink, Route, Routes } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DetailsPage from './pages/DetailsPage';
import SettingsPage from './pages/SettingsPage';
import StoragePage from './pages/StoragePage';
import LoginPage from './pages/LoginPage';
import SetupPage from './pages/SetupPage';
import UsersPage from './pages/UsersPage';

export default function App() {
  const [authState, setAuthState] = useState({
    loading: true,
    authenticated: false,
    setupRequired: false,
    user: null,
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
      });
    } catch (error) {
      setAuthError(error.message);
      setAuthState({
        loading: false,
        authenticated: false,
        setupRequired: false,
        user: null,
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
          <NavLink to="/storage" className="header-link">
            Storage
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
          <Route path="/" element={<DashboardPage />} />
          <Route path="/storage" element={<StoragePage />} />
          <Route path="/settings" element={isAdmin ? <SettingsPage /> : <Navigate to="/" replace />} />
          <Route path="/users" element={isAdmin ? <UsersPage currentUser={authState.user} /> : <Navigate to="/" replace />} />
          <Route path="/resource/:type/:node/:vmid" element={<DetailsPage />} />
        </Routes>
      </main>
    </div>
  );
}
