import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors());
app.use(express.json());

const PROXMOX_BASE_URL = process.env.PROXMOX_BASE_URL || 'https://proxmox.example.com:8006';
const PROXMOX_TOKEN_ID = process.env.PROXMOX_TOKEN_ID || '';
const PROXMOX_TOKEN_SECRET = process.env.PROXMOX_TOKEN_SECRET || '';
const PROXMOX_REALM = process.env.PROXMOX_REALM || 'pam';
const PROXMOX_USERNAME = process.env.PROXMOX_USERNAME || '';
const PROXMOX_PASSWORD = process.env.PROXMOX_PASSWORD || '';
const APP_PORT = Number(process.env.PORT || 8787);
const ALLOW_INSECURE_TLS = String(process.env.ALLOW_INSECURE_TLS || 'true') === 'true';
const APP_BASE_URL = process.env.APP_BASE_URL || `http://localhost:${APP_PORT}`;
const CLIENT_DIST_DIR = path.resolve(__dirname, '../client/dist');

const httpsAgent = new (await import('https')).Agent({
  rejectUnauthorized: !ALLOW_INSECURE_TLS,
});

let authCache = {
  ticket: null,
  csrf: null,
  expiresAt: 0,
};

function hasApiToken() {
  return Boolean(PROXMOX_TOKEN_ID && PROXMOX_TOKEN_SECRET);
}

async function loginWithPassword() {
  if (!PROXMOX_USERNAME || !PROXMOX_PASSWORD) {
    throw new Error('Configurazione mancante: impostare PROXMOX_USERNAME e PROXMOX_PASSWORD oppure token API.');
  }

  const now = Date.now();
  if (authCache.ticket && authCache.expiresAt > now + 60_000) {
    return authCache;
  }

  const username = PROXMOX_USERNAME.includes('@') ? PROXMOX_USERNAME : `${PROXMOX_USERNAME}@${PROXMOX_REALM}`;
  const url = `${PROXMOX_BASE_URL}/api2/json/access/ticket`;
  const params = new URLSearchParams();
  params.set('username', username);
  params.set('password', PROXMOX_PASSWORD);

  const { data } = await axios.post(url, params.toString(), {
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    httpsAgent,
  });

  authCache = {
    ticket: data.data.ticket,
    csrf: data.data.CSRFPreventionToken,
    expiresAt: Date.now() + 2 * 60 * 60 * 1000,
  };

  return authCache;
}

async function proxmoxRequest(method, apiPath, { params, data, headers = {} } = {}) {
  const url = `${PROXMOX_BASE_URL}/api2/json${apiPath}`;
  const requestHeaders = { ...headers };

  if (hasApiToken()) {
    requestHeaders.Authorization = `PVEAPIToken=${PROXMOX_TOKEN_ID}=${PROXMOX_TOKEN_SECRET}`;
  } else {
    const auth = await loginWithPassword();
    requestHeaders.Cookie = `PVEAuthCookie=${auth.ticket}`;
    if (method !== 'GET') {
      requestHeaders.CSRFPreventionToken = auth.csrf;
    }
  }

  const response = await axios({
    method,
    url,
    params,
    data,
    headers: requestHeaders,
    httpsAgent,
  });

  return response.data.data;
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
  const encodedNode = encodeURIComponent(node);
  const encodedVmid = encodeURIComponent(String(vmid));
  if (type === 'qemu') {
    return `${PROXMOX_BASE_URL}/?console=kvm&novnc=1&vmid=${encodedVmid}&node=${encodedNode}`;
  }
  return `${PROXMOX_BASE_URL}/?console=lxc&xtermjs=1&vmid=${encodedVmid}&node=${encodedNode}`;
}

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, proxmox: PROXMOX_BASE_URL, authMode: hasApiToken() ? 'api-token' : 'password' });
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
    res.status(500).json({ error: error.message, details: error.response?.data || null });
  }
});

app.get('/api/resources/:type/:node/:vmid', async (req, res) => {
  const { type, node, vmid } = req.params;
  if (!['qemu', 'lxc'].includes(type)) {
    return res.status(400).json({ error: 'Tipo non valido' });
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
      raw: {
        status,
        config,
      },
    });
  } catch (error) {
    res.status(500).json({ error: error.message, details: error.response?.data || null });
  }
});

app.post('/api/resources/:type/:node/:vmid/:action', async (req, res) => {
  const { type, node, vmid, action } = req.params;
  const allowedActions = new Set(['start', 'shutdown', 'reboot', 'stop']);
  if (!['qemu', 'lxc'].includes(type)) {
    return res.status(400).json({ error: 'Tipo non valido' });
  }
  if (!allowedActions.has(action)) {
    return res.status(400).json({ error: 'Azione non valida' });
  }

  try {
    const result = await proxmoxRequest('POST', `/nodes/${node}/${type}/${vmid}/status/${action}`);
    res.json({ ok: true, upid: result });
  } catch (error) {
    res.status(500).json({ error: error.message, details: error.response?.data || null });
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
  console.log(`Proxmox Mobile WebApp in ascolto su ${APP_BASE_URL}`);
});
