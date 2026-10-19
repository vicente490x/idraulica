# Hydro · Dashboard ufficio

Client Next.js / TypeScript collegato alle API Django, con Tailwind CSS, TanStack
Query, dialog accessibili Radix UI e calendario FullCalendar 6 con Luxon.
Tutti i dati operativi arrivano dal backend. Nessuna fixture è inclusa nell'app.

## Avvio locale

Richiede Node.js 22+ (verificato con 24.15), Python e backend configurato come
descritto nel README della radice. Avviare Django su `127.0.0.1:8000`, poi:

```powershell
cd apps/web
npm.cmd ci
Copy-Item .env.example .env.local
npm.cmd run dev
```

Aprire **http://127.0.0.1:3000/login**. Usare un account amministratore o ufficio
creato nel proprio database: nessuna password predefinita. Un amministratore può
creare i tecnici dalla schermata Tecnici; un operatore può gestire clienti e lavori.

Il browser chiama `/api/v1/` sullo stesso host di Next.js, che inoltra a Django.
`BACKEND_URL` è una variabile server, non `NEXT_PUBLIC_*`; non contiene credenziali.
In Django includere l'origine effettiva in `CSRF_TRUSTED_ORIGINS`, per esempio
`http://127.0.0.1:3000`. Conservare i cookie con stesso hostname durante l'utilizzo.
Gli URL con slash finale vengono preservati per evitare redirect dei POST.

Per build e avvio del server locale ottimizzato:

```powershell
npm.cmd run typecheck
npm.cmd run build
npm.cmd run start
```

`BACKEND_URL` delle rewrites è risolto in fase di build: ricostruire quando cambia
per `next start`. Per sviluppo basta riavviare. Nessuna pubblicazione automatica;
il server locale non sostituisce proxy HTTPS e configurazione di produzione.

## Funzioni disponibili

- Login web, logout, recupero/reset password; cookie sessione HttpOnly e CSRF.
  Nessun token o dato operativo salvato in localStorage.
- Panoramica: appuntamenti, lavori in corso/completati/urgenti, tecnici disponibili,
  sospesi e ultimi cambi di stato. Riepilogo aggiornato ogni 30 secondi.
- Clienti: ricerca/paginazione/filtro città, creazione/modifica, scheda contatti e
  storico interventi, eliminazione confermata e protetta se ci sono lavori collegati.
- Interventi: ricerca/filtri data-stato-tecnico, dettaglio, creazione/modifica,
  assegnazione, priorità, note e cambi di stato confermati; storico persistente.
- Creazione rapida: cliente esistente con indirizzo precompilato oppure nuova
  anagrafica durante la chiamata. Il nuovo cliente viene salvato una sola volta;
  se l'appuntamento incontra un conflitto rimane selezionato per il nuovo tentativo.
- Calendario giorno/settimana/mese, filtri, apertura eventi con mouse/Invio,
  selezione orario, drag & drop e modifica durata. Backend valida e può rifiutare
  con 409: l'evento torna nella posizione precedente. Alternativa accessibile:
  modifica data e ora dal dettaglio, senza richiedere il trascinamento.
- Tecnici: disponibilità attuale, lavori/ore pianificati giorno/settimana,
  agenda individuale e intervalli di indisponibilità con conferma di rimozione.
  La creazione di un'indisponibilità sovrapposta a lavori attivi viene rifiutata.

Timezone caricata dalla configurazione aziendale (predefinita Europe/Rome).
Input locali convertiti in UTC, giorni calendario inclusivi degli interventi che
attraversano mezzanotte, cambio d'ora gestito da Luxon. Input ambigui o inesistenti
durante il cambio d'ora richiedono un altro orario. Date/stati non sono business
rule autorevoli nel client: transizioni consentite provengono dalle API.
La versione del modulo rimane quella aperta dall'utente anche dopo refetch
automatici: un aggiornamento recente dell'ufficio non viene sovrascritto.

## Test browser

```powershell
# Browser Playwright, oppure Chrome già installato.
npm.cmd exec playwright -- install chromium
npm.cmd run test:e2e
# Alternativa senza download Chromium:
$env:PLAYWRIGHT_CHANNEL='chrome'
npm.cmd run test:e2e
```

La suite avvia automaticamente Next su 3001 e Django su 8001 con database SQLite
temporaneo, utenti e contatti fittizi. Non riusa server già presenti né il database
locale dell'utente. Usa il Python `.venv` della radice; installare prima i requirements
backend. I lock di PostgreSQL sono verificati dalla suite backend separata.
Screenshot e trace diagnostici sono esclusi da Git; screenshot di controllo in
`.local/screenshots/` nella radice. Nessun test invia email a indirizzi reali.

## Perimetro

Dashboard fase 3. Foto/firme, allegati, preventivi/PDF, report esportabili, chat,
push e mappa live restano nella fase 5; nessun pulsante ne simula il funzionamento.
Tema chiaro; tema scuro opzionale rimandato. Verifiche attuali in
`docs/VALIDATION-PHASE-3.md` nella radice del repository.

Riferimenti tecnici: [Next rewrites](https://nextjs.org/docs/app/api-reference/config/next-config-js/rewrites),
[TanStack Query](https://tanstack.com/query/latest/docs/framework/react/overview),
[FullCalendar React](https://fullcalendar.io/docs/react).
