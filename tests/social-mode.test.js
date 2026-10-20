import {test} from 'node:test';
import assert from 'node:assert/strict';
import {WebSocket} from 'ws';
import {createApp} from '../server/index.js';
import {installArena} from '../client/ui/arena.js';
import {ARENA,arenaBlocks,solidBlocks} from '../shared/catalog.js';
import {removeLegacyCrimeProgress,socialLifeApiDisabled} from '../shared/social-mode.js';

test('Napoli Life social mode blocks legacy combat/crime routes but preserves civil work',()=>{
 for(const path of ['/api/firearms','/api/firearms/buy','/api/arena/join','/api/heist/start','/api/gang/create','/api/rp/arrest','/api/rp/fine'])
  assert.equal(socialLifeApiDisabled(path),true,path);
 assert.equal(socialLifeApiDisabled('/api/rp/work',{work:'polizia'}),true);
 assert.equal(socialLifeApiDisabled('/api/rp/work',{work:'meccanico'}),false);
 assert.equal(socialLifeApiDisabled('/api/vehicle/buy'),false);
});

test('legacy combat progress is removed while unrelated progression is retained',()=>{
 const {progress,changed}=removeLegacyCrimeProgress({wanted:{until:1},jail:{until:2},heist:{id:3},firearms:['pistola'],equippedWeapon:'pistola',work:'polizia',duty:true,vehicles:['moto'],balance:125});
 assert.equal(changed,true);
 for(const key of ['wanted','jail','heist','firearms','equippedWeapon'])assert.equal(Object.hasOwn(progress,key),false,key);
 assert.equal(progress.work,null);assert.equal(progress.duty,false);
 assert.deepEqual(progress.vehicles,['moto']);assert.equal(progress.balance,125);
 assert.equal(removeLegacyCrimeProgress(progress).changed,false);
});

test('legacy arena boundary no longer leaves invisible collision walls',()=>{
 const [topWall]=arenaBlocks();
 const solids=solidBlocks();
 assert.equal(solids.some(block=>block.every((n,i)=>n===topWall[i])),false);
 assert.ok(ARENA.x1>ARENA.x0);
});

test('l’installazione legacy dell’arena è inerte e non monta l’HUD di combattimento',()=>{
 const legacyArena=installArena();assert.equal(typeof legacyArena.update,'function');assert.doesNotThrow(()=>legacyArena.update(null));
});

test('3D server rejects combat/crime APIs and still accepts a civilian job',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});
 await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));
 t.after(()=>app.close());
 assert.equal(app.game.socialMode,'social-life');
 for(const service of ['arena','police','heists','gangs','firearms'])assert.equal(app.game[service],undefined,service);
 const base=`http://127.0.0.1:${app.server.address().port}`;
 const reg=await fetch(base+'/api/auth/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({username:'SocialTester',password:'safe-test-password'})});
 assert.equal(reg.status,200);const {token,user}=await reg.json();
 async function post(path,body){return fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Authorization:`Bearer ${token}`},body:JSON.stringify(body)});}
 for(const path of ['/api/firearms/buy','/api/arena/join','/api/heist/start','/api/gang/create','/api/rp/arrest','/api/rp/fine']){
  const response=await post(path,{});assert.equal(response.status,410,path);
 }
 const ws=new WebSocket(base.replace('http','ws')+'/ws');
 await new Promise((resolve,reject)=>{ws.once('open',resolve);ws.once('error',reject);});
 ws.send(JSON.stringify({type:'auth',token}));
 await new Promise((resolve,reject)=>{const timeout=setTimeout(()=>reject(new Error('WebSocket welcome timeout')),3000);ws.on('message',raw=>{if(JSON.parse(raw).type==='welcome'){clearTimeout(timeout);resolve();}});});
 t.after(()=>ws.terminate());
 const player=app.game.players.get(user.id);
 ws.send(JSON.stringify({type:'shoot',dx:1,dy:0}));ws.send(JSON.stringify({type:'reload'}));
 await new Promise(resolve=>setTimeout(resolve,40));
 assert.equal(player.arena,undefined);assert.equal(app.game.arena,undefined);assert.equal(app.game.firearms,undefined);
 const police=await post('/api/rp/work',{work:'polizia'});assert.equal(police.status,410);
 const civilian=await post('/api/rp/work',{work:'meccanico'});assert.equal(civilian.status,200,JSON.stringify(await civilian.json()));
});
