# Napoli Life — verifica modalità vita sociale (2026-10-19)

## Perimetro verificato

Il progetto esistente usa Three.js/WebGL nel client, Node.js per HTTP e WebSocket, e SQLite per i dati persistenti. Questa verifica riguarda la build 3D già presente e l'avvio locale; non è una riscrittura del gioco.

Il branch di sicurezza attivo è `codex/napoli-life-safety-2026-10-19`, al commit `a2449a9` (`Fix mobile movement stutter and touch QA`). Sono stati esaminati gli ultimi sei commit. Non è emersa una regressione attribuibile con certezza a un commit pubblicato. È invece stata riprodotta una regressione nell'albero di lavoro locale: `client/ui/city.js` importava `COUNTERMALL_SHOPS`, simbolo inesistente; la correzione all'import `COUNTER, MALL_SHOPS` ha permesso l'avvio del client.

## Interventi della fase

- Introdotta la modalità `social-life`; nel server 3D sono disattivati gli endpoint di armi da fuoco, arena, rapine, bande, arresti e multe, e l'arruolamento nella polizia restituisce `410`.
- Il server 3D non costruisce più i servizi Arena, Firearms, Heists, Gangs o Police. Vecchi dati di progressione criminale vengono rimossi al login; gli altri progressi, come veicoli e saldo, vengono preservati.
- La vecchia HUD dell'arena è un adattatore inerte per mantenere compatibile il cablaggio esistente. Sono state rimosse le voci criminali dall'HUD di guida e dal POI arena; sono conservati i controlli veicolo, rifornimento, riparazioni, lavori civili, attività commerciali e sociali.
- Rimosse le collisioni invisibili del vecchio perimetro arena. Rimangono le collisioni civili e dei distributori.
- Il modulo storico di polizia e gli asset/animazioni legacy restano nel repository per ora: non vengono attivati dal server 3D. Non sono stati cancellati per evitare di rompere percorsi storici o test non ancora migrati.

## Sistemi presenti e livello di verifica

- Movimento, avatar 3D, terza persona e camera touch: caricamento e input verificati nel browser mobile emulato.
- Veicoli, ingresso/uscita e guida: coperti da test server/client automatici già presenti; non è stato eseguito in questa fase un secondo test manuale completo con due browser connessi.
- Multiplayer WebSocket, chat e sincronizzazione: la suite d'integrazione esistente passa; questa esecuzione non equivale a un test di carico né a una prova su rete mobile reale.
- Lavori civili, negozi, inventario, saldo, proprietà e interazioni: funzionalità già presenti in misura diversa; i test esistenti passano. Non sono state implementate in questa fase nuove carriere, appartamenti o voice chat.
- La mappa 3D di Mergellina viene caricata, ma la fedeltà completa degli edifici e della zona delle “13 scese” non è stata certificata da rilievo geografico e confronto sul posto.
- Creazione avatar, chat vocale di prossimità, gruppi/eventi completi, proprietà arredabili e transazioni economiche anti-exploit richiedono ulteriore lavoro e test dedicati.

## Test e prestazioni

- `npm test`: **234 passati, 0 falliti**.
- `node --test tests/social-mode.test.js`: **5 passati, 0 falliti**.
- Smoke test live del gioco su viewport browser emulati landscape **844×390**, **915×412** e **932×430**: **35 controlli passati, 0 falliti**; nessun errore console/pagina e nessuna sovrapposizione HUD imprevista. Personaggio, mondo, camera, input a piedi/veicolo, multitouch, rilascio pointer e passaggio portrait/landscape sono stati verificati. Due sovrapposizioni interne alla minimappa sono intenzionali.
- Screenshot e report: `artifacts/qa-social-life-phase1-2026-10-19-matrix/` (matrice completa); il primo smoke run è in `artifacts/qa-social-life-phase1-2026-10-19-rerun/`.
- Prestazioni del browser emulato, per viewport: **844×390: 6 FPS, P95 900 ms, P99 966,7 ms, picco 966,7 ms; 915×412: 3 FPS, P95 933,3 ms, P99 966,7 ms, picco 966,7 ms; 932×430: 2 FPS, P95 933,3 ms, P99 966,7 ms, picco 999,9 ms**. Heap JS riportato **11,3 MB**. Il renderer varia tra **417 e 422 draw call**, **670.933–681.682 triangoli**, **302 geometrie** e **97 texture**. La memoria GPU non è esposta dal browser.
- Prestazioni: **FAIL** rispetto all'obiettivo 30 FPS. Le misure sono browser/emulate e non Samsung S24 Ultra; non vanno interpretate come benchmark del telefono. Il profilo non isola ancora CPU e GPU fisiche, quindi il collo di bottiglia va profilato prima di scegliere ottimizzazioni grafiche.
- Nessun test è stato eseguito su un telefono Android fisico in questa fase.

## Stato Git e lavoro rimanente

Le modifiche sono locali sul branch di sicurezza. Il worktree conteneva già numerose modifiche e artefatti non correlati all'inizio di questa fase; non è stato creato un commit aggregato per evitare di includere lavoro altrui o non verificato. Il server QA temporaneo su `127.0.0.1:33119` è stato arrestato dopo la verifica; il server preesistente sulla porta 3079 non è stato toccato.

Prossimo ordine consigliato:

1. Separare con staging selettivo le modifiche già presenti e creare un commit autonomo della sola fase “social-life/no combat”.
2. Profilare caricamento, frame loop e rendering con tracing per attribuire i frame lunghi a task JavaScript, caricamento asset o GPU; ripetere su 844×390, 915×412 e 932×430.
3. Correggere i colli di bottiglia misurati e ripetere la suite browser; confermare il risultato su S24 Ultra prima di dichiarare 30 FPS.
4. Completare le verifiche di due sessioni multiplayer e le funzionalità social/economiche mancanti.
