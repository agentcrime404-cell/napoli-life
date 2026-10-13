# Campione Ultra 332 — 11 ottobre 2026

Campione iniziale Chalet Ciro integrato in MergExtra.buildCiro, attivo solo in Ultra. Cornici in pietra a gradini, giunti, zoccolo laterale, montanti, maniglie e supporti delle tende; intonaco con materiale fisico e micro-rilievo sulle tende. Le siepi conservano geometria semplificata e colore attenuato.

Il dettaglio viene unito subito in tre mesh per materiale, anche quando lo chalet viene costruito dopo il caricamento della città. Verifica geometrica per dimensioni 22 × 9 metri: 684 triangoli e 3 chiamate di disegno; geometrie temporanee liberate dopo l'unione.

Profilo Ultra: mappe ombre 4096 (limitate alla capacità GPU), anisotropia fino a 16 per le texture caricate da tex(), facciate tridimensionali fino a 20 edifici entro 95 metri, contro 12/70 di Alta. Profili telefono invariati. Le ombre 4096 occupano quattro volte i texel delle 2048: il costo complessivo Ultra deve ancora essere misurato nel quartiere completo. La risoluzione dinamica esistente rimane attiva: Ultra non garantisce 4K nativo su qualsiasi dispositivo.

Verifiche: sintassi dei moduli valida; 14 test esistenti su batching e rilascio risorse superati; caricamento e rendering del campione isolato nel browser, senza errori console osservati. Screenshot ultra-332-chalet.png. Terreno e sfondo della schermata sono un banco di prova, non l'intera città. Non è un benchmark degli FPS e non dimostra fotorealismo o prontezza al lancio.

Da completare: confronto prestazioni Alta/Ultra nel quartiere completo, vegetazione meno schematica, modelli e facciate più vari, successiva estensione del campione. Nessuna pubblicazione effettuata.
