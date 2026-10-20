import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createApp} from '../server/index.js';
import {savePlayer} from '../server/storage.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<100;i++){if(fn())return;await pause(20);}assert.fail('Timeout');}

test('HUMANA V2: persistenza, economia, case, messaggi ed eventi reali',async t=>{
 const app=createApp({dbPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 async function api(path,body,account,method=body?'POST':'GET'){const response=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',...(account?{Authorization:'Bearer '+account.token}:{})},body:body?JSON.stringify(body):undefined});return {status:response.status,data:await response.json()};}
 const a=(await api('auth/register',{username:'V2_Anna',password:'test-secret-anna'})).data,b=(await api('auth/register',{username:'V2_Bruno',password:'test-secret-bruno'})).data;
 async function connect(account){const ws=new WebSocket(base.replace('http','ws')+'/ws'),messages=[];ws.on('message',b=>messages.push(JSON.parse(b)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:account.token}));await until(()=>messages.some(m=>m.type==='welcome'));return {ws,messages};}
 let ca=await connect(a);const cb=await connect(b);
 await t.test('Stato protetto, default e preferenze salvate',async()=>{
  assert.equal((await api('state')).status,401);const s=(await api('state',null,a)).data;assert.equal(s.balance,100);assert.equal(s.home.privacy,'PRIVATE');assert.deepEqual(s.inventory,[]);
  await api('settings',{master:.4,voice:.2,zoom:1.2},a,'PATCH');const saved=(await api('state',null,a)).data.settings;assert.equal(saved.master,.4);assert.equal(saved.zoom,1.2);
 });
 await t.test('Acquisto server-side: stanza, saldo, proprietà e idempotenza',async()=>{
  assert.equal((await api('purchase',{item:'bed',requestId:'outside-shop'},a)).status,400);
  app.living.move(app.game.players.get(a.user.id),'shop');
  const request={item:'bed',requestId:'unique-bed-1',price:-999999,balance:999999};
  const results=await Promise.all([api('purchase',request,a),api('purchase',request,a)]);assert.ok(results.every(r=>r.status===200));
  let s=(await api('state',null,a)).data;assert.equal(s.balance,70);assert.equal(s.inventory[0].quantity,1);
  assert.equal((await api('equip',{item:'jacket-sea'},a)).status,403);
  await api('purchase',{item:'jacket-sea',requestId:'outfit-request'},a);await api('equip',{item:'jacket-sea'},a);
  await api('profile',{bio:'Profilo V2'},a,'PATCH');assert.equal((await api('me',null,a)).data.avatar.outfit,'sea');
  await api('purchase',{item:'bed',requestId:'second-bed'},a);assert.equal((await api('purchase',{item:'bed',requestId:'too-many-beds'},a)).status,400);
  s=(await api('state',null,a)).data;assert.equal(s.balance,5);assert.equal(s.inventory.find(i=>i.item==='bed').quantity,2);
 });
 await t.test('Case: privacy, inviti autorizzati, arredi posseduti e revoca',async()=>{
  assert.equal((await api('home/enter',{owner:a.user.id},b)).status,403);
  assert.equal((await api('home/invite',{id:b.user.id},a)).status,403);
  await api('friends',{id:b.user.id},a);await api('friends',{id:a.user.id,action:'accept'},b);
  assert.equal((await api('home/invite',{id:b.user.id},a)).status,200);assert.equal((await api('home/enter',{owner:a.user.id},b)).status,200);
  assert.equal(app.game.players.get(b.user.id).room,'home:'+a.user.id);
  assert.equal((await api('home',{furniture:[{item:'bed',x:4,y:4}]},a,'PATCH')).status,200);
  assert.equal((await api('home',{furniture:[{item:'sofa',x:4,y:4}]},a,'PATCH')).status,403);
  assert.equal((await api('home',{furniture:[null]},a,'PATCH')).status,400);
  assert.equal((await api('home',{furniture:[{item:'bed',x:8,y:12}]},a,'PATCH')).status,400);
  await api('home',{privacy:'PRIVATE'},a,'PATCH');assert.equal(app.game.players.get(b.user.id).room,'lungomare');
  await api('home',{privacy:'FRIENDS'},a,'PATCH');assert.equal((await api('home/enter',{owner:a.user.id},b)).status,200);
 });
 await t.test('Blocco revoca casa e impedisce messaggi; conversazioni isolate',async()=>{
  assert.equal((await api('dm',{id:b.user.id,text:'Ciao Bruno'},a)).status,200);
  assert.equal((await api('dm?peer='+a.user.id,null,b)).data[0].text,'Ciao Bruno');
  assert.equal((await api('dm?peer=unknown',null,b)).data.length,0);
  assert.equal((await api('inbox',null,b)).data[0].username,a.user.username);
  await api('block',{id:b.user.id},a);app.game.frames=200;app.game.tick();assert.equal(app.game.players.get(b.user.id).room,'lungomare');
  assert.equal((await api('dm',{id:a.user.id,text:'Bloccato'},b)).status,403);assert.equal((await api('dm?peer='+a.user.id,null,b)).status,403);
  await api('block',{id:b.user.id,remove:true},a);
 });
 await t.test('Eventi: accesso privato, iscrizione e limiti',async()=>{
  const start=Date.now()+60000;assert.equal((await api('events',{name:'Festa',location:'home:'+a.user.id,start_time:start,end_time:start+3600000},a)).status,200);
  assert.equal((await api('events',null,b)).data.length,0);const e=(await api('events',null,a)).data[0];assert.equal((await api('events/join',{id:e.id},b)).status,403);
  await api('home',{privacy:'PUBLIC'},a,'PATCH');assert.equal((await api('events/join',{id:e.id},b)).status,200);
  assert.equal((await api('events',{name:'Abuso',location:'home:'+a.user.id,start_time:start,end_time:start+3600000},b)).status,400);
 });
 await t.test('Ordini nei locali e premio misurato dal server',async()=>{
  app.living.move(app.game.players.get(a.user.id),'bar');assert.equal((await api('purchase',{item:'coffee',requestId:'coffee-order'},a)).status,200);
  assert.equal((await api('purchase',{item:'pizza',requestId:'pizza-outside'},a)).status,400);
  assert.equal((await api('reward',{walked:1000000},a)).status,400);
  // Solo fixture server: nessun endpoint permette al giocatore di impostare la distanza.
  app.game.players.get(a.user.id).travel=101;assert.equal((await api('reward',{},a)).status,200);assert.equal((await api('reward',{},a)).status,400);
  assert.equal((await api('state',null,a)).data.progress.orders,1);
 });
 await t.test('HUD: XP, livello, VIP e gemme non falsificabili dal client',async()=>{
  let s=(await api('state',null,a)).data;assert.equal(s.gems,1);assert.ok(s.xp>=101);assert.equal(s.level,2);assert.equal(s.vip,false);
  await api('profile',{avatar:{level:99,vip:true,gems:9999},bio:'Test'},a,'PATCH');s=(await api('state',null,a)).data;assert.equal(s.level,2);assert.equal(s.vip,false);assert.equal(s.gems,1);
  const p=app.game.players.get(a.user.id);p.travel=405;savePlayer(app.db,p);s=(await api('state',null,a)).data;assert.equal(s.level,6);assert.equal(s.vip,true);
  app.living.move(p,'shop');assert.equal((await api('purchase',{item:'palette-jade',requestId:'gems-insufficient'},a)).status,400);
  // Fixture amministrata solo nel test: nessun endpoint permette di assegnarsi gemme.
  app.db.prepare("UPDATE player_state SET progress=json_set(progress,'$.gems',3) WHERE user_id=?").run(a.user.id);
  const req={item:'palette-jade',requestId:'gems-success'};assert.equal((await api('purchase',req,a)).status,200);assert.equal((await api('purchase',req,a)).status,200);s=(await api('state',null,a)).data;assert.equal(s.gems,0);assert.equal(s.inventory.find(i=>i.item==='palette-jade').quantity,1);
 });
 await t.test('Refresh con stessa sessione e ritorno dopo disconnessione',async()=>{
  const p=app.game.players.get(a.user.id);app.living.move(p,'lungomare');p.x=22;p.y=22;savePlayer(app.db,p);
  const old=ca;ca=await connect(a);await until(()=>old.ws.readyState===3);assert.equal(app.game.players.size,2);assert.equal(app.game.players.get(a.user.id).x,22);
  ca.ws.close();await until(()=>!app.game.players.has(a.user.id));ca=await connect(a);assert.equal(app.game.players.get(a.user.id).x,22);
  const snapshot=()=>ca.messages.findLast(m=>m.type==='state');await until(()=>snapshot());assert.equal(snapshot().players.find(p=>p.id===a.user.id).avatar.outfit,'sea');assert.equal(snapshot().players.some(p=>'balance' in p||'settings' in p||'token' in p),false);
 });
 await t.test('PWA e moduli: risorse servite senza 404 e HUD mobile incluso nella cache aggiornata',async()=>{for(const path of ['/ui/hud.js','/ui/hud.css','/ui/mobile-reference-hud.css','/manifest.webmanifest','/sw.js','/ui/living.js','/ui/performance-panel.js','/ui/performance-panel.css','/world/facade-lod.js','/audio/ambient.js','/assets/living.png','/assets/icon-192.png','/assets/icon-512.png'])assert.equal((await fetch(base+path)).status,200,path);const manifest=await (await fetch(base+'/manifest.webmanifest')).json();assert.equal(manifest.display,'standalone');const sw=await(await fetch(base+'/sw.js')).text();assert.match(sw,/humana-life-371/);assert.match(sw,/\/ui\/mobile-reference-hud\.css/);assert.match(sw,/\/ui\/performance-panel\.js/);assert.match(sw,/\/ui\/performance-panel\.css/);assert.match(sw,/\/world\/facade-lod\.js/);});
 ca.ws.close();cb.ws.close();
});
