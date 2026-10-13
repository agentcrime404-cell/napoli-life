// Preparazione degli shader con un limite di tempo che NON interrompe il lavoro. compileAsync non blocca la pagina: oltre il limite si continua
// ad aspettarlo (il chiamante non disegna: un disegno con shader ancora in preparazione li compilerebbe di fila e può bloccare il browser)
// e onLate avvisa una volta sola (sulle GPU lente la preparazione può durare più di 10 s e poi finire da sola).
// Gli errori veri (eccezione immediata, promessa rifiutata, anche dopo il limite) arrivano al chiamante. Esito: 'ok' in tempo, 'late' dopo il limite.
export function prepareWithLimit(start,{ms=10000,onLate=()=>{}}={}){
 let late=false;
 const timer=setTimeout(()=>{late=true;try{onLate();}catch(error){console.error('Avviso di preparazione lenta non riuscito',error);}},ms);
 return new Promise(ok=>ok(start())).then(()=>late?'late':'ok').finally(()=>clearTimeout(timer));
}

// Programmi nati durante una preparazione: quelli della pagina che non c'erano all'inizio (before = Set dei programmi di allora).
// Così si controllano solo i programmi nuovi, non tutti quelli della pagina.
export function programsSince(before,programs=[]){return programs.filter(program=>!before.has(program));}

// Programmi WebGL che non si collegano: compileAsync li dà per pronti e three li segnala solo al primo disegno.
// Si guardano solo quelli già pronti (nessuna attesa sulla GPU), ognuno una volta sola (seen): uno shader rotto è un avviso, non un errore
// che blocca il gioco, quindi si segnala una volta e poi non si interroga più la GPU. Restituisce i programmi rotti trovati ora.
export function brokenPrograms(programs=[],seen=new WeakSet()){
 const bad=[];
 for(const program of programs){
  if(seen.has(program))continue;
  if(!program.diagnostics&&program.isReady?.()===false)continue; /* ancora in preparazione: lo guarda il controllo successivo */
  if(!program.diagnostics)program.getUniforms?.();
  seen.add(program);if(program.diagnostics?.runnable===false)bad.push(program);
 }
 return bad;
}

// Avviso per gli shader rotti: nomi (per l'avviso breve) e dettagli del driver per la console (collegamento, vertex, fragment).
// Il nome di un programma three è quello del materiale, spesso vuoto: allora vale il tipo di shader (es. "lambert").
export function brokenReport(bad=[]){
 const label=program=>program.name||program.type||'senza nome',names=[...new Set(bad.map(label))];
 const details=bad.map(program=>{const d=program.diagnostics||{};return {name:label(program),programLog:d.programLog||'',vertexLog:d.vertexShader?.log||'',fragmentLog:d.fragmentShader?.log||''};});
 return {names,details};
}
