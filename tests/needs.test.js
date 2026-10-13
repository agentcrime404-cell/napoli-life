import test from 'node:test';
import assert from 'node:assert/strict';
import {database} from '../server/database.js';
import {ensureState} from '../server/storage.js';
import {Needs} from '../server/needs.js';
import {step} from '../shared/world.js';

test('Bisogni: fame e sete scendono, si salvano e il cibo li recupera',()=>{
 const db=database(':memory:'),log=[];db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run('u','User','x');ensureState(db,'u');
 const game={db,send:(ws,m)=>log.push(m)};const needs=new Needs(game),p={id:'u',ws:{}};
 needs.tick(p,1200);assert.equal(p.needs.hunger,78);assert.equal(p.needs.thirst,69);
 needs.restore(p,'food');assert.equal(p.needs.hunger,100);assert.equal(p.needs.thirst,69);
 needs.save(p);const again={id:'u',ws:{}};assert.deepEqual(needs.view(again),{hunger:100,thirst:69});
 assert.ok(log.some(x=>x.type==='needs'));
});

test('Bisogni: fame e sete basse rallentano a piedi ma non alterano il mezzo',()=>{
 const base={room:'lungomare',x:200,y:200,needs:{hunger:100,thirst:100},vehicle:null};
 const low={...base,needs:{hunger:10,thirst:10}};step(base,{x:1,y:0},1);step(low,{x:1,y:0},1);assert.ok(low.x-base.x<0.7);
});
