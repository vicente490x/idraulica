# Roadmap

Stato al 19 ottobre 2026: fasi 1–3 implementate e verificate. La fase 3 è stata
autorizzata dal successivo comando dell'utente; rapporto in
`docs/VALIDATION-PHASE-3.md`. Prossimo incremento: fase 4, Flutter REST.

1. Analisi: leggere 3 fonti + master prompt, inventario app, specifiche, ER,
   matrice e ambiguità. Gate: ogni requisito collegato a fase e prova.
2. Backend: configurazione, modelli/migrazioni PostgreSQL, JWT/sessioni/CSRF,
   RBAC, CRUD clienti/interventi, assegnazione, transizioni/versioni/idempotenza,
   storico/audit, schema API e test. Gate: suite locale e controlli migrazioni;
   PostgreSQL verificato separatamente. Fermarsi qui su richiesta dell'utente.
3. Web: Next.js/TypeScript/Tailwind/componenti accessibili/TanStack Query;
   login, dashboard reale, anagrafiche, tecnici, calendario con drag & drop e conflitti.
   Gate: test browser ruoli/creazione/modifica/filtri/errori/tastiera/responsive.
4. Mobile: migrazione Flutter esistente a REST, Riverpod/GoRouter/storage sicuro,
   login/agenda/dettaglio/stati/foto/firma. Gate: test widget e build Android/iOS;
   nessuna dipendenza operativa da Firestore.
5. Avanzate: storage privato, chat Channels, outbox/Celery/FCM/email/promemoria,
   mappe autorizzate, preventivi/PDF, offline/versioni, report CSV/PDF e privacy tools.
   Gate: flusso end-to-end, retry e conflitti, permessi allegati, provider reali configurati.
6. Qualità: audit sicurezza, accessibilità, performance con volumi concordati,
   test unitari/integrazione/E2E, ripristino backup, correzioni e UAT.
7. Demo: seed idempotenti solo demo (admin, ufficio, 3 tecnici, clienti/lavori/preventivi
   fittizi), build, manuali ufficio/tecnico, presentazione e collaudo committente.
8. Produzione: hosting/HTTPS/domino/monitoraggio/backup, migrazione dati approvata,
   store, go-live autorizzato e manutenzione. Nessuna pubblicazione automatica.

Le stime dipendono da volumi, SLA, provider e approvazioni organizzative; nessuna
data di consegna o conformità legale è dedotta dai documenti.
