import test from 'node:test';
import assert from 'node:assert/strict';
import {FixedStepper} from '../client/player/fixed-step.js';
import {reconcileLocalPosition} from '../client/player/reconcile.js';
import {defaultFrameRateLimit,readFrameRateLimit} from '../client/ui/frame-rate.js';

test('simulazione a passo fisso mantiene la stessa distanza a 30, 60 e 120 FPS',()=>{
 const simulate=rate=>{
  const clock=new FixedStepper(1/60,.1,6);let position=0,steps=0;
  for(let i=0;i<rate;i++)clock.advance(1/rate,dt=>{position+=4.4*dt;steps++;});
  return {position,steps};
 };
 const thirty=simulate(30),sixty=simulate(60),oneTwenty=simulate(120);
 assert.equal(thirty.steps,60);assert.equal(sixty.steps,60);assert.equal(oneTwenty.steps,60);
 assert.ok(Math.abs(thirty.position-4.4)<1e-6);
 assert.equal(thirty.position,sixty.position);assert.equal(sixty.position,oneTwenty.position);
});

test('simulazione a passo fisso limita il recupero dopo una pausa e può essere azzerata',()=>{
 const clock=new FixedStepper(1/60,.1,6);let steps=0;
 assert.equal(clock.advance(1,()=>steps++),6);assert.equal(steps,6);
 clock.reset();assert.equal(clock.advance(0,()=>steps++),0);
});

test('predizione locale non azzera piccoli scarti di rete mentre il giocatore si muove',()=>{
 const player={x:4,y:7};
 assert.equal(reconcileLocalPosition(player,4.2,7,1/60,true),0);
 assert.deepEqual(player,{x:4,y:7});
});

test('correzione server inattiva converge gradualmente invece di teletrasportare il giocatore',()=>{
 const player={x:4,y:7};
 const corrected=reconcileLocalPosition(player,4.2,7,1/60,false);
 assert.ok(corrected>0&&corrected<.2);
 assert.ok(player.x>4&&player.x<4.2);
});

test('una correzione grande resta limitata alla velocità massima di riconciliazione',()=>{
 const player={x:0,y:0};
 const corrected=reconcileLocalPosition(player,5,0,1/60,false);
 assert.ok(corrected<=8/60+1e-9);
});

test('un cambio di posizione da respawn resta immediato',()=>{
 const player={x:0,y:0};
 reconcileLocalPosition(player,20,15,1/60,true);
 assert.deepEqual(player,{x:20,y:15});
});

test('60 FPS è il valore predefinito sui telefoni potenti e 30 sui dispositivi non classificabili',()=>{
 assert.equal(defaultFrameRateLimit({hardwareConcurrency:8,deviceMemory:8},true),60);
 assert.equal(defaultFrameRateLimit({hardwareConcurrency:4,deviceMemory:4},true),30);
 assert.equal(defaultFrameRateLimit({hardwareConcurrency:16,deviceMemory:undefined},true),30);
 assert.equal(defaultFrameRateLimit({hardwareConcurrency:2,deviceMemory:1},false),60);
});

test('la preferenza FPS salvata prevale sul profilo automatico',()=>{
 const storage={getItem:key=>key==='humana-fps-limit'?'30':null};
 assert.equal(readFrameRateLimit(storage,{hardwareConcurrency:8,deviceMemory:8},true),30);
 assert.equal(readFrameRateLimit({getItem:()=>null},{hardwareConcurrency:8,deviceMemory:8},true),60);
});
