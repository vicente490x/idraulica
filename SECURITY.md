# Sicurezza e aspetti organizzativi

RBAC backend deny-by-default, queryset filtrate prima di accedere al dettaglio;
tecnici limitati alle assegnazioni correnti, note ufficio escluse. Password validate e
Argon2. JWT access 5 minuti, refresh 1 giorno, rotazione/blacklist e sessione verificata
su ogni accesso; logout/revoca/cambio password invalidano le sessioni interessate.
Web session Django HttpOnly e CSRF anche sul login; mai token in localStorage.
Fase 3: chiamate browser sullo stesso host via Next rewrites; preservare gli
slash finali API e includere solo le origini web autorizzate nella allowlist CSRF.
Query cache esclusivamente in memoria, svuotata su logout o scadenza sessione.
Accesso dashboard riservato a ufficio/admin, oltre ai controlli backend.
Moduli intervento conservano la versione aperta anche se i dati si aggiornano in
background. Descrizioni e note renderizzate come testo React, senza HTML arbitrario.
Header web no-store, nosniff, DENY e referrer same-origin; CSP completa da
definire/verificare insieme al proxy HTTPS prima della produzione.
Rate limit login/reset con cache condivisa Redis in produzione; il throttle DRF
non sostituisce protezione brute-force al reverse proxy.

Segreti solo da ambiente; avvio non-dev rifiutato senza secret esplicito e PostgreSQL.
CORS allowlist, HTTPS/cookie secure/HSTS in produzione, nessun media pubblico.
Debug solo opt-in locale; errori API centralizzati, nessun body/password/token nei log.
Audit memorizza azione/ID/versione, mai note o contenuto personale.
Recupero password con risposta uniforme e SMTP configurato; console email solo dev
(contiene link sensibili). Limitare accesso ai log di sviluppo.

Fase 2 non include upload o GPS. Per fasi successive: limiti dimensione e firma MIME,
scansione file, bucket privati, URL firmati brevi, controllo proprietà, cifratura storage
e cache offline; FCM con testi generici e gestione token invalidi, WebSocket autorizzati.
Nessun tracking continuativo o in background. Firme con snapshot/hash immutabile,
senza qualificazione di firma elettronica qualificata.

Prima della produzione: threat model, dependency scan, test IDOR/CSRF/XSS/injection,
concorrenza PostgreSQL, backup restore, gestione incidenti, monitoraggio e HTTPS.
Non dichiarare conformità GDPR: titolare/ruoli, basi giuridiche, informative, retention,
accesso/esportazione/anonimizzazione, fornitori, valutazione GPS e firme richiedono
verifica legale e organizzativa. L'export dati personali e la retention saranno
implementati e verificati prima del go-live; lo schema non li sostituisce.

Backup proposto: `pg_dump -Fc`, copia cifrata in destinazione separata e accesso minimo;
restore in database isolato con `pg_restore --no-owner`, migrazioni e verifica conteggi/
allegati. Storage con versionamento e backup coordinato; RPO/RTO e retention da
approvare. Non eseguire ripristini su produzione per verificare un backup.
