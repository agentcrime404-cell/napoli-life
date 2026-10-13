import {test} from 'node:test';import assert from 'node:assert/strict';
import {database} from '../server/database.js';import {Jobs,DAILY} from '../server/jobs.js';import {MAPS} from '../shared/world.js';
test('Lavori: consegna verificata dal server, missioni giornaliere, premi di livello',()=>{
 const db=database(':memory:'),sent=[];db.prepare('INSERT INTO users(id,username,password) VALUES(?,?,?)').run('a','A','x');
 const p={id:'a',room:'lungomare',...MAPS.lungomare.spawn,ws:{},travel:0},game={players:new Map([['a',p]]),send:(ws,m)=>sent.push(m)},jobs=new Jobs(db,game);
 let v=jobs.view('a');assert.equal(v.missions.length,DAILY.length);assert.equal(v.job,null);
 v=jobs.start('a');assert.ok(v.job&&v.job.reward>0);assert.throws(()=>jobs.start('a'),/già/);
 jobs.tick(p);assert.ok(p.job,'lontano: non consegnata');
 Object.assign(p,{x:v.job.x,y:v.job.y});jobs.tick(p);assert.equal(p.job,null);assert.equal(sent.at(-1).type,'jobDone');
 const bal=db.prepare('SELECT balance FROM player_state WHERE user_id=?').get('a').balance;assert.ok(bal>=sent.at(-1).coins);
 for(let i=0;i<2;i++){jobs.start('a');Object.assign(p,p.job);jobs.tick(p);}
 assert.equal(jobs.view('a').missions.find(m=>m.id==='deliver').done,true);jobs.claim('a','deliver');assert.throws(()=>jobs.claim('a','deliver'),/già/);assert.throws(()=>jobs.claim('a','walk'),/non ancora/);
 p.work='taxi';p.duty=true;jobs.service(p,301);assert.equal(jobs.view('a').missions.find(m=>m.id==='service').done,true);jobs.claim('a','service');
 for(const r of ['bar','club','bar','pizzeria'])jobs.visit(p,r);assert.equal(jobs.view('a').missions.find(m=>m.id==='visit').done,true);
 jobs.level(p);p.travel=250;jobs.level(p);assert.equal(sent.at(-1).type,'levelUp');assert.equal(sent.at(-1).coins,100);});
