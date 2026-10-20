// Correzioni del server segnalate dai cercatori di bug: ogni test riproduce un caso che prima falliva.
// Un solo server 3D in memoria (caricare Mergellina è lento); il ciclo di gioco è fermo e i tick si fanno a mano.
import {test,before,after} from 'node:test';
import assert from 'node:assert/strict';
import {EventEmitter} from 'node:events';
import {createApp} from '../server/index.js';
import {ensureState,state} from '../server/storage.js';
import {token} from '../server/auth.js';
import {doors,canStand} from '../shared/world.js';
import {napoliParkedVehicles} from '../shared/napoli.js';
import {RP,FUEL} from '../shared/catalog.js';

let app,game,living,db,n=0;
before(()=>{app=createApp({dbPath:':memory:',edition:'3d'});clearInterval(app.game.clock);game=app.game;living=app.living;db=app.db;});
after(async()=>{await app.close();});

const fakeWs=()=>{const w=new EventEmitter();Object.assign(w,{readyState:1,bufferedAmount:0,sent:[],send(s){w.sent.push(JSON.parse(s));},ping(){},close(){if(w.readyState===3)return;w.readyState=3;w.emit('close');},terminate(){w.close();}});return w;};
const newUser=(balance=1000)=>{const id='bf'+(++n);db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run(id,'Bug_'+id,'x');ensureState(db,id);db.prepare('UPDATE player_state SET balance=? WHERE user_id=?').run(balance,id);return {id,username:'Bug_'+id,avatar:'{}',token:token(db,id)};};
const send=(w,m)=>w.emit('message',Buffer.from(JSON.stringify(m)));
const connect=u=>{const w=fakeWs();game.connect(w);send(w,{type:'auth',token:u.token});const p=game.players.get(u.id);assert.ok(p&&p.ws===w,'giocatore connesso');return p;};
const join=(balance)=>{const u=newUser(balance);return {u,p:connect(u)};};
const api=(u,path,body={},method='POST')=>living.route(path,method,u,body);
const bal=id=>db.prepare('SELECT balance FROM player_state WHERE user_id=?').get(id).balance;
const prog=id=>state(db,id).progress;
const interact=(p,req={})=>{p.interactedAt=0;game.interact(p,req);};
/* Un mezzo di strada di Mergellina libero: il giocatore viene messo proprio accanto. */
let streetUsed=0;
const takeStreet=p=>{const list=napoliParkedVehicles().filter(o=>!game.streetVehicleState(o.id)?.occupied);const q=list[streetUsed++%list.length];Object.assign(p,{room:'mergellina',x:q.x,y:q.y});interact(p);assert.equal(p.vehicleSource,'street','preso il mezzo di strada');return q;};

test('Un mestiere chiamato constructor o __proto__ viene rifiutato e non manda in crash lo stipendio',()=>{
 const {u,p}=join();
 for(const w of ['constructor','__proto__','toString'])assert.throws(()=>api(u,'/api/rp/work',{work:w}),/sconosciuto/,w);
 const g=prog(u.id);g.work='constructor';g.duty=true;db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(g),u.id);
 const again={id:u.id,username:u.username,ws:p.ws};game.rp.load(again);assert.equal(again.work,null,'un mestiere ereditato salvato non si riprende');
 const bad={...again,rpLoaded:true,work:'constructor',duty:true,payAt:0};assert.doesNotThrow(()=>game.rp.tick(bad),'il tick non lancia');
});

test('Un mezzo noleggiato non diventa di proprietà quando si scende o quando scade',()=>{
 const {u,p}=join();api(u,'/api/vehicle/rent',{id:'cabrio'});assert.equal(p.vehicle,'cabrio');
 api(u,'/api/vehicle/use',{});assert.equal(p.vehicle,null);
 assert.equal(api(u,'/api/vehicles',{},'GET').vehicles.find(v=>v.id==='cabrio').owned,false,'noleggio, non acquisto');
 assert.ok(!(prog(u.id).vehicles||[]).includes('cabrio'));
 const g=prog(u.id);g.rentals.cabrio=Date.now()-1;db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(g),u.id);
 assert.equal(living.canUse(u.id,'cabrio'),false,'scaduto non si usa più');
 assert.ok(!living.carList(prog(u.id)).some(c=>c.v==='cabrio'),'il noleggio scaduto non resta parcheggiato sulla mappa');
});

test('Il lucchetto del veicolo si chiude e si apre senza errore del server',()=>{
 const {u,p}=join();api(u,'/api/vehicle/rent',{id:'scooter'});
 assert.deepEqual(api(u,'/api/vehicle/lock',{}),{locked:true});assert.deepEqual(api(u,'/api/vehicle/lock',{locked:false}),{locked:false});assert.equal(p.vehicleLocked,false);
});

test('La modalità vita sociale non installa polizia e rifiuta gli arresti',()=>{
 const {u,p}=join();assert.equal(game.police,undefined);
 assert.throws(()=>api(u,'/api/rp/arrest',{id:p.id}),/non è disponibile/i);
 assert.throws(()=>api(u,'/api/rp/fine',{id:p.id,amount:100}),/non è disponibile/i);
});

test('Il mezzo di strada si libera anche alla sostituzione della sessione, con Scendi, svenendo e noleggiando',()=>{
 let {u,p}=join(),q=takeStreet(p);const p2=connect(u);assert.notEqual(p2,p);assert.equal(game.streetVehicleState(q.id).occupied,false,'sessione ripresa');
 q=takeStreet(p2);api(u,'/api/vehicle/use',{});assert.equal(game.streetVehicleState(q.id).occupied,false,'Scendi');
 q=takeStreet(p2);const type=game.streetVehicleState(q.id).v;game.rp.knockDown(p2,'Prova');game.tick();assert.equal(game.streetVehicleState(q.id).occupied,false,'svenuto');assert.equal(game.streetVehicleState(q.id).v,type);
 p2.down=null;q=takeStreet(p2);const t2=game.streetVehicleState(q.id).v;api(u,'/api/vehicle/rent',{id:'cabrio'});game.tick();
 const st=game.streetVehicleState(q.id);assert.equal(st.v,t2,'il mezzo pubblico non diventa la cabrio noleggiata');assert.equal(st.occupied,false);assert.equal(p2.vehicleSource,null);
});

test('Il vecchio flag furto non rende gratuiti gli acquisti',()=>{
 const {u}=join(100);
 api(u,'/api/purchase',{item:'zaino-acqua',requestId:'legacy-steal-1',online:true,steal:true});
 assert.ok(bal(u.id)<100,'il prezzo viene comunque addebitato');
 assert.ok(state(db,u.id).inventory.some(item=>item.item==='zaino-acqua'),'l’acquisto civile resta funzionante');
});

const cop=(work='polizia')=>{const r=join(1000);api(r.u,'/api/rp/work',{work});api(r.u,'/api/rp/duty',{on:true});return r;};
test('I percorsi di multe e arresti sono disabilitati mentre il soccorso medico resta disponibile',()=>{
 const c=join(1000),t=join(2600);c.p.work='polizia';c.p.duty=true;c.p.rpLoaded=true;Object.assign(t.p,{room:c.p.room,x:c.p.x+1,y:c.p.y});
 assert.throws(()=>api(c.u,'/api/rp/fine',{id:t.u.id,amount:500}),/non è disponibile/i);
 assert.throws(()=>api(c.u,'/api/rp/arrest',{id:t.u.id}),/non è disponibile/i);
 assert.equal(bal(t.u.id),2600);
 const m=cop('medico'),x=join(100);Object.assign(x.p,{room:m.p.room,x:m.p.x+1,y:m.p.y});
 game.rp.knockDown(x.p,'Prova');api(m.u,'/api/rp/revive',{id:x.u.id});const m1=bal(m.u.id);assert.equal(m1,1000+RP.reviveReward);
 assert.equal(x.p.down,null,'rianimato');
});

test('Dopo assistenza medica si torna a Mergellina',()=>{
  const {p}=join();game.rp.knockDown(p,'Prova');game.rp.hospital(p);assert.equal(p.room,'mergellina');assert.ok(canStand('mergellina',p.x,p.y));
 });

test('Il ferito a terra non cammina, non corregge la posizione e non entra nelle porte',()=>{
 const {p}=join(),x0=p.x,y0=p.y;game.rp.knockDown(p,'Prova');
 for(let i=0;i<10;i++){send(p.ws,{type:'input',x:1,y:0,run:true,position:{x:p.x+.5,y:p.y}});game.tick();}
 assert.ok(Math.hypot(p.x-x0,p.y-y0)<.01,'fermo a terra');
 const d=doors('mergellina').find(q=>q.to&&q.to!=='mergellina');Object.assign(p,{x:d.x,y:d.y});interact(p);assert.equal(p.room,'mergellina','niente porte da ferito');
 p.down=null;
});

test('Ricaricare non cancella lo stato di ferito e di mezzo in panne',()=>{
 const {u,p}=join();game.rp.knockDown(p,'Prova');const until=p.down.until;
 const p2=connect(u);game.rp.load(p2);assert.ok(p2.down,'ancora a terra');assert.equal(p2.down.until,until);
 game.rp.hospital(p2);const p3=connect(u);game.rp.load(p3);assert.ok(!p3.down,'dopo l’ospedale non torna a terra');
 p3.broken={t0:Date.now(),until:Date.now()+60000,v:'auto',called:0};game.rp.saveStatus(p3);const p4=connect(u);game.rp.load(p4);assert.ok(p4.broken,'il guasto resta');
});

test('Il passeggero del taxi paga anche se si scollega, e il tassista non può far ripartire la corsa',()=>{
 const d=cop('taxi'),c=join(1000);api(d.u,'/api/vehicle/rent',{id:'auto'});Object.assign(c.p,{room:d.p.room,x:d.p.x,y:d.p.y,seat:'car',passenger:d.u.id,passengerIndex:0});
 game.rp.drive(c.p);assert.ok(c.p.taxi,'tassametro acceso');
 for(let i=0;i<5;i++){api(d.u,'/api/rp/duty',{on:false});game.rp.drive(c.p);api(d.u,'/api/rp/duty',{on:true});game.rp.drive(c.p);}
 assert.equal(bal(c.u.id),1000,'nessuna corsa addebitata durante i cambi di servizio');
 c.p.taxi.m=500;const before=bal(d.u.id)-0;c.p.ws.close();
 const cost=Math.round(RP.taxiBase+.5*RP.taxiPerKm);assert.equal(bal(c.u.id),1000-cost,'paga alla disconnessione');assert.equal(bal(d.u.id),before+cost);
});

test('Uscendo da casa si torna a Mergellina, anche se il padrone di casa ti espelle',()=>{
 const a=join(),b=join(),x0=a.p.x,y0=a.p.y;api(a.u,'/api/home/enter',{});assert.equal(a.p.room,'home:'+a.u.id);
 const door=doors(a.p.room)[0];Object.assign(a.p,{x:door.x,y:door.y});interact(a.p);assert.equal(a.p.room,'mergellina');assert.ok(Math.hypot(a.p.x-x0,a.p.y-y0)<1);
 api(a.u,'/api/home',{privacy:'PUBLIC'},'PATCH');api(b.u,'/api/home/enter',{owner:a.u.id});assert.equal(b.p.room,'home:'+a.u.id);
 api(a.u,'/api/home',{privacy:'PRIVATE'},'PATCH');assert.equal(b.p.room,'mergellina','espulso a Mergellina');
});

test('Chi è a terra o sta viaggiando non si teletrasporta in casa',()=>{
  const {u,p}=join();p.down={t0:Date.now(),until:Date.now()+9000,called:0};assert.throws(()=>api(u,'/api/home/enter',{}));p.down=null;
  p.seat='boat';p.ride={pts:[{x:0,y:0},{x:1,y:1}],t0:Date.now(),duration:9000,to:{x:0,y:0}};assert.throws(()=>api(u,'/api/home/enter',{}));p.seat=null;p.ride=null;
 assert.equal(p.room,'mergellina');
});

test('La posizione prevista dal client non permette di correre più veloce del server',()=>{
 const {p}=join();let dir=null;for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){let ok=true;for(let k=1;k<=40;k++)if(!canStand(p.room,p.x+dx*k*.5,p.y+dy*k*.5)){ok=false;break;}if(ok){dir=[dx,dy];break;}}assert.ok(dir,'serve una direzione libera');
 const x0=p.x,y0=p.y;for(let i=0;i<30;i++)send(p.ws,{type:'input',x:0,y:0,position:{x:p.x+dir[0]*.74,y:p.y+dir[1]*.74}});
 assert.ok(Math.hypot(p.x-x0,p.y-y0)<=1.5,'niente teletrasporto: '+Math.hypot(p.x-x0,p.y-y0).toFixed(1)+' m');
});

test('La missione "Resta in servizio 5 minuti" avanza davvero',()=>{
 const {u,p}=join();p.work='taxi';p.duty=true;for(let i=0;i<400;i++)app.game.jobs.service(p,.05);
 assert.ok(app.game.jobs.view(u.id).missions.find(m=>m.id==='service').progress>=19);
});

test('I metri fatti in auto non contano come camminata',()=>{
 const {u,p}=join();api(u,'/api/vehicle/rent',{id:'auto'});p.travel=0;p.vel=6;p.heading=0;
 const x0=p.x,y0=p.y;for(let i=0;i<10;i++){p.input={drive:true,steer:0,throttle:1,brake:0,x:0,y:0};p.lastInput=Date.now();game.tick();}
 assert.ok(Math.hypot(p.x-x0,p.y-y0)>.5,'l’auto si è mossa');assert.equal(p.travel,0);
});

test('Le consegne del rider funzionano anche a Mergellina',()=>{
 const {u,p}=join();const v=app.game.jobs.start(u.id);assert.ok(v.job,'consegna presa');
 Object.assign(p,{x:p.job.x,y:p.job.y});const before=bal(u.id);app.game.jobs.tick(p);assert.equal(p.job,null);assert.ok(bal(u.id)>before,'pagata');
});

test('Un nuovo passeggero prende il primo posto libero, non quello di un altro',()=>{
 const d=join();api(d.u,'/api/vehicle/rent',{id:'auto'});const ps=[join(),join(),join()];
 for(const q of ps){Object.assign(q.p,{room:d.p.room,x:d.p.x+.5,y:d.p.y});interact(q.p,{intent:'passenger',playerId:d.u.id});assert.equal(q.p.passenger,d.u.id);}
 interact(ps[0].p);assert.equal(ps[0].p.passenger,null);const e=join();Object.assign(e.p,{room:d.p.room,x:d.p.x+.5,y:d.p.y});interact(e.p,{intent:'passenger',playerId:d.u.id});
 const idx=[ps[1].p,ps[2].p,e.p].map(q=>q.passengerIndex);assert.equal(new Set(idx).size,3,'posti diversi: '+idx);
});

test('Fame e sete scendono con il tempo',()=>{
 const {p}=join();for(let i=0;i<2000;i++)game.needs.tick(p,.05);assert.ok(p.needs.hunger<100&&p.needs.thirst<100,JSON.stringify(p.needs));
});

test('Chi si scollega durante il rifornimento già pagato ritrova il pieno',()=>{
 const {u,p}=join();Object.assign(p,{fuelFor:'auto',fuel:10,tanks:{auto:10},fueling:{station:'x',t0:Date.now(),until:Date.now()+9000}});p.ws.close();
 assert.equal(state(db,u.id).position.tanks.auto,FUEL.tank);
});
