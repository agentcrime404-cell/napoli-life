import {test} from 'node:test';import assert from 'node:assert/strict';
import {database} from '../server/database.js';import {Living} from '../server/living.js';import {step,MAPS} from '../shared/world.js';
import {canVehicleReverse} from '../shared/catalog.js';
function setup(balance){const db=database(':memory:');db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run('a','A','x');const players=new Map([['a',{id:'a',room:'lungomare',x:0,y:0}]]),living=new Living(db,{players,blocked:()=>false});living.route('/api/state','GET',{id:'a'},{});db.prepare('UPDATE player_state SET balance=? WHERE user_id=?').run(balance,'a');return {db,living,players};}
test('HUD veicolo: la retromarcia è mostrata solo sui mezzi che la supportano',()=>{for(const id of ['auto','a-500','cabrio','furgone','scooter','m-50','m-epoca','m-xadv','monopattino'])assert.equal(canVehicleReverse(id),true,id+' supporta la retromarcia');for(const id of ['m-enduro','m-naked','m-cruiser','m-sport','b-bmx','b-mtb'])assert.equal(canVehicleReverse(id),false,id+' non deve mostrare la retromarcia');});
test('Mezzi: sblocco, noleggio, saldo e mezzo ripreso al rientro',()=>{
 const {living,players}=setup(300),me=players.get('a'),call=(p,b)=>living.route('/api/vehicle/'+p,'POST',{id:'a'},b);
 assert.throws(()=>call('use',{id:'monopattino'}),/sblocca/);
 let g=call('buy',{id:'monopattino'});assert.equal(g.balance,50);assert.ok(g.vehicles.find(v=>v.id==='monopattino').owned);
 assert.throws(()=>call('buy',{id:'monopattino'}),/già/);assert.throws(()=>call('rent',{id:'auto'}),/insufficienti/);
 call('use',{id:'monopattino'});assert.equal(me.vehicle,'monopattino');assert.equal(living.lastVehicle('a'),'monopattino');
 call('use',{id:''});assert.equal(me.vehicle,null);assert.equal(living.lastVehicle('a'),null);
 me.room='bar';assert.throws(()=>call('use',{id:'monopattino'}),/aperto/);});
test('Mezzi: la velocità cresce solo all’aperto',()=>{const at=room=>{const p={room,x:MAPS[room].spawn?.x??10,y:MAPS[room].spawn?.y??10,vehicle:'auto'},x=p.x;for(let i=0;i<20;i++)step(p,{x:1,y:0},.1);return p.x-x;};
 const walk={room:'lungomare',x:MAPS.lungomare.spawn?.x??10,y:MAPS.lungomare.spawn?.y??10};const x0=walk.x;for(let i=0;i<20;i++)step(walk,{x:1,y:0},.1);assert.ok(at('lungomare')>(walk.x-x0)*1.6,'in 2 secondi l’auto (che accelera) supera di molto chi cammina');});

test('Guida touch: sterzo progressivo indipendente da acceleratore e freno',()=>{
 const p={room:'lungomare',x:MAPS.lungomare.spawn.x,y:MAPS.lungomare.spawn.y,vehicle:'scooter',heading:0,direction:0};
 for(let i=0;i<8;i++)step(p,{drive:true,steer:0,throttle:1,brake:0},.05);
 assert.ok(p.vel>0,'l’acceleratore aumenta la velocità');
 const before=p.heading;step(p,{drive:true,steer:1,throttle:1,brake:0},.05);
 assert.ok(p.heading>before&&p.heading-before<.3,'lo sterzo gira gradualmente, non ruota istantaneamente');
 const turned=p.heading;for(let i=0;i<6;i++)step(p,{drive:true,steer:0,throttle:1,brake:0},.05);
 assert.ok(Math.abs(p.heading-turned)<.01,'rilasciare lo sterzo mantiene la traiettoria');
 p.vehicle='bici';for(let i=0;i<40;i++)step(p,{drive:true,steer:0,throttle:0,brake:1},.05);
 assert.ok(p.vel>=0&&p.vel<.1,'la bici frena senza retromarcia');
});

test('Guida auto: la retromarcia entra solo dopo aver quasi fermato il mezzo',()=>{
 const p={room:'lungomare',x:MAPS.lungomare.spawn.x+5,y:MAPS.lungomare.spawn.y,vehicle:'auto',heading:0,direction:0,vel:4};
 step(p,{drive:true,steer:0,throttle:0,brake:1},.05);assert.ok(p.vel>0,'il primo freno riduce la velocità senza invertire subito');
 let reverse=false;for(let i=0;i<18;i++){step(p,{drive:true,steer:0,throttle:0,brake:1},.05);reverse||=p.vel<0;}
 assert.ok(reverse,'l’auto può arretrare solo dopo la frenata a bassa velocità');
});

test('Guida scooter: il freno inserisce la retromarcia solo quasi da fermo',()=>{
 const p={room:'lungomare',x:MAPS.lungomare.spawn.x+5,y:MAPS.lungomare.spawn.y,vehicle:'scooter',heading:0,direction:0,vel:3};
 step(p,{drive:true,steer:0,throttle:0,brake:1},.05);assert.ok(p.vel>0,'lo scooter frena prima di arretrare');
 let reverse=false;for(let i=0;i<30;i++){step(p,{drive:true,steer:0,throttle:0,brake:1},.05);reverse||=p.vel<0;}
 assert.ok(reverse,'lo scooter può arretrare lentamente dopo la frenata');assert.ok(p.vel>=-1.21,'la retromarcia dello scooter resta lenta');
});

test('Guida moto: la frenata non attiva la retromarcia ereditata dalla classe scooter',()=>{
 const p={room:'lungomare',x:MAPS.lungomare.spawn.x+5,y:MAPS.lungomare.spawn.y,vehicle:'m-enduro',heading:0,direction:0,vel:3};
 for(let i=0;i<40;i++)step(p,{drive:true,steer:0,throttle:0,brake:1},.05);
 assert.ok(p.vel>=0&&p.vel<.1,'la moto si arresta senza invertire la marcia');
});
