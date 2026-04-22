import { useEffect, useState } from 'react';

const defaultForm = {
  baseUrl: '',
  allowInsecureTls: false,
  authMode: 'api-token',
  tokenId: '',
  tokenSecret: '',
  realm: 'pam',
  username: '',
  password: '',
};

function applySettingsToForm(settings) {
  return {
    baseUrl: settings.baseUrl || '',
    allowInsecureTls: Boolean(settings.allowInsecureTls),
    authMode: settings.authMode || 'api-token',
    tokenId: settings.tokenId || '',
    tokenSecret: '',
    realm: settings.realm || 'pam',
    username: settings.username || '',
    password: '',
  };
}

export default function SettingsPage() {
  const [health, setHealth] = useState(null);
  const [form, setForm] = useState(defaultForm);
  const [settingsInfo, setSettingsInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [warning, setWarning] = useState('');

  useEffect(() => {
    loadHealth();
    loadSettings();
  }, []);

  async function loadHealth() {
    try {
      const response = await fetch('/api/health');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Errore nel caricamento dello stato applicazione');
      setHealth(payload);
    } catch (loadError) {
      setError(loadError.message);
    }
  }

  async function loadSettings() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/settings');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Impossibile leggere la configurazione');

      setSettingsInfo(payload);
      setForm(applySettingsToForm(payload.settings));
    } catch (loadError) {
      setSettingsInfo(null);
      setError(loadError.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function callSettingsEndpoint(endpoint, method, workingSetter) {
    setMessage('');
    setWarning('');
    setError('');
    workingSetter(true);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Operazione non riuscita');

      if (payload.settings) {
        setSettingsInfo((current) => ({ ...(current || {}), settings: payload.settings }));
        setForm(applySettingsToForm(payload.settings));
      }

      if (payload.result?.version || payload.message) {
        const version = payload.result?.version?.release ? ` (${payload.result.version.release})` : '';
        setMessage(payload.message || `Connessione Proxmox verificata con successo${version}.`);
      }
      if (payload.warning) {
        setWarning(payload.warning);
      }

      await loadHealth();
      return payload;
    } catch (submitError) {
      setError(submitError.message);
      return null;
    } finally {
      workingSetter(false);
    }
  }

  async function handleTest(event) {
    event.preventDefault();
    await callSettingsEndpoint('/api/settings/test', 'POST', setTesting);
  }

  async function handleSave(event) {
    event.preventDefault();
    await callSettingsEndpoint('/api/settings', 'PUT', setSaving);
    await loadSettings();
  }

  async function handleClearCredentials() {
    const confirmed = window.confirm('Vuoi cancellare dal backend tutte le credenziali Proxmox salvate?');
    if (!confirmed) return;

    setMessage('');
    setWarning('');
    setError('');
    setClearing(true);
    try {
      const response = await fetch('/api/settings/credentials', { method: 'DELETE' });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Cancellazione credenziali non riuscita');
      setMessage(payload.message || 'Credenziali cancellate correttamente.');
      setSettingsInfo(payload);
      setForm(payload.settings ? applySettingsToForm(payload.settings) : defaultForm);
      await loadHealth();
      await loadSettings();
    } catch (submitError) {
      setError(submitError.message);
    } finally {
      setClearing(false);
    }
  }

  return (
    <section className="settings-page">
      <div className="details-card settings-hero">
        <div>
          <div className="resource-type">Backend setup</div>
          <h2>Configurazione Proxmox</h2>
          <p className="settings-copy">Questo pannello salva nel backend host, autenticazione e credenziali operative di Proxmox.</p>
        </div>
        <div className="settings-health">
          <span className={`health-pill ${health?.configured ? 'is-good' : 'is-muted'}`}>
            {health?.configured ? 'Configurato' : 'Setup richiesto'}
          </span>
          {health?.proxmox ? <span className="health-meta">{health.proxmox}</span> : null}
        </div>
      </div>

      <form className="details-card settings-form" onSubmit={handleSave}>
        <div className="settings-section">
          <h3>Connessione</h3>
          <label className="field-label">
            URL Proxmox
            <input value={form.baseUrl} onChange={(event) => updateField('baseUrl', event.target.value)} placeholder="https://pve.example.com:8006" />
          </label>

          <label className="checkbox-row">
            <input type="checkbox" checked={form.allowInsecureTls} onChange={(event) => updateField('allowInsecureTls', event.target.checked)} />
            <span>Permetti TLS insicuro per ambienti lab o certificati self-signed</span>
          </label>
        </div>

        <div className="settings-section">
          <h3>Autenticazione Proxmox</h3>
          <div className="segmented auth-mode-toggle">
            <button type="button" className={form.authMode === 'api-token' ? 'active' : ''} onClick={() => updateField('authMode', 'api-token')}>
              API Token
            </button>
            <button type="button" className={form.authMode === 'password' ? 'active' : ''} onClick={() => updateField('authMode', 'password')}>
              Username
            </button>
          </div>

          {form.authMode === 'api-token' ? (
            <div className="settings-grid">
              <label className="field-label">
                Token ID
                <input value={form.tokenId} onChange={(event) => updateField('tokenId', event.target.value)} placeholder="root@pam!mobile-app" />
              </label>
              <label className="field-label">
                Token secret
                <input
                  type="password"
                  value={form.tokenSecret}
                  onChange={(event) => updateField('tokenSecret', event.target.value)}
                  placeholder={settingsInfo?.settings?.hasTokenSecret ? 'Lascia vuoto per mantenere il secret salvato' : 'Inserisci il token secret'}
                />
              </label>
            </div>
          ) : (
            <div className="settings-grid">
              <label className="field-label">
                Username
                <input value={form.username} onChange={(event) => updateField('username', event.target.value)} placeholder="root oppure root@pam" />
              </label>
              <label className="field-label">
                Realm
                <input value={form.realm} onChange={(event) => updateField('realm', event.target.value)} placeholder="pam" />
              </label>
              <label className="field-label">
                Password
                <input
                  type="password"
                  value={form.password}
                  onChange={(event) => updateField('password', event.target.value)}
                  placeholder={settingsInfo?.settings?.hasPassword ? 'Lascia vuoto per mantenere la password salvata' : 'Inserisci la password'}
                />
              </label>
            </div>
          )}
        </div>

        {message ? <div className="empty-state success">{message}</div> : null}
        {warning ? <div className="empty-state warning">{warning}</div> : null}
        {error ? <div className="empty-state error">{error}</div> : null}

        <div className="settings-actions">
          <button type="button" onClick={handleTest} disabled={loading || testing || saving || clearing}>
            {testing ? 'Test in corso…' : 'Testa connessione'}
          </button>
          <button type="submit" className="primary-button" disabled={loading || testing || saving || clearing}>
            {saving ? 'Salvataggio…' : 'Salva configurazione'}
          </button>
        </div>

        <div className="settings-actions single-action">
          <button type="button" className="danger-button" onClick={handleClearCredentials} disabled={loading || testing || saving || clearing}>
            {clearing ? 'Cancellazione…' : 'Cancella credenziali salvate'}
          </button>
        </div>

        {loading ? <p className="field-help">Caricamento configurazione dal backend…</p> : null}
      </form>
    </section>
  );
}
