import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ResourceCard from '../components/ResourceCard';

export default function DashboardPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [pendingKey, setPendingKey] = useState('');
  const [error, setError] = useState('');
  const [setupRequired, setSetupRequired] = useState(false);

  async function load() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/resources');
      const data = await response.json();
      if (!response.ok) {
        setSetupRequired(data.code === 'SETUP_REQUIRED');
        throw new Error(data.error || 'Errore nel caricamento');
      }
      setSetupRequired(false);
      setItems(data.items);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
    const id = setInterval(load, 15000);
    return () => clearInterval(id);
  }, []);

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
      <div className="toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca nome, nodo o VMID" />
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

      <div className="card-grid">
        {filteredItems.map((item) => {
          const key = `${item.type}-${item.node}-${item.vmid}`;
          return (
            <ResourceCard
              key={key}
              item={item}
              onAction={handleAction}
              pendingAction={pendingKey.startsWith(key)}
            />
          );
        })}
      </div>
    </section>
  );
}
