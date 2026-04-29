import { useEffect, useMemo, useRef, useState } from 'react';

function formatDateTime(value) {
  if (!value) return '—';
  return new Date(value * 1000).toLocaleString('it-IT');
}

function formatDuration(startTime, endTime, status) {
  if (!startTime) return '—';
  const end = endTime || (status === 'running' ? Math.floor(Date.now() / 1000) : null);
  if (!end) return '—';
  const seconds = Math.max(0, end - startTime);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remSeconds = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remSeconds}s`;
  const hours = Math.floor(minutes / 60);
  const remMinutes = minutes % 60;
  return `${hours}h ${remMinutes}m`;
}

function formatTaskType(type) {
  const value = String(type || '').trim();
  return value || 'sconosciuto';
}

function statusLabel(status) {
  if (status === 'running') return 'in corso';
  if (status === 'ok') return 'completato';
  if (status === 'error') return 'errore';
  if (status === 'stopped') return 'fermato';
  return status || 'sconosciuto';
}

export default function TasksPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [statusFilter, setStatusFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [search, setSearch] = useState('');
  const hasDataRef = useRef(false);

  useEffect(() => {
    async function load({ silent = false } = {}) {
      if (silent) {
        setRefreshing(true);
      } else {
        setLoading(true);
        setError('');
      }

      try {
        const response = await fetch('/api/tasks?limit=120');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Errore nel caricamento dei task');
        setItems(Array.isArray(payload.items) ? payload.items : []);
        hasDataRef.current = true;
        setError('');
      } catch (loadError) {
        if (!silent || !hasDataRef.current) {
          setError(loadError.message);
        }
      } finally {
        if (silent) {
          setRefreshing(false);
        } else {
          setLoading(false);
        }
      }
    }

    load();
    const id = setInterval(() => {
      load({ silent: true });
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const availableTypes = useMemo(() => {
    return [...new Set(items.map((item) => formatTaskType(item.type)).filter(Boolean))].sort((a, b) => a.localeCompare(b));
  }, [items]);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter((item) => {
      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;
      const matchesType = typeFilter === 'all' || formatTaskType(item.type) === typeFilter;
      const haystack = [
        item.node,
        item.user,
        item.upid,
        item.vmid,
        item.type,
        item.statusText,
      ].join(' ').toLowerCase();
      const matchesSearch = !query || haystack.includes(query);
      return matchesStatus && matchesType && matchesSearch;
    });
  }, [items, search, statusFilter, typeFilter]);

  return (
    <section className="details-page task-page">
      <div className="details-card">
        <div className="resource-type">Task monitor</div>
        <h2>Task Proxmox e UPID</h2>
        <div className="resource-meta">Monitoraggio in tempo reale delle operazioni cluster-wide, con aggiornamento ogni 3 secondi.</div>
      </div>

      <div className="toolbar">
        <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Cerca UPID, nodo, VMID, utente o stato" />
        <div className={`toolbar-status ${refreshing ? 'is-visible' : ''}`}>
          Aggiornamento task in background…
        </div>
        <div className="segmented segmented-quad task-status-filters">
          <button className={statusFilter === 'all' ? 'active' : ''} onClick={() => setStatusFilter('all')}>Tutti</button>
          <button className={statusFilter === 'running' ? 'active' : ''} onClick={() => setStatusFilter('running')}>In corso</button>
          <button className={statusFilter === 'ok' ? 'active' : ''} onClick={() => setStatusFilter('ok')}>OK</button>
          <button className={statusFilter === 'error' ? 'active' : ''} onClick={() => setStatusFilter('error')}>Errori</button>
        </div>
        <label className="field-label">
          Tipo task
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="all">Tutti i tipi</option>
            {availableTypes.map((type) => (
              <option key={type} value={type}>{type}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? <div className="empty-state">Caricamento task…</div> : null}
      {error ? <div className="empty-state error">{error}</div> : null}
      {!loading && !error && filteredItems.length === 0 ? <div className="empty-state">Nessun task trovato</div> : null}

      {filteredItems.map((item) => (
        <article className="details-card task-card" key={item.upid}>
          <div className="resource-card__top">
            <div>
              <div className="resource-type">{formatTaskType(item.type)} · {item.node || 'nodo sconosciuto'}</div>
              <h2>{item.vmid ? `VM/LXC ${item.vmid}` : item.upid}</h2>
              <div className="resource-meta">{item.upid}</div>
            </div>
            <span className={`status-badge ${item.status === 'running' ? 'status-paused' : item.status === 'ok' ? 'status-running' : 'status-stopped'}`}>
              {statusLabel(item.status)}
            </span>
          </div>

          <div className="details-grid">
            <div><span>Utente</span><strong>{item.user || '—'}</strong></div>
            <div><span>Stato raw</span><strong>{item.statusText || '—'}</strong></div>
            <div><span>Inizio</span><strong>{formatDateTime(item.startTime)}</strong></div>
            <div><span>Fine</span><strong>{formatDateTime(item.endTime)}</strong></div>
            <div><span>Durata</span><strong>{formatDuration(item.startTime, item.endTime, item.status)}</strong></div>
            <div><span>PID</span><strong>{item.pid || '—'}</strong></div>
          </div>

          {item.details?.logTail?.length ? (
            <div className="runtime-box">
              <h3>Ultime righe log</h3>
              <pre>{item.details.logTail.join('\n')}</pre>
            </div>
          ) : null}
        </article>
      ))}
    </section>
  );
}
