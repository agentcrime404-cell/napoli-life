import test from 'node:test';
import assert from 'node:assert/strict';
import {prepareWithLimit,programsSince,brokenPrograms,brokenReport} from '../client/world/shader-prep.js';

const never=()=>new Promise(()=>{});
test('Shader preparation that finishes resolves without calling the late handler',async()=>{
 let late=0;assert.equal(await prepareWithLimit(()=>Promise.resolve(),{ms:50,onLate:()=>late++}),'ok');assert.equal(late,0);
});
test('A rejected or throwing preparation reaches the caller instead of being swallowed',async()=>{
 await assert.rejects(prepareWithLimit(()=>Promise.reject(new Error('compileAsync rotto')),{ms:50}),/compileAsync rotto/);
 await assert.rejects(prepareWithLimit(()=>{throw new Error('conversione rotta');},{ms:50}),/conversione rotta/);
});
// GPU lente: il limite non fa fallire il caricamento. Si continua ad aspettare compileAsync, onLate avvisa una volta e l'esito arriva dopo ('late').
test('A slow preparation keeps waiting past the limit, warns once and then finishes late',async()=>{
 let late=0,done;const work=new Promise(ok=>{done=ok;}),result=prepareWithLimit(()=>work,{ms:20,onLate:()=>late++});
 let settled=false;result.then(()=>{settled=true;},()=>{settled=true;});
 await new Promise(r=>setTimeout(r,60));assert.equal(late,1);assert.equal(settled,false);
 done();assert.equal(await result,'late');assert.equal(late,1);
});
test('A preparation that never finishes stays pending instead of failing',async()=>{
 let late=0,settled=false;prepareWithLimit(never,{ms:20,onLate:()=>late++}).then(()=>{settled=true;},()=>{settled=true;});
 await new Promise(r=>setTimeout(r,60));assert.equal(late,1);assert.equal(settled,false);
});
test('An error arriving after the limit reaches the caller and never becomes an unhandled rejection',async()=>{
 const unhandled=[];const on=e=>unhandled.push(e);process.on('unhandledRejection',on);
 let fail,late=0;const work=new Promise((_,no)=>{fail=no;}),result=prepareWithLimit(()=>work,{ms:20,onLate:()=>late++});
 await new Promise(r=>setTimeout(r,40));fail(new Error('dopo il limite'));await assert.rejects(result,/dopo il limite/);
 await new Promise(r=>setTimeout(r,20));process.off('unhandledRejection',on);assert.equal(late,1);assert.deepEqual(unhandled,[]);
});
test('A late handler that throws does not break the preparation',async()=>{
 const errors=[],orig=console.error;console.error=(...a)=>errors.push(a);
 try{let done;const result=prepareWithLimit(()=>new Promise(ok=>{done=ok;}),{ms:10,onLate:()=>{throw new Error('avviso rotto');}});await new Promise(r=>setTimeout(r,30));done();assert.equal(await result,'late');}
 finally{console.error=orig;}
 assert.equal(errors.length,1);
});
// Shader che non si collegano: un avviso, non un errore. Ogni programma si interroga e si segnala una volta sola; quelli non ancora pronti si guardano dopo.
const make=(name,{ready=true,runnable=true}={})=>{const p={name,checked:0,ready,isReady(){return this.ready;},getUniforms(){this.checked++;if(!runnable)this.diagnostics={runnable:false,programLog:'link '+name,vertexShader:{log:''},fragmentShader:{log:'ERROR: '+name}};return {};}};return p;};
test('Broken WebGL programs are checked and reported once, programs still compiling are checked later',()=>{
 const ok=make('MeshLambertMaterial'),bad=make('rotto',{runnable:false}),waiting=make('in attesa',{ready:false,runnable:false}),seen=new WeakSet();
 assert.deepEqual(brokenPrograms([ok,bad,waiting],seen),[bad]);assert.equal(waiting.checked,0);assert.equal(ok.checked,1);assert.equal(bad.checked,1);
 assert.deepEqual(brokenPrograms([ok,bad,waiting],seen),[]);assert.equal(ok.checked,1);assert.equal(bad.checked,1);
 waiting.ready=true;assert.deepEqual(brokenPrograms([ok,bad,waiting],seen),[waiting]);assert.equal(waiting.checked,1);
});
test('Only the programs created by the current preparation are checked',()=>{
 const old=make('vecchio rotto',{runnable:false}),kept=make('vecchio'),fresh=make('nuovo rotto',{runnable:false}),before=new Set([old,kept]);
 const now=programsSince(before,[old,kept,fresh]);assert.deepEqual(now,[fresh]);
 assert.deepEqual(brokenPrograms(now),[fresh]);assert.equal(old.checked,0);assert.equal(kept.checked,0);
});
test('The broken shader report has unique names for the notice and driver logs for the console',()=>{
 const a=make('a',{runnable:false}),b=make('a',{runnable:false}),c=make('c',{runnable:false});for(const p of [a,b,c])p.getUniforms();
 const {names,details}=brokenReport([a,b,c]);assert.deepEqual(names,['a','c']);assert.equal(details.length,3);
 assert.deepEqual(details[2],{name:'c',programLog:'link c',vertexLog:'',fragmentLog:'ERROR: c'});
 const unnamed=make('',{runnable:false});unnamed.type='lambert';unnamed.getUniforms();assert.deepEqual(brokenReport([unnamed]).names,['lambert']);
});
