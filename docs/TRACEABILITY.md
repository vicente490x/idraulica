# Matrice requisiti → implementazione → test

D = documnento.txt (paragrafi per tema); G = guida PDF, pagina; P = presentazione,
pagina; M = master prompt, sezione. Test indicati come pianificati finché il report
di validazione non ne attesta l'esecuzione. Copertura aggregata per capacità:
i dettagli di accettazione sono in SPEC.md, senza escludere i requisiti delle fonti.

| ID | Fonte | Funzionalità / destinazione | Fase | Prova |
|---|---|---|---|---|
| R01 | D introduzione; G1 §1; P1,2,4; M1–3 | Analisi, flussi, stack, monorepo, documenti | 1 | Revisione fonti/matrice |
| R02 | G1 utenti; G2 §3; P2 JWT; M4–5 | Utenti, login, sessioni, ruoli, password | 2 | test auth, refresh, logout, CSRF, RBAC |
| R03 | D archivio; G1 clienti, G2 API; M6,7 | CRUD clienti normalizzato | 2 | test clienti, ricerca, FK e isolamento |
| R04 | D appuntamenti/urgenze; G1 interventi, G2 §3; M6,7,16 | CRUD interventi/assegnazioni | 2 | test create/update, orari, conflitti |
| R05 | D stati/assente; G2 §4; M8 | Stati, assente, storico e permessi | 2/4 | test transizioni e storico; widget conferma |
| R06 | D dashboard/inserimento rapido; G2 §5; P1,2; M7,15 | Dashboard, clienti rapidi, indicatori | 3 | browser creazione, validazioni, caricamento |
| R07 | D settimana/carico; G2 calendario; P2; M7 | Calendario giorno/settimana/mese, drag/drop, filtri, carico | 3 | browser filtri, conflitti, responsive |
| R08 | D agenda; G2 §4; P1,2,4; M8 | 15 schermate mobile, dettaglio, home, profilo | 4/5 | widget login/agenda/dettaglio + build |
| R09 | D navigazione/mappa; G2 navigazione; P1,2 GPS; M9 | Chiamata, Maps, posizione autorizzata, timestamp/GPS assente | 4/5 | device permessi/negazione/fine lavoro |
| R10 | D foto; G1 foto, G2,3 test; P1; M8,14 | Camera/galleria prima/dopo, anteprima, privato | 4/5 | upload validi/invalidi/IDOR e widget |
| R11 | D firma; G2 firma; M8 | Firma, snapshot immutabile e hash | 4 | test immutabilità e widget firma |
| R12 | D chat; G1 messaggi; M11 | Conversazioni autorizzate, WebSocket, non letti, retry | 5 | integrazione socket/IDOR/riconnessione |
| R13 | D preventivi; G1 preventivi; M12 | Righe, decimali, IVA, stati e PDF | 5 | test importi/permessi/PDF |
| R14 | D notifiche/urgenze/assente; G2 §6, G3; P1,2 email/reminder; M10 | In-app, FCM, email/promemoria, dedup/retry | 5 | provider configurato, token invalidi e privacy |
| R15 | D report; G2 riepilogo; P2; M7 | Giorno/settimana/tecnico/durate, CSV/PDF | 5 | aggregati timezone e export autorizzati |
| R16 | P2 offline; M13 | Cache/coda/retry, UUID, conflitti espliciti | 2/5 | test versioni/idempotenza; device offline |
| R17 | G1 database; P1,2,4; M6 | Schema, FK, vincoli, UTC, indici/migrazioni | 2 | migrazioni/check + PostgreSQL |
| R18 | M14 | GDPR tools, retention/export/anonimizzazione, policy | 5/6 | test policy + revisione organizzativa |
| R19 | M5,14,16 | Rate limit, CSRF/CORS, audit, errori, sicurezza accessi | 2/6 | test auth/throttle/IDOR/errori + audit |
| R20 | M15 | Italiano, accessibilità, responsive, dark se sostenibile | 3/4/6 | tastiera/contrasto/viewport/device |
| R21 | G2,3 §7; P3,4; M17 | Unit/integration/E2E 12 passi, performance, UAT | 2–7 | suite, percorso ufficio→firma→report |
| R22 | M18,21 | Demo separata idempotente admin/ufficio/3 tecnici/dati fittizi | 7 | seed due volte, smoke test demo |
| R23 | G3 §8; P3,4; M19–22 | Hosting/store/manuali/go-live/manutenzione | 7/8 | build, restore, UAT, approvazione deploy |
| R24 | M2,3,10,16 | Compose/Postgres/Redis/Celery/Channels/OpenAPI/S3/FCM | 2/5/8 | check schema/compose; integrazioni reali |
| R25 | M20,22 | Incrementi verificabili, preservazione esistente, stop fase 2 | 1/2 | git diff e rapporto validazione |

## Evidenze aggiunte nella fase 3

R06/R07/R20 verificati dai test browser `apps/web/tests/office.spec.ts`: accesso,
persistenza clienti/appuntamenti/modifiche, filtri, tre viste calendario, navigazione
evento con Invio, trascinamento effettivo e rollback di conflitto, indisponibilità,
assenza di overflow mobile, dialog con tastiera, creazione rapida durante chiamata.
R02/R19: cookie HttpOnly, localStorage vuoto, logout, esclusione tecnico e gestione
errore API con retry; conflitto versione verificato contro una modifica server reale.
R04/R16/R17: `backend/operations/tests/test_office.py` aggiunge 8 verifiche per
query temporali, timezone/mezzanotte/cambio d'ora, riepilogo, autorizzazioni,
indisponibilità e metadati di transizione. Suite complessiva: 35 test PostgreSQL.
Esiti e limiti in `docs/VALIDATION-PHASE-3.md`. R10–R15/R18 rimangono nelle fasi
avanzate: non sono resi disponibili da pagine dimostrative.
