import { useEffect, useState } from 'react';

const ADMIN_TOKEN_STORAGE_KEY = 'proxmox-mobile-admin-token';

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

function getStoredAdminToken() {
  try {
    return window.sessionStorage.getItem(ADMIN_TOKEN_STORAGE_KEY) || '';
  } catch (_error) {
    return '';
  }
}

function storeAdminToken(value) {
  try {
    if (!value) {
      window.sessionStorage.removeItem(ADMIN_TOKEN_STORAGE_KEY);
      return;
    }
    window.sessionStorage.setItem(ADMIN_TOKEN_STORAGE_KEY, value);
  } catch (_error) {
    // Ignore sessionStorage access failures.
  }
}

function buildHeaders(adminToken) {
  return adminToken ? { 'x-admin-token': adminToken } : {};
}

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
  const [adminToken, setAdminToken] = useState(getStoredAdminToken);
  const [loading, setLoading] = useState(true);
  const [testing, setTesting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    storeAdminToken(adminToken);
  }, [adminToken]);

  useEffect(() => {
    loadHealth();
  }, []);

  useEffect(() => {
    loadSettings();
  }, [adminToken]);

  async function loadHealth() {
    try {
      const response = await fetch('/api/health');
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Errore nel caricamento dello stato applicazione');
      setHealth(payload);
    } catch (err) {
      setError(err.message);
    }
  }

  async function loadSettings() {
    setLoading(true);
    setError('');

    try {
      const response = await fetch('/api/settings', {
        headers: buildHeaders(adminToken),
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error || 'Impossibile leggere la configurazione');
      }

      setSettingsInfo(payload);
      setForm(applySettingsToForm(payload.settings));
    } catch (err) {
      setSettingsInfo(null);
      if (!health?.adminProtected && !adminToken) {
        setForm(defaultForm);
      }
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(field, value) {
    setForm((current) => ({ ...current, [field]: value }));
  }

  async function callSettingsEndpoint(endpoint, method, workingSetter) {
    setMessage('');
    setError('');
    workingSetter(true);

    try {
      const response = await fetch(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...buildHeaders(adminToken),
        },
        body: JSON.stringify(form),
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error || 'Operazione non riuscita');

      if (payload.settings) {
        setSettingsInfo((current) => ({
          ...(current || {}),
          settings: payload.settings,
        }));
      }

      if (payload.result?.version || payload.message) {
        const version = payload.result?.version?.release ? ` (${payload.result.version.release})` : '';
        setMessage(payload.message || `Connessione Proxmox verificata con successo${version}.`);
      }

      if (payload.settings) {
        setForm(applySettingsToForm(payload.settings));
      }

      await loadHealth();
      return payload;
    } catch (err) {
      setError(err.message);
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

  return (
    <section className="settings-page">
      <div className="details-card settings-hero">
        <div>
          <div className="resource-type">Backend setup</div>
          <h2>Configurazione Proxmox</h2>
          <p className="settings-copy">
            Questo pannello salva nel backend l&apos;host Proxmox, il metodo di autenticazione e le credenziali operative.
          </p>
        </div>
        <div className="settings-health">
          <span className={`health-pill ${health?.configured ? 'is-good' : 'is-muted'}`}>
            {health?.configured ? 'Configurato' : 'Setup richiesto'}
          </span>
          {health?.proxmox ? <span className="health-meta">{health.proxmox}</span> : null}
        </div>
      </div>

      <form className="details-card settings-form" onSubmit={handleSave}>
        {health?.adminProtected ? (
          <div className="settings-section">
            <label className="field-label">
              Token amministrativo backend
              <input
                type="password"
                value={adminToken}
                onChange={(event) => setAdminToken(event.target.value)}
                placeholder="Inserisci APP_ADMIN_TOKEN"
              />
            </label>
            <p className="field-help">
              Il token non viene salvato sul server: resta solo nella sessione del browser.
            </p>
          </div>
        ) : null}

        <div className="settings-section">
          <h3>Connessione</h3>
          <label className="field-label">
            URL Proxmox
            <input
              value={form.baseUrl}
              onChange={(event) => updateField('baseUrl', event.target.value)}
              placeholder="https://pve.example.com:8006"
            />
          </label>

          <label className="checkbox-row">
            <input
              type="checkbox"
              checked={form.allowInsecureTls}
              onChange={(event) => updateField('allowInsecureTls', event.target.checked)}
            />
            <span>Permetti TLS insicuro per ambienti lab o certificati self-signed</span>
          </label>
        </div>

        <div className="settings-section">
          <h3>Autenticazione</h3>
          <div className="segmented">
            <button
              type="button"
              className={form.authMode === 'api-token' ? 'active' : ''}
              onClick={() => updateField('authMode', 'api-token')}
            >
              API Token
            </button>
            <button
              type="button"
              className={form.authMode === 'password' ? 'active' : ''}
              onClick={() => updateField('authMode', 'password')}
            >
              Username
            </button>
          </div>

          {form.authMode === 'api-token' ? (
            <div className="settings-grid">
              <label className="field-label">
                Token ID
                <input
                  value={form.tokenId}
                  onChange={(event) => updateField('tokenId', event.target.value)}
                  placeholder="user@realm!token-name"
                />
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
                <input
                  value={form.username}
                  onChange={(event) => updateField('username', event.target.value)}
                  placeholder="root oppure root@pam"
                />
              </label>
              <label className="field-label">
                Realm
                <input
                  value={form.realm}
                  onChange={(event) => updateField('realm', event.target.value)}
                  placeholder="pam"
                />
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
        {error ? <div className="empty-state error">{error}</div> : null}

        <div className="settings-actions">
          <button type="button" onClick={handleTest} disabled={loading || testing || saving}>
            {testing ? 'Test in corso…' : 'Testa connessione'}
          </button>
          <button type="submit" className="primary-button" disabled={loading || testing || saving}>
            {saving ? 'Salvataggio…' : 'Salva configurazione'}
          </button>
        </div>

        {loading ? <p className="field-help">Caricamento configurazione dal backend…</p> : null}
      </form>
    </section>
  );
}
