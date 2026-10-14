import test from 'node:test';
import assert from 'node:assert/strict';
import {AdaptiveResolution} from '../client/world/adaptive-resolution.js';

test('Risoluzione: recupera qualità al limite mobile di 30 FPS dopo un rallentamento',()=>{
 const quality=new AdaptiveResolution();let scale=quality.sample(19,1);
 assert.equal(scale,.9);
 for(let i=0;i<6;i++)scale=quality.sample(30,scale);
 assert.ok(scale>.9&&scale<=1);
});
test('Risoluzione: oscillazioni e campioni sospesi non provocano aumenti ripetuti',()=>{
 const quality=new AdaptiveResolution();let scale=.8;
 for(const fps of [30,29,NaN,30,28,30,29,30])scale=quality.sample(fps,scale);
 assert.equal(scale,.8);
 for(let i=0;i<20;i++)scale=quality.sample(10,scale);
 assert.equal(scale,.6);
});
test('Risoluzione: un singolo frame sotto i 30 FPS non abbassa la qualità, due finestre consecutive sì',()=>{
 const quality=new AdaptiveResolution({target:30});
 assert.equal(quality.sample(28,1),1);
 assert.equal(quality.sample(30,1),1);
 assert.equal(quality.sample(28,1),1);
 assert.equal(quality.sample(28,1),.9);
});
test('Risoluzione: il recupero rispetta il target a 60 FPS e il limite massimo',()=>{
 const quality=new AdaptiveResolution({target:60});let scale=.9;
 for(let i=0;i<20;i++)scale=quality.sample(60,scale);
 assert.equal(scale,1);
 assert.ok(quality.sample(30,scale)<1);
});
test('Risoluzione mobile: riduce un notch quando il P95 WebGL supera il margine di gameplay',()=>{
 const quality=new AdaptiveResolution({target:30});
 assert.equal(quality.sample(30,1,22.8),.9);
 assert.equal(quality.sample(30,.9,20),.9);
});
test('Risoluzione mobile: richiede P95 render stabile prima di recuperare qualità',()=>{
 const quality=new AdaptiveResolution({target:30});let scale=.8;
 for(let i=0;i<10;i++)scale=quality.sample(30,scale,20);
 assert.equal(scale,.8);
 for(let i=0;i<20;i++)scale=quality.sample(30,scale,18);
 assert.ok(scale>.8&&scale<=1);
});
