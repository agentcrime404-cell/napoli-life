# Ripresa della grafica — 10 ottobre 2026

Conversazione precedente recuperata: «Migliora il gioco», id 01a122aa-4298-7422-bff1-8517037751f1. Era archiviata ed è stata ripristinata.

Modifiche precedenti conservate: materiali illuminati, ombre morbide, arredi 3D dello Chalet Ciro e foglie irregolari.

In questa ripresa: foliage() in client/world/world3d.js unisce le foglie in quattro mesh per cespuglio invece di 110 (32 su mobile). Questo evita centinaia di oggetti separati nei dettagli aggiunti da MergExtra dopo il bake della città. Corretto il modulo per i semi negativi. Cache aggiornata da 286 a 287.

Verifiche: sintassi dei due moduli corretta, geometria valida per PC/mobile e semi negativi, 86 test passati con accesso al server locale. Il browser ha mostrato la scena dello Chalet Ciro e l'ingresso nella città. Il caricamento iniziale è lento e talvolta blocca temporaneamente l'automazione: non è stata misurata una variazione degli FPS.

Le modifiche sono locali. Nessuna pubblicazione su Render eseguita.