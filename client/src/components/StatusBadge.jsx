export default function StatusBadge({ status }) {
  const normalized = String(status || 'unknown').toLowerCase();
  const labelMap = {
    running: 'Acceso',
    stopped: 'Spento',
    paused: 'In pausa',
  };
  return <span className={`status-badge status-${normalized}`}>{labelMap[normalized] || status}</span>;
}
