import { Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DetailsPage from './pages/DetailsPage';
import SettingsPage from './pages/SettingsPage';

export default function App() {
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
          <NavLink to="/settings" className="header-link">
            Impostazioni
          </NavLink>
        </div>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/settings" element={<SettingsPage />} />
          <Route path="/resource/:type/:node/:vmid" element={<DetailsPage />} />
        </Routes>
      </main>
    </div>
  );
}
