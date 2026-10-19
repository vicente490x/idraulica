# Specifica funzionale

## Fonti e perimetro
Analisi del 19 ottobre 2026. Fonti lette integralmente: `documnento.txt` (D),
`guida_completa_sviluppo_app_idraulica.pdf` (G, 3 pagine),
`Project Implementation on IT Services Infographic Presentation.pdf` (P, 4 pagine),
master prompt allegato (M, sezioni 1–22). Testo estratto dei PDF in `docs/sources/`.
Il primo PDF presenta un indice startxref malformato: pypdf lo ha recuperato e ha
estratto tutte e tre le pagine. Alcuni glifi sono difettosi; i requisiti sono leggibili.

La consegna iniziale comprende fasi 1 e 2; il comando successivo dell'utente ha
autorizzato la fase 3, ora con dashboard web collegata al backend. Nuova app,
upload, firme, preventivi operativi, chat, push, GPS, offline e report esportabili
appartengono alle fasi successive.
Non equivalgono a funzionalità implementate perché presenti nel modello dati.
La matrice in `docs/TRACEABILITY.md` precede l'implementazione del backend.

## Situazione iniziale
`progetti/idraulica_app` è un'app Flutter con accesso diretto a Firestore,
creazione interventi senza autenticazione applicativa, calendario non collegato agli
interventi, dettagli e marker fissi. Non esistono backend, test di dominio o documentazione
architetturale. Le regole Firestore distribuite non sono note. Il codice viene conservato,
ma non costituisce un client autorizzato del nuovo backend. Nessuna migrazione dati
automatica o modifica al Gradle esistente in questa consegna.

## Utenti e casi d'uso
Amministratore: utenti/ruoli, clienti, agenda, tecnici, report e configurazioni.
Ufficio: clienti, pianificazione, assegnazioni, comunicazioni e report autorizzati;
nessuna amministrazione utenti. Tecnico: solo interventi assegnati e clienti relativi,
stati, foto, firma, preventivi, chat e proprio storico. Ogni autorizzazione è server-side.
Registrazione pubblica vietata. Account disabilitati esclusi anche con token valido.

## Funzioni e accettazione
- Identità: email univoca normalizzata, password con validatori e Argon2; JWT breve,
  refresh ruotato/revocabile, logout, cambio/reset password, sessioni elencabili/revocabili.
  Web: sessione Django HttpOnly con CSRF; mobile: Bearer e in futuro storage OS sicuro.
- Clienti: anagrafica, contatti, indirizzo/città/CAP, coordinate opzionali e note;
  ricerca/paginazione; storico collegato, eliminazione impedita se referenziato.
- Interventi: cliente, tecnico attivo, problema/tipo, luogo, priorità, orari UTC,
  note separate, versione e storico. Data fine successiva all'inizio; sovrapposizioni
  di interventi attivi sullo stesso tecnico rifiutate, anche per urgenze.
- Stati: programmato → assegnato → confermato → in viaggio → in lavorazione → completato.
  Cliente assente da confermato/in viaggio/in lavorazione → da riprogrammare → assegnato.
  Ufficio può annullare interventi aperti; completato e annullato sono terminali.
  Tecnico non assegna, riprogramma o annulla; note ufficio non esposte ai tecnici.
  Ogni creazione/transizione/riassegnazione conserva autore e timestamp.
- Concorrenza: aggiornamenti richiedono versione attuale; risposta 409 se obsoleta;
  lock transazionali serializzano le assegnazioni. Retry di stato identificato da UUID
  e stesso payload restituisce il risultato precedente senza doppio storico.
- Dashboard futura: indicatori giornalieri, filtri, calendario giorno/settimana/mese,
  drag & drop con verifica conflitti, inserimento rapido cliente/appuntamento, agenda
  e carico tecnici, archivio clienti, report giornalieri/settimanali CSV/PDF.
- Mobile futuro: splash/login/home, agenda giorno/settimana, dettaglio, chiamata e
  navigatore, stati e cliente assente, foto camera/galleria prima/dopo, firma sul
  riepilogo immutabile, preventivi, chat, notifiche, storico e profilo.
- Preventivi futuri: voci normalizzate, quantità/prezzi/IVA decimali, totale calcolato
  dal backend; bozza/inviato/approvato/rifiutato e PDF scaricabile.
- Media futuri: oggetti privati, verifica tipo reale/dimensioni, URL temporanei dopo
  autorizzazione, firma associata a hash e snapshot immutabile. Nessuna firma qualificata.
- Comunicazioni future: conversazioni autorizzate, WebSocket autenticati, riconnessione,
  non letti, timestamp; notifiche persistenti e FCM configurabile, deduplica/retry/token
  invalidi; push senza dati personali; email/promemoria richiesti da P pagina 2.
- GPS futuro: consenso/autorizzazione lavorativa, ultimo aggiornamento e gestione
  permessi/GPS assente; nessun tracciamento persistente in background.
- Offline futuro: cache assegnazioni, coda persistente, retry/backoff, UUID operazione,
  confronto versioni e risoluzione esplicita conflitti senza sovrascritture silenziose.
- Qualità: UI italiana accessibile, responsive, stati vuoti/errori/caricamento,
  conferma azioni distruttive; OpenAPI versionata, audit senza contenuti sensibili,
  backup/ripristino, test dominio/E2E/UAT/performance e manuali operativi.

## Decisioni da validare, non bloccanti per le fondamenta
Assunzione iniziale: una sola azienda, timezone Europe/Rome, un tecnico per intervento,
ufficio con accesso a tutte le anagrafiche. Nessuna autorizzazione trasversale tra tecnici.
Riassegnazione consentita solo prima della partenza. Eccezioni alle sovrapposizioni,
multi-tecnico/multi-azienda e riapertura lavori richiedono decisione esplicita.
Da confermare prima delle relative fasi: IVA e arrotondamento, approvazione preventivi,
requisiti di completamento (foto/firma obbligatorie o facoltative), conservazione dati,
informative/base giuridica GPS e firme, report accessibili all'ufficio, provider e budget,
volumi/SLA/RPO/RTO, migrazione Firestore e distribuzione store.
Nessuna di queste decisioni abilita oggi tracking, invii esterni o pubblicazione.

## Contratto API fase 2
Prefisso `/api/v1/`; JSON, pagine da 25, errori `{error: {code, details}}`.
Risorse users (solo admin), technicians (lettura ufficio/proprio profilo), customers,
interventions; dettaglio/history/status e `/auth/` per JWT/sessioni/password.
Creazione/aggiornamento intervento riservati all'ufficio; tecnico usa solo status.
Update con `version`; status con `version`, `status`, `operation_id` UUID.
PATCH e PUT condividono il controllo versione; eliminazione interventi via annullamento.

## Incremento fase 3
Dashboard locale in `apps/web`: Next.js/TypeScript/Tailwind, TanStack Query,
Radix Dialog e FullCalendar 6/Luxon. Login/sessioni HttpOnly/CSRF, recupero/reset
password, overview con aggiornamento ogni 30 secondi, clienti CRUD/storico,
interventi con filtri/modifica/stati, creazione rapida con nuova anagrafica,
agenda giorno/settimana/mese con drag & drop/resize e rollback conflitti,
tecnici con agenda/carico/disponibilità e creazione account admin-only.
Conferme per annullamento lavoro, eliminazione cliente e rimozione indisponibilità.
Nessun dato fittizio nel client; fixture browser esclusivamente nel database temporaneo.

API aggiunte: `/office/config/` (timezone), `/office/overview/?date=YYYY-MM-DD`,
`/availability/` GET/POST/DELETE riservate all'ufficio. Gli intervalli disponibili
sono la normalità: per liberare uno slot si elimina l'indisponibilità.
Creazione indisponibilità serializzata sullo stesso lock tecnico delle assegnazioni;
rifiuto se ci sono lavori attivi nell'intervallo. Nessuna migrazione necessaria.
Interventi filtrabili con `start`, `end`: sovrapposizione con intervallo semiaperto,
inclusi lavori attraverso mezzanotte. Output aggiunge nomi cliente/tecnico,
telefono, `allowed_transitions` e `planning_editable`, senza esporre note ufficio ai tecnici.
Disponibilità "ora" calcolata sull'istante attuale anche se si consulta un'altra giornata;
ore carico riferite alla durata pianificata, non al tempo di lavoro effettivo.
Il form conserva lo snapshot/versione di apertura fino a salvataggio o chiusura.
Tema scuro e report CSV/PDF restano rinviati secondo la roadmap.
