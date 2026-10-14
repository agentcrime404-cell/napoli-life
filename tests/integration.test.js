import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {readFileSync} from 'node:fs';
import {createApp} from '../server/index.js';
import {canStand,step,attenuation,doors,MAPS,VEHICLE_INTERACTION_RANGE,registerMergellina} from '../shared/world.js';
import {napoliParkedVehicles,setNapoli} from '../shared/napoli.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn){for(let i=0;i<300;i++){if(fn())return;await pause(20);}assert.fail('Timeout di sincronizzazione');}
test('Collisioni, velocità e attenuazione voce',()=>{
 const bar=MAPS.lungomare.buildings.find(b=>b.id==='bar');assert.equal(canStand('lungomare',bar.cx,bar.cy),false);assert.equal(canStand('lungomare',-1,16),false);
 const {x:sx,y:sy}=MAPS.lungomare.spawn,p={room:'lungomare',x:sx,y:sy};step(p,{x:1,y:1},.1);assert.ok(Math.abs(Math.hypot(p.x-sx,p.y-sy)-.25)<1e-8);
 assert.equal(attenuation(3),1);assert.equal(attenuation(15),0);assert.ok(attenuation(8)>attenuation(12));
 for(const room of Object.values(MAPS))assert.ok(canStand(room.id,room.spawn.x,room.spawn.y));
});
test('Due client reali: account, sincronizzazione, social, interni e permessi',async t=>{
 const app=createApp({dbPath:':memory:'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 t.after(()=>app.close());const base=`http://127.0.0.1:${app.server.address().port}`;
 async function api(path,body,token,method=body?'POST':'GET'){const r=await fetch(base+'/api/'+path,{method,headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});return {status:r.status,data:await r.json()};}
 await t.test('Client e moduli serviti, sorgenti server non esposti',async()=>{for(const path of ['/', '/app.js','/shared/world.js','/shared/district.js','/assets/residences.png'])assert.equal((await fetch(base+path)).status,200,path);assert.equal((await fetch(base+'/server/auth.js')).status,404);});
 const a=(await api('auth/register',{username:'Tester_A',password:'test-password-A'})).data;
 const b=(await api('auth/register',{username:'Tester_B',password:'test-password-B'})).data;
 await t.test('Password hash, autenticazione e profilo',async()=>{
  assert.ok(a.token&&b.token);assert.notEqual(app.db.prepare('SELECT password FROM users WHERE id=?').get(a.user.id).password,'test-password-A');
  assert.equal((await api('auth/login',{username:'Tester_A',password:'wrong-pass'})).status,401);
  assert.equal((await api('me')).status,401);
  const profile=await api('profile',{bio:'Ciao Napoli',avatar:{color:'#abcdef',accessory:'cap'}},a.token,'PATCH');assert.equal(profile.data.bio,'Ciao Napoli');
 });
 async function client(account){const ws=new WebSocket(base.replace('http','ws')+'/ws'),messages=[];ws.on('message',d=>messages.push(JSON.parse(d)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:account.token}));await until(()=>messages.some(m=>m.type==='welcome'));return {ws,messages,send:m=>ws.send(JSON.stringify(m)),state:()=>messages.findLast(m=>m.type==='state')};}
 const ca=await client(a),cb=await client(b);
 await t.test('Presenza, input autorevoli e disconnessione',async()=>{
  await until(()=>ca.state()?.players.length===2);const initial=app.game.players.get(a.user.id).x;
  ca.send({type:'input',x:9999,y:0,position:{x:99999}});await pause(180);const x=app.game.players.get(a.user.id).x;assert.ok(x>initial&&x<initial+1);
  ca.send({type:'input',x:0,y:0});assert.equal(app.game.players.size,2);
 });
 await t.test('Salto multiplayer con limite e fari consentiti soltanto al guidatore',async()=>{
  const pa=app.game.players.get(a.user.id);ca.send({type:'vehicleLights'});await pause(80);assert.equal(pa.lightsOn,false,'a piedi non si attivano i fari');
  ca.send({type:'jump'});await until(()=>Number.isFinite(pa.jumpAt)&&pa.jumpAt>0);const jumpAt=pa.jumpAt;assert.ok(pa.jumpUntil>jumpAt);
  ca.send({type:'jump'});await pause(80);assert.equal(pa.jumpAt,jumpAt,'il limite evita il salto ripetuto');
  pa.vehicle='auto';pa.seat=null;ca.send({type:'vehicleLights'});await until(()=>pa.lightsOn===true);
  pa.seat='car';ca.send({type:'vehicleLights'});await pause(70);assert.equal(pa.lightsOn,false,'il passeggero non può controllare i fari');
  pa.vehicle=null;pa.seat=null;
 });
 await t.test('Veicolo fermo: salita, autorizzazione stradale persistente, guida e uscita',async()=>{
  if(!napoliParkedVehicles().some(vehicle=>vehicle.id==='ciro-africa-9')){setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));registerMergellina();}
  const pa=app.game.players.get(a.user.id),pb=app.game.players.get(b.user.id),target=napoliParkedVehicles().find(vehicle=>vehicle.id==='ciro-africa-9'),original={room:pa.room,x:pa.x,y:pa.y,direction:pa.direction,heading:pa.heading},otherOriginal={room:pb.room,x:pb.x,y:pb.y,direction:pb.direction,heading:pb.heading};
  assert.ok(target,'la moto ferma di test è presente nella scena di Mergellina');
  assert.equal(VEHICLE_INTERACTION_RANGE,5);
  Object.assign(pb,{room:'mergellina',x:target.x+1,y:target.y,vehicle:null,vehicleSource:null,streetVehicleId:null,seat:null,input:{x:0,y:0}});
  await pause(190);Object.assign(pa,{room:'mergellina',x:target.x+4.2,y:target.y,vehicle:null,seat:null,input:{x:0,y:0}});
  assert.ok(Math.hypot(pa.x-target.x,pa.y-target.y)<VEHICLE_INTERACTION_RANGE,'il giocatore è nel raggio mostrato dal pulsante');
  ca.send({type:'interact'});await until(()=>pa.vehicle===target.v);assert.equal(pa.vehicleSource,'street');
  await pause(2700);assert.equal(pa.vehicle,target.v,'il controllo periodico del garage non deve smontare dal mezzo pubblico');
  for(let i=0;i<7;i++){ca.send({type:'input',drive:true,throttle:1,steer:0,brake:0});await pause(100);}
  assert.ok(pa.vel>0,'l’acceleratore raggiunge la fisica server del veicolo');
  ca.send({type:'input',drive:true,throttle:0,steer:0,brake:1});await pause(650);const dropPoint={x:pa.x,y:pa.y};ca.send({type:'interact'});await until(()=>pa.vehicle===null);assert.equal(pa.vehicleSource,null);
  const parkedAtDrop=app.game.streetVehicleState(target.id);assert.ok(parkedAtDrop&&!parkedAtDrop.occupied,'dopo l’uscita il mezzo pubblico resta disponibile');assert.ok(Math.hypot(parkedAtDrop.x-dropPoint.x,parkedAtDrop.y-dropPoint.y)<.25,'il mezzo viene parcheggiato dove è sceso il giocatore');await pause(180);const receivedByA=ca.state()?.streetVehicles?.find(vehicle=>vehicle.id===target.id),receivedByB=cb.state()?.streetVehicles?.find(vehicle=>vehicle.id===target.id);assert.ok(receivedByA&&!receivedByA.occupied,'il guidatore riceve la posizione del mezzo appena parcheggiato: '+JSON.stringify({room:pa.room,server:parkedAtDrop,received:receivedByA}));assert.ok(receivedByB&&!receivedByB.occupied,'gli altri client vicini ricevono il parcheggio condiviso: '+JSON.stringify({room:app.game.players.get(b.user.id).room,server:parkedAtDrop,received:receivedByB}));
  const progress=JSON.parse(app.db.prepare('SELECT progress FROM player_state WHERE user_id=?').get(a.user.id).progress);
  assert.ok(!(progress.vehicles||[]).includes(target.v),'un veicolo stradale non diventa proprietà dopo l’uscita');assert.equal(pa.streetVehicleId,null,'l’identità del mezzo è liberata quando il giocatore scende');
  Object.assign(pa,{room:'mergellina',x:parkedAtDrop.x+.4,y:parkedAtDrop.y+.25,vehicle:null,vehicleSource:null,streetVehicleId:null,seat:null,input:{x:0,y:0}});Object.assign(pb,{room:'mergellina',x:parkedAtDrop.x+.4,y:parkedAtDrop.y+.25,vehicle:null,vehicleSource:null,streetVehicleId:null,seat:null,input:{x:0,y:0}});
  await pause(190);ca.send({type:'interact'});cb.send({type:'interact'});await until(()=>pa.vehicle===target.v);await pause(220);
  assert.equal(pa.streetVehicleId,target.id,'il primo giocatore acquisisce l’identità del mezzo stradale');assert.equal(pb.vehicle,null,'il secondo giocatore non può duplicare il veicolo già occupato');
  ca.send({type:'interact'});await until(()=>pa.vehicle===null);assert.equal(pa.streetVehicleId,null,'il veicolo torna disponibile dopo l’uscita');
  Object.assign(pa,original);Object.assign(pb,otherOriginal);
 });
 await t.test('Richieste amicizia: solo destinatario può accettare',async()=>{
  assert.equal((await api('friends',{id:b.user.id},a.token)).status,200);
  assert.equal((await api('friends',{id:b.user.id,action:'accept'},a.token)).status,403);
  assert.equal((await api('friends',{id:a.user.id,action:'accept'},b.token)).status,200);
  assert.equal((await api('social',null,a.token)).data.friends[0].status,'accepted');
 });
 await t.test('Chat reale e segnalazione',async()=>{
  ca.send({type:'chat',text:'Ciao dal Lungomare'});await until(()=>cb.messages.some(m=>m.type==='chat'&&m.text==='Ciao dal Lungomare'));
  assert.equal((await api('report',{id:b.user.id,reason:'Test moderazione'},a.token)).status,200);assert.equal(app.db.prepare('SELECT COUNT(*) n FROM reports').get().n,1);
 });
 await t.test('Blocco esclude presenza e segnalazione WebRTC',async()=>{
  ca.send({type:'voice',enabled:true});cb.send({type:'voice',enabled:true});await pause(40);
  ca.send({type:'signal',to:b.user.id,description:{type:'offer',sdp:'test'}});await until(()=>cb.messages.some(m=>m.type==='signal'));
  await api('block',{id:b.user.id},a.token);await until(()=>ca.state()?.players.length===1);
  const before=cb.messages.filter(m=>m.type==='signal').length;ca.send({type:'signal',to:b.user.id,description:{type:'offer',sdp:'blocked'}});await pause(100);assert.equal(cb.messages.filter(m=>m.type==='signal').length,before);
  assert.equal((await api('social',null,a.token)).data.friends.length,0);await api('block',{id:b.user.id,remove:true},a.token);
 });
 await t.test('Porta verificata, interno condiviso e seduta esclusiva',async()=>{
  const pa=app.game.players.get(a.user.id),pb=app.game.players.get(b.user.id);ca.send({type:'interact'});await pause(40);assert.equal(pa.room,'lungomare');
  // Fixture server vicino alla porta: il client non dispone di teletrasporto.
  await pause(190);Object.assign(pa,(({x,y})=>({x,y}))(doors('lungomare')[0]));ca.send({type:'interact'});await until(()=>pa.room==='bar');
  await until(()=>ca.state()?.players.length===1);Object.assign(pb,(({x,y})=>({x,y}))(doors('lungomare')[0]));cb.send({type:'interact'});await until(()=>pb.room==='bar');await until(()=>ca.state()?.players.length===2);
  await pause(190);Object.assign(pa,{x:5.1,y:6});Object.assign(pb,{x:5.2,y:6});ca.send({type:'interact'});await until(()=>pa.seat==='seat0');cb.send({type:'interact'});await pause(60);assert.equal(pb.seat,null);
  await pause(190);ca.send({type:'interact'});await until(()=>!pa.seat);
 });
 await t.test('Logout revoca sessione e presenza',async()=>{
  await api('logout',{},b.token);await until(()=>app.game.players.size===1);assert.equal((await api('me',null,b.token)).status,401);
 });
 await t.test('Sessione scaduta revocata anche su socket aperto',async()=>{const pa=app.game.players.get(a.user.id);app.db.prepare('UPDATE sessions SET expires=0 WHERE user_id=?').run(a.user.id);app.game.auth.get(pa).checked=0;app.game.tick();await until(()=>app.game.players.size===0);});
 ca.ws.close();
});
