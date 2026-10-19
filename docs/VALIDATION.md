# Rapporto fasi 1 e 2 — 19 ottobre 2026

## Fase 1
Lette integralmente le tre fonti richieste e il master prompt. Estratte tutte le
pagine dei PDF con pypdf; indice del PDF guida recuperato automaticamente.
Analizzata l'app Flutter: Firestore diretto, nessun login applicativo, calendario
non integrato, dettaglio e mappa con valori fissi. Nessuna modifica al Flutter.

Creati `SPEC.md`, `ARCHITECTURE.md`, `DATABASE.md` con ER, `ROADMAP.md`,
`TASKS.md`, `SECURITY.md`, `README.md`, `.env.example`, `docs/TRACEABILITY.md`
e testi sorgenti estratti. Matrice creata prima del backend.
Non ci sono domande bloccanti per la fase 2. Decisioni aziendali aperte in SPEC.

## Fase 2
Backend reale in `backend/`, senza frontend aggiuntivi:

- `config/`: impostazioni ambiente, PostgreSQL/SQLite esplicito, Redis/Channels/Celery,
  ASGI/WSGI, URL versionati, error handling e OpenAPI.
- `accounts/`: user email, Argon2, admin-only provisioning, JWT 5 minuti/refresh
  rotante, sessioni revocabili verificate a ogni accesso, login web HttpOnly/CSRF,
  logout, cambio/reset password e rate limit.
- `operations/`: schema completo delle entità, CRUD clienti/interventi, tecnici,
  permessi server-side, isolamento per assegnazione, note ufficio riservate,
  orari e disponibilità, transizioni, storico, audit, versioni e retry idempotenti.
- Migrazioni iniziali versionate; lock PostgreSQL per serializzare assegnazioni,
  aggiornamenti e retry di stato; refresh concorrenti protetti da lock sessione.
- `infrastructure/`: Dockerfile e Compose locale PostgreSQL/Redis/backend.
  `scripts/backend.py`: launcher con caricamento ambiente portabile, adatto anche
  ai sistemi che disabilitano gli script PowerShell.
- `.github/workflows/backend.yml`: pipeline proposta con PostgreSQL 17;
  non eseguita su GitHub in questa sessione.

Lo schema delle funzioni avanzate non implica che API media/firma/preventivi/chat/
notifiche/GPS/report siano già disponibili. Le configurazioni di provider in
`.env.example` sono dichiarate non attive. Nessun seed di produzione o account
predefinito è stato creato. Gli account nei test sono esclusivamente fittizi.

## Verifiche eseguite

Ambiente Windows, Python 3.14.6, Django 6.1.2, DRF 3.18.3.
PostgreSQL 18 installato usato con cluster isolato in `.local/postgres`, porta
loopback 55439, credenziali casuali locali non versionate. Il servizio PostgreSQL
preesistente non è stato modificato. Istanza temporanea arrestata dopo le verifiche.

| Verifica | Risultato |
|---|---|
| Installazione dipendenze / `pip check` | Nessuna dipendenza incompatibile rilevata |
| `manage.py check` | Nessun problema |
| Migrazioni da DB vuoto SQLite e PostgreSQL 18 | Tutte applicate |
| `makemigrations --check --dry-run` | Nessuna modifica mancante |
| Suite finale PostgreSQL | **27 test, tutti superati**, teardown completato |
| Suite SQLite prima del test integrato aggiuntivo | 26 test: 22 superati, 4 concorrenti saltati esplicitamente |
| OpenAPI `--validate --fail-on-warn` | Zero errori, zero avvisi |
| `check --deploy --fail-level WARNING`, impostazioni produzione | Nessun problema; non è un audit completo |
| Avvio HTTP locale reale, CSRF bootstrap | HTTP 200 e token JSON |
| HTTP reale clienti senza autenticazione | HTTP 401 e JSON errore |
| Compose `config --no-env-resolution --quiet` | Configurazione valida |
| `git diff --check` | Nessun errore |

Suite: `accounts/tests/test_auth.py` (login, sessioni, revoca, password, CSRF,
limiti, ruoli); `operations/tests/test_api.py` (CRUD, isolamento, ricerca/filtri,
vincoli, transizioni, versioni, retry); `*/tests/test_concurrency.py` (4 casi
PostgreSQL: collisione assegnazioni, aggiornamenti obsoleti, doppio retry stato,
doppio refresh); `operations/tests/test_workflow.py` (JWT reale admin → ufficio
→ creazione cliente/assegnazione → tecnico conferma/viaggio/lavoro/completamento
→ verifica storico ufficio).
Il flusso backend non include ancora foto, firma e report: il flusso completo di
12 passi del master prompt rimane un criterio delle fasi successive.

## Limiti e prossime attività
Docker installato ma daemon non attivo: immagini non compilate/eseguite, Redis
non verificato dal vivo. I test usano cache di processo, non dimostrano throttle
distribuito. SMTP esterno, FCM, S3, mappe e WebSocket non verificati né attivati.
Nessun test/build Flutter o browser eseguito in questa fase; Flutter non disponibile
nel PATH rilevato. Pipeline GitHub non lanciata. Nessun deploy.

Prima di produzione occorrono audit sicurezza, test di carico/UAT, proxy HTTPS,
server ASGI, monitoraggio, backup e prova restore, policy privacy/retention e
funzioni avanzate. Nessuna attestazione automatica GDPR.
La modifica preesistente a `gradle-wrapper.properties` è stata preservata.
Prossima fase: dashboard web (fase 3), da avviare solo su nuovo comando dell'utente.
