# Gestionale azienda idraulica

Consegna fasi 1–3: analisi documenti, backend REST Django con database
PostgreSQL e dashboard web Next.js per l'ufficio. Utenti/ruoli, autenticazione,
clienti, interventi, stati, audit e calendario sono collegati a dati persistenti.
Il client mobile REST sarà sviluppato nella fase 4.
L'app Flutter preesistente in `progetti/idraulica_app` è conservata e non è
ancora collegata a queste API. Non usare i suoi dettagli/marker dimostrativi come dati reali.

## Requisiti e struttura

Python 3.14, PostgreSQL 17+ (verificato con 18), facoltativamente Docker Compose.
Redis necessario per cache condivisa di produzione e future attività asincrone.
Dipendenze esatte in `backend/requirements.txt`; PDF leggibili con pypdf.

- `backend/accounts`: utenti email, JWT e sessioni/password.
- `backend/operations`: schema dati, API e servizi transazionali.
- `apps/web/`: dashboard Next.js; `apps/mobile/`: destinazione del nuovo client.
  Flutter attuale in `progetti/`.
- `infrastructure/`: Compose locale e Dockerfile.
- `docs/`: matrice, schema OpenAPI, fonti estratte e rapporto verifiche.

## Installazione Windows / PowerShell

Eseguire dalla radice:

```powershell
python -m venv .venv
.\.venv\Scripts\python -m pip install -r backend/requirements.txt
Copy-Item .env.example .env
```

Modificare `.env`: scegliere `POSTGRES_PASSWORD` e generare `DJANGO_SECRET_KEY`
localmente (`python -c "import secrets; print(secrets.token_urlsafe(64))"`).
Nessuna credenziale predefinita di produzione. `.env` è ignorato da Git.
Lo script `scripts/backend.py` carica il file come dati, senza eseguirlo:
usare valori non racchiusi tra virgolette e senza commenti alla fine della riga.
Con chiamate dirette a manage.py, esportare invece le variabili nella shell;
Django non carica implicitamente `.env`.

## Dashboard web (fase 3)

Dopo aver avviato Django su porta 8000, aprire un secondo terminale:

```powershell
cd apps/web
npm.cmd ci
npm.cmd run dev
```

Aprire **http://127.0.0.1:3000/login** e usare l'account amministratore o ufficio
creato nel proprio database. Per creare il primo amministratore usare
`python scripts/backend.py createsuperuser` con il Python della `.venv`.
Per un avvio senza servizi usare prima la procedura SQLite riportata sotto.
Non sono necessarie credenziali Firebase per usare la dashboard.

Dettagli di configurazione, calendario, test e build nel
[README web](apps/web/README.md). Il frontend usa cookie HttpOnly/CSRF e inoltra
le API a Django; includere l'origine web effettiva in `CSRF_TRUSTED_ORIGINS`.
Il `.env.example` aggiornato include localhost e 127.0.0.1 sulla porta 3000.
Nessun deploy è stato eseguito.

### PostgreSQL e Redis con Docker

Avviare Docker Desktop, poi:

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml up -d db redis
.\.venv\Scripts\python scripts/backend.py migrate --noinput
.\.venv\Scripts\python scripts/backend.py createsuperuser
.\.venv\Scripts\python scripts/backend.py runserver 127.0.0.1:8000
```

In alternativa, backend in container (migrazioni esplicite prima dell'avvio):

```powershell
docker compose --env-file .env -f infrastructure/compose.yaml build backend
docker compose --env-file .env -f infrastructure/compose.yaml run --rm backend python manage.py migrate --noinput
docker compose --env-file .env -f infrastructure/compose.yaml run --rm backend python manage.py createsuperuser
docker compose --env-file .env -f infrastructure/compose.yaml up -d backend
```

Compose espone solo porte loopback e usa volumi persistenti; configurazione per sviluppo,
non per deploy. Lo storage privato e i provider FCM/Maps non sono attivati.
Per PostgreSQL nativo impostare host/porta/utente/database in `.env`; con sola esecuzione
locale lasciare `REDIS_URL` vuota per cache di processo. Il DB di test richiede CREATEDB.

### Prova rapida senza servizi

```powershell
.\.venv\Scripts\python scripts/backend.py --sqlite migrate --noinput
.\.venv\Scripts\python scripts/backend.py --sqlite createsuperuser
.\.venv\Scripts\python scripts/backend.py --sqlite runserver 127.0.0.1:8000
```

SQLite è solo una modalità locale esplicita: i test di lock PostgreSQL vengono saltati.
Non dimostra le garanzie di concorrenza del database di riferimento.

## Uso delle API

`POST /api/v1/auth/login/` con JSON `email`, `password` restituisce access/refresh
per client mobile. Inviare `Authorization: Bearer <access>`; refresh su
`POST /api/v1/auth/refresh/`. Sessioni: `/api/v1/auth/sessions/`, revoca con
`POST /api/v1/auth/sessions/{id}/revoke/`; logout con POST `/auth/logout/`.
Cambio password: `/auth/password/change/`; reset: `/auth/password/reset/` e
`/auth/password/reset/confirm/`. Il modulo web reset sarà nella fase 3;
in sviluppo il link viene scritto dalla console email, in produzione configurare SMTP.

Web futuro: GET `/api/v1/auth/csrf/`, poi POST `/auth/web-login/` con header
`X-CSRFToken` e cookie inclusi. Dopo il login recuperare un nuovo CSRF token.
Le mutazioni richiedono CSRF anche quando la sessione è già autenticata.
Cookie sessione HttpOnly, Secure fuori sviluppo. Nessun token in localStorage.

L'amministratore crea ufficio/tecnici su `/api/v1/users/`. Ufficio crea clienti
su `/customers/` e interventi su `/interventions/`. Tecnico e clienti devono
essere identificati dagli ID restituiti dalle rispettive API. Intervento minimo:

```json
{
  "customer": "UUID-cliente", "technician": 2,
  "title": "Riparazione perdita", "description": "Perdita sotto lavello",
  "intervention_type": "riparazione", "priority": "normal",
  "starts_at": "2026-10-20T08:00:00Z", "ends_at": "2026-10-20T09:00:00Z",
  "address": "Indirizzo del cliente"
}
```

Per aggiornare via PATCH includere `version` attuale; versione obsoleta e sovrapposizioni
restituiscono 409. Il tecnico usa solo POST `/interventions/{id}/status/`:

```json
{"status": "confirmed", "version": 1, "operation_id": "57aed849-92de-43fd-9075-010f77574c62"}
```

Generare un nuovo UUID per ogni operazione e riusare UUID/payload identici per retry.
Lo storico è su `/interventions/{id}/history/`. Tecnici vedono solo le assegnazioni
correnti e i relativi clienti; note ufficio escluse. Interventi non cancellabili:
usare lo stato `cancelled` con utente ufficio. Clienti referenziati protetti da cancellazione.

Liste paginate con `count`, `next`, `previous`, `results`; ricerca `?search=...`,
filtri interventi `technician`, `customer`, `status`, `priority`, ordinamento `ordering=starts_at`.
Errori JSON uniformi in `error.code` e `error.details`.
OpenAPI statico in `docs/openapi.yaml`; schema e Swagger autenticati su
`/api/v1/schema/` e `/api/v1/docs/` (Swagger può caricare risorse CDN).

## Verifiche

```powershell
.\.venv\Scripts\python scripts/backend.py test accounts operations
.\.venv\Scripts\python scripts/backend.py makemigrations --check --dry-run
.\.venv\Scripts\python scripts/backend.py spectacular --file docs/openapi.yaml --validate --fail-on-warn
```

Per test rapidi aggiungere `--sqlite`. Evidenze, limitazioni e fasi aperte in
`docs/VALIDATION.md`, `docs/VALIDATION-PHASE-3.md` e `TASKS.md`. Il percorso E2E completo con foto/firma/report
richiede le fasi successive. Non sono inclusi seed demo o credenziali nel backend attuale.

## Documentazione e rilascio

Leggere `SPEC.md`, `ARCHITECTURE.md`, `DATABASE.md`, `ROADMAP.md`, `SECURITY.md`
e `docs/TRACEABILITY.md`. Decisioni aperte: IVA, retention, policy GPS/firme,
volumi/SLA e migrazione Firestore. Nessuna domanda blocca le fondamenta attuali.
Produzione richiede HTTPS, server ASGI, segreti, SMTP, Redis, backup/ripristino,
monitoraggio e valutazioni legali/organizzative. Non è stato eseguito alcun deploy.
