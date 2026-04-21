# Proxmox Mobile WebApp

Versione proposta: `0.2.0`

Applicazione web mobile-first per consultare e gestire VM QEMU e container LXC su Proxmox VE da smartphone, senza esporre direttamente le credenziali del cluster al browser.

## Cosa fa il progetto

Il repository contiene una piccola monorepo Node.js con:

- `client/`: frontend React + Vite ottimizzato per uso mobile
- `server/`: backend Express che interroga le API di Proxmox VE e serve anche la build del client in produzione

Il backend gestisce l'autenticazione verso Proxmox in due modalita':

- token API Proxmox tramite `PVEAPIToken`
- login username/password con cache di `ticket` e token CSRF

## Funzionalita' implementate

- dashboard con elenco di VM e container LXC non template
- ordinamento alfabetico delle risorse
- filtro per tipo risorsa: tutte, VM QEMU, container LXC
- ricerca per nome, nodo o VMID
- refresh automatico della dashboard ogni 15 secondi
- stato operativo della risorsa con badge visuale
- indicatori rapidi di CPU, RAM e disco
- azioni rapide dalla dashboard:
  - `start`
  - `shutdown`
  - `reboot`
- pagina di dettaglio per singola risorsa
- visualizzazione dettagliata di:
  - nodo
  - VMID
  - CPU e numero vCPU
  - memoria usata/totale
  - disco usato/totale
  - uptime
  - tipo sistema operativo
- lettura configurazione rete da Proxmox
- tentativo di lettura dello stato runtime delle interfacce:
  - VM QEMU: endpoint `agent/network-get-interfaces`
  - LXC: endpoint `interfaces`
- pulsante per apertura della console nativa Proxmox in nuova scheda
- fallback lato server per servire il frontend buildato in produzione

## Funzionalita' non presenti al momento

- autenticazione utenti applicativa separata da Proxmox
- multiutente, ruoli o audit interno
- console incorporata nell'interfaccia
- cronologia task Proxmox e polling degli UPID
- metriche storiche o grafici
- test automatici
- pipeline CI/CD

## Architettura tecnica

### Frontend

Stack:

- React 18
- React Router 6
- Vite 6

Pagine principali:

- `DashboardPage`: elenco risorse, ricerca, filtro, refresh periodico, azioni rapide
- `DetailsPage`: metriche, dati rete e link alla console

Componenti:

- `ResourceCard`: card sintetica della risorsa
- `StatusBadge`: badge di stato (`running`, `stopped`, `paused`)

### Backend

Stack:

- Node.js
- Express
- Axios
- dotenv
- cors

Responsabilita' del server:

- autenticarsi verso Proxmox VE
- chiamare le API `/api2/json`
- normalizzare i dati per il frontend
- eseguire azioni power management sulle risorse
- proteggere browser e UI dalle credenziali dirette di Proxmox
- servire gli asset statici del frontend in produzione

## Endpoint esposti dall'app

### `GET /api/health`

Restituisce stato base dell'app, URL Proxmox configurato e modalita' di autenticazione attiva.

### `GET /api/resources`

Restituisce l'elenco delle risorse di tipo `qemu` e `lxc`, escludendo i template.

### `GET /api/resources/:type/:node/:vmid`

Restituisce:

- stato corrente della risorsa
- configurazione della risorsa
- dati di rete parsati
- eventuali interfacce runtime
- URL sicuro per aprire la console Proxmox

### `POST /api/resources/:type/:node/:vmid/:action`

Azioni consentite:

- `start`
- `shutdown`
- `reboot`
- `stop`

Nota: il frontend al momento usa `start`, `shutdown` e `reboot`; il server supporta anche `stop`.

## Requisiti

- Node.js 20 o superiore
- accesso a un'istanza Proxmox VE raggiungibile dal server
- credenziali Proxmox oppure token API con permessi adeguati

## Configurazione ambiente

Copiare il file di esempio:

```bash
cp .env.example .env
```

Variabili supportate dal backend:

| Variabile | Obbligatoria | Descrizione |
| --- | --- | --- |
| `PROXMOX_BASE_URL` | si | URL base Proxmox, ad esempio `https://pve.example.com:8006` |
| `PROXMOX_TOKEN_ID` | no | ID token API Proxmox |
| `PROXMOX_TOKEN_SECRET` | no | Secret del token API |
| `PROXMOX_REALM` | no | Realm usato con login classico, default `pam` |
| `PROXMOX_USERNAME` | no | Username Proxmox, con o senza `@realm` |
| `PROXMOX_PASSWORD` | no | Password Proxmox |
| `PORT` | no | Porta del backend, default `8787` |
| `ALLOW_INSECURE_TLS` | no | Se `true`, disabilita la verifica del certificato TLS del server Proxmox |
| `APP_BASE_URL` | no | URL pubblico dell'app, usato per il log di startup |

Regola di autenticazione:

- usare `PROXMOX_TOKEN_ID` e `PROXMOX_TOKEN_SECRET` per il metodo consigliato
- in alternativa usare `PROXMOX_USERNAME` e `PROXMOX_PASSWORD`

## Avvio in sviluppo

Installazione dipendenze:

```bash
npm install
```

Avvio client + server:

```bash
npm run dev
```

URL locali:

- frontend Vite: `http://localhost:5173`
- backend Express: `http://localhost:8787`

In sviluppo Vite proxya le richieste `/api` al backend locale.

## Build e avvio in produzione

Build frontend:

```bash
npm run build
```

Avvio server:

```bash
npm run start
```

Quando `client/dist` esiste, il backend serve direttamente l'app React buildata.

## Sicurezza e permessi consigliati

Uso consigliato: token API dedicato con privilegi minimi.

Permessi tipicamente utili:

- `VM.Audit`
- `VM.PowerMgmt`
- `VM.Console`
- `Datastore.Audit`
- `Sys.Audit`

Applicare i permessi al path corretto in base al proprio cluster, pool o nodo.

Attenzione:

- `ALLOW_INSECURE_TLS=true` e' comodo in laboratorio ma non e' consigliato in produzione
- l'app non implementa autenticazione aggiuntiva: se pubblicata su Internet va protetta con reverse proxy, VPN o accesso Zero Trust

## Limitazioni operative osservate nel codice

- i dettagli runtime di rete per le VM dipendono dal QEMU Guest Agent
- la console e' aperta nella UI nativa di Proxmox, non incorporata nell'app
- la dashboard aggiorna periodicamente ma la pagina dettaglio non esegue refresh automatico
- il frontend usa `window.confirm` e `window.alert`, quindi l'esperienza e' volutamente semplice e diretta

## Struttura del repository

```text
.
|-- client/
|   |-- src/
|   |   |-- components/
|   |   |-- pages/
|   |   |-- App.jsx
|   |   |-- main.jsx
|   |   `-- styles.css
|   |-- index.html
|   |-- package.json
|   `-- vite.config.js
|-- server/
|   |-- index.js
|   `-- package.json
|-- package.json
|-- README.md
`-- LICENSE
```

## Versione assegnata

Ho assegnato la versione `0.2.0` per rappresentare uno stato gia' utilizzabile e documentato, ma ancora chiaramente pre-1.0:

- esiste una feature set coerente end-to-end
- il progetto e' pubblicabile e usabile in LAN/VPN
- mancano ancora test, hardening e alcune rifiniture da release stabile `1.0.0`

## Stato attuale del progetto

Il progetto e' un MVP funzionante per amministrazione rapida da mobile di risorse Proxmox, particolarmente adatto a uso personale, homelab o accesso operativo veloce dietro rete fidata.

Per un rilascio piu' maturo i prossimi passi consigliati sarebbero:

- introdurre test minimi su backend e frontend
- gestire task UPID e feedback asincrono delle azioni
- migliorare autenticazione e protezione dell'accesso pubblico
- aggiungere refresh opzionale anche sulla vista dettaglio
