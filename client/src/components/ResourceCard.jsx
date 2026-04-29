import { Link } from 'react-router-dom';
import StatusBadge from './StatusBadge';

function percent(current, total) {
  if (!total || current == null) return null;
  return Math.min(100, Math.round((current / total) * 100));
}

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

export default function ResourceCard({ item, onAction, pendingAction, canManageResources, compact = false }) {
  const cpu = item.cpu == null ? null : Math.round(item.cpu * 100);
  const ram = percent(item.mem, item.maxmem);
  const disk = percent(item.disk, item.maxdisk);
  const isLocked = Boolean(item.lock);
  const actionLabel = item.status === 'running' ? 'shutdown' : 'start';
  const primaryLabel = item.status === 'running' ? 'Spegni' : 'Avvia';

  return (
    <article className={`resource-card ${compact ? 'resource-card--compact' : ''}`}>
      <div className="resource-card__top">
        <div>
          <div className="resource-type">{item.type.toUpperCase()} · {item.node}</div>
          <h2>{item.name}</h2>
          <div className="resource-meta">VMID {item.vmid}</div>
          {isLocked ? <div className="resource-lock">Locked: {item.lock}</div> : null}
        </div>
        <StatusBadge status={item.status} lock={item.lock} compact={compact} />
      </div>

      <div className="usage-stack">
        <UsageBar
          label="CPU"
          percentValue={cpu}
          detail={item.maxcpu ? `${item.maxcpu} vCPU disponibili` : 'Uso istantaneo CPU'}
        />
        <UsageBar
          label="RAM"
          percentValue={ram}
          detail={`${formatBytes(item.mem)} / ${formatBytes(item.maxmem)}`}
        />
        <UsageBar
          label="Disco"
          percentValue={disk}
          detail={`${formatBytes(item.disk)} / ${formatBytes(item.maxdisk)}`}
        />
      </div>

      <div className="actions-row">
        {canManageResources ? (
          <>
            <button disabled={pendingAction} onClick={() => onAction(item, actionLabel)}>
              {primaryLabel}
            </button>
            <button disabled={pendingAction} onClick={() => onAction(item, 'reboot')}>
              Riavvia
            </button>
            <button disabled={pendingAction} onClick={() => onAction(item, 'reset')}>
              Reset
            </button>
            {isLocked ? (
              <button disabled={pendingAction} className="danger-button" onClick={() => onAction(item, 'unlock')}>
                Unlock
              </button>
            ) : null}
          </>
        ) : null}
        <Link className="details-link" to={`/resource/${item.type}/${item.node}/${item.vmid}`}>
          Dettagli
        </Link>
      </div>
    </article>
  );
}
