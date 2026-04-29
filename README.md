# Proxmox Mobile WebApp

Versione corrente: `0.7.0`

Proxmox Mobile WebApp e' una webapp amministrativa mobile-first per Proxmox VE. Permette di accedere in modo sicuro a VM QEMU, container LXC e storage del cluster tramite un backend Node.js che centralizza autenticazione Proxmox, configurazione persistente, controllo accessi applicativo e API operative pensate per uso da smartphone, tablet o browser desktop.

## Descrizione del software

Il software non e' solo una dashboard di lettura: oggi e' una piccola console operativa per homelab e ambienti self-hosted, con:

- autenticazione locale all'app con utenti, ruoli e sessioni protette
- configurazione del server Proxmox interamente dal backend
- consultazione di VM, container e storage
- riepilogo dello stato del cluster e dei nodi hypervisor
- azioni rapide su guest
- accesso alla console web nativa di Proxmox
- gestione centralizzata delle credenziali Proxmox senza esporle al browser
- installazione come web app su smartphone e desktop compatibili
- polling dinamico in background con aggiornamento live di CPU, RAM e disco
- vista compatta opzionale per mostrare due guest per riga

L'architettura e' pensata per essere pubblicata come servizio singolo dietro reverse proxy, mantenendo il frontend React e il backend Express nello stesso progetto.

## Cosa introduce questa release

- autenticazione applicativa locale con bootstrap del primo amministratore
- login/logout con sessioni su cookie `httpOnly`
- gestione utenti con ruoli `admin`, `operator` e `viewer`
- protezione delle API operative backend tramite sessione autenticata
- pannello admin per creare, aggiornare, disabilitare ed eliminare utenti
- configurazione Proxmox persistente dal backend
- gestione credenziali Proxmox con supporto a token API o username/password
- warning piu' chiari per token API validi ma con privilegi insufficienti
- diagnostica piu' esplicita quando il token non restituisce topologia CPU o metriche nodo complete
- filtro dashboard per guest accesi, spenti o locked
- modalita' compatta dashboard con 2 schede per riga
- visualizzazione note delle VM e degli LXC
- azioni aggiuntive `reset` e `unlock`
- nuova sezione per lo stato degli storage
- aggiornamento dati in background senza spostamenti del layout durante il polling
- aggiornamento live piu' frequente delle metriche guest e overview
- supporto installazione come web app/PWA con manifest, icone e service worker
- riepilogo cluster/hypervisor con CPU, core, thread, RAM, swap, disco e load

## Architettura

Il repository e' una monorepo Node.js con due workspace:

- `client/`: frontend React + Vite
- `server/`: backend Express che espone API applicative, autentica gli utenti locali, dialoga con Proxmox VE e serve la build frontend in produzione

In produzione il backend puo' servire direttamente `client/dist`, quindi e' possibile distribuire l'app come singolo servizio Node.js dietro Nginx, Traefik o altri reverse proxy.

## Funzionalita' principali

### Accesso all'app

- setup iniziale guidato del primo amministratore
- login applicativo con utenti locali
- ruoli supportati:
  - `admin`
  - `operator`
  - `viewer`
- logout e sessioni protette tramite cookie `httpOnly`
- pannello dedicato alla gestione utenti applicativi

Ruoli applicativi:

- `admin`: accesso completo all'app, gestione utenti e impostazioni backend
- `operator`: accesso operativo a dashboard, dettagli, storage e azioni guest
- `viewer`: accesso in sola lettura senza permessi di `start`, `shutdown`, `reboot`, `reset` o `unlock`

### Operativita' Proxmox

- elenco di VM QEMU e container LXC non template
- ricerca per nome, nodo o VMID
- filtro per tipo risorsa
- filtro per stato:
  - accesi
  - spenti
  - locked
- switch di visualizzazione:
  - normale
  - compatta con 2 guest per riga
- refresh automatico dashboard ogni 5 secondi
- visualizzazione stato lock del guest
- dettaglio risorsa con:
  - CPU
  - RAM
  - disco
  - uptime
  - OS type
  - rete
  - note/description
- pulsanti azione:
  - `start`
  - `shutdown`
  - `reboot`
  - `reset`
  - `unlock` dove consentito dall'API Proxmox e dai permessi disponibili
- barre orizzontali con percentuale per:
  - CPU
  - RAM
  - disco
- aggiornamento live delle barre e dei valori senza ricaricare la pagina
- apertura della console web nativa di Proxmox in una nuova scheda

### Overview Cluster

- riepilogo aggregato di cluster e hypervisor
- CPU logiche totali
- socket, core e thread
- RAM totale e disponibile
- swap totale e disponibile
- disco totale e disponibile
- load average per nodo
- dettaglio sintetico per singolo nodo
- diagnostica visiva quando l'API del token non restituisce topologia CPU, swap o load

### Storage

- vista dedicata degli storage del cluster
- stato storage
- utilizzo percentuale
- barra orizzontale di utilizzo
- spazio usato, libero e totale
- tipo plugin e indicazione shared/non shared

### Web App

- manifest web app
- service worker per asset statici e app shell
- icone installabili
- supporto installazione in modalita' standalone su browser compatibili

### Configurazione backend

- pannello `Impostazioni` accessibile agli admin
- configurazione URL Proxmox dal backend
- supporto a due modalita' di autenticazione Proxmox:
  - token API
  - username/password
- test connessione prima del salvataggio
- salvataggio persistente della configurazione lato server
- cancellazione delle credenziali Proxmox salvate
- supporto opzionale a `APP_ADMIN_TOKEN` come protezione aggiuntiva per le API sensibili

## Endpoint API

### Autenticazione applicativa

- `GET /api/auth/status`
- `POST /api/auth/setup`
- `POST /api/auth/login`
- `POST /api/auth/logout`

### Operativita'

- `GET /api/health`
- `GET /api/resources`
- `GET /api/resources/:type/:node/:vmid`
- `POST /api/resources/:type/:node/:vmid/:action`
- `GET /api/storages`
- `GET /api/overview`

### Amministrazione backend

- `GET /api/settings`
- `POST /api/settings/test`
- `PUT /api/settings`
- `DELETE /api/settings/credentials`
- `GET /api/users`
- `POST /api/users`
- `PUT /api/users/:userId`
- `DELETE /api/users/:userId`

## Requisiti

- Node.js 20+
- accesso di rete dal backend verso Proxmox VE
- credenziali Proxmox oppure token API con privilegi adeguati
- per metriche nodo complete, il token deve poter leggere anche gli endpoint sotto `/nodes/{node}`

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
| `APP_ADMIN_TOKEN` | Token opzionale per proteggere ulteriormente la configurazione backend |
| `APP_CONFIG_PATH` | Path del file JSON di configurazione persistente |
| `APP_USERS_PATH` | Path del file JSON degli utenti applicativi |
| `CORS_ORIGIN` | Origin consentita se il frontend gira su dominio separato |
| `PROXMOX_BASE_URL` | Default iniziale Proxmox, usato come fallback prima del setup |
| `PROXMOX_TOKEN_ID` | Default iniziale token ID |
| `PROXMOX_TOKEN_SECRET` | Default iniziale token secret |
| `PROXMOX_REALM` | Default realm per login password |
| `PROXMOX_USERNAME` | Default username |
| `PROXMOX_PASSWORD` | Default password |
| `ALLOW_INSECURE_TLS` | Se `true`, accetta certificati self-signed verso Proxmox |

Nota importante:

- le variabili `PROXMOX_*` fungono da configurazione iniziale o fallback
- una volta salvata la configurazione dal pannello backend, il server usa il file persistito
- gli utenti dell'app vengono memorizzati separatamente dal file di configurazione Proxmox

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
Il dev server Vite e il backend sono configurati per ascoltare su tutte le interfacce, quindi l'app puo' essere testata anche da altri dispositivi della LAN.

## Avvio in produzione

Build frontend:

```bash
npm run build
```

Avvio backend:

```bash
npm run start
```

In produzione il backend serve direttamente la build frontend.

## Deploy consigliato

Per un deploy piu' sicuro:

- esporre l'app dietro Nginx, Traefik o Nginx Proxy Manager
- usare HTTPS valido lato pubblico
- impostare `APP_ADMIN_TOKEN`
- proteggere l'accesso amministrativo con VPN, IP allowlist o Zero Trust
- mantenere `ALLOW_INSECURE_TLS=false` in produzione, salvo ambienti controllati
- conservare fuori dal versionamento sia il file di configurazione Proxmox sia il file utenti

## Permessi Proxmox suggeriti

Per un token dedicato o un utente tecnico:

- `VM.Audit`
- `VM.PowerMgmt`
- `VM.Console`
- `Datastore.Audit`
- `Sys.Audit`

Applicare i permessi al path corretto del proprio cluster, nodo, pool o risorsa.

Nota sui token API:

- se VM, storage e parte della dashboard funzionano ma `socket`, `core`, `swap` o `load` restano mancanti, il token spesso non vede completamente gli endpoint nodo come `/nodes/{node}/status/current` o `/nodes/{node}/hardware/cpuinfo`
- in questi casi l'app usa fallback dove possibile e mostra una diagnostica esplicita nell'overview

## Struttura repository

```text
.
|-- client/
|   |-- src/
|   |   |-- components/
|   |   `-- pages/
|-- server/
|   |-- data/
|   |-- index.js
|   `-- package.json
|-- package.json
|-- package-lock.json
|-- README.md
`-- .env.example
```

## Limitazioni attuali

- la console resta quella nativa Proxmox aperta in una nuova scheda
- i dettagli runtime di rete per le VM dipendono dal QEMU Guest Agent
- l'azione `unlock` dipende dai permessi effettivi disponibili e dal supporto dell'API Proxmox per il tipo guest
- non sono ancora presenti test automatici o pipeline CI/CD

## Roadmap ragionata

- aggiungere test backend e frontend
- introdurre logging strutturato e audit trail amministrativo
- gestire polling degli UPID e stato task Proxmox
- aggiungere supporto PWA e notifiche
- valutare cifratura at-rest di configurazione e archivio utenti
