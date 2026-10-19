# Rapporto fase 3 — 19 ottobre 2026

## Risultato

Dashboard ufficio reale in `apps/web/`, collegata a Django con sessioni HttpOnly
e CSRF. Nessun dato operativo simulato nel client, nessuna pubblicazione.
Flutter e la modifica Gradle preesistente sono preservati.

Implementati:

- Login/logout, pagina recupero e pagina reset password.
- Layout italiano responsive con sidebar, ricerca/filtri, stati di caricamento,
  vuoti ed errori, feedback di salvataggio, dialog Radix accessibili e conferme.
- Panoramica giornaliera con conteggi reali, agenda e ultimi cambi di stato;
  aggiornamento periodico a 30 secondi.
- Archivio clienti, paginazione/filtro città, creazione/modifica, contatti,
  storico e cancellazione confermata con protezione dei clienti referenziati.
- Interventi con filtri/ricerca/data, dettaglio e note, assegnazione/modifica,
  transizioni autorizzate dal server, conferma annullamento e storico.
- Creazione appuntamento con ricerca server del cliente e indirizzo precompilato;
  anagrafica rapida durante una telefonata, conservata e selezionata se un
  successivo conflitto impedisce di salvare l'appuntamento.
- Calendario FullCalendar giorno/settimana/mese, colori stato/priorità,
  creazione da selezione orario, drag & drop e resize persistenti con controllo
  versione/sovrapposizioni e ripristino visivo in caso di rifiuto.
- Tecnici con disponibilità attuale, agenda giorno/settimana, lavori/ore
  pianificati e gestione indisponibilità. Creazione account solo amministratore.

## File e contratti

Nuovi: `apps/web/package.json` e lockfile, configurazione Next/TypeScript/Tailwind,
`src/app/` per le route, `src/components/` per interfacce e moduli, `src/lib/`
per API/tipi/orari; test Playwright e relativo config. Versioni risolte nel lockfile:
Next 16.4.2, React 19, TanStack Query 5 e FullCalendar 6.

Backend: `operations/office.py` (overview/config/indisponibilità), `filters.py`
(intervallo temporale), `serializers.py` (etichette e capacità server), `views.py`,
`accounts/views.py`, URL e impostazioni. Nessuna modifica al modello dati e nessuna
nuova migrazione necessaria. `SQLITE_DB_PATH` opzionale solo in ambienti locali
abilita un database isolato per E2E. Produzione rimane PostgreSQL.

Nuovi endpoint office-only: `/api/v1/office/config/`, `/office/overview/?date=...`,
`/availability/` GET/POST/DELETE. Interventi: `start`/`end` delimitano una finestra
semiaperta con query di sovrapposizione. Indisponibilità e assegnazioni condividono
il lock sul tecnico. Le transizioni disponibili sono metadati dal backend.

Documentazione aggiornata: README radice/web, SPEC, ARCHITECTURE, SECURITY,
TASKS, matrice requisiti e schema OpenAPI. Aggiunti workflow CI web; non eseguiti
su GitHub in questa sessione. Il workflow backend esistente include i nuovi test.

## Verifiche eseguite

| Verifica | Risultato |
|---|---|
| Backend su PostgreSQL 18 isolato | **35 test superati**, inclusi 4 casi concorrenti |
| Backend SQLite | 31 superati, 4 concorrenti saltati esplicitamente |
| Migrazioni `--check --dry-run` | Nessuna migrazione mancante |
| Django `check` | Nessun problema |
| OpenAPI `--validate --fail-on-warn` | Zero errori, zero avvisi |
| TypeScript `tsc --noEmit` | Superato |
| Next.js build ottimizzata | Superata, tutte le route generate senza errori |
| Playwright su Chrome installato | **10 test superati** contro Django reale |
| Ripetizione creazione rapida dopo correzione campi React | 1 test mirato superato |
| Ispezione visiva screenshot 1440×1000 e 390×844 | Eseguita |
| `git diff --check` | Nessun errore |

I test browser avviano server Next (3001) e Django (8001), con database SQLite
temporaneo e soli utenti/contatti fittizi. Nessun uso del database locale utente,
del servizio PostgreSQL preesistente o di account esterni. Cookie HttpOnly e
localStorage vuoto verificati nel browser. Le simulazioni di errore 503 sono
intercettazioni esclusivamente nei test, non nel prodotto.

Copertura browser: redirect anonimo/login/logout; creazione cliente e intervento,
modifica persistente dopo reload e filtri; tre viste calendario e Invio sull'evento;
errore recuperabile con retry; indisponibilità e conferma rimozione; esclusione
tecnico; viewport mobile senza overflow e dialog da tastiera; trascinamento con
salvataggio reale e rollback su sovrapposizione; modifica obsoleta rifiutata senza
sovrascrivere la modifica recente; anagrafica rapida durante chiamata.

Gli 8 nuovi test backend coprono autorizzazioni office-only, date non valide,
mezzanotte, durata nel giorno del cambio d'ora, disponibilità attuale indipendente
dalla giornata consultata, collisioni tra lavori e indisponibilità e metadati stato.
Il cluster PostgreSQL di prova è stato arrestato dopo i test. Screenshot locali
di dati fittizi in `.local/screenshots/`, esclusi da Git.

## Limiti, decisioni e prossima fase

Verificato Chrome su Windows e viewport mobile emulata; non eseguiti Firefox,
Safari o dispositivi reali, audit WCAG completo, carico o pen-test. Resize calendario
implementato sullo stesso contratto di aggiornamento; il test mouse specifico
verifica drag & drop, non il trascinamento della maniglia di durata.
Il recupero password usa le API testate nella fase 2; consegna email SMTP esterna
non verificata. Docker/Redis, FCM, S3 e mappe rimangono nelle condizioni riportate
nel rapporto iniziale. Nessuna attestazione di conformità GDPR.

UI in tema chiaro; tema scuro opzionale rimandato. Ore tecnici sono durate
pianificate, non rendicontazione effettiva. Report CSV/PDF, allegati/foto/firme,
preventivi, chat, notifiche e mappa live sono ancora fase 5.
Restano da validare retention, policy GPS/firme, IVA, volumi/SLA e migrazione
Firestore secondo SPEC. Nessuna decisione bloccante per la dashboard corrente.
Prossima fase: **4, client Flutter REST**, da avviare su nuovo comando dell'utente.

La skill Sites è stata applicata nel percorso locale, senza registrazione,
sincronizzazione esterna o pubblicazione del sito.
