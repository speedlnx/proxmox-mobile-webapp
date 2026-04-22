import { useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import StatusBadge from '../components/StatusBadge';

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

function formatUptime(seconds) {
  if (!seconds) return '—';
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  return `${days}g ${hours}h ${minutes}m`;
}

export default function DetailsPage() {
  const { type, node, vmid } = useParams();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
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
        const response = await fetch(`/api/resources/${type}/${node}/${vmid}`);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Errore nel caricamento');
        setData(payload);
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
    }, 15000);
    return () => clearInterval(id);
  }, [type, node, vmid]);

  if (loading) return <div className="empty-state">Caricamento dettagli…</div>;
  if (error) return <div className="empty-state error">{error}</div>;
  if (!data) return null;

  const { info, network } = data;

  return (
    <section className="details-page">
      <Link to="/" className="back-link">← Torna alla dashboard</Link>
      <div className={`toolbar-status ${refreshing ? 'is-visible' : ''}`}>
        Aggiornamento in background…
      </div>

      <div className="details-card">
        <div className="resource-card__top">
          <div>
            <div className="resource-type">{info.type.toUpperCase()} · {info.node}</div>
            <h2>{info.name}</h2>
            <div className="resource-meta">VMID {info.vmid}</div>
            {info.lock ? <div className="resource-lock">Locked: {info.lock}</div> : null}
          </div>
          <StatusBadge status={info.status} lock={info.lock} />
        </div>

        <div className="details-grid">
          <div><span>CPU</span><strong>{info.cpu == null ? '—' : `${Math.round(info.cpu * 100)}%`}</strong></div>
          <div><span>vCPU</span><strong>{info.cpus || '—'}</strong></div>
          <div><span>RAM</span><strong>{formatBytes(info.mem)} / {formatBytes(info.maxmem)}</strong></div>
          <div><span>Disco</span><strong>{formatBytes(info.disk)} / {formatBytes(info.maxdisk)}</strong></div>
          <div><span>Uptime</span><strong>{formatUptime(info.uptime)}</strong></div>
          <div><span>OS Type</span><strong>{info.ostype || '—'}</strong></div>
        </div>

        <div className="console-box">
          <h3>Console</h3>
          <p>
            Questo pulsante apre la console nativa di Proxmox in una nuova scheda. È il modo più rapido e stabile per un uso da smartphone.
          </p>
          <a href={info.consoleUrl} target="_blank" rel="noreferrer" className="console-link">Apri console</a>
        </div>
      </div>

      <div className="details-card">
        <h3>Note</h3>
        {info.notes ? (
          <pre className="notes-box">{info.notes}</pre>
        ) : (
          <div className="empty-state">Nessuna nota configurata</div>
        )}
      </div>

      <div className="details-card">
        <h3>Rete</h3>
        {network.config?.length ? (
          <div className="network-list">
            {network.config.map((nic) => (
              <div className="network-card" key={nic.nic}>
                <strong>{nic.nic}</strong>
                <div>Bridge: {nic.bridge || '—'}</div>
                <div>IP: {nic.ip || '—'}</div>
                <div>GW: {nic.gw || '—'}</div>
                {nic.ip6 ? <div>IPv6: {nic.ip6}</div> : null}
                {nic.gw6 ? <div>GW6: {nic.gw6}</div> : null}
                {nic.mac ? <div>MAC: {nic.mac}</div> : null}
                {nic.hwaddr ? <div>HWADDR: {nic.hwaddr}</div> : null}
              </div>
            ))}
          </div>
        ) : (
          <div className="empty-state">Nessuna configurazione di rete disponibile</div>
        )}

        {network.runtime ? (
          <details className="runtime-box">
            <summary>Dettagli runtime interfacce</summary>
            <pre>{JSON.stringify(network.runtime, null, 2)}</pre>
          </details>
        ) : (
          <p className="runtime-note">I dettagli runtime non sono disponibili. Per le VM serve di norma il QEMU Guest Agent.</p>
        )}
      </div>
    </section>
  );
}
