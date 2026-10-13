# Napoli Life — collaudo per l’uscita mobile

Stato: NON pronto per l’uscita. Documento di lavoro, da aggiornare dopo ogni correzione verificata.

## Evidenze ottenute
- Ultima suite automatica: 95 test superati, 0 falliti, 30,8 s. Comprende due client WebSocket indipendenti, autenticazione, sincronizzazione, persistenza, interni, permessi, traffico, collisioni e gestione degli input.
- Accesso browser: schermata iniziale, ospite, scelta Ciro, prepartita e ingresso confermati sulle build 292–294.
- Browser utilizzato: Chromium 154 su Windows, tramite browser integrato; GPU Intel UHD (ANGLE/Direct3D11), DPR 1. Formati provati: 1280×720 e 844×390. Queste prove NON certificano prestazioni su telefoni fisici.
- Costruzione scena: 6,7–7,7 s nelle prove locali. Scene iniziali: circa 1,59 milioni di triangoli, 746 materiali; 5.134 mesh prima del raggruppamento spaziale, circa 6.800 dopo. Sono quantità totali, NON triangoli effettivamente disegnati.
- Banco di prova: rendering del solo cielo circa 70 ms (primo fotogramma, include preparazione; NON FPS a regime).
- Il primo rendering della città si blocca. Riprodotto con rendering singolo. Le prime prove limitavano le mesh ma lasciavano visibili le insegne (sprite): non dimostrano che il mare sia la causa. Isolamento corretto per includere sprite e punti; variante acqua mobile Phong applicata provvisoriamente, esito ancora da verificare.
- Audit della mappa: 306 ingressi, 0 non raggiungibili. L’audit verifica la griglia; non sostituisce la visita in 3D di tutti gli ingressi.

## Aggiornamento del collaudo
- Banco di prova della città suddivisa: 264 chiamate di disegno e 655.192 triangoli nella visuale campionata; primo disegno 884 ms, secondo 26 ms. Tempi JavaScript di una chiamata render, non misure di FPS sostenuti o tempo GPU.
- Ingresso ospite, Ciro e prepartita nuovamente verificati sulla build 302. Il fotogramma completo resta bloccato nella fase di rendering; simulazione, avatar e dettagli arrivano fino a quella fase.
- Tre nuovi test della risoluzione adattiva superati separatamente dopo la suite: ripristino a 30 FPS, isteresi e limite massimo.
- Il cielo mobile usa ora una derivazione JPEG CC0 da 47 KB su una cupola, senza conversione cubica in tempo reale; la versione HDR originale rimane per i livelli PC. Questa modifica non ha ancora dato evidenza di risoluzione del blocco nella partita completa.

## Correzioni in corso
- Nessun rendering della città dietro accesso e prepartita; pausa quando la pagina è nascosta e azzeramento degli input.
- Costruzione della città suddivisa in fasi con restituzione del controllo all’interfaccia e schermata di caricamento/errore.
- Caricamento asincrono e riutilizzato dei modelli dei mezzi.
- Raggruppamento degli arredi per aree di 100 m, esclusione delle aree lontane già al primo frame.
- Misurazione FPS adattiva su tempo effettivo anziché delta simulazione limitato. Recupero della risoluzione mobile dopo campioni stabili vicino a 30 FPS, con attesa per evitare oscillazioni.
- La telecamera parte dalla posizione del giocatore invece di interpolare dall’origine della mappa; il primo posizionamento e i cambi di stanza sono immediati.
- Shader personalizzato del mare escluso dai livelli mobile: da collaudare.
- Miglioramenti degli interni con materiali, arredi, ombre, panorama, bancone e tavoli coerenti; da riverificare nel percorso completo.

## Impedimenti e verifiche residue obbligatorie
1. Risolvere e ricollaudare il blocco del primo rendering. Nessuna attestazione di 30/60 FPS finché non si entra e si gioca stabilmente.
2. Misurare FPS a regime e percentili, memoria e caricamento in sessioni prolungate; verificare almeno un Android medio, un Android più potente e un iPhone fisici. Nessun telefono fisico è stato collaudato in questa sessione.
3. Collaudare nel browser il percorso completo: camminata, touch simultaneo, camera, guida, collisioni, locali, appartamenti, acquisti interni, salvataggio, audio.
4. Due browser indipendenti con riconnessione, persistenza, rete lenta e interruzioni. I test WebSocket automatici già superati non sostituiscono questo percorso visivo.
5. Verificare gestione delle risorse condivise durante l’evizione della cache dei locali: l’attuale smaltimento può coinvolgere materiali riutilizzati.
6. Audit visivo della fedeltà di Mergellina e delle licenze degli asset consegnati; riferimenti fotografici esistenti nel progetto.
7. Generare e collaudare la build installabile finale e le istruzioni; nessuna pubblicazione effettuata.

## Avvio dello sviluppo
Da PowerShell nella cartella del progetto: `npm start`. Node.js 24 o successivo. Il lanciatore stampa l’indirizzo locale e quello Wi-Fi; per fermarlo usare Ctrl+C. Non avviare una seconda istanza sulla stessa porta.

Le pagine `_renderer-audit.html` e `_reference-review.html` sono strumenti temporanei di diagnosi e devono essere rimosse dalla consegna.

## Verifica successiva — build 304
Accesso ospite, scelta Ciro e prepartita confermati nuovamente su origine locale pulita (porta 32000). L’ingresso avvia la costruzione della città, ma il collaudo tramite browser non arriva a certificare una partita stabile: la lettura della pagina va in timeout. Non attribuire ancora il difetto a uno specifico shader o oggetto senza una riproduzione conclusiva.

I 12 test mirati su batch, suddivisione geometrie, visibilità e risoluzione adattiva passano. Il profilo mobile e il comportamento visivo del nuovo cielo richiedono ancora una verifica completa. Nessuna build è stata pubblicata.
