import { useState } from 'react';

export default function LoginPage({ onSuccess }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Login non riuscito');
      await onSuccess();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="app-shell auth-shell">
      <form className="details-card auth-card" onSubmit={handleSubmit}>
        <div>
          <div className="resource-type">Accesso applicativo</div>
          <h2>Login</h2>
          <p className="settings-copy">Accedi con un utente locale dell&apos;app per usare dashboard, storage e controlli Proxmox.</p>
        </div>

        <label className="field-label">
          Username
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>

        <label className="field-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
          />
        </label>

        {error ? <div className="empty-state error">{error}</div> : null}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Accesso…' : 'Accedi'}
        </button>
      </form>
    </div>
  );
}
