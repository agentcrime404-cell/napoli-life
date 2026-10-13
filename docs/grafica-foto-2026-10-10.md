# Grafica e comandi dalle foto — 10 ottobre 2026, versione 288

Riferimenti: sei tavole salvate in data/telegram-foto, a partire da 1791580434.jpg; strada 1791581452.jpg, locale 1791581587.jpg, appartamento 1791581696.jpg.

Completato nel codice:
- Nuovo client/ui/reference-hud.css: pulsanti circolari scuri, microfono/amici/menu in alto a destra, chat laterale, joystick visibile, azioni in basso, minimappa tonda. Formati PC, telefono verticale e orizzontale.
- Gli stessi pulsanti sono spostati in hud.js e mantengono eventi e ID. Profilo, inventario e telefono restano accessibili. Etichette accessibili aggiunte.
- Minimap quadrata senza deformazione; freccia del giocatore e zoom funzionante a Mergellina.
- Interni: materiali standard al posto dei pavimenti toon e delle pareti basic; parquet con venature e piastrelle blu/crema, divani beige con cuscini, foglie irregolari, sospensioni calde e scaffali con bottiglie.
- Aperture panoramiche 3D, vetri, balconi e tende; mare, barche, skyline e Vesuvio oltre le finestre di case e bar. La geometria non modifica le collisioni o i confini delle stanze.
- Comando Siediti/Alzati contestuale e icone vettoriali per telecamera/mappa.

Verifiche: sintassi dei moduli modificati corretta; geometria del nuovo allestimento verificata con Three.js su casa/bar/negozio, PC e mobile. Suite: 85 test su 86 passati; il test launch non vede il messaggio di avvio entro circa 2.5 secondi e fallisce anche isolato. Il browser apre il gioco e la nuova disposizione; trovati e corretti joystick nascosto, azioni a griglia e SVG troppo piccoli.

Limiti: resa ancora più semplice delle immagini fotografiche. Bar e villa0 sono stati verificati visivamente in una pagina temporanea che richiama lo stesso World3D.buildInterior del gioco. Screenshot salvati in docs/grafica-bar-288.png e docs/grafica-casa-288.png. Nessun errore o warning nella console della vista interni. Tavoli e sedie dei bar ora usano modelli GLTF Poly Haven già presenti nel progetto. Aggiunto il soffitto, visibile solo dal basso, con travi. Il passaggio effettivo dalla strada al locale resta da provare. Il browser intermittentemente blocca catture e comandi dopo il caricamento della città. Non è stato eseguito un deploy su Render. Schermata del gioco con comandi corretti salvata in docs/grafica-comandi-288.png; pulsante chat verificato. Per continuare, completare la verifica verticale e provare ingresso reale in un bar e in una casa. Non dichiarare grafica identica alle foto.