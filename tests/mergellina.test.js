import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {readFileSync} from 'node:fs';
import {createApp} from '../server/index.js';
import {NAPOLI,napoliPlaces,napoliStand,napoliCell,napoliSpawn,napoliParkedVehicles,setNapoli} from '../shared/napoli.js';
import {canStand} from '../shared/world.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));

test('Mergellina: scala 1:1, locali ben distanziati, tutti calpestabili e raggiungibili dalla regione principale',()=>{
 if(!NAPOLI.data)setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));
 const D=NAPOLI.data,P=napoliPlaces();
 // scala: due punti di riferimento a distanza reale nota (Piazza Sannazaro → Castel dell'Ovo ≈ 2,3 km)
 const L=Object.fromEntries(D.landmarks.filter(l=>!l.missing).map(l=>[l.name,l]));assert.ok(L['Castel dell\'Ovo']&&L['Piazza Sannazaro']&&L['Fontana del Sebeto']);
 const d=Math.hypot(L['Castel dell\'Ovo'].x-L['Piazza Sannazaro'].x,L['Castel dell\'Ovo'].y-L['Piazza Sannazaro'].y);assert.ok(d>2250&&d<2400,'distanza '+d);
 assert.ok(P.doors.length>=250,'locali: '+P.doors.length);
 for(let i=0;i<P.doors.length;i++){const a=P.doors[i];assert.ok(napoliStand(a.x,a.y,.3),'porta fuori terreno calpestabile: '+a.name);for(let j=i+1;j<P.doors.length;j++){const b=P.doors[j];assert.ok(Math.hypot(a.x-b.x,a.y-b.y)>=12,'locali troppo vicini: '+a.name+' / '+b.name);}}
 assert.equal(new Set(P.doors.map(x=>x.id)).size,P.doors.length,'id duplicati');
 assert.ok(P.doors.some(x=>x.real)&&P.doors.some(x=>x.fantasy),'ci sono sia attività vere sia di fantasia');
 // distribuzione: nessuna zona calpestabile grande senza locali (celle di 300 m con almeno il 20% calpestabile hanno almeno un locale)
 const bad=[];for(let cy=NAPOLI.y0;cy<NAPOLI.y0+NAPOLI.h;cy+=300)for(let cx=NAPOLI.x0;cx<NAPOLI.x0+NAPOLI.w;cx+=300){let w=0;for(let y=cy;y<cy+300;y+=6)for(let x=cx;x<cx+300;x+=6)if(napoliCell(x,y))w++;if(w/2500>.2&&!P.doors.some(q=>q.x>=cx&&q.x<cx+300&&q.y>=cy&&q.y<cy+300))bad.push(cx+','+cy);}
 assert.equal(bad.length,0,'zone senza locali: '+bad.join(' '));
 // la fontana e il castello non si attraversano
 assert.equal(napoliCell(L['Fontana del Sebeto'].x,L['Fontana del Sebeto'].y),false,'vasca della fontana');
});

test('Mergellina: la generazione accelerata dei parcheggi conserva veicoli, posizioni e identità',()=>{
 if(!NAPOLI.data)setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));
 const vehicles=napoliParkedVehicles(),ids=vehicles.map(vehicle=>vehicle.id);
 assert.ok(vehicles.length>=190,'veicoli stradali: '+vehicles.length);
 assert.equal(new Set(ids).size,vehicles.length,'identità dei veicoli duplicate');
 assert.ok(vehicles.some(vehicle=>vehicle.id==='ciro-africa-9'&&vehicle.v==='m-enduro'),'la moto dello Chalet resta interagibile');
 assert.ok(vehicles.every(vehicle=>Number.isFinite(vehicle.x)&&Number.isFinite(vehicle.y)),'le coordinate di tutti i veicoli sono finite');
 assert.ok(napoliCell(vehicles.find(vehicle=>vehicle.id==='ciro-africa-9').x,vehicles.find(vehicle=>vehicle.id==='ciro-africa-9').y),'la moto dello Chalet resta sul terreno calpestabile');
 const car=vehicles.find(vehicle=>vehicle.id==='merg-car-53');let nearest=null;
 for(const road of NAPOLI.data.roads||[])if(!['footway','steps','path','cycleway','pedestrian'].includes(road.k))for(let i=1;i<road.p.length;i++){
  const a=road.p[i-1],b=road.p[i],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((car.x-a[0])*dx+(car.y-a[1])*dy)/length2)),x=a[0]+dx*t,y=a[1]+dy*t,distance=Math.hypot(car.x-x,car.y-y);
  if(!nearest||distance<nearest.distance)nearest={dx,dy,distance};
 }
 const roadHeading=Math.atan2(nearest.dy,nearest.dx),angle=Math.abs(Math.atan2(Math.sin(car.rot-roadHeading),Math.cos(car.rot-roadHeading))),axisError=Math.min(angle,Math.abs(Math.PI-angle));
 assert.ok(axisError<.12,'auto parcheggiata parallela alla carreggiata: errore '+axisError.toFixed(3)+' rad');
 assert.ok(napoliStand(car.x+Math.cos(car.rot)*2,car.y+Math.sin(car.rot)*2,1.05),'la corsia davanti alla vettura deve essere libera');
 assert.deepEqual(napoliParkedVehicles(),vehicles,'il risultato resta deterministico e riutilizzabile');
});

test('Mergellina: una posizione salvata dentro un edificio viene bloccata e lo spawn resta sicuro',()=>{
 if(!NAPOLI.data)setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));
 const x=-348.6800956102528,y=1186.2918433043699,D=NAPOLI.data;
 const inside=(px,py,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++){const a=P[i],b=P[j];if(((a[1]>py)!==(b[1]>py))&&px<(b[0]-a[0])*(py-a[1])/(b[1]-a[1])+a[0])c=!c;}return c;};
 assert.ok(D.buildings.some(b=>!b.tn&&inside(x,y,b.p)),'il punto riproduce un edificio della mappa');
 assert.equal(napoliCell(x,y),true,'la vecchia griglia marca erroneamente la cella come calpestabile');
 assert.equal(napoliStand(x,y,0),false);assert.equal(canStand('mergellina',x,y,0),false);
 const spawn=napoliSpawn();assert.ok(napoliStand(spawn.x,spawn.y,.4),'lo spawn deve restare libero');
 assert.ok(!D.buildings.some(b=>!b.tn&&inside(spawn.x,spawn.y,b.p)),'lo spawn non deve cadere dentro un edificio');
});

test('Mergellina: due giocatori si vedono e si muovono insieme',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,reg=async n=>(await (await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:n,password:'test-secret-'+n})})).json());
 const a=await reg('Merge_A'),b=await reg('Merge_B');
 const conn=async acc=>{const ws=new WebSocket(base.replace('http','ws')+'/ws'),m=[];ws.on('message',x=>m.push(JSON.parse(x)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:acc.token}));for(let i=0;i<100&&!m.some(x=>x.type==='welcome');i++)await pause(20);return {ws,m};};
 const ca=await conn(a),cb=await conn(b);ca.ws.send(JSON.stringify({type:'travel',to:'mergellina'}));cb.ws.send(JSON.stringify({type:'travel',to:'mergellina'}));await pause(400);
 assert.equal(app.game.players.get(a.user.id).room,'mergellina');assert.equal(app.game.players.get(b.user.id).room,'mergellina');
 // A cammina verso est per 3 secondi: il server lo sposta e B vede la nuova posizione
 const x0=app.game.players.get(a.user.id).x;const t0=Date.now();while(Date.now()-t0<3000){ca.ws.send(JSON.stringify({type:'input',x:1,y:0,run:false}));await pause(50);}
 const moved=app.game.players.get(a.user.id).x-x0;assert.ok(moved>2,'A si è mosso di '+moved+' m');
 await pause(200);const last=cb.m.filter(x=>x.type==='state').at(-1);assert.ok(last&&last.players.some(p=>p.id===a.user.id),'B vede A');
 ca.ws.close();cb.ws.close();
});

test('Mergellina: si entra e si esce da un locale vero e da uno di fantasia',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,acc=await (await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Porta_A',password:'test-secret-porta'})})).json();
 const ws=new WebSocket(base.replace('http','ws')+'/ws'),m=[];ws.on('message',x=>m.push(JSON.parse(x)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:acc.token}));for(let i=0;i<100&&!m.some(x=>x.type==='welcome');i++)await pause(20);
 ws.send(JSON.stringify({type:'travel',to:'mergellina'}));await pause(300);
 const P=napoliPlaces().doors;for(const door of [P.find(d=>d.real),P.find(d=>d.fantasy)]){const p=app.game.players.get(acc.user.id);p.room='mergellina';p.x=door.x;p.y=door.y;p.input={x:0,y:0};ws.send(JSON.stringify({type:'interact'}));await pause(350);
  assert.equal(p.room,door.to,'entrata in '+door.name+' ('+(door.real?'vero':'fantasia')+'): stanza '+p.room);
  ws.send(JSON.stringify({type:'interact'}));await pause(350);assert.equal(p.room,'mergellina','uscita da '+door.name);}
 ws.close();
});

test('Aggiornamento: tutti ripartono da Mergellina la prima volta; versione e mappa non restano in memoria nel browser',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const v=await (await fetch(base+'/version.json')).json();assert.ok(Number(v.build)>200,'versione '+v.build);
 const mp=await fetch(base+'/assets/world/napoli/map/mergellina.json');assert.match(mp.headers.get('cache-control'),/no-cache/,'la mappa si controlla sempre');
 const reg=await (await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Aggiorna_A',password:'test-secret-agg'})})).json();
 const ws=new WebSocket(base.replace('http','ws')+'/ws'),m=[];ws.on('message',x=>m.push(JSON.parse(x)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:reg.token}));for(let i=0;i<100&&!m.some(x=>x.type==='welcome');i++)await pause(20);await pause(200);
 assert.equal(app.game.players.get(reg.user.id).room,'mergellina','parte da Mergellina');ws.close();
});
