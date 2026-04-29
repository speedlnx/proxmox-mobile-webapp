export default function StatusBadge({ status, lock, compact = false }) {
  if (lock) {
    return (
      <span
        className={`status-badge status-locked ${compact ? 'status-badge--compact' : ''}`}
        aria-label="Locked"
        title="Locked"
      >
        {compact ? '' : 'Locked'}
      </span>
    );
  }

  const normalized = String(status || 'unknown').toLowerCase();
  const labelMap = {
    running: 'Acceso',
    stopped: 'Spento',
    paused: 'In pausa',
  };
  const label = labelMap[normalized] || status;
  return (
    <span
      className={`status-badge status-${normalized} ${compact ? 'status-badge--compact' : ''}`}
      aria-label={label}
      title={label}
    >
      {compact ? '' : label}
    </span>
  );
}
