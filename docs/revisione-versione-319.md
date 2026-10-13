# Revisione della versione 319 — 10 ottobre 2026

Valutazione: non ancora certificata per il lancio pubblico.

## Stato osservato
- Versione locale 319 mostrata nella schermata di accesso. Modifiche recenti nella stessa cartella confermate dall’utente come lavoro di Claude.
- Nuovi interventi nel renderer: canvas 2D in memoria CPU, preparazione asincrona degli shader, materiali semplificati per mobile, sospensione del rendering durante costruzione/preparazione. Sono interventi presenti nel codice; il loro successo completo non è ancora verificato.
- Suite eseguita sulla copia attuale: 103 test superati, zero falliti, 50,8 secondi. I test della polizia emettono ancora avvisi police.save relativi al database del test.
- Browser integrato Chromium/Intel UHD: accesso ospite, scelta Ciro e prepartita completati sulla porta locale 32003. Entrando nella città, la lettura della pagina va in timeout. Non è una prova conclusiva della causa, né una certificazione di stabilità.
- La precedente build completava almeno il primo fotogramma: i log riportano 1,66 secondi. Il vecchio rapporto che attribuisce tutto al primo rendering va considerato superato da questa evidenza parziale.
- Richiesta HTTPS a /version.json del servizio humana-life-3d.onrender.com: HTTP 503, “Service Suspended”, con testo che indica sospensione da parte del proprietario.
- render.yaml locale: piano free, nessun disco attivo, deploy manuale. Non ho verificato il piano effettivo nella dashboard. Per un servizio persistente occorre assicurare conservazione e backup del database.

## Prima di pubblicare
1. Collaudo ripetibile della partita completa, senza blocchi, su PC e telefoni reali; misure sostenute di FPS e memoria.
2. Verifica di guida, interni, comandi touch e multiplayer con due browser e interruzioni di rete.
3. Conservazione dati, backup e ripristino verificati nell’ambiente di hosting scelto.
4. Rimuovere strumenti temporanei di diagnosi dalla consegna; includere tutti i nuovi moduli e asset necessari, attualmente anche non tracciati in Git.
5. Riattivazione/configurazione del servizio e verifica della build effettivamente pubblicata.

Nessuna pubblicazione, commit o push eseguiti durante questa revisione. Non assegnata una percentuale di completamento priva di criteri misurabili.
