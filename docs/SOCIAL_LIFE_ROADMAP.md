# Napoli Life: roadmap Social Life Simulator

## Direzione

Napoli Life punta a essere una seconda vita sociale ambientata a Napoli. Il ciclo centrale è casa, spostamenti, incontri, attività, lavoro, acquisti e ritorno ai propri luoghi. Armi, rapine e fazioni restano codice isolato e contenuto facoltativo: non guidano la progressione o l'interfaccia principale.

## Inventario e priorità dei sistemi attuali

| Priorità | Sistemi già presenti | Direzione |
| --- | --- | --- |
| Essenziali | Avatar, movimento e guida; case e inviti; garage e proprietà dei veicoli; amicizie, messaggi, voce e profili; locali e negozi; lavori civili; monete, acquisti e bisogni; eventi | Stabilizzare e collegare questi sistemi nel percorso quotidiano. La prima area di qualità resta Chalet Ciro → Mergellina → Lungomare. |
| Utile più avanti | Arredo e personalizzazione, economia delle attività, progressione, eventi ricorrenti, pedoni e traffico, servizi di polizia e soccorso leggeri, ciclo giorno/notte e ambientazione sonora | Aggiungere dopo telemetria e test mobile, con densità e costi adattivi. Riutilizzare i luoghi e i sistemi esistenti. |
| Fuori priorità per il gameplay standard | Armi da fuoco, rapine complesse, guerre tra fazioni, loot e combattimento pesante | Non espandere in questa fase. Isolare o nascondere dal percorso sociale senza cancellare moduli funzionanti o dati. L'arena già presente resta un'attività separata. |

## Fasi tecniche

1. **Fondamenta sociali e affidabilità.** Gruppi temporanei di amici, inviti con scadenza, limiti server-side, uscita e successione del leader, rispetto di blocchi e amicizie. Un gruppo sociale non equivale a una gang e non concede privilegi economici o di gameplay.
2. **Percorso quotidiano del quartiere.** Usare la mappa esistente per collegare casa, veicolo, locali, incontri, lavori e negozi con inviti contestuali e obiettivi semplici. Non spostare la geometria per soddisfare il loop.
3. **Attività condivise.** Eventi piccoli organizzati dai giocatori, proposte di ritrovo nei luoghi già accessibili, sedute/emote e interazioni di gruppo. Ogni invito rispetta privacy, amicizie e blocchi.
4. **Lavori civili ed economia.** Consolidare pochi lavori ripetibili (consegne, taxi, meccanico e servizio locale), con ricompense trasparenti, persistenza e controlli contro duplicazioni. Non introdurre vantaggi pay-to-win.
5. **Vita ambientale.** Migliorare NPC, traffico, audio del mare e della città e ciclo temporale soltanto dopo benchmark; usare pooling, LOD, aggiornamento a distanza e budget di densità.
6. **Convalida mobile e multiplayer.** Suite browser emulata nei viewport landscape, test di due sessioni e test su dispositivi Android reali prima di dichiarare target hardware raggiunti.

## Primo incremento consegnato

Il primo incremento è il gruppo sociale persistente: massimo sei membri, inviti agli amici, accettazione/rifiuto, annullamento, rimozione del membro da parte del leader, uscita con successione deterministica, inviti con scadenza e rimozione dal gruppo quando un blocco rende incompatibile la relazione. Il client lo rende disponibile nel pannello Amici. I controlli autorevoli sono nel server; il gruppo non muove avatar e non modifica posizioni, case, proprietà o gang.

Il secondo incremento aggiunge il ritrovo condiviso: il leader sceglie tra locali sociali già registrati sulla mappa, tutti i membri vedono lo stesso luogo persistito e possono impostarlo come waypoint GPS. Il server sceglie nome e coordinate dalla propria lista di destinazioni valide, quindi una richiesta non può spostare un ritrovo con coordinate arbitrarie. Il ritrovo può essere spostato o annullato dal leader; non crea teletrasporti, ricompense o modifiche alla geometria.

Il terzo incremento aggiunge la conferma di partecipazione al ritrovo: ogni membro può indicare “Ci sono”, “Forse” o “Non vengo”; il gruppo vede i conteggi e riceve l'aggiornamento. Le risposte sono persistite insieme al ritrovo, partono da zero quando il leader cambia luogo e vengono rimosse quando un membro lascia il gruppo o viene rimosso. Il server accetta risposte soltanto dai membri e soltanto per i tre stati previsti.

Il quarto incremento aggiunge il check-in condiviso: un membro online può segnare l'arrivo soltanto se si trova nella stanza del ritrovo e a non più di 12 metri dal locale. L'arrivo viene salvato nel ritrovo, conferma automaticamente la partecipazione, compare nel conteggio del gruppo e genera una notifica agli altri membri. I check-in ripetuti sono idempotenti; spostare o annullare il ritrovo azzera lo stato e uscire dal gruppo rimuove il check-in del membro. Il controllo usa la posizione autorevole del server e non teletrasporta il giocatore.

Il client aggiorna l'abilitazione del check-in a ogni stato multiplayer, quindi il pulsante diventa disponibile quando il giocatore raggiunge il raggio senza dover chiudere e riaprire la scheda. Nella visuale mobile il check-in è il comando primario e resta nella parte alta della scheda. La prova live del 14 ottobre 2026 ha usato due sessioni Edge con viewport touch 844×390: cammino verso Chalet del Golfo, check-in entro 12 m, persistenza server, notifica e aggiornamento immediato del conteggio nell'altra sessione; zero errori console/JavaScript. Report e screenshot sono in `artifacts/qa-social-checkin-2026-10-14/`. Per ripetere il test: avvia un'istanza 3D con database di prova su una porta libera, imposta `QA_BASE_URL` e `QA_OUTPUT_DIR`, poi esegui `npm run qa:social:live`.

Nel pannello Lavoro, mestieri civili, locali, consegne e missioni restano nel percorso iniziale. La scheda Gang è conservata in “Sistemi RP opzionali”, chiusa per impostazione predefinita e caricata soltanto quando il giocatore la apre; questo riduce l'enfasi senza cancellare dati o servizi esistenti.

## Da verificare prima di estendere il sistema

- La prova browser a due sessioni è stata eseguita con account temporanei; resta una prova su Android fisico, oltre al collaudo server automatizzato.
- Verificare l'arrivo e il waypoint su un telefono Android reale e controllare il comportamento con riconnessione o cambio di stanza durante un ritrovo.
- Abbandono/disconnessione offline durante un incontro e comportamento del gruppo dopo il riavvio del server.
- Test multiistanza e limiti/rate control degli inviti per un server pubblico.
- Ricerca UX con giocatori per verificare che il gruppo e gli inviti siano immediati su touch.

Questa roadmap descrive lo stato del codice osservato durante lo sviluppo, non certifica prontezza commerciale né sostituisce una revisione di sicurezza o legale.
