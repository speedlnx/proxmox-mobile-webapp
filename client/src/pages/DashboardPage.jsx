import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import ResourceCard from '../components/ResourceCard';

const DISPLAY_MODE_STORAGE_KEY = 'pmw_dashboard_display_mode';

export default function DashboardPage({ canManageResources }) {
  const [items, setItems] = useState([]);
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pendingKey, setPendingKey] = useState('');
  const [error, setError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [displayMode, setDisplayMode] = useState(() => window.localStorage.getItem(DISPLAY_MODE_STORAGE_KEY) || 'comfortable');
  const hasDataRef = useRef(false);

  async function load({ silent = false } = {}) {
    if (silent) {
      setRefreshing(true);
    } else {
      setLoading(true);
      setError('');
    }

    try {
      const [resourcesResponse, overviewResponse] = await Promise.all([
        fetch('/api/resources'),
        fetch('/api/overview').catch(() => null),
      ]);
      const resourcesData = await resourcesResponse.json();

      if (!resourcesResponse.ok) {
        setSetupRequired(resourcesData.code === 'SETUP_REQUIRED');
        throw new Error(resourcesData.error || 'Errore nel caricamento');
      }

      const overviewResult = overviewResponse
        ? {
            ok: overviewResponse.ok,
            data: await overviewResponse.json(),
          }
        : null;

      setSetupRequired(false);
      setItems(resourcesData.items);
      if (overviewResult && overviewResult.ok) {
        setOverview(overviewResult.data);
      }
      hasDataRef.current = true;
      setError('');
    } catch (err) {
      if (!silent || !hasDataRef.current) {
        setError(err.message);
      }
    } finally {
      if (silent) {
        setRefreshing(false);
      } else {
        setLoading(false);
      }
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(() => {
      load({ silent: true });
    }, 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    window.localStorage.setItem(DISPLAY_MODE_STORAGE_KEY, displayMode);
  }, [displayMode]);

  async function handleAction(item, action) {
    const confirmed = window.confirm(`Confermi l'azione ${action} su ${item.name}?`);
    if (!confirmed) return;
    const key = `${item.type}-${item.node}-${item.vmid}-${action}`;
    setPendingKey(key);
    try {
      const response = await fetch(`/api/resources/${item.type}/${item.node}/${item.vmid}/${action}`, { method: 'POST' });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Operazione non riuscita');
      await load();
    } catch (err) {
      window.alert(err.message);
    } finally {
      setPendingKey('');
    }
  }

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesType = typeFilter === 'all' || item.type === typeFilter;
      const normalizedStatus = item.lock ? 'locked' : item.status;
      const matchesStatus = statusFilter === 'all' || normalizedStatus === statusFilter;
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || String(item.vmid).includes(q) || item.node.toLowerCase().includes(q);
      return matchesType && matchesStatus && matchesSearch;
    });
  }, [items, typeFilter, statusFilter, search]);

  return (
    <section>
      {overview ? (
        <div className="details-card cluster-status-card">
          <div className="cluster-status-card__content">
            <div>
              <div className="resource-type">Cluster status</div>
              <strong>Stato cluster</strong>
            </div>
            <div className="cluster-status-card__meta">
              <span className={`status-badge ${overview.summary.online === overview.summary.nodes ? 'status-running' : 'status-paused'}`}>
                {overview.summary.online}/{overview.summary.nodes} nodi online
              </span>
              <Link to="/cluster" className="cluster-status-card__link">Apri cluster</Link>
            </div>
          </div>
        </div>
      ) : null}

      <div className="toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca nome, nodo o VMID" />
        <div className={`toolbar-status ${refreshing ? 'is-visible' : ''}`}>
          Aggiornamento in background…
        </div>
        <div className="segmented">
          <button className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>Tutti</button>
          <button className={typeFilter === 'qemu' ? 'active' : ''} onClick={() => setTypeFilter('qemu')}>VM</button>
          <button className={typeFilter === 'lxc' ? 'active' : ''} onClick={() => setTypeFilter('lxc')}>LXC</button>
        </div>
        <div className="segmented segmented-quad">
          <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>Tutti</button>
          <button className={statusFilter === 'running' ? 'active' : ''} onClick={() => setStatusFilter('running')}>Accesi</button>
          <button className={statusFilter === 'stopped' ? 'active' : ''} onClick={() => setStatusFilter('stopped')}>Spenti</button>
          <button className={statusFilter === 'locked' ? 'active' : ''} onClick={() => setStatusFilter('locked')}>Locked</button>
        </div>
        <div className="segmented segmented-dual">
          <button className={displayMode === 'comfortable' ? 'active' : ''} onClick={() => setDisplayMode('comfortable')}>Normale</button>
          <button className={displayMode === 'compact' ? 'active' : ''} onClick={() => setDisplayMode('compact')}>Compatta</button>
        </div>
      </div>

      {loading && <div className="empty-state">Caricamento in corso…</div>}
      {error && <div className="empty-state error">{error}</div>}
      {setupRequired ? (
        <div className="setup-card">
          <h3>Completa il setup del backend</h3>
          <p>Il server Proxmox non e&apos; ancora configurato. Vai nelle impostazioni per salvare host e credenziali dal backend.</p>
          <Link to="/settings" className="console-link">Apri impostazioni</Link>
        </div>
      ) : null}
      {!loading && !error && filteredItems.length === 0 && <div className="empty-state">Nessuna risorsa trovata</div>}

      <div className={`card-grid ${displayMode === 'compact' ? 'card-grid--compact' : ''}`}>
        {filteredItems.map((item) => {
          const key = `${item.type}-${item.node}-${item.vmid}`;
          return (
            <ResourceCard
              key={key}
              item={item}
              onAction={handleAction}
              pendingAction={pendingKey.startsWith(key)}
              canManageResources={canManageResources}
              compact={displayMode === 'compact'}
            />
          );
        })}
      </div>
    </section>
  );
}
