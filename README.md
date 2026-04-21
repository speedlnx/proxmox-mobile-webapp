# Proxmox Mobile WebApp

Web app mobile-first per accedere rapidamente a Proxmox VE da smartphone.

## Funzioni incluse

- lista VM e container LXC con stato
- avvio, spegnimento, stop e riavvio
- vista rapida CPU / RAM / disco
- vista dettagliata della configurazione rete
- pulsante rapido per aprire la console nativa di Proxmox
- refresh automatico ogni 15 secondi
- backend dedicato per evitare di esporre le credenziali Proxmox nel browser

## Stack

- frontend: React + Vite
- backend: Node.js + Express

## Requisiti

- Node.js 20+
- accesso API a Proxmox VE

## Installazione

```bash
cp .env.example .env
npm install
npm run dev
```

Sviluppo:

- frontend: http://localhost:5173
- backend: http://localhost:8787

Build produzione:

```bash
npm run build
npm run start
```

## Configurazione consigliata

Per sicurezza è preferibile usare un token API con permessi minimi necessari.

Permessi suggeriti per il token utente dedicato:

- VM.Audit
- VM.PowerMgmt
- VM.Console
- Datastore.Audit
- Sys.Audit

Assegna i permessi al path corretto in base a cluster, pool o singoli nodi/VM.

## Note sulla console

Questa versione MVP apre la console nativa Proxmox in una nuova scheda. È la scelta più semplice e robusta da smartphone.

Se vuoi una **console incorporata direttamente nell'app** si può evolvere il progetto aggiungendo:

- bridge noVNC per QEMU
- bridge xterm.js per LXC
- websocket proxy server-side
- SSO o session broker temporaneo

## Dati di rete

La vista rete tenta questo ordine:

1. dati runtime reali via QEMU Guest Agent per le VM
2. endpoint interfacce LXC per i container
3. fallback alla configurazione statica di Proxmox

Per vedere IP reali aggiornati delle VM è consigliato installare e abilitare il **QEMU Guest Agent**.

## Reverse proxy / pubblicazione

Per pubblicarla in modo sicuro dietro nginx o Nginx Proxy Manager:

- esponi solo la web app, non direttamente il backend su internet senza protezioni
- limita gli IP ammessi o aggiungi autenticazione extra
- usa HTTPS valido
- valuta VPN o accesso Zero Trust

## Possibili evoluzioni

- login utente locale nell'app
- filtri per nodo, tag, pool
- task log e progress UPID
- metriche storiche
- notifiche push
- dark/light theme
- installazione come PWA
