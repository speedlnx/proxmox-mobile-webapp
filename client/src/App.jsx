import { Routes, Route, NavLink } from 'react-router-dom';
import DashboardPage from './pages/DashboardPage';
import DetailsPage from './pages/DetailsPage';

export default function App() {
  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Proxmox Mobile</h1>
          <p>Interfaccia mobile-first per VM e container</p>
        </div>
        <NavLink to="/" className="header-link">
          Dashboard
        </NavLink>
      </header>
      <main className="app-main">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/resource/:type/:node/:vmid" element={<DetailsPage />} />
        </Routes>
      </main>
    </div>
  );
}
