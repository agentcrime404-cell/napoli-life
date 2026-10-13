# Audit contenuti commerciale — Napoli Life

## Stato

La geografia di Mergellina è mantenuta come dato cartografico OpenStreetMap con attribuzione ODbL nei crediti. Le attività commerciali del gioco usano nomi e insegne inventati.

## Azioni applicate

- Rimossi dal caricamento runtime i GLB esterni nelle cartelle `vehicles/moto-vere` e `vehicles/auto-vere`; i mezzi vengono generati dal codice o caricati dai kit già verificati.
- Sostituiti i nomi visibili ispirati a marchi con nomi originali: `Compatta Tonda`, `Compatta Quadra`, `Maxi Enduro Bimotore` e simili.
- Aggiornata la schermata iniziale con l’insegna “Chalet del Golfo” e un’auto fittizia senza marchio o targa leggibile; le varianti obsolete sono state archiviate fuori dagli asset pubblici.
- Mantenuti i riferimenti tecnici interni solo quando necessari alla compatibilità del salvataggio; non sono insegne o marchi mostrati al giocatore.
- Conservate le attribuzioni CC0, MIT, CC-BY e ODbL in `client/assets/world/napoli/LICENZE.md`.

## Contenuti da verificare prima della pubblicazione

- Ogni texture o fotografia aggiunta manualmente dopo questo audit deve avere una fonte e una licenza registrate.
- I modelli CC-BY possono restare solo con attribuzione completa e prova della licenza; in assenza di prova vanno esclusi dalla build.
- Non usare loghi, insegne, nomi commerciali, targhe o campagne pubblicitarie reali senza accordo scritto.
- Le immagini generate o modificate con strumenti generativi richiedono comunque controllo dei termini d’uso e delle somiglianze con design o opere di terzi; la generazione non equivale a una liberatoria.
- I nomi geografici reali (strade, Mergellina, Napoli) restano riferimenti territoriali e non marchi commerciali.

Questo audit riduce il rischio di distribuzione, ma la pubblicazione commerciale finale deve includere una revisione legale dei file effettivamente impacchettati e dei contratti pubblicitari.
