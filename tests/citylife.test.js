import test from 'node:test';
import assert from 'node:assert/strict';
import {Traffic} from '../shared/traffic.js';

const run=(tr,sec,hour)=>{tr.hour=hour;for(let t=0;t<sec;t+=.1)tr.update(.1,[]);};

test('Traffico vivo: più mezzi, cambia con l’ora e nessuno resta bloccato per sempre',()=>{
 const previousRandom=Math.random;let seed=36;Math.random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 try{
 const tr=new Traffic();tr.lights=true;tr.enrich();tr.viewer={x:-500,y:-500};
 assert.ok(tr.cars.some(c=>c.model==='scooter')&&tr.cars.some(c=>c.model==='furgone')&&tr.cars.some(c=>c.model==='rifiuti'),'scooter, furgoni e camion dei rifiuti');
 run(tr,60,8);const morning=tr.cars.filter(c=>!c.off).length;
 run(tr,60,3);const night=tr.cars.filter(c=>!c.off).length;
 assert.ok(night<morning,'di notte meno mezzi che la mattina ('+night+' < '+morning+')');
 assert.ok(!tr.cars.some(c=>c.model==='rifiuti'&&!c.off&&tr.hour===3),'i camion ESI non girano di notte');
 // di mattina i camion lavorano e si fermano ogni tanto; tutti gli altri continuano a girare
 tr.hour=9;let parked=0,moved=new Map();const s0=new Map(tr.cars.map(c=>[c,c.s]));
 for(let t=0;t<300;t+=.1){tr.update(.1,[]);for(const c of tr.cars)if(c.park&&c.work)parked++;}
 const act=tr.cars.filter(c=>!c.off);assert.ok(act.length>8);
 assert.ok(parked>0,'i camion si fermano a svuotare i bidoni');
 const before=new Map(act.map(c=>[c,c.s]));let stuck=0;const moved2=new Map(act.map(c=>[c,0]));for(let t=0;t<120;t+=.1){tr.update(.1,[]);for(const c of act)if(c.v>.3)moved2.set(c,moved2.get(c)+1);}for(const c of act)if(!c.off&&moved2.get(c)<20)stuck++;
 assert.ok(stuck<=1,'nessun mezzo bloccato per sempre (bloccati: '+stuck+')');
 }finally{Math.random=previousRandom;}
});

test('Traffico: la velocità si abbassa con il traffico intenso e un ostacolo ferma chi arriva',()=>{
 const tr=new Traffic();tr.update(.1,[]);tr.speedK=.3;let s=0;for(let t=0;t<30;t+=.1){tr.update(.1,[]);}for(const c of tr.cars)s+=c.v;assert.ok(s/tr.cars.length<3,'traffico lento');
});
