# Proxmox Mobile WebApp

Versione corrente: `0.3.0`

Applicazione web mobile-first per amministrare VM QEMU e container LXC su Proxmox VE, con backend Node.js che gestisce autenticazione, configurazione persistente del target Proxmox e API operative per dashboard e dettaglio risorsa.

## Cosa e' cambiato in questa release

Questa versione porta il progetto molto piu' vicino a un deploy reale:

- configurazione del server Proxmox interamente dal backend tramite pagina `Impostazioni`
- persistenza della configurazione su file server-side
- supporto a test connessione prima del salvataggio
- protezione opzionale del pannello impostazioni con `APP_ADMIN_TOKEN`
- validazione piu' robusta della configurazione
- headers di sicurezza HTTP di base
- gestione errori lato backend piu' coerente
- setup guidato quando il backend non e' ancora configurato

## Architettura

Il repository e' una monorepo Node.js con due workspace:

- `client/`: frontend React + Vite
- `server/`: backend Express che parla con Proxmox VE e serve la build del frontend in produzione

In produzione il backend puo' servire direttamente `client/dist`, quindi e' possibile distribuire un solo servizio Node.js dietro reverse proxy.

## Funzionalita' principali

### Operativita' Proxmox

- elenco VM e container LXC non template
- ordinamento alfabetico
- ricerca per nome, nodo o VMID
- filtro per tipo risorsa
- refresh automatico dashboard ogni 15 secondi
- azioni rapide `start`, `shutdown`, `reboot`
- dettaglio risorsa con CPU, RAM, disco, uptime, OS type e rete
- apertura console Proxmox in nuova scheda

### Configurazione backend

- pannello `Impostazioni` raggiungibile dall'app
- configurazione URL Proxmox dal backend
- supporto a due modalita' di autenticazione:
  - token API
  - username/password
- possibilita' di mantenere secret o password gia' salvati senza reinserirli
- test di connessione verso Proxmox prima del salvataggio definitivo
- salvataggio della configurazione in `server/data/app-config.json` o nel path definito da `APP_CONFIG_PATH`
- possibilita' di bloccare le API di configurazione con `APP_ADMIN_TOKEN`

## Endpoint API

### Pubblici applicativi

- `GET /api/health`
- `GET /api/resources`
- `GET /api/resources/:type/:node/:vmid`
- `POST /api/resources/:type/:node/:vmid/:action`

### Amministrazione backend

- `GET /api/settings`
- `POST /api/settings/test`
- `PUT /api/settings`

Se `APP_ADMIN_TOKEN` e' valorizzato, questi endpoint richiedono l'header `x-admin-token`.

## Requisiti

- Node.js 20+
- accesso di rete dal backend verso Proxmox VE
- credenziali Proxmox o token API con privilegi adeguati

## Configurazione ambiente

File di esempio:

```bash
cp .env.example .env
```

Variabili supportate:

| Variabile | Descrizione |
| --- | --- |
| `PORT` | Porta del backend, default `8787` |
| `APP_BASE_URL` | URL pubblico dell'app per logging e deploy |
| `APP_ADMIN_TOKEN` | Token opzionale per proteggere la configurazione backend |
| `APP_CONFIG_PATH` | Path del file JSON di configurazione persistente |
| `CORS_ORIGIN` | Origin consentita se il frontend gira su dominio separato |
| `PROXMOX_BASE_URL` | Default iniziale Proxmox, usato solo come fallback |
| `PROXMOX_TOKEN_ID` | Default iniziale token ID |
| `PROXMOX_TOKEN_SECRET` | Default iniziale token secret |
| `PROXMOX_REALM` | Default realm per login password |
| `PROXMOX_USERNAME` | Default username |
| `PROXMOX_PASSWORD` | Default password |
| `ALLOW_INSECURE_TLS` | Se `true`, accetta certificati self-signed verso Proxmox |

Nota importante:

- le variabili `PROXMOX_*` fungono da configurazione iniziale o fallback
- una volta salvata la configurazione dal pannello backend, il server usa il file persistito

## Avvio in sviluppo

Installazione dipendenze:

```bash
npm install
```

Avvio client e server:

```bash
npm run dev
```

URL locali:

- frontend: `http://localhost:5173`
- backend: `http://localhost:8787`

Durante lo sviluppo Vite fa proxy delle richieste `/api` verso il backend.

## Deploy consigliato

Per un deploy piu' sicuro:

- esporre l'app dietro Nginx, Traefik o Nginx Proxy Manager
- usare HTTPS valido lato pubblico
- impostare `APP_ADMIN_TOKEN`
- limitare l'accesso di amministrazione tramite VPN, IP allowlist o Zero Trust
- mantenere `ALLOW_INSECURE_TLS=false` in produzione, salvo ambienti controllati
- conservare il file di configurazione persistente fuori dal versionamento

## Permessi Proxmox suggeriti

Per un token dedicato o un utente tecnico:

- `VM.Audit`
- `VM.PowerMgmt`
- `VM.Console`
- `Datastore.Audit`
- `Sys.Audit`

Applicare i permessi al path corretto del proprio cluster, nodo, pool o risorsa.

## Struttura repository

```text
.
|-- client/
|-- server/
|   |-- data/
|   |-- index.js
|   `-- package.json
|-- package.json
|-- README.md
`-- .env.example
```

## Limitazioni attuali

- la console resta quella nativa Proxmox aperta in una nuova scheda
- i dettagli runtime di rete per le VM dipendono dal QEMU Guest Agent
- non sono ancora presenti test automatici o pipeline CI/CD
- non esiste un sistema multiutente interno all'app

## Roadmap ragionata

Per arrivare a una release ancora piu' forte sul piano operativo:

- aggiungere test backend e frontend
- introdurre logging strutturato e audit trail amministrativo
- gestire polling degli UPID e stato task Proxmox
- aggiungere supporto PWA e notifiche
- valutare cifratura at-rest del file di configurazione
