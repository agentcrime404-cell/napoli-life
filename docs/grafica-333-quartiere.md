# Grafica del quartiere completo — versione 333

11 ottobre 2026. Estensione degli interventi del campione ai materiali condivisi del gioco: in Ultra persiane e portoni hanno rilievo, ringhiere hanno risposta metallica, cornici hanno materiale fisico opaco. La pavimentazione generata per Mergellina usa un rilievo lieve e riceve la luce con un materiale fisico. Le altre qualità conservano i materiali precedenti.

Ottimizzazione indipendente dal profilo: Chalet Ciro viene aggiunto dopo il bake principale della città; ora unisce i suoi arredi statici prima di inserirsi nella scena. Restano intatti posizioni, collisioni e geometria. Non si uniscono i veicoli o altri oggetti animati.

Collaudo browser: quartiere intero costruito, extra caricati, LOD e visibilità spaziale attivi; viste della strada iniziale e dello chalet integrato nella città. Nessun errore console osservato; resta l'avviso esistente sul modello Africa da 54130 triangoli.

Misura locale del solo rendering, 24 campioni dopo 8 fotogrammi di riscaldamento, camera ferma: prima dell'unione degli arredi Ultra 905 draw, mediana invio CPU 51,1 ms, p95 64,5 ms; dopo 803 draw, mediana 41,4 ms, p95 57,7 ms. Misure indicative su grafica integrata, non un benchmark degli FPS o della simulazione multiplayer. Caricamenti asincroni, shader e risorse residenti possono influenzare il confronto. Ultra resta troppo oneroso per considerarlo validato su questo hardware.

Test: prima esecuzione limitata dal sandbox (connessioni localhost EACCES); riesecuzione autorizzata con rete locale: 128 test superati, zero fallimenti. Dopo il batching finale: tre test relativi al batching superati; sintassi valida.

Screenshot: ultra-333-quartiere.png e ultra-333-chalet-citta.png. L'immagine è della scena completa statica, senza simulazione giocatori.

Lavoro ancora necessario: prova in partita prolungata, telefoni reali e PC con GPU dedicata; vegetazione meno schematica, edifici e arredi più vari, acqua meno periodica. Nessuna dichiarazione di qualità fotorealistica, 4K garantito o gioco pronto al lancio. Nessuna pubblicazione.
`nConfronto Alta sulla stessa vista: 799 draw, 1.151.893 triangoli, mediana invio CPU 35,4 ms, p95 54,2 ms. Anche questa misura riguarda solo il rendering statico e non gli FPS in partita.
