import test from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {readFileSync} from 'node:fs';
import {createApp} from '../server/index.js';
import {NAPOLI,napoliPlaces,napoliStand,napoliVehicleStand,napoliNearestRoadPoint,napoliCell,napoliSpawn,napoliParkedVehicles,napoliServices,setNapoli} from '../shared/napoli.js';
import {canStand,step} from '../shared/world.js';
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

test('Mergellina: le maxi-enduro dello Chalet sono allineate alla strada e hanno spazio per camera e partenza',()=>{
 if(!NAPOLI.data)setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));
 const link=NAPOLI.data.roads.find(road=>road.osm==='way/243489198'),bikes=napoliParkedVehicles().filter(vehicle=>vehicle.id==='ciro-africa-4'||vehicle.id==='ciro-africa-9');
 assert.ok(link,'la strada d’accesso allo Chalet resta referenziata da OpenStreetMap');assert.equal(bikes.length,2,'restano entrambe le moto interagibili');
 for(const bike of bikes){
  let nearest=null;
  for(let i=1;i<link.p.length;i++){const a=link.p[i-1],b=link.p[i],dx=b[0]-a[0],dy=b[1]-a[1],length2=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((bike.x-a[0])*dx+(bike.y-a[1])*dy)/length2)),x=a[0]+dx*t,y=a[1]+dy*t,distance=Math.hypot(bike.x-x,bike.y-y);if(!nearest||distance<nearest.distance)nearest={dx,dy,distance};}
  const roadHeading=Math.atan2(nearest.dy,nearest.dx),angle=Math.abs(Math.atan2(Math.sin(bike.rot-roadHeading),Math.cos(bike.rot-roadHeading))),axisError=Math.min(angle,Math.abs(Math.PI-angle));
  assert.ok(nearest.distance<=(Number(link.w)||5)/2+.35,'la moto resta nel margine stradale: '+bike.id+' ('+nearest.distance.toFixed(2)+' m)');
  assert.ok(axisError<.08,'la moto segue l’asse della strada: '+bike.id+' ('+axisError.toFixed(3)+' rad)');
  assert.ok(napoliStand(bike.x,bike.y,.55),'la moto non invade edifici: '+bike.id);
  assert.ok(canStand('mergellina',bike.x+Math.cos(bike.rot),bike.y+Math.sin(bike.rot),.35),'la partenza in avanti è libera: '+bike.id);
  assert.ok(canStand('mergellina',bike.x-Math.cos(bike.rot)*4,bike.y-Math.sin(bike.rot)*4,.5),'la camera terza persona ha spazio dietro: '+bike.id);
 }
 assert.ok(Math.hypot(bikes[0].x-bikes[1].x,bikes[0].y-bikes[1].y)>8,'le due moto non si sovrappongono e non bloccano la camera');
});

test('Mergellina: distributori disponibili per mappa e interazioni con nomi generici',()=>{
 if(!NAPOLI.data)setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));
 const fuel=napoliServices().fuel;assert.ok(fuel.length>=3,'stazioni di servizio: '+fuel.length);
 assert.equal(new Set(fuel.map(x=>x.id)).size,fuel.length,'identità stazione univoche');
 assert.ok(fuel.every(x=>Number.isFinite(x.x)&&Number.isFinite(x.y)),'coordinate delle stazioni finite');
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

test('Mergellina: le auto restano sulla strada e possono recuperare una posizione fuori carreggiata',()=>{
 if(!NAPOLI.data)setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));
 const road=NAPOLI.data.roads.find(r=>r.osm==='way/243489190');assert.ok(road,'tratto stradale OSM di riferimento');
 const roadPoint={x:235.629,y:394.611};assert.ok(napoliVehicleStand(roadPoint.x,roadPoint.y,.95),'un’auto può sostare sulla carreggiata');
 const footwayPoint={x:28.3,y:-138.6};assert.ok(napoliStand(footwayPoint.x,footwayPoint.y,.25),'il punto pedonale resta accessibile a piedi');
 assert.equal(napoliVehicleStand(footwayPoint.x,footwayPoint.y,.55),false,'un veicolo non avanza su un camminamento lontano dalla carreggiata');
 const offRoad={x:221.26,y:393.98};assert.equal(napoliVehicleStand(offRoad.x,offRoad.y,.55),false,'una posizione salvata lontana dalla strada non è una superficie di guida');
 assert.ok(napoliVehicleStand(offRoad.x+.2,offRoad.y,.55,offRoad.x,offRoad.y),'il veicolo può recuperare gradualmente verso la strada');
 assert.equal(napoliVehicleStand(offRoad.x-.2,offRoad.y,.55,offRoad.x,offRoad.y),false,'non può allontanarsi ulteriormente dalla strada');
 const player={room:'mergellina',x:roadPoint.x,y:roadPoint.y,vehicle:'auto',heading:-1.42,direction:-1.42,vel:0};
 for(let i=0;i<180;i++)step(player,{drive:true,throttle:1,brake:0,steer:0},1/60);
 assert.ok(Math.hypot(player.x-roadPoint.x,player.y-roadPoint.y)>.5,'la guida continua sul tracciato stradale');
});

test('Mergellina: una moto ferma al margine rientra gradualmente quando si accelera dritto',()=>{
 if(!NAPOLI.data)setNapoli(JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8')));
 const start={x:231.75,y:377.04},p={room:'mergellina',...start,vehicle:'m-enduro',heading:-2.467,direction:-2.467,vel:0};
 const road0=napoliNearestRoadPoint(p.x,p.y);assert.ok(road0&&road0.distance>1.5,'il test parte dal margine della corsia');
 let maxStep=0;for(let i=0;i<240;i++){const x=p.x,y=p.y;step(p,{drive:true,throttle:1,steer:0,brake:0},1/60);maxStep=Math.max(maxStep,Math.hypot(p.x-x,p.y-y));}
 const travel=Math.hypot(p.x-start.x,p.y-start.y);
 assert.ok(travel>1,'accelerare dritto non lascia la moto bloccata al bordo');
 assert.ok(napoliVehicleStand(p.x,p.y,.55),'dopo il recupero la moto resta su una superficie stradale consentita');
 assert.ok(maxStep<.3,'la correzione dello sterzo non teletrasporta la moto');
});

test('Mergellina: due giocatori si vedono e si muovono insieme',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,reg=async n=>(await (await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:n,password:'test-secret-'+n})})).json());
 const a=await reg('Merge_A'),b=await reg('Merge_B');
 const conn=async acc=>{const ws=new WebSocket(base.replace('http','ws')+'/ws'),m=[];ws.on('message',x=>m.push(JSON.parse(x)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:acc.token}));for(let i=0;i<100&&!m.some(x=>x.type==='welcome');i++)await pause(20);return {ws,m};};
 const ca=await conn(a),cb=await conn(b);ca.ws.send(JSON.stringify({type:'travel',to:'mergellina'}));cb.ws.send(JSON.stringify({type:'travel',to:'mergellina'}));await pause(400);
 assert.equal(app.game.players.get(a.user.id).room,'mergellina');assert.equal(app.game.players.get(b.user.id).room,'mergellina');
 const pa=app.game.players.get(a.user.id),pb=app.game.players.get(b.user.id),nearB={x:pb.x,y:pb.y};Object.assign(pb,{x:pa.x+120,y:pa.y});await pause(220);
 const distantState=cb.m.filter(x=>x.type==='state').at(-1);assert.ok(distantState,'B riceve lo stato multiplayer');assert.ok(!distantState.players.some(p=>p.id===a.user.id),'A resta fuori dal pacchetto 3D di prossimità');
 const mapA=distantState.mapPlayers?.find(p=>p.id===a.user.id);assert.ok(mapA,'A resta visibile sulla mappa anche oltre 55 m');assert.deepEqual(Object.keys(mapA).sort(),['direction','id','room','seat','username','vehicle','x','y'],'il marcatore mappa contiene solo campi pubblici necessari');
 Object.assign(pb,nearB);await pause(180);
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
