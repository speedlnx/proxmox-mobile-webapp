import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import https from 'https';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const APP_PORT = Number(process.env.PORT || 8787);
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${APP_PORT}`;
const APP_ADMIN_TOKEN = process.env.APP_ADMIN_TOKEN || '';
const APP_CONFIG_PATH = path.resolve(__dirname, process.env.APP_CONFIG_PATH || './data/app-config.json');
const CLIENT_DIST_DIR = path.resolve(__dirname, '../client/dist');
const CORS_ORIGIN = process.env.CORS_ORIGIN || '';
const APP_VERSION = '0.3.1';

const ENV_PROXMOX_DEFAULTS = {
  baseUrl: normalizeBaseUrl(process.env.PROXMOX_BASE_URL || ''),
  allowInsecureTls: parseBoolean(process.env.ALLOW_INSECURE_TLS, false),
  authMode: '',
  tokenId: process.env.PROXMOX_TOKEN_ID || '',
  tokenSecret: process.env.PROXMOX_TOKEN_SECRET || '',
  realm: process.env.PROXMOX_REALM || 'pam',
  username: process.env.PROXMOX_USERNAME || '',
  password: process.env.PROXMOX_PASSWORD || '',
};

ENV_PROXMOX_DEFAULTS.authMode = deriveAuthMode(ENV_PROXMOX_DEFAULTS);

const app = express();

app.disable('x-powered-by');

if (CORS_ORIGIN) {
  app.use(cors({ origin: CORS_ORIGIN }));
}

app.use(express.json({ limit: '100kb' }));
app.use((_req, res, next) => {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  next();
});

let authCache = {
  cacheKey: '',
  ticket: null,
  csrf: null,
  expiresAt: 0,
};

let persistedSettings = loadPersistedSettings();

function parseBoolean(value, fallback = false) {
  if (typeof value === 'boolean') return value;
  if (typeof value !== 'string') return fallback;
  return value.toLowerCase() === 'true';
}

function normalizeBaseUrl(value) {
  return String(value || '').trim().replace(/\/+$/, '');
}

function deriveAuthMode(config) {
  if (config.authMode === 'api-token' || config.authMode === 'password') {
    return config.authMode;
  }
  if (config.tokenId && config.tokenSecret) {
    return 'api-token';
  }
  if (config.username && config.password) {
    return 'password';
  }
  return '';
}

function getEffectiveProxmoxConfig() {
  const merged = {
    ...ENV_PROXMOX_DEFAULTS,
    ...(persistedSettings.proxmox || {}),
  };

  merged.baseUrl = normalizeBaseUrl(merged.baseUrl);
  merged.allowInsecureTls = Boolean(merged.allowInsecureTls);
  merged.realm = String(merged.realm || 'pam').trim() || 'pam';
  merged.tokenId = String(merged.tokenId || '').trim();
  merged.tokenSecret = String(merged.tokenSecret || '');
  merged.username = String(merged.username || '').trim();
  merged.password = String(merged.password || '');
  merged.authMode = deriveAuthMode(merged);

  return merged;
}

function isConfigurationComplete(config) {
  if (!config.baseUrl) return false;
  if (config.authMode === 'api-token') {
    return Boolean(config.tokenId && config.tokenSecret);
  }
  if (config.authMode === 'password') {
    return Boolean(config.username && config.password);
  }
  return false;
}

function validateProxmoxConfig(config) {
  if (!config.baseUrl) {
    throw createHttpError(400, 'PROXMOX_BASE_URL_REQUIRED', 'Inserire l\'URL del server Proxmox.');
  }

  let url;
  try {
    url = new URL(config.baseUrl);
  } catch (_error) {
    throw createHttpError(400, 'PROXMOX_BASE_URL_INVALID', 'L\'URL del server Proxmox non e\' valido.');
  }

  if (!['http:', 'https:'].includes(url.protocol)) {
    throw createHttpError(400, 'PROXMOX_BASE_URL_PROTOCOL', 'Usare un URL Proxmox con protocollo http o https.');
  }

  if (!config.authMode) {
    throw createHttpError(400, 'PROXMOX_AUTH_MODE_REQUIRED', 'Selezionare una modalita\' di autenticazione.');
  }

  if (config.authMode === 'api-token') {
    if (!config.tokenId || !config.tokenSecret) {
      throw createHttpError(400, 'PROXMOX_TOKEN_REQUIRED', 'Per il token API servono token ID e token secret.');
    }
  }

  if (config.authMode === 'password') {
    if (!config.username || !config.password) {
      throw createHttpError(400, 'PROXMOX_PASSWORD_REQUIRED', 'Per il login classico servono username e password.');
    }
  }
}

function createHttpError(status, code, message, extra = {}) {
  const error = new Error(message);
  error.status = status;
  error.code = code;
  error.extra = extra;
  return error;
}

function maskSecret(value) {
  if (!value) return '';
  if (value.length <= 6) return `${value.slice(0, 1)}***`;
  return `${value.slice(0, 3)}***${value.slice(-2)}`;
}

function buildSettingsResponse() {
  const config = getEffectiveProxmoxConfig();
  return {
    configured: isConfigurationComplete(config),
    updatedAt: persistedSettings.updatedAt || null,
    source: persistedSettings.updatedAt ? 'persisted' : 'environment',
    adminTokenRequired: Boolean(APP_ADMIN_TOKEN),
    settings: buildSettingsSnapshot(config),
  };
}

function buildSettingsSnapshot(config) {
  return {
    baseUrl: config.baseUrl,
    allowInsecureTls: config.allowInsecureTls,
    authMode: config.authMode || 'api-token',
    tokenId: config.tokenId,
    tokenSecretMasked: maskSecret(config.tokenSecret),
    hasTokenSecret: Boolean(config.tokenSecret),
    realm: config.realm,
    username: config.username,
    passwordMasked: maskSecret(config.password),
    hasPassword: Boolean(config.password),
  };
}

function readJsonFile(filePath) {
  try {
    return JSON.parse(fs.readFileSync(filePath, 'utf8'));
  } catch (error) {
    console.error(`Impossibile leggere ${filePath}:`, error.message);
    return null;
  }
}

function loadPersistedSettings() {
  if (!fs.existsSync(APP_CONFIG_PATH)) {
    return { updatedAt: null, proxmox: {} };
  }

  const parsed = readJsonFile(APP_CONFIG_PATH);
  if (!parsed || typeof parsed !== 'object') {
    return { updatedAt: null, proxmox: {} };
  }

  return {
    updatedAt: parsed.updatedAt || null,
    proxmox: parsed.proxmox && typeof parsed.proxmox === 'object' ? parsed.proxmox : {},
  };
}

function persistSettings(config) {
  const nextStore = {
    updatedAt: new Date().toISOString(),
    proxmox: config,
  };

  fs.mkdirSync(path.dirname(APP_CONFIG_PATH), { recursive: true });

  const tempFile = `${APP_CONFIG_PATH}.tmp`;
  fs.writeFileSync(tempFile, JSON.stringify(nextStore, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempFile, APP_CONFIG_PATH);
  try {
    fs.chmodSync(APP_CONFIG_PATH, 0o600);
  } catch (_error) {
    // Ignore chmod failures on filesystems that do not support unix permissions.
  }

  persistedSettings = nextStore;
  authCache = { cacheKey: '', ticket: null, csrf: null, expiresAt: 0 };
}

function createHttpsAgent(config) {
  if (!config.baseUrl.startsWith('https://')) return undefined;
  return new https.Agent({
    rejectUnauthorized: !config.allowInsecureTls,
  });
}

function createAuthCacheKey(config) {
  return [config.baseUrl, config.authMode, config.realm, config.username, config.password].join('|');
}

async function loginWithPassword(config) {
  if (!config.username || !config.password) {
    throw createHttpError(
      400,
      'PROXMOX_PASSWORD_REQUIRED',
      'Configurazione mancante: impostare username e password Proxmox oppure un token API.'
    );
  }

  const cacheKey = createAuthCacheKey(config);
  const now = Date.now();
  if (authCache.cacheKey === cacheKey && authCache.ticket && authCache.expiresAt > now + 60_000) {
    return authCache;
  }

  const username = config.username.includes('@') ? config.username : `${config.username}@${config.realm}`;
  const params = new URLSearchParams();
  params.set('username', username);
  params.set('password', config.password);

  const { data } = await axios.post(
    `${config.baseUrl}/api2/json/access/ticket`,
    params.toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      httpsAgent: createHttpsAgent(config),
      timeout: 15_000,
    }
  );

  authCache = {
    cacheKey,
    ticket: data.data.ticket,
    csrf: data.data.CSRFPreventionToken,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };

  return authCache;
}

async function proxmoxRequestWithConfig(config, method, apiPath, { params, data, headers = {}, retry = true } = {}) {
  validateProxmoxConfig(config);

  const requestHeaders = { ...headers };
  if (config.authMode === 'api-token') {
    requestHeaders.Authorization = `PVEAPIToken=${config.tokenId}=${config.tokenSecret}`;
  } else {
    const auth = await loginWithPassword(config);
    requestHeaders.Cookie = `PVEAuthCookie=${auth.ticket}`;
    if (method !== 'GET') {
      requestHeaders.CSRFPreventionToken = auth.csrf;
    }
  }

  try {
    const response = await axios({
      method,
      url: `${config.baseUrl}/api2/json${apiPath}`,
      params,
      data,
      headers: requestHeaders,
      httpsAgent: createHttpsAgent(config),
      timeout: 20_000,
    });

    return response.data.data;
  } catch (error) {
    if (retry && config.authMode === 'password' && error.response?.status === 401) {
      authCache = { cacheKey: '', ticket: null, csrf: null, expiresAt: 0 };
      return proxmoxRequestWithConfig(config, method, apiPath, { params, data, headers, retry: false });
    }
    throw error;
  }
}

async function proxmoxRequest(method, apiPath, options) {
  const config = getEffectiveProxmoxConfig();
  if (!isConfigurationComplete(config)) {
    throw createHttpError(
      503,
      'SETUP_REQUIRED',
      'Il server Proxmox non e\' ancora configurato. Apri Impostazioni e completa il setup.'
    );
  }
  return proxmoxRequestWithConfig(config, method, apiPath, options);
}

async function testProxmoxConfiguration(config) {
  const version = await proxmoxRequestWithConfig(config, 'GET', '/version');
  let clusterStatus = [];
  let warning = null;

  try {
    clusterStatus = await proxmoxRequestWithConfig(config, 'GET', '/cluster/status');
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 403) {
      warning =
        'Il token API e\' valido, ma non ha accesso a /cluster/status. La configurazione puo\' comunque essere salvata. ' +
        'Per visualizzare dashboard e dettagli risorse servono permessi Proxmox adeguati, ad esempio VM.Audit e gli ACL corretti.';
    } else {
      throw error;
    }
  }

  return {
    version,
    cluster: Array.isArray(clusterStatus) ? clusterStatus : [],
    warning,
  };
}

function normalizeSubmittedConfig(input = {}) {
  const current = getEffectiveProxmoxConfig();
  const authMode = String(input.authMode || current.authMode || '').trim();
  const baseUrl = normalizeBaseUrl(input.baseUrl ?? current.baseUrl);
  const allowInsecureTls =
    typeof input.allowInsecureTls === 'boolean'
      ? input.allowInsecureTls
      : current.allowInsecureTls;
  const realm = String(input.realm ?? current.realm ?? 'pam').trim() || 'pam';
  const username = String(input.username ?? current.username ?? '').trim();
  const tokenId = String(input.tokenId ?? current.tokenId ?? '').trim();

  const passwordInput = typeof input.password === 'string' ? input.password : undefined;
  const tokenSecretInput = typeof input.tokenSecret === 'string' ? input.tokenSecret : undefined;

  return {
    baseUrl,
    allowInsecureTls,
    authMode,
    tokenId,
    tokenSecret: tokenSecretInput === undefined || tokenSecretInput === '' ? current.tokenSecret : tokenSecretInput,
    realm,
    username,
    password: passwordInput === undefined || passwordInput === '' ? current.password : passwordInput,
  };
}

function clearStoredCredentials() {
  const current = getEffectiveProxmoxConfig();
  const clearedConfig = {
    ...current,
    authMode: '',
    tokenId: '',
    tokenSecret: '',
    username: '',
    password: '',
  };

  persistSettings(clearedConfig);
  return clearedConfig;
}

function normalizeResource(item) {
  return {
    id: item.id,
    vmid: item.vmid,
    name: item.name || `${item.type}-${item.vmid}`,
    node: item.node,
    type: item.type,
    status: item.status || 'unknown',
    cpu: item.cpu ?? null,
    maxcpu: item.maxcpu ?? null,
    mem: item.mem ?? null,
    maxmem: item.maxmem ?? null,
    disk: item.disk ?? null,
    maxdisk: item.maxdisk ?? null,
    uptime: item.uptime ?? null,
    tags: item.tags || '',
    template: item.template || 0,
  };
}

function parseLxcNetworkConfig(config) {
  return Object.entries(config)
    .filter(([key]) => key.startsWith('net'))
    .map(([key, value]) => {
      const parts = Object.fromEntries(
        String(value)
          .split(',')
          .map((part) => {
            const [k, ...rest] = part.split('=');
            return [k, rest.join('=')];
          })
      );
      return {
        nic: key,
        name: parts.name || '',
        bridge: parts.bridge || '',
        hwaddr: parts.hwaddr || '',
        ip: parts.ip || '',
        gw: parts.gw || '',
        ip6: parts.ip6 || '',
        gw6: parts.gw6 || '',
        raw: value,
      };
    });
}

function parseVmNetworkConfig(config) {
  const ipConfigs = Object.fromEntries(
    Object.entries(config).filter(([key]) => key.startsWith('ipconfig'))
  );

  return Object.entries(config)
    .filter(([key]) => /^net\d+$/.test(key))
    .map(([key, value]) => {
      const index = key.replace('net', '');
      const ipcfg = ipConfigs[`ipconfig${index}`] || '';
      const nicParts = Object.fromEntries(
        String(value)
          .split(',')
          .map((part) => {
            const [k, ...rest] = part.split('=');
            return [k, rest.join('=')];
          })
      );
      const ipParts = Object.fromEntries(
        String(ipcfg)
          .split(',')
          .filter(Boolean)
          .map((part) => {
            const [k, ...rest] = part.split('=');
            return [k, rest.join('=')];
          })
      );

      return {
        nic: key,
        model: String(value).split(',')[0] || '',
        bridge: nicParts.bridge || '',
        mac: nicParts.macaddr || '',
        ip: ipParts.ip || '',
        gw: ipParts.gw || '',
        ip6: ipParts.ip6 || '',
        gw6: ipParts.gw6 || '',
        raw: value,
      };
    });
}

function safeConsoleUrl({ type, node, vmid }) {
  const config = getEffectiveProxmoxConfig();
  const encodedNode = encodeURIComponent(node);
  const encodedVmid = encodeURIComponent(String(vmid));
  if (type === 'qemu') {
    return `${config.baseUrl}/?console=kvm&novnc=1&vmid=${encodedVmid}&node=${encodedNode}`;
  }
  return `${config.baseUrl}/?console=lxc&xtermjs=1&vmid=${encodedVmid}&node=${encodedNode}`;
}

function requireAdminToken(req, res, next) {
  if (!APP_ADMIN_TOKEN) return next();
  if (req.get('x-admin-token') === APP_ADMIN_TOKEN) return next();
  return res.status(401).json({
    error: 'Token amministrativo non valido o mancante.',
    code: 'ADMIN_TOKEN_REQUIRED',
  });
}

function extractClientError(error, fallbackMessage) {
  if (error.status && error.code) {
    return {
      status: error.status,
      payload: {
        error: error.message,
        code: error.code,
        ...error.extra,
      },
    };
  }

  if (axios.isAxiosError(error)) {
    const status = error.response?.status || 502;
    const proxmoxMessage =
      error.response?.data?.errors
        ? Object.values(error.response.data.errors).join(', ')
        : error.response?.data?.message || error.response?.data?.error;

    return {
      status,
      payload: {
        error: proxmoxMessage || error.message || fallbackMessage,
        code: 'PROXMOX_REQUEST_FAILED',
        details: error.response?.data || null,
      },
    };
  }

  return {
    status: 500,
    payload: {
      error: fallbackMessage,
      code: 'UNEXPECTED_ERROR',
    },
  };
}

app.get('/api/health', (_req, res) => {
  const config = getEffectiveProxmoxConfig();
  res.json({
    ok: true,
    version: APP_VERSION,
    configured: isConfigurationComplete(config),
    proxmox: config.baseUrl || null,
    authMode: config.authMode || null,
    adminProtected: Boolean(APP_ADMIN_TOKEN),
    configUpdatedAt: persistedSettings.updatedAt || null,
  });
});

app.get('/api/settings', requireAdminToken, (_req, res) => {
  res.json(buildSettingsResponse());
});

app.post('/api/settings/test', requireAdminToken, async (req, res) => {
  try {
    const config = normalizeSubmittedConfig(req.body);
    validateProxmoxConfig(config);
    const result = await testProxmoxConfiguration(config);
    res.json({
      ok: true,
      result,
      settings: buildSettingsSnapshot(config),
      warning: result.warning || null,
    });
  } catch (error) {
    const { status, payload } = extractClientError(error, 'Connessione a Proxmox non riuscita.');
    res.status(status).json(payload);
  }
});

app.put('/api/settings', requireAdminToken, async (req, res) => {
  try {
    const config = normalizeSubmittedConfig(req.body);
    validateProxmoxConfig(config);
    const result = await testProxmoxConfiguration(config);
    persistSettings(config);

    res.json({
      ok: true,
      message: 'Configurazione Proxmox salvata correttamente.',
      warning: result.warning || null,
      ...buildSettingsResponse(),
    });
  } catch (error) {
    const { status, payload } = extractClientError(error, 'Salvataggio configurazione non riuscito.');
    res.status(status).json(payload);
  }
});

app.delete('/api/settings/credentials', requireAdminToken, (_req, res) => {
  try {
    clearStoredCredentials();
    res.json({
      ok: true,
      message: 'Credenziali Proxmox salvate rimosse correttamente.',
      ...buildSettingsResponse(),
    });
  } catch (error) {
    const { status, payload } = extractClientError(error, 'Cancellazione credenziali non riuscita.');
    res.status(status).json(payload);
  }
});

app.get('/api/resources', async (_req, res) => {
  try {
    const data = await proxmoxRequest('GET', '/cluster/resources', { params: { type: 'vm' } });
    const items = data
      .filter((item) => ['qemu', 'lxc'].includes(item.type) && !item.template)
      .map(normalizeResource)
      .sort((a, b) => a.name.localeCompare(b.name));

    res.json({ items });
  } catch (error) {
    const { status, payload } = extractClientError(error, 'Errore nel caricamento delle risorse.');
    res.status(status).json(payload);
  }
});

app.get('/api/resources/:type/:node/:vmid', async (req, res) => {
  const { type, node, vmid } = req.params;
  if (!['qemu', 'lxc'].includes(type)) {
    return res.status(400).json({ error: 'Tipo non valido', code: 'INVALID_RESOURCE_TYPE' });
  }

  try {
    const [status, config] = await Promise.all([
      proxmoxRequest('GET', `/nodes/${node}/${type}/${vmid}/status/current`),
      proxmoxRequest('GET', `/nodes/${node}/${type}/${vmid}/config`),
    ]);

    let runtimeInterfaces = null;
    try {
      if (type === 'qemu') {
        runtimeInterfaces = await proxmoxRequest('GET', `/nodes/${node}/qemu/${vmid}/agent/network-get-interfaces`);
      } else {
        runtimeInterfaces = await proxmoxRequest('GET', `/nodes/${node}/lxc/${vmid}/interfaces`);
      }
    } catch (_error) {
      runtimeInterfaces = null;
    }

    const parsedNetwork = type === 'qemu' ? parseVmNetworkConfig(config) : parseLxcNetworkConfig(config);

    res.json({
      info: {
        vmid,
        node,
        type,
        name: config.hostname || config.name || `${type}-${vmid}`,
        status: status.status || 'unknown',
        cpu: status.cpu ?? null,
        cpus: status.cpus ?? status.maxcpu ?? null,
        mem: status.mem ?? null,
        maxmem: status.maxmem ?? null,
        disk: status.disk ?? null,
        maxdisk: status.maxdisk ?? null,
        uptime: status.uptime ?? null,
        ostype: config.ostype || null,
        description: config.description || '',
        consoleUrl: safeConsoleUrl({ type, node, vmid }),
      },
      network: {
        config: parsedNetwork,
        runtime: runtimeInterfaces,
      },
    });
  } catch (error) {
    const { status, payload } = extractClientError(error, 'Errore nel caricamento del dettaglio risorsa.');
    res.status(status).json(payload);
  }
});

app.post('/api/resources/:type/:node/:vmid/:action', async (req, res) => {
  const { type, node, vmid, action } = req.params;
  const allowedActions = new Set(['start', 'shutdown', 'reboot', 'stop']);
  if (!['qemu', 'lxc'].includes(type)) {
    return res.status(400).json({ error: 'Tipo non valido', code: 'INVALID_RESOURCE_TYPE' });
  }
  if (!allowedActions.has(action)) {
    return res.status(400).json({ error: 'Azione non valida', code: 'INVALID_RESOURCE_ACTION' });
  }

  try {
    const result = await proxmoxRequest('POST', `/nodes/${node}/${type}/${vmid}/status/${action}`);
    res.json({ ok: true, upid: result });
  } catch (error) {
    const { status, payload } = extractClientError(error, 'Operazione non riuscita.');
    res.status(status).json(payload);
  }
});

if (fs.existsSync(CLIENT_DIST_DIR)) {
  app.use(express.static(CLIENT_DIST_DIR));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(CLIENT_DIST_DIR, 'index.html'));
  });
}

app.listen(APP_PORT, () => {
  console.log(`Proxmox Mobile WebApp ${APP_VERSION} in ascolto su ${APP_BASE_URL}`);
  console.log(`Configurazione runtime: ${APP_CONFIG_PATH}`);
});
