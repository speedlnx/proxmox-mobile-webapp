import { useEffect, useRef, useState } from 'react';

function formatBytes(value) {
  if (value == null) return '—';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  let n = value;
  let i = 0;
  while (n >= 1024 && i < units.length - 1) {
    n /= 1024;
    i += 1;
  }
  return `${n.toFixed(n >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

function percent(used, total) {
  if (!total || used == null) return null;
  return Math.min(100, Math.round((used / total) * 100));
}

function resolveAvailable(item) {
  if (item.avail != null) return item.avail;
  if (item.total != null && item.used != null) return Math.max(0, item.total - item.used);
  return null;
}

export default function StoragePage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);
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
        const response = await fetch('/api/storages');
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Errore nel caricamento degli storage');
        setItems(payload.items);
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

    load();
    const id = setInterval(() => {
      load({ silent: true });
    }, 20000);
    return () => clearInterval(id);
  }, []);

  return (
    <section className="details-page">
      <div className={`toolbar-status ${refreshing ? 'is-visible' : ''}`}>
        Aggiornamento in background…
      </div>
      {loading ? <div className="empty-state">Caricamento storage…</div> : null}
      {error ? <div className="empty-state error">{error}</div> : null}
      {!loading && !error && items.length === 0 ? <div className="empty-state">Nessuno storage trovato</div> : null}

      {items.map((item) => {
        const usage = percent(item.used, item.total);
        const available = resolveAvailable(item);
        return (
          <article className="details-card" key={`${item.node}-${item.storage}`}>
            <div className="resource-card__top">
              <div>
                <div className="resource-type">{item.node || 'cluster'} · {item.plugintype || item.type}</div>
                <h2>{item.storage}</h2>
                <div className="resource-meta">{item.content || 'Contenuti non specificati'}</div>
              </div>
              <span className={`status-badge ${item.status === 'available' ? 'status-running' : 'status-paused'}`}>
                {item.status}
              </span>
            </div>

            <div className="storage-usage">
              <div className="storage-usage__labels">
                <span>Utilizzo spazio</span>
                <strong>{usage == null ? '—' : `${usage}%`}</strong>
              </div>
              <div
                className="storage-usage__bar"
                role="progressbar"
                aria-valuenow={usage ?? 0}
                aria-valuemin="0"
                aria-valuemax="100"
                aria-label={`Utilizzo storage ${item.storage}`}
              >
                <div className="storage-usage__fill" style={{ width: `${usage ?? 0}%` }} />
              </div>
            </div>

            <div className="details-grid">
              <div><span>Utilizzo</span><strong>{usage == null ? '—' : `${usage}%`}</strong></div>
              <div><span>Shared</span><strong>{item.shared ? 'Si' : 'No'}</strong></div>
              <div><span>Usato</span><strong>{formatBytes(item.used)}</strong></div>
              <div><span>Libero</span><strong>{formatBytes(available)}</strong></div>
              <div><span>Totale</span><strong>{formatBytes(item.total)}</strong></div>
              <div><span>Tipo</span><strong>{item.plugintype || item.type || '—'}</strong></div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
