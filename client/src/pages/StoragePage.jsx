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

function formatLoad(loadavg) {
  if (!loadavg?.length) return '—';
  return loadavg.map((value) => Number(value).toFixed(2)).join(' / ');
}

function UsageBar({ label, percentValue, detail }) {
  return (
    <div className="usage-meter">
      <div className="usage-meter__labels">
        <span>{label}</span>
        <strong>{percentValue == null ? '—' : `${percentValue}%`}</strong>
      </div>
      <div className="usage-meter__bar" role="progressbar" aria-valuenow={percentValue ?? 0} aria-valuemin="0" aria-valuemax="100" aria-label={`${label} usage`}>
        <div className="usage-meter__fill" style={{ width: `${percentValue ?? 0}%` }} />
      </div>
      <div className="usage-meter__detail">{detail}</div>
    </div>
  );
}

export default function ClusterPage() {
  const [items, setItems] = useState([]);
  const [overview, setOverview] = useState(null);
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
        const [storageResponse, overviewResponse] = await Promise.all([
          fetch('/api/storages'),
          fetch('/api/overview').catch(() => null),
        ]);
        const payload = await storageResponse.json();
        if (!storageResponse.ok) throw new Error(payload.error || 'Errore nel caricamento del cluster');
        const overviewPayload = overviewResponse
          ? {
              ok: overviewResponse.ok,
              data: await overviewResponse.json(),
            }
          : null;
        setItems(payload.items);
        if (overviewPayload?.ok) {
          setOverview(overviewPayload.data);
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
      {overview ? (
        <div className="details-card overview-card">
          <div className="resource-card__top">
            <div>
              <div className="resource-type">Cluster overview</div>
              <h2>Cluster e Hypervisor</h2>
              <div className="resource-meta">
                Nodi online {overview.summary.online}/{overview.summary.nodes}
              </div>
            </div>
          </div>

          <div className="details-grid overview-grid">
            <div><span>CPU logiche</span><strong>{overview.summary.cpus ?? '—'}</strong></div>
            <div><span>Socket</span><strong>{overview.summary.sockets ?? '—'}</strong></div>
            <div><span>Core totali</span><strong>{overview.summary.cores ?? '—'}</strong></div>
            <div><span>Thread totali</span><strong>{overview.summary.threads ?? '—'}</strong></div>
            <div><span>RAM totale</span><strong>{formatBytes(overview.summary.memoryTotal)}</strong></div>
            <div><span>RAM disponibile</span><strong>{formatBytes(overview.summary.memoryFree)}</strong></div>
            <div><span>Swap totale</span><strong>{formatBytes(overview.summary.swapTotal)}</strong></div>
            <div><span>Swap libera</span><strong>{formatBytes(overview.summary.swapFree)}</strong></div>
            <div><span>Disco totale</span><strong>{formatBytes(overview.summary.diskTotal)}</strong></div>
            <div><span>Disco libero</span><strong>{formatBytes(overview.summary.diskFree)}</strong></div>
          </div>

          <div className="overview-node-list">
            {overview.nodes.map((node) => (
              <div className="overview-node-card" key={node.node}>
                <div className="resource-card__top">
                  <div>
                    <strong>{node.node}</strong>
                    <div className="resource-meta">
                      CPU {node.cpus ?? '—'} · Socket {node.sockets ?? '—'} · Core {node.totalCores ?? '—'} · Thread {node.totalThreads ?? '—'}
                    </div>
                  </div>
                  <span className={`status-badge ${node.status === 'online' ? 'status-running' : 'status-stopped'}`}>
                    {node.status}
                  </span>
                </div>
                <div className="usage-stack overview-usage-stack">
                  <UsageBar
                    label="CPU"
                    percentValue={node.cpuUsage == null ? null : Math.round(node.cpuUsage * 100)}
                    detail={node.totalThreads ? `${node.totalThreads} thread logici` : 'Uso istantaneo CPU'}
                  />
                  <UsageBar
                    label="RAM"
                    percentValue={percent(node.memoryUsed, node.memoryTotal)}
                    detail={`${formatBytes(node.memoryUsed)} / ${formatBytes(node.memoryTotal)}`}
                  />
                </div>
                <div className="overview-node-stats">
                  <span>Load: {formatLoad(node.loadavg)}</span>
                  <span>Swap: {formatBytes(node.swapUsed)} / {formatBytes(node.swapTotal)}</span>
                  <span>Disco: {formatBytes(node.diskUsed)} / {formatBytes(node.diskTotal)}</span>
                  {node.diagnostics?.missingCpuTopology || node.diagnostics?.missingSwap || node.diagnostics?.missingLoad ? (
                    <span className="overview-diagnostic">
                      Alcuni dati nodo non sono disponibili via API. Verifica `Sys.Audit` sul path `/nodes/{node.node}` o i permessi effettivi del token.
                    </span>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? <div className="empty-state">Caricamento cluster…</div> : null}
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
