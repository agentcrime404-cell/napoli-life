# Report di provenienza asset — Napoli Life

Data audit: 2026-10-12. Il report riguarda i file presenti nel repository e il caricamento runtime attuale. Non costituisce parere legale.

L’inventario automatico aggiornato registra 288 file `runtime`, 252 `review-required` e 3 `excluded-runtime`. `review-required` è una segnalazione prudenziale basata su percorsi ed estensioni: non significa che siano 252 violazioni accertate, né che gli altri file abbiano ricevuto una liberatoria legale.

## Contenuti originali del progetto

| Categoria | Contenuto | Stato |
|---|---|---|
| Geometria | Strade, marciapiedi, palazzi procedurali, Vesuvio, pontili, barche, Chalet del Golfo e locali | Originale generato dal codice; coordinate e collisioni interne |
| Attività | Nomi, insegne, colori e descrizioni delle attività | Originali; non usare loghi o campagne reali |
| Audio | `client/audio/ambient.js`, `client/audio/vehicle-engine.js`, effetti UI e suoni sintetici | Generato proceduralmente dal progetto; nessuna registrazione di terzi rilevata |
| Interfaccia | HUD, minimappa, icone emoji, pannelli e testi | Creati nel progetto; verificare solo eventuali font o immagini aggiunti in futuro |
| Animazioni procedurali | Guida, inclinazione, camera, pedoni, traffico | Codice originale |

## Licenze documentate e utilizzabili con obblighi

- Kenney: modelli città, veicoli e arredi CC0.
- Poly Haven: materiali, HDR, vegetazione e arredi CC0.
- Quaternius: personaggi CC0.
- Microsoft Rocketbox: modelli e animazioni MIT; il testo MIT deve restare incluso nella distribuzione.
- Three.js e `waternormals.jpg`: MIT; conservare le attribuzioni.
- OpenStreetMap: dati della mappa con ODbL; mantenere attribuzione agli OpenStreetMap contributors.
- Alcune palme convertite da modelli Sketchfab: CC-BY 4.0; richiedono attribuzione dell’autore e prova della licenza.
- Fotografie Wikimedia usate per Castel dell’Ovo e facciate: indicate come pubblico dominio nella documentazione; conservare fonte e prova dello status.

Riferimento completo: [LICENZE.md](../client/assets/world/napoli/LICENZE.md).

## Materiali esclusi dal runtime

I file presenti in `vehicles/moto-vere` e `vehicles/auto-vere` (inclusi modelli ispirati a marchi reali e modelli con licenza CC-BY non ancora verificata) non vengono più caricati da `realvehicles.js`. Restano nel repository come materiale storico e devono essere esclusi dal pacchetto di pubblicazione oppure rimossi dopo un controllo legale.

## Schermate iniziali aggiornate — 2026-10-12

- `client/assets/sfondo-login-v2.webp` e `client/assets/sfondo-pregame-v4.webp` sono immagini create/modificate con ImageGen per questo progetto. La schermata d’ingresso mostra l’insegna inventata “Chalet del Golfo”; l’auto principale è stata ridisegnata come modello fittizio, senza emblema di costruttore né targa leggibile.
- Non è stato importato un nuovo file fotografico da un sito esterno in questo aggiornamento. La generazione e la modifica non costituiscono da sole una garanzia legale: termini d’uso applicabili e somiglianze residue con opere o design esistenti restano da verificare prima della distribuzione commerciale.
- Le varianti obsolete `sfondo-login.webp`, `sfondo-pregame.webp`, `sfondo-pregame-v2.webp` e `sfondo-pregame-v3.webp` sono state spostate in `docs/asset-archive/`, fuori dagli asset pubblici e non sono referenziate dal runtime. L’asset manifest le esclude dal pacchetto client.
- La nuova immagine `sfondo-pregame-v4.webp` è classificata `review-required` nell’inventario automatico: non viene dichiarata commercialmente libera senza verifica dei termini e revisione professionale.

## Contenuti che richiedono autorizzazione

- Marchi, loghi, insegne, nomi commerciali, campagne pubblicitarie e fotografie fornite da attività reali.
- Eventi, musica, video o contenuti caricati dagli utenti senza una licenza di distribuzione commerciale.
- Fotografie non chiaramente in pubblico dominio o con licenza compatibile con il gioco.

## Sostituzioni e compatibilità

Le sostituzioni effettuate riguardano soltanto nomi visualizzati e loader degli asset esterni. Non sono state cambiate coordinate, geometrie di collisione, porte, interazioni, sincronizzazione multiplayer o percorsi della mappa.

## Verifiche ancora necessarie

1. Creare un archivio di release contenente solo gli asset runtime e confrontarlo con questo report.
2. Verificare nel pacchetto finale ogni immagine, font, GLB/GLTF e file audio aggiunto dopo l’audit.
3. Conservare copie delle licenze e delle attribuzioni nella build pubblicata.
4. Far controllare da un professionista i casi CC-BY, ODbL, fotografie e l’eventuale pubblicità reale prima della vendita.

Il progetto non viene dichiarato sicuro al 100% senza questa verifica finale sul pacchetto di release e una revisione legale professionale.
