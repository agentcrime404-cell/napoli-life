import {cleanAvatar,cleanPhoto} from '../shared/avatar.js';
import {Roleplay} from './rp.js';
import {Heists} from './heist.js';
import {Bag} from './bag.js';
import {Biz} from './biz.js';
import {Gangs} from './gang.js';
import {LOOKS} from '../shared/looks.js';import {setNapoli} from '../shared/napoli.js';import {registerMergellina,registerMallFloor,EXTRA_BLOCKS} from '../shared/world.js';import {solidBlocks} from '../shared/catalog.js';import {Arena} from './arena.js';import {Fuel} from './fuel.js';import {Police} from './police.js';import {Service} from './service.js';
// Zona Mergellina di HUMANA life 3D (mappa vera OpenStreetMap), se il file della mappa esiste.
const BUILD=(()=>{try{return (readFileSync(new URL('../client/sw.js',import.meta.url),'utf8').match(/humana-life-(\d+)/)||[])[1]||'0';}catch{return '0';}})();
let napoliLoaded=false;function loadMergellina(){if(napoliLoaded)return;napoliLoaded=true;try{setNapoli(JSON.parse(readFileSync(new URL('../client/assets/world/napoli/map/mergellina.json',import.meta.url),'utf8')));registerMergellina();}catch(e){console.warn('Mergellina non caricata:',e.message);}}
import http from 'node:http';import https from 'node:https';import {readFileSync,createReadStream} from 'node:fs';import {readFile,stat} from 'node:fs/promises';import {networkInterfaces} from 'node:os';import {gzipSync} from 'node:zlib';import {fileURLToPath} from 'node:url';import {resolve as pathResolve,extname,sep,dirname as pathDirname,join as pathJoin} from 'node:path';import {randomUUID} from 'node:crypto';import {WebSocketServer} from 'ws';
import {database} from './database.js';import {hashPassword,verify,token,resolve,publicUser,digest} from './auth.js';import {Game} from './game.js';import {payments} from './payments.js';import {Living} from './living.js';import {saveReport,logError} from './reports.js';import {MapEditor} from './editor.js';import {Jobs} from './jobs.js';import {Phone} from './phone.js';import {verifyGoogle,googleUser,googleClientId,randomSecret} from './google.js';
import {Needs} from './needs.js';
import {Firearms} from './firearms.js';
const root=fileURLToPath(new URL('..',import.meta.url));
const ipv4Number=address=>address.split('.').reduce((n,part)=>(n*256+Number(part))>>>0,0);
function isPrivateIPv4(address){const p=address.split('.').map(Number);return p.length===4&&(p[0]===10||p[0]===192&&p[1]===168||p[0]===172&&p[1]>=16&&p[1]<=31||p[0]===169&&p[1]===254);}
function isLocalAddress(address){const ip=String(address||'').toLowerCase().replace(/^::ffff:/,'');if(ip==='::1'||ip==='localhost')return true;if(ip.includes(':'))return ip.startsWith('fc')||ip.startsWith('fd')||ip.startsWith('fe80:');return ip.startsWith('127.')||isPrivateIPv4(ip);}
function lanIPv4Addresses(remoteAddress){const remote=String(remoteAddress||'').replace(/^::ffff:/,'');const rows=[];for(const [name,items] of Object.entries(networkInterfaces()))for(const item of items||[]){if((item.family==='IPv4'||item.family===4)&&!item.internal&&isPrivateIPv4(item.address))rows.push({name,address:item.address,netmask:item.netmask||'255.255.255.0'});}const unique=[...new Map(rows.map(row=>[row.address,row])).values()];const sameSubnet=row=>{if(!remote.includes('.')||remote.split('.').length!==4)return false;try{return(ipv4Number(remote)&ipv4Number(row.netmask))===(ipv4Number(row.address)&ipv4Number(row.netmask));}catch{return false;}};const rank=row=>sameSubnet(row)?0:/wi.?fi|wireless|wlan/i.test(row.name)?1:/ethernet/i.test(row.name)?2:3;return unique.sort((a,b)=>rank(a)-rank(b));}
// Origini dell'app Android (Capacitor). L'accesso usa token Bearer, non cookie.
const APP_ORIGINS=new Set(['http://localhost','https://localhost','capacitor://localhost']);
// HUMANA life (2D) e HUMANA life 3D sono due giochi separati: ognuno ha il suo processo, la sua porta e il suo archivio.
// "edition": '' = HUMANA life (2D, scripts/play.mjs), '3d' = HUMANA life 3D (scripts/play-3d.mjs).
export function createApp({dbPath=process.env.DATABASE_PATH||'./data/humana.sqlite',edition=''}={}){
 if(edition==='3d'){loadMergellina();registerMallFloor();} // la zona Mergellina esiste solo in HUMANA life 3D
 const db=database(dbPath),game=new Game(db),limits=new Map();const firearms=new Firearms(game);game.firearms=firearms;
 const zipped=new Map();function rate(key,max){const now=Date.now();let r=limits.get(key);if(!r||now-r.time>60000)limits.set(key,r={time:now,n:0});if(limits.size>10000)limits.delete(limits.keys().next().value);return ++r.n<=max;}
 const living=new Living(db,game);living.edition=edition;const editor=new MapEditor(db,game);const jobs=new Jobs(db,game);game.jobs=jobs;const needs=new Needs(game);game.needs=needs;const phone=new Phone(db,game);game.phone=phone;game.living=living;if(edition==='3d'){if(!EXTRA_BLOCKS.length)EXTRA_BLOCKS.push(...solidBlocks());game.arena=new Arena(game);game.fuel=new Fuel(game);game.service=new Service(game);game.police=new Police(game);game.rp=new Roleplay(game);game.heist=new Heists(game);game.bag=new Bag(game);game.biz=new Biz(game);game.gangs=new Gangs(game);}const pay=payments(db);
 const handler=async(req,res)=>{
  const json=(code,data)=>{res.writeHead(code,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const url=new URL(req.url,'http://localhost');
   if(url.pathname==='/health'&&req.method==='GET')return json(200,{status:'ok'});
   if(url.pathname==='/version.json'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({build:BUILD,gioco:'Napoli life'}));return;}
   // Immagini scaricate dall'app sul telefono (oggetti aggiunti dopo l'installazione).
   if(!url.pathname.startsWith('/api/')&&APP_ORIGINS.has(req.headers.origin)){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');}
   if(url.pathname.startsWith('/api/')){
    if(APP_ORIGINS.has(req.headers.origin)){res.setHeader('Access-Control-Allow-Origin',req.headers.origin);res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Headers','Content-Type, Authorization');res.setHeader('Access-Control-Allow-Methods','GET, POST, PATCH, DELETE');res.setHeader('Access-Control-Max-Age','600');}
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(url.pathname==='/api/stripe/webhook'&&req.method==='POST'){let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>65536)return json(413,{error:'Richiesta troppo grande'});}return json(200,pay.webhook(raw,req.headers['stripe-signature']));}
    if(!rate(req.socket.remoteAddress+(url.pathname.startsWith('/api/auth')?'auth':'api'),url.pathname.startsWith('/api/auth')?20:180))return json(429,{error:'Troppe richieste. Riprova fra un minuto.'});
    // Il QR Wi-Fi è disponibile solo nel server 3D e solo ai dispositivi della rete locale.
    if(url.pathname==='/api/wifi'&&req.method==='GET'){
     if(edition!=='3d'||process.env.RENDER||!isLocalAddress(req.socket.remoteAddress))return json(404,{error:'Condivisione Wi-Fi disponibile solo sulla rete locale di Napoli life'});
     const interfaces=lanIPv4Addresses(req.socket.remoteAddress);if(!interfaces.length)return json(503,{error:'Nessun indirizzo IPv4 Wi-Fi disponibile sul PC'});
     const port=server.address()?.port||Number(process.env.PORT_3D)||3079,protocol=req.socket.encrypted?'https':'http',urls=interfaces.map(i=>({address:i.address,url:`${protocol}://${i.address}:${port}/`})),selected=urls[0];
     try{const {default:QRCode}=await import('qrcode'),qrDataUrl=await QRCode.toDataURL(selected.url,{width:360,margin:2,errorCorrectionLevel:'M',color:{dark:'#0b1622',light:'#ffffff'}});let apkAvailable=false;try{await stat(pathResolve(root,'dist','HUMANA-3D.apk'));apkAvailable=true;}catch{}return json(200,{url:selected.url,urls,qrDataUrl,apkAvailable,apkUrl:`${protocol}://${selected.address}:${port}/scarica/HUMANA-life-3D.apk`});}
     catch(error){console.error('Generazione QR Wi-Fi non disponibile:',error.message);return json(503,{error:'Generatore QR non disponibile sul server. Avvia il progetto con le dipendenze di sviluppo installate.'});}
    }
    if(url.pathname==='/api/errore'&&req.method==='POST'){let text='';for await(const chunk of req){text+=chunk;if(text.length>3000)break;}try{await logError(pathDirname(pathResolve(dbPath)),JSON.parse(text.slice(0,3000)),req.headers['user-agent']);}catch{}return json(200,{ok:true});}
    if(url.pathname==='/api/segnala'&&req.method==='POST'){const user=resolve(db,req.headers.authorization?.replace(/^Bearer /,''));if(!user)return json(401,{error:'Accedi per continuare'});if(!editor.isAdmin(user))return json(403,{error:'Solo gli admin possono inviare segnalazioni'});let text='';for await(const chunk of req){text+=chunk;if(text.length>3e6)return json(413,{error:'Immagine troppo grande'});}try{return json(200,await saveReport(pathJoin(pathDirname(pathResolve(dbPath)),'segnalazioni'),user,JSON.parse(text)));}catch(e){return json(e.status||400,{error:e.message});}}
    let body={};if(['POST','PATCH','DELETE'].includes(req.method)){let text='';for await(const chunk of req){text+=chunk;if(text.length>8192)return json(413,{error:'Richiesta troppo grande'});}try{body=JSON.parse(text||'{}');if(!body||Array.isArray(body)||typeof body!=='object')return json(400,{error:'Oggetto JSON richiesto'});}catch{return json(400,{error:'JSON non valido'});}}
    if(url.pathname==='/api/auth/options'&&req.method==='GET')return json(200,{googleClientId:googleClientId()});
    if(url.pathname==='/api/auth/google'&&req.method==='POST'){try{const g=await verifyGoogle(body.credential);const {user,created}=googleUser(db,g,await hashPassword(randomSecret()));return json(200,{token:token(db,user.id),user:publicUser(user),created});}catch(e){return json(e.status||500,{error:e.message});}}
    if(['/api/auth/register','/api/auth/login'].includes(url.pathname)&&req.method==='POST'){
     const {username,password}=body;if(!/^[a-zA-Z0-9_]{3,20}$/.test(username||'')||typeof password!=='string'||password.length<(url.pathname.endsWith('register')?8:6)||password.length>128)return json(400,{error:'Nome: 3–20 lettere/numeri/_; password: 8–128 caratteri.'});
     let user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
     if(url.pathname.endsWith('register')){
      if(user)return json(409,{error:'Nome già utilizzato'});
      const hashed=await hashPassword(password);try{db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run(randomUUID(),username,hashed);}catch{return json(409,{error:'Nome già utilizzato'});}user=db.prepare('SELECT * FROM users WHERE username=?').get(username);
     }else if(!user||!await verify(password,user.password))return json(401,{error:'Credenziali non valide'});
     return json(200,{token:token(db,user.id),user:publicUser(user)});
    }
    // Ingresso da ospite, solo su HUMANA life 3D: si sceglie un personaggio e si entra, senza nome né password.
    // Viene creato un profilo con un nome automatico (es. Ciro_4821); il browser lo ricorda e la volta dopo si rientra con lo stesso.
    if(url.pathname==='/api/auth/guest'&&req.method==='POST'){
     if(edition!=='3d')return json(403,{error:'Ingresso da ospite disponibile solo su Napoli life'});
     // Chi ha già un profilo ospite in questo browser lo riprende: "GIOCA SUBITO" non ne crea un altro.
     {const old=req.headers.authorization?.replace(/^Bearer /,''),prev=resolve(db,old);if(prev){let a={};try{a=JSON.parse(prev.avatar);}catch{}if(a.guest)return json(200,{token:old,user:publicUser(prev),created:false});}}
     if(!rate(req.socket.remoteAddress+'guest',8))return json(429,{error:'Troppi ingressi da ospite. Riprova fra un minuto.'});
     const look=Number.isInteger(body.look)&&body.look>=0&&body.look<LOOKS.length?body.look:0,hashed=await hashPassword(randomSecret());let guest=null;
     for(let i=0;i<20&&!guest;i++){const name=LOOKS[look].name+'_'+(1000+Math.floor(Math.random()*9000));try{db.prepare('INSERT INTO users(id,username,password,avatar) VALUES(?,?,?,?)').run(randomUUID(),name,hashed,JSON.stringify({color:'#41d9cf',accessory:'none',body:'regular',glasses:false,look,guest:true,...(edition==='3d'&&cleanPhoto(body.photo)?{photo:cleanPhoto(body.photo)}:{})}));guest=db.prepare('SELECT * FROM users WHERE username=?').get(name);}catch{}}
     if(!guest)return json(503,{error:'Non riesco a creare il profilo ospite. Riprova.'});return json(200,{token:token(db,guest.id),user:publicUser(guest),created:true});
    }
    const raw=req.headers.authorization?.replace(/^Bearer /,'');const user=resolve(db,raw);if(!user)return json(401,{error:'Accedi per continuare'});
    // Cambio del personaggio pronto (vale per il 3D; il 2D non cambia).
    if(url.pathname==='/api/look'&&req.method==='POST'){if(!Number.isInteger(body.look)||body.look<0||body.look>=LOOKS.length)return json(400,{error:'Personaggio non valido'});const avatar={...JSON.parse(user.avatar),look:body.look},ph=edition==='3d'?cleanPhoto(body.photo):null;if(ph)avatar.photo=ph;else delete avatar.photo;db.prepare('UPDATE users SET avatar=? WHERE id=?').run(JSON.stringify(avatar),user.id);const active=game.players.get(user.id);if(active)active.avatar=avatar;return json(200,{...publicUser(user),avatar});}
    if(url.pathname==='/api/map/edits'&&req.method==='GET')return json(200,{doc:editor.doc,admin:editor.isAdmin(user)});
    if(url.pathname==='/api/admin/reload'&&req.method==='POST'){if(!editor.isAdmin(user))return json(403,{error:'Solo gli admin'});let n=0;for(const p of game.players.values()){game.send(p.ws,{type:'appUpdate'});n++;}return json(200,{ok:true,players:n});}
    if(url.pathname==='/api/admin/map'&&req.method==='POST'){try{return json(200,editor.apply(user,body));}catch(e){return json(e.status||500,{error:e.message});}}
    if(url.pathname==='/api/checkout'&&req.method==='POST')return json(200,await pay.checkout(user,body,`${req.socket.encrypted?'https':'http'}://${req.headers.host}`));
    if(url.pathname==='/api/checkout/confirm'&&req.method==='POST')return json(200,await pay.confirm(user,body));
    // Ricerca video per l'app YouTube del telefono (senza aprire il browser).
    if(url.pathname==='/api/youtube'){const q=String(url.searchParams.get('q')||'').slice(0,100).trim();if(!q)return json(200,{videos:[]});try{const html=await (await fetch('https://www.youtube.com/results?hl=it&search_query='+encodeURIComponent(q),{headers:{'accept-language':'it-IT','user-agent':'Mozilla/5.0'}})).text();const videos=[],seen=new Set();for(const m of html.matchAll(/"videoRenderer":\{"videoId":"([\w-]{11})".{0,1500}?"title":\{"runs":\[\{"text":"((?:[^"\\]|\\.)*)"/g)){if(seen.has(m[1]))continue;seen.add(m[1]);let t=m[2];try{t=JSON.parse('"'+t+'"');}catch{}videos.push({id:m[1],title:t});if(videos.length>=15)break;}return json(200,{videos});}catch{return json(502,{error:'Ricerca non disponibile'});}}
    if(url.pathname.startsWith('/api/phone')){try{const r=phone.route(url.pathname,req.method,user,req.method==='GET'?Object.fromEntries(url.searchParams):body);if(r!==undefined)return json(200,r);}catch(e){return json(e.status||500,{error:e.message});}}
    if(url.pathname.startsWith('/api/jobs')){try{const r=jobs.route(url.pathname,req.method,user);if(r!==undefined)return json(200,r);}catch(e){return json(e.status||500,{error:e.message});}}
    const needsPlayer=game.players.get(user.id)||{id:user.id,ws:null};const needsResult=needs.route(url.pathname,req.method,needsPlayer);if(needsResult!==undefined)return json(200,needsResult);
    const firearmsPlayer=game.players.get(user.id)||{id:user.id,ws:null};const firearmsResult=firearms.route(url.pathname,req.method,firearmsPlayer,body);if(firearmsResult!==undefined)return json(200,firearmsResult);
    const extra=living.route(url.pathname,req.method,user,req.method==='GET'?Object.fromEntries(url.searchParams):body);if(extra!==undefined)return json(200,extra);
    if(url.pathname==='/api/me'&&req.method==='GET')return json(200,publicUser(user));
    if(url.pathname==='/api/config'&&req.method==='GET')return json(200,{googleClientId:googleClientId(),iceServers:JSON.parse(process.env.ICE_SERVERS_JSON||'[{"urls":"stun:stun.l.google.com:19302"}]')});
    if(url.pathname==='/api/logout'&&req.method==='POST'){db.prepare('DELETE FROM sessions WHERE token=?').run(digest(raw));game.players.get(user.id)?.ws.close(4001,'Logout');return json(200,{ok:true});}
    if(url.pathname==='/api/profile'&&req.method==='PATCH'){
     const bio=String(body.bio??user.bio).slice(0,160);const avatar=cleanAvatar(body.avatar,JSON.parse(user.avatar));db.prepare('UPDATE users SET bio=?,avatar=? WHERE id=?').run(bio,JSON.stringify(avatar),user.id);
     const active=game.players.get(user.id);if(active)Object.assign(active,{bio,avatar});return json(200,{...publicUser(user),bio,avatar});
    }
    if(url.pathname==='/api/social'&&req.method==='GET'){
     const friends=db.prepare('SELECT * FROM friendships WHERE sender=? OR receiver=?').all(user.id,user.id).map(f=>{const id=f.sender===user.id?f.receiver:f.sender;return {...f,user:publicUser(db.prepare('SELECT * FROM users WHERE id=?').get(id)),online:game.players.has(id)};});
     const blocked=db.prepare('SELECT u.* FROM users u JOIN blocks b ON b.target=u.id WHERE b.owner=?').all(user.id).map(publicUser);return json(200,{friends,blocked});
    }
    if(url.pathname==='/api/friends'&&req.method==='POST'){
     const target=db.prepare('SELECT * FROM users WHERE id=?').get(String(body.id));if(!target||target.id===user.id||game.blocked(user.id,target.id))return json(400,{error:'Utente non disponibile'});
     if(body.action==='accept'){const change=db.prepare("UPDATE friendships SET status='accepted' WHERE sender=? AND receiver=? AND status='pending'").run(target.id,user.id);if(!change.changes)return json(403,{error:'Nessuna richiesta da accettare'});}
     else if(body.action==='remove'){db.prepare('DELETE FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)').run(target.id,user.id,user.id,target.id);}
     else{const exists=db.prepare('SELECT 1 FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)').get(target.id,user.id,user.id,target.id);if(!exists)db.prepare('INSERT INTO friendships(sender,receiver) VALUES(?,?)').run(user.id,target.id);}
     return json(200,{ok:true});
    }
    if(url.pathname==='/api/block'&&req.method==='POST'){
     if(body.id===user.id||!db.prepare('SELECT 1 FROM users WHERE id=?').get(String(body.id)))return json(400,{error:'Utente non valido'});
     if(body.remove)db.prepare('DELETE FROM blocks WHERE owner=? AND target=?').run(user.id,body.id);
     else{db.prepare('INSERT OR IGNORE INTO blocks VALUES(?,?)').run(user.id,body.id);db.prepare('DELETE FROM friendships WHERE (sender=? AND receiver=?) OR (sender=? AND receiver=?)').run(user.id,body.id,body.id,user.id);}
     return json(200,{ok:true});
    }
    if(url.pathname==='/api/report'&&req.method==='POST'){const reason=String(body.reason||'').trim().slice(0,500);if(!reason||!db.prepare('SELECT 1 FROM users WHERE id=?').get(String(body.id)))return json(400,{error:'Indica utente e motivo'});db.prepare('INSERT INTO reports(owner,target,reason,created) VALUES(?,?,?,?)').run(user.id,body.id,reason,Date.now());return json(200,{ok:true});}
    return json(404,{error:'Operazione non trovata'});
   }
   if(req.method!=='GET'&&req.method!=='HEAD')return json(405,{error:'Metodo non consentito'});
   // Pagina di download dell'app (QR): /scarica, il file APK e il codice QR generati in dist/.
   if(url.pathname==='/scarica/HUMANA-life-3D.apk'){const file=pathResolve(root,'dist','HUMANA-3D.apk');const {size}=await stat(file);res.writeHead(200,{'Content-Type':'application/vnd.android.package-archive','Content-Length':size,'Cache-Control':'no-cache','Content-Disposition':'attachment; filename="HUMANA-life-3D.apk"'});if(req.method==='HEAD')return res.end();createReadStream(file).pipe(res);return;}
   if(url.pathname==='/scarica/HUMANA-life.apk'||url.pathname==='/scarica/qr.png'){const apk=url.pathname.endsWith('.apk'),file=pathResolve(root,'dist',apk?'HUMANA.apk':'qr-scarica.png');const {size}=await stat(file);res.writeHead(200,{'Content-Type':apk?'application/vnd.android.package-archive':'image/png','Content-Length':size,'Cache-Control':'no-cache',...(apk?{'Content-Disposition':'attachment; filename="HUMANA-life.apk"'}:{})});if(req.method==='HEAD')return res.end();createReadStream(file).pipe(res);return;}
   // Solo HUMANA life (2D) è pubblicato: 3D e real restano spenti finché non sono pronti (EXPERIMENTAL=1 nel file .env per provarli).
   // Ogni gioco serve solo la sua pagina: il server del 2D non apre il 3D e il server del 3D non apre il 2D (EXPERIMENTAL=1 nel .env toglie il blocco per le prove).
   // "real" resta spento per chi non è sul PC.
   if(process.env.EXPERIMENTAL!=='1'){const p=url.pathname,onPc=['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress);
    if((edition==='3d'?['/index.html','/3d','/3d.html']:['/3d','/3d.html']).includes(p)||!onPc&&['/real','/real.html'].includes(p)){res.writeHead(302,{Location:'/'});res.end();return;}}
   const prefix=url.pathname.startsWith('/shared/')?'shared':'client';
   const rel=decodeURIComponent(url.pathname==='/'?'3d.html':url.pathname==='/admin'?'admin.html':url.pathname==='/debug-controls'?'debug-controls.html':url.pathname==='/3d'?'3d.html':url.pathname==='/real'?'real.html':url.pathname==='/manifest.webmanifest'&&edition==='3d'?'manifest-3d.webmanifest':(url.pathname==='/scarica'||url.pathname==='/scarica-3d')?'scarica-3d.html':url.pathname.replace(/^\/(?:shared\/)?/,''));
   const base=pathResolve(root,prefix),path=pathResolve(base,rel);if(!path.startsWith(base+sep)||rel.split('/').some(p=>p.startsWith('.')))return json(403,{error:'Accesso negato'});
   const file=await readFile(path),head={'Content-Type':({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.webmanifest':'application/manifest+json','.json':'application/json'})[extname(path)]||'application/octet-stream','X-Content-Type-Options':'nosniff','Referrer-Policy':'strict-origin-when-cross-origin','Permissions-Policy':'camera=(), microphone=(self)','Cache-Control':'no-cache'};
   // Solo HUMANA life 3D: ETag per non riscaricare ciò che non è cambiato, immagini e modelli tenuti in memoria dal telefono per 3 giorni
   // (prima ogni apertura riscaricava tutto: centinaia di MB), testi compressi. HUMANA life (2D) resta com'era.
   if(edition==='3d'){const st=await stat(path),etag='"'+st.size.toString(16)+'-'+Math.floor(st.mtimeMs).toString(16)+'"',heavy=url.pathname.startsWith('/assets/')||url.pathname.startsWith('/vendor/');head.ETag=etag;head['Cache-Control']=heavy&&!url.pathname.startsWith('/assets/world/napoli/map/')?'public, max-age=259200':'no-cache';
    if(req.headers['if-none-match']===etag){res.writeHead(304,{ETag:etag,'Cache-Control':head['Cache-Control']});res.end();return;}
    if(/gzip/.test(req.headers['accept-encoding']||'')&&['.html','.js','.css','.json','.svg','.gltf','.webmanifest'].includes(extname(path))&&file.length>1024){const key=path+etag,z=(zipped.get(key)||zipped.set(key,gzipSync(file)).get(key));if(zipped.size>300)zipped.delete(zipped.keys().next().value);head['Content-Encoding']='gzip';head.Vary='Accept-Encoding';head['Content-Length']=z.length;res.writeHead(200,head);res.end(req.method==='HEAD'?undefined:z);return;}}
   res.writeHead(200,head);res.end(req.method==='HEAD'?undefined:file);
  }catch(e){if(!res.headersSent)json(e.status||((e.code==='ENOENT'||e.code==='EISDIR')?404:500),{error:e.status?e.message:(e.code==='ENOENT'||e.code==='EISDIR')?'Risorsa non trovata':'Errore del server'});else res.end();}
 };
 const server=process.env.TLS_CERT&&process.env.TLS_KEY?https.createServer({cert:readFileSync(process.env.TLS_CERT),key:readFileSync(process.env.TLS_KEY)},handler):http.createServer(handler);
 const wss=new WebSocketServer({noServer:true,maxPayload:20000});
 server.on('upgrade',(req,socket,head)=>{const expected=process.env.PUBLIC_ORIGIN||`${req.socket.encrypted?'https':'http'}://${req.headers.host}`;if(req.url!=='/ws'||(req.headers.origin&&req.headers.origin!==expected&&!APP_ORIGINS.has(req.headers.origin))){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>game.connect(ws));});
 return {server,db,game,living,edition,async close(){game.close();for(const ws of wss.clients)ws.terminate();wss.close();await new Promise(r=>server.close(r));db.close();}};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){const app=createApp();app.server.listen(Number(process.env.PORT)||3000,process.env.HOST||'0.0.0.0',()=>console.log('HUMANA pronta: http://localhost:'+(process.env.PORT||3000)));for(const signal of ['SIGTERM','SIGINT'])process.on(signal,async()=>{await app.close();process.exit();});}
