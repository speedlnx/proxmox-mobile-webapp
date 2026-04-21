import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import ResourceCard from '../components/ResourceCard';

export default function DashboardPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
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
      const matchesFilter = filter === 'all' || item.type === filter;
      const q = search.trim().toLowerCase();
      const matchesSearch = !q || item.name.toLowerCase().includes(q) || String(item.vmid).includes(q) || item.node.toLowerCase().includes(q);
      return matchesFilter && matchesSearch;
    });
  }, [items, filter, search]);

  return (
    <section>
      <div className="toolbar">
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Cerca nome, nodo o VMID" />
        <div className="segmented">
          <button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>Tutti</button>
          <button className={filter === 'qemu' ? 'active' : ''} onClick={() => setFilter('qemu')}>VM</button>
          <button className={filter === 'lxc' ? 'active' : ''} onClick={() => setFilter('lxc')}>LXC</button>
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
