import { useState } from 'react';

export default function SetupPage({ onSuccess }) {
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Le password non coincidono.');
      return;
    }

    setLoading(true);
    try {
      const response = await fetch('/api/auth/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Setup iniziale non riuscito');
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
          <div className="resource-type">Primo avvio</div>
          <h2>Crea il primo admin</h2>
          <p className="settings-copy">
            Nessun utente configurato. Crea il primo account amministratore per proteggere backend e frontend.
          </p>
        </div>

        <label className="field-label">
          Username admin
          <input value={username} onChange={(event) => setUsername(event.target.value)} autoComplete="username" />
        </label>

        <label className="field-label">
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>

        <label className="field-label">
          Conferma password
          <input
            type="password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
          />
        </label>

        {error ? <div className="empty-state error">{error}</div> : null}

        <button type="submit" className="primary-button" disabled={loading}>
          {loading ? 'Creazione…' : 'Crea amministratore'}
        </button>
      </form>
    </div>
  );
}
