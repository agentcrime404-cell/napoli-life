# Rifinitura grafica 331 — 11 ottobre 2026

Intervento sul punto 4, conservando gli aggiornamenti trovati fino alla cache 330.

- Intonaci fotografici schiariti con miscela calda; colline meno sature e foschia graduale da 320 a 2600 metri.
- Sfondo urbano con texture di finestre dedicata, evitando la fotografia ripetuta 24 volte e il conseguente grigio nei livelli mipmap.
- Corretto il velo del tramonto: la cupola scrive la posizione alla profondità dello sfondo e verifica la profondità della scena. Non copre più prato, strada ed edifici opachi. Il solo ordine di disegno non risolveva il problema perché la cupola è trasparente.
- Mantenuta la correzione dello shader del mare presente nella versione 330.

Verifica: scena locale caricata nel browser, viste strada e golfo; giorno, tramonto e notte. Nessun errore console rilevato. Sintassi world3d.js valida; 20 test shader/resource-lifetime superati. Screenshot grafica-331-giorno.png e grafica-331-tramonto.png. Il pannello di collaudo disegna singoli fotogrammi: i tempi CPU mostrati NON sono una misura degli FPS durante il gioco.

Limiti ancora visibili: sagome degli edifici lontani troppo uniformi, ripetizione delle facciate vicine, vegetazione e arredi semplificati; le onde conservano una periodicità percepibile. Non equivale alle foto di riferimento e non certifica la prontezza al lancio. Nessun test su telefono reale in questo intervento. Il log conserva inoltre un avviso sul modello africa da 54130 triangoli.
