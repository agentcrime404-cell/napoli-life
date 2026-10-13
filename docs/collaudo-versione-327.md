# Collaudo versione 327 — 10 ottobre 2026

## Modifiche
Conservate le correzioni della versione 326 su risorse condivise, registri dei locali e propagazione degli errori grafici.
- Il timeout della preparazione shader ora rifiuta l'operazione con SHADER_PREP_TIMEOUT: resta la schermata di errore con possibilità di riprovare, invece di forzare un rendering sincrono potenzialmente bloccante.
- Uno shader già riconosciuto non valido continua a essere segnalato durante i tentativi successivi, senza ripetere la verifica GPU.
- Per shader non validi (SHADER_LINK_FAILED), il recupero propone di ricaricare la pagina; per un semplice timeout resta Riprova.

## Verifiche
- 16 test mirati su shader e risorse grafici: superati.
- Suite completa conclusa: 114 test superati, zero falliti, 58,6 secondi.
- Accesso ospite, scelta personaggio e ingresso in Mergellina verificati in browser sulla 326.
- Rientro con sessione salvata e ingresso in Mergellina verificati sulla 327.
- Cambio fra prima persona, 2.5D e terza persona verificato; movimento da tastiera osservato.
- Screenshot: collaudo-327-citta.png.
- Campioni del contatore della pagina: 23 FPS in prima persona sulla 326 e 17 FPS in terza persona sulla 327; visuali diverse, non un confronto di prestazioni fra build. Risoluzione interna al 60%, viewport 1280×720. Non sono misure sostenute né test su telefoni reali. Il campione della 327 riportava 676 draw call e 855066 triangoli.
- Server di prova isolato: porta 32004, database dedicato. Nessun account di produzione modificato.

## Restano aperti
Ottimizzazione per raggiungere 30 FPS sostenuti; collaudo prolungato su telefoni reali; percorso completo guida/interni/multiplayer/rete; hosting persistente e verifica della build pubblicata. I precedenti timeout del browser non si sono riprodotti durante questo ingresso, ma ciò non certifica tutti i dispositivi o tutte le scene.
Nessun deploy, commit o push eseguito.
