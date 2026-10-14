import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../client/vendor/three/three.module.min.js';
import {SpatialVisibility} from '../client/world/spatial-visibility.js';
const box=(size,x,z)=>{const mesh=new THREE.Mesh(new THREE.BoxGeometry(size,size,size),new THREE.MeshBasicMaterial());mesh.position.set(x,0,z);return mesh;};

test('Visibilità: gruppi complessi lontani sono esclusi senza cambiare le posizioni',async()=>{
 const root=new THREE.Group(),near=new THREE.Group(),far=new THREE.Group();near.position.x=20;far.position.x=600;near.add(box(2,0,0));far.add(box(2,0,0));root.add(near,far);
 const visibility=new SpatialVisibility(root,{range:100});assert.equal(await visibility.prepare(),true);visibility.update(0,0);
 assert.equal(near.visible,true);assert.equal(far.visible,false);assert.equal(far.position.x,600);assert.equal(far.children[0].parent,far);
 visibility.update(600,0);assert.equal(far.visible,true);assert.equal(near.visible,false);
});

test('Visibilità: mare e landmark grandi restano, i batch lontani possono sparire',async()=>{
 const root=new THREE.Group(),landmark=box(160,1000,0),batch=box(160,1000,0),border=box(20,110,0);batch.userData.zone=true;root.add(landmark,batch,border);
 const visibility=new SpatialVisibility(root,{range:100});await visibility.prepare();visibility.update(0,0);
 assert.equal(landmark.visible,true);assert.equal(batch.visible,false);assert.equal(border.visible,true);
});

test('Visibilità: coordinate globali corrette sotto un genitore trasformato e costruzione annullabile',async()=>{
 const scene=new THREE.Scene(),root=new THREE.Group(),object=box(2,0,0);root.position.set(300,0,400);scene.add(root);root.add(object);
 const visibility=new SpatialVisibility(root,{range:30});await visibility.prepare();visibility.update(300,400);assert.equal(object.visible,true);visibility.update(0,0);assert.equal(object.visible,false);
 const cancelled=new SpatialVisibility(root);assert.equal(await cancelled.prepare(()=>true),false);assert.equal(cancelled.entries.length,0);
});

test('Visibilità: l’indice spaziale limita i controlli agli oggetti vicini e aggiorna anche la distanza',async()=>{
 const root=new THREE.Group(),near=box(2,12,0);root.add(near);
 for(let i=0;i<400;i++)root.add(box(2,1000+i*96,(i%9)*96));
 const visibility=new SpatialVisibility(root,{range:20});await visibility.prepare();visibility.update(0,0);
 assert.equal(near.visible,true);assert.equal(root.children[1].visible,false);
 assert.ok(visibility.lastCandidateCount<visibility.entries.length/20,'il culling deve esaminare una piccola parte della città');
 const checked=visibility.lastCandidateCount;visibility.update(.2,0);assert.equal(visibility.lastCandidateCount,checked,'un movimento inferiore alla soglia riusa il risultato');
 visibility.range=5;visibility.update(.2,0);assert.equal(near.visible,false,'una modifica alla distanza forza un aggiornamento anche da fermi');
 visibility.update(1000,0);assert.equal(root.children[1].visible,true,'gli oggetti diventano visibili entrando nel raggio');
});
