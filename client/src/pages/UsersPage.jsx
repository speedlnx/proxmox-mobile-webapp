import { useEffect, useState } from 'react';

const defaultForm = {
  username: '',
  password: '',
  role: 'operator',
};

export default function UsersPage({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [form, setForm] = useState(defaultForm);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [passwordDrafts, setPasswordDrafts] = useState({});

  async function loadUsers() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/users');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Errore nel caricamento utenti');
      setUsers(payload.users);
    } catch (loadError) {
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUsers();
  }, []);

  async function createUser(event) {
    event.preventDefault();
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Creazione utente non riuscita');
      setForm(defaultForm);
      setMessage(payload.message || 'Utente creato.');
      await loadUsers();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setSaving(false);
    }
  }

  async function updateUser(user, changes) {
    setError('');
    setMessage('');
    const response = await fetch(`/api/users/${user.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(changes),
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Aggiornamento utente non riuscito');
    setMessage(payload.message || 'Utente aggiornato.');
    await loadUsers();
  }

  async function deleteUser(user) {
    const confirmed = window.confirm(`Vuoi eliminare l'utente ${user.username}?`);
    if (!confirmed) return;

    setError('');
    setMessage('');
    const response = await fetch(`/api/users/${user.id}`, { method: 'DELETE' });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error || 'Eliminazione utente non riuscita');
    setMessage(payload.message || 'Utente eliminato.');
    await loadUsers();
  }

  return (
    <section className="settings-page">
      <div className="details-card">
        <div className="resource-type">Access control</div>
        <h2>Utenti applicativi</h2>
        <p className="settings-copy">Gli admin possono gestire utenti, impostazioni backend e accesso completo al software.</p>
      </div>

      <form className="details-card settings-form" onSubmit={createUser}>
        <div className="settings-section">
          <h3>Crea utente</h3>
          <div className="settings-grid">
            <label className="field-label">
              Username
              <input value={form.username} onChange={(event) => setForm((current) => ({ ...current, username: event.target.value }))} />
            </label>
            <label className="field-label">
              Password
              <input
                type="password"
                value={form.password}
                onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
              />
            </label>
            <label className="field-label">
              Ruolo
              <select value={form.role} onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}>
                <option value="operator">operator</option>
                <option value="admin">admin</option>
              </select>
            </label>
          </div>
        </div>

        {message ? <div className="empty-state success">{message}</div> : null}
        {error ? <div className="empty-state error">{error}</div> : null}

        <button type="submit" className="primary-button" disabled={saving}>
          {saving ? 'Creazione…' : 'Crea utente'}
        </button>
      </form>

      {loading ? <div className="empty-state">Caricamento utenti…</div> : null}

      {!loading && users.map((user) => (
        <article className="details-card" key={user.id}>
          <div className="resource-card__top">
            <div>
              <div className="resource-type">{user.role}</div>
              <h2>{user.username}</h2>
              <div className="resource-meta">
                {user.disabled ? 'Disabilitato' : 'Attivo'}
                {currentUser?.id === user.id ? ' · sessione corrente' : ''}
              </div>
            </div>
          </div>

          <div className="settings-grid">
            <label className="field-label">
              Ruolo
              <select
                value={user.role}
                onChange={async (event) => {
                  try {
                    await updateUser(user, { role: event.target.value, disabled: user.disabled });
                  } catch (updateError) {
                    setError(updateError.message);
                  }
                }}
              >
                <option value="operator">operator</option>
                <option value="admin">admin</option>
              </select>
            </label>

            <label className="checkbox-row">
              <input
                type="checkbox"
                checked={user.disabled}
                onChange={async (event) => {
                  try {
                    await updateUser(user, { role: user.role, disabled: event.target.checked });
                  } catch (updateError) {
                    setError(updateError.message);
                  }
                }}
              />
              <span>Utente disabilitato</span>
            </label>

            <label className="field-label">
              Nuova password
              <input
                type="password"
                value={passwordDrafts[user.id] || ''}
                onChange={(event) => setPasswordDrafts((current) => ({ ...current, [user.id]: event.target.value }))}
                placeholder="Lascia vuoto per non cambiare"
              />
            </label>
          </div>

          <div className="settings-actions">
            <button
              type="button"
              onClick={async () => {
                try {
                  if (!passwordDrafts[user.id]) {
                    setError('Inserisci una nuova password prima di salvarla.');
                    return;
                  }
                  await updateUser(user, { password: passwordDrafts[user.id] });
                  setPasswordDrafts((current) => ({ ...current, [user.id]: '' }));
                } catch (updateError) {
                  setError(updateError.message);
                }
              }}
            >
              Aggiorna password
            </button>
            <button
              type="button"
              className="danger-button"
              disabled={currentUser?.id === user.id}
              onClick={async () => {
                try {
                  await deleteUser(user);
                } catch (deleteError) {
                  setError(deleteError.message);
                }
              }}
            >
              Elimina utente
            </button>
          </div>
        </article>
      ))}
    </section>
  );
}
