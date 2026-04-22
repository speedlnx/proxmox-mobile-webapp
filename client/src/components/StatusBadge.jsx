export default function StatusBadge({ status, lock }) {
  if (lock) {
    return <span className="status-badge status-locked">Locked</span>;
  }

  const normalized = String(status || 'unknown').toLowerCase();
  const labelMap = {
    running: 'Acceso',
    stopped: 'Spento',
    paused: 'In pausa',
  };
  return <span className={`status-badge status-${normalized}`}>{labelMap[normalized] || status}</span>;
}
