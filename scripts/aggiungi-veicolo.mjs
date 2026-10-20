// Aggiunge (o rimuove) un veicolo con modello 3D scaricato, controllandolo prima.
// Uso: node scripts/aggiungi-veicolo.mjs <file.glb> --id vespa-gts --tipo scooter --nome "Scooter GTS" --prezzo 900
//        --colore "#d9d3c3" --lunghezza 1.9 --autore "Autore" --fonte "https://..." --licenza "CC BY 4.0" [--yaw 3.1416]
//      node scripts/aggiungi-veicolo.mjs --rimuovi vespa-gts
// Aggiorna insieme: nuovi/<id>.glb, nuovi/manifest.json, shared/vehicles-extra.js e LICENZE.md.
import {readFileSync,writeFileSync,copyFileSync,existsSync,mkdirSync,rmSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=fileURLToPath(new URL('..',import.meta.url));
export const LIMITI={triangoliAvviso:30000,byteMobile:1_500_000,byteMax:12_000_000};
export const TIPI={
 auto:{shop:'auto',base:'auto',model:'sedan',emoji:'🚗',speed:2.9,lunghezza:4.3},
 cabrio:{shop:'auto',base:'cabrio',model:'super',emoji:'🏎️',speed:3.3,lunghezza:4.2},
 moto:{shop:'moto',base:'scooter',model:'naked',emoji:'🏍️',speed:3,lunghezza:2.1},
 scooter:{shop:'moto',base:'scooter',model:'scooter',emoji:'🛵',speed:2.3,lunghezza:1.8},
 bici:{shop:'bici',base:'bici',model:'mtb',emoji:'🚲',speed:1.9,lunghezza:1.8}};

/** Legge un GLB e ne ricava triangoli, byte e problemi. Lancia un errore se non è un GLB utilizzabile. */
export function analizzaGlb(file){
 const data=readFileSync(file);
 if(data.length<28||data.toString('ascii',0,4)!=='glTF')throw new Error('Non è un file GLB valido (deve iniziare con "glTF"). Scarica il formato glTF Binary (.glb).');
 const len=data.readUInt32LE(12);if(data.toString('ascii',16,20)!=='JSON')throw new Error('GLB corrotto: manca il blocco JSON.');
 const doc=JSON.parse(data.toString('utf8',20,20+len));
 const esterni=[...(doc.buffers||[]),...(doc.images||[])].filter(x=>x.uri&&!x.uri.startsWith('data:'));
 if(esterni.length)throw new Error('Il modello usa file esterni ('+esterni.map(x=>x.uri).slice(0,3).join(', ')+'): serve un GLB unico con tutto dentro.');
 const triangoli=Math.round((doc.meshes||[]).flatMap(m=>m.primitives||[]).reduce((s,p)=>{
  if(p.mode!==undefined&&p.mode!==4)return s;
  const a=doc.accessors?.[p.indices]??doc.accessors?.[p.attributes?.POSITION];return s+(a?a.count:0)/3;},0));
 if(!triangoli)throw new Error('Il modello non contiene triangoli.');
 return {bytes:data.length,triangoli,estensioni:doc.extensionsRequired||[]};
}

function arg(argv,nome,def){const i=argv.indexOf('--'+nome);return i>=0?argv[i+1]:def;}
function leggiManifest(p){return existsSync(p)?JSON.parse(readFileSync(p,'utf8')):{modelli:[]};}

function scriviExtra(root,manifest,voci){
 const righe=voci.map(v=>' '+JSON.stringify(v)).join(',\n');
 writeFileSync(path.join(root,'shared/vehicles-extra.js'),
`// File GENERATO da scripts/aggiungi-veicolo.mjs: non modificarlo a mano.
// Veicoli aggiuntivi con modello 3D scaricato (glb = id nel manifest client/assets/world/napoli/vehicles/nuovi/manifest.json).
// "model" è il modello disegnato dal gioco usato come riserva se il GLB non si carica.
export const EXTRA_VEHICLES=[${voci.length?'\n'+righe+'\n':''}];
`);
}
function leggiVoci(root){
 const f=path.join(root,'shared/vehicles-extra.js');if(!existsSync(f))return [];
 const m=readFileSync(f,'utf8').match(/EXTRA_VEHICLES=\[([\s\S]*)\];/);if(!m)return [];
 return m[1].split('\n').map(l=>l.trim().replace(/,$/,'')).filter(Boolean).map(l=>JSON.parse(l));
}

export async function esegui(argv,{root=HERE,log=console.log}={}){
 const dir=path.join(root,'client/assets/world/napoli/vehicles/nuovi'),manifestPath=path.join(dir,'manifest.json'),licenze=path.join(root,'client/assets/world/napoli/LICENZE.md');
 const rimuovi=arg(argv,'rimuovi');
 if(rimuovi){
  const manifest=leggiManifest(manifestPath),voci=leggiVoci(root);
  if(!manifest.modelli.some(m=>m.id===rimuovi))throw new Error('Veicolo "'+rimuovi+'" non trovato nel manifest.');
  manifest.modelli=manifest.modelli.filter(m=>m.id!==rimuovi);writeFileSync(manifestPath,JSON.stringify(manifest,null,1)+'\n');
  rmSync(path.join(dir,rimuovi+'.glb'),{force:true});scriviExtra(root,manifest,voci.filter(v=>v.glb!==rimuovi));
  if(existsSync(licenze)){const t=readFileSync(licenze,'utf8').split('\n').filter(l=>!l.includes('vehicles/nuovi/'+rimuovi+'.glb')).join('\n');writeFileSync(licenze,t);}
  log('Rimosso '+rimuovi+'. I giocatori che lo possedevano vedranno il modello di riserva del gioco.');return {rimosso:rimuovi};
 }
 const file=argv.find(a=>!a.startsWith('--')&&/\.glb$/i.test(a));
 if(!file)throw new Error('Indica il file .glb del modello (vedi le istruzioni in cima a scripts/aggiungi-veicolo.mjs).');
 const id=arg(argv,'id'),tipo=arg(argv,'tipo'),nome=arg(argv,'nome'),prezzo=Number(arg(argv,'prezzo')),colore=arg(argv,'colore','#8b9098'),
  autore=arg(argv,'autore'),fonte=arg(argv,'fonte'),licenza=arg(argv,'licenza'),yaw=Number(arg(argv,'yaw','0')),T=TIPI[tipo];
 if(!/^[a-z0-9][a-z0-9-]{2,28}$/.test(id||''))throw new Error('--id: 3-29 caratteri tra minuscole, numeri e trattini (es. vespa-gts).');
 if(!T)throw new Error('--tipo deve essere uno tra: '+Object.keys(TIPI).join(', '));
 if(!nome||nome.length>40)throw new Error('--nome obbligatorio (max 40 caratteri), un nome di fantasia senza marchi.');
 if(!Number.isInteger(prezzo)||prezzo<50||prezzo>20000)throw new Error('--prezzo: intero tra 50 e 20000 monete.');
 if(!/^#[0-9a-f]{6}$/i.test(colore))throw new Error('--colore: formato #rrggbb.');
 if(!autore||!fonte||!/^https?:\/\//.test(fonte))throw new Error('--autore e --fonte (link http/https) sono obbligatori: servono ai Crediti.');
 if(!/^(CC0|CC[ -]BY)/i.test(licenza||''))throw new Error('--licenza ammessa: CC0 oppure CC BY (es. "CC BY 4.0"). Altre licenze vanno verificate a mano.');
 if(/CC[ -]BY[ -](NC|ND)|NC|ND/i.test(licenza))throw new Error('Le licenze NC (non commerciale) e ND (non modificabile) non sono ammesse.');
 if(!Number.isFinite(yaw))throw new Error('--yaw deve essere un numero in radianti (es. 3.1416).');
 const lunghezza=Number(arg(argv,'lunghezza',T.lunghezza));if(!(lunghezza>=.8&&lunghezza<=8))throw new Error('--lunghezza in metri tra 0.8 e 8.');
 const info=analizzaGlb(file);
 if(info.bytes>LIMITI.byteMax)throw new Error('File troppo grande ('+(info.bytes/1e6).toFixed(1)+' MB, massimo '+LIMITI.byteMax/1e6+' MB). Riducilo (texture 1024 px).');
 const {VEHICLE}=await import(new URL('../shared/catalog.js',import.meta.url));
 const manifest=leggiManifest(manifestPath),voci=leggiVoci(root),catId='x-'+id,aggiorna=manifest.modelli.some(m=>m.id===id);
 if(!aggiorna&&VEHICLE[catId])throw new Error('L’id "'+catId+'" esiste già nel catalogo.');
 mkdirSync(dir,{recursive:true});copyFileSync(file,path.join(dir,id+'.glb'));
 const credito={text:`Veicolo "${nome}": modello di ${autore}, licenza ${licenza}.`,url:fonte};
 const voce={id:catId,shop:T.shop,base:T.base,model:T.model,glb:id,name:nome,emoji:T.emoji,buy:prezzo,speed:T.speed,color:colore};
 const m={id,file:id+'.glb',length:lunghezza,yaw,bytes:info.bytes,triangles:info.triangoli,credit:credito};
 manifest.modelli=[...manifest.modelli.filter(x=>x.id!==id),m];voci.splice(0,voci.length,...voci.filter(v=>v.glb!==id),voce);
 writeFileSync(manifestPath,JSON.stringify(manifest,null,1)+'\n');scriviExtra(root,manifest,voci);
 if(existsSync(licenze)){const riga=`| vehicles/nuovi/${id}.glb | "${nome}" — ${autore} — ${fonte} | ${licenza} (${licenza.startsWith('CC0')?'nessun obbligo di citazione':'citare l’autore: già nella schermata Crediti'}) |`;
  const t=readFileSync(licenze,'utf8').split('\n').filter(l=>!l.includes(`vehicles/nuovi/${id}.glb`)).join('\n').replace(/\n*$/,'\n')+riga+'\n';writeFileSync(licenze,t);}
 log(`${aggiorna?'Aggiornato':'Aggiunto'} ${catId} (${nome}): ${info.triangoli} triangoli, ${(info.bytes/1e6).toFixed(2)} MB.`);
 if(info.triangoli>LIMITI.triangoliAvviso)log('ATTENZIONE: oltre '+LIMITI.triangoliAvviso+' triangoli, può rallentare i telefoni. Meglio ridurlo.');
 if(info.bytes>LIMITI.byteMobile)log('ATTENZIONE: oltre '+LIMITI.byteMobile/1e6+' MB. Sui telefoni NON verrà caricato (resta il modello di riserva). Riduci le texture a 1024 px per averlo anche lì.');
 if(info.estensioni.length)log('Nota: il modello richiede le estensioni glTF '+info.estensioni.join(', ')+': se non appare, riesportalo senza compressione (Draco/meshopt).');
 log('Provalo: avvia il gioco e apri http://localhost:3079/vetrina-veicoli.html (la freccia verde deve puntare avanti; altrimenti usa --yaw 3.1416).');
 log('Poi alza CACHE in client/sw.js, esegui npm test e pubblica come al solito.');
 return {id:catId,...info};
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 esegui(process.argv.slice(2)).catch(e=>{console.error('Errore: '+e.message);process.exitCode=1;});
}
