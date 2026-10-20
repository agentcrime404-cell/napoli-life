import test from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {Police} from '../server/police.js';
import {PRISON,POLICE,policeGeom,prisonCell,STEAL_PATHS} from '../shared/catalog.js';

const game=()=>{const log=[];return {log,send:(ws,m)=>log.push(m),living:null,arena:null,players:new Map()};};
const player=(o={})=>({id:'p',username:'p',room:'lungomare',x:60,y:60,input:{x:0,y:0},ws:{},myCars:[],...o});

test('Furto: chi prende senza pagare diventa ricercato; se lo vedono va in cella 60 secondi, poi lo liberano alla porta',()=>{
 const g=game(),po=new Police(g),p=player({vehicle:'auto',seat:null});
 const r=Math.random;Math.random=()=>0;
 po.crime(p,20);Math.random=r;assert.ok(p.wanted&&p.wanted.caught,'ricercato e visto');assert.ok(g.log.some(m=>/senza pagare/.test(m.message)));
 po.tick(p);assert.ok(p.wanted&&!p.jail,'prima del tempo non succede nulla');
 p.wanted.until=Date.now()-1;po.tick(p);assert.ok(p.jail,'arrestato');assert.equal(p.vehicle,null);assert.equal(p.wanted,null);
 const st=POLICE.find(c=>c.id===p.jail.station),cell=prisonCell(st);assert.deepEqual([p.x,p.y],[cell.x,cell.y]);
 assert.ok(Math.abs((p.jail.until-p.jail.t0)-PRISON.seconds*1000)<50,'un minuto');
 p.input={x:1,y:0};po.tick(p);assert.deepEqual(p.input,{x:0,y:0},'in cella non ci si muove');assert.ok(p.jail);
 p.jail.until=Date.now()-1;po.tick(p);assert.equal(p.jail,null,'liberato');const d=policeGeom(st).door;assert.ok(Math.hypot(p.x-d.x,p.y-d.y)<2,'alla porta della caserma');
 assert.ok(g.log.some(m=>/liberarti/.test(m.message)));
});

test('Furto: a volte nessuno vede e la fai franca',()=>{
 const g=game(),po=new Police(g),p=player();const r=Math.random;Math.random=()=>.99;po.crime(p,5);Math.random=r;assert.equal(p.wanted.caught,false);
 p.wanted.until=Date.now()-1;po.tick(p);assert.equal(p.wanted,null);assert.equal(p.jail,undefined);assert.ok(g.log.some(m=>/franca/.test(m.message)));
});

test('Il furto vale per acquisti, barbiere, bevande, benzina e mezzi',()=>{
 for(const q of ['/api/purchase','/api/barber','/api/vending','/api/service/order','/api/fuel/refill','/api/vehicle/buy'])assert.ok(STEAL_PATHS.includes(q),q);
 assert.ok(!STEAL_PATHS.includes('/api/atm/exchange')&&!STEAL_PATHS.includes('/api/slot'),'banca e slot non si rubano');
});

import {WebSocket} from 'ws';
import {createApp} from '../server/index.js';
import {ensureState,state} from '../server/storage.js';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
test('Napoli Life 3D rimuove progressi criminali legacy e non attiva la polizia',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(r=>app.server.listen(0,'127.0.0.1',r));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const reg=await (await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'Ladro_1',password:'test-secret-ladro'})})).json();
 ensureState(app.db,reg.user.id);const saved=state(app.db,reg.user.id).progress;Object.assign(saved,{wanted:{until:Date.now()+9000},jail:{until:Date.now()+9000},heist:{id:'old'},firearms:['pistola'],equippedWeapon:'pistola',work:'polizia',duty:true});
 app.db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(saved),reg.user.id);
 const connect=async()=>{const ws=new WebSocket(base.replace('http','ws')+'/ws'),m=[];ws.on('message',b=>m.push(JSON.parse(b)));await new Promise(r=>ws.once('open',r));ws.send(JSON.stringify({type:'auth',token:reg.token}));for(let i=0;i<100&&!m.some(x=>x.type==='welcome');i++)await pause(20);return {ws,m};};
 const c=await connect();await pause(100);const p=app.game.players.get(reg.user.id);assert.ok(p,'giocatore connesso');
 assert.equal(app.game.police,undefined);assert.equal(p.wanted,undefined);assert.equal(p.jail,undefined);app.game.rp.load(p);assert.equal(p.work,null);
 const progress=state(app.db,reg.user.id).progress;for(const key of ['wanted','jail','heist','firearms','equippedWeapon'])assert.equal(Object.hasOwn(progress,key),false,key);
 const blocked=await fetch(base+'/api/rp/arrest',{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+reg.token},body:JSON.stringify({id:reg.user.id})});assert.equal(blocked.status,410);
 c.ws.close();
});

test('Furto: chi scappa lontano (almeno PRISON.escape metri) semina la polizia, chi resta viene preso',()=>{
 const g=game(),po=new Police(g),p=player({room:'mergellina',x:0,y:0});const r=Math.random;Math.random=()=>0;po.crime(p,20);Math.random=r;
 p.x=PRISON.escape+5;p.wanted.until=Date.now()-1;po.tick(p);assert.equal(p.jail,undefined,'scappato: niente cella');assert.equal(p.wanted,null);assert.ok(g.log.some(m=>/seminati/.test(m.message)));
 const q=player({id:'q',room:'mergellina',x:0,y:0});Math.random=()=>0;po.crime(q,20);Math.random=r;q.x=10;q.wanted.until=Date.now()-1;po.tick(q);assert.ok(q.jail,'rimasto vicino: preso');
});
