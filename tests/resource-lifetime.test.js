import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../client/vendor/three/three.module.min.js';
import {treeResources,cachedResources,disposeDetached,sharedResources,forgetDisposed} from '../client/world/resource-lifetime.js';

function watch(resource){let count=0;resource.addEventListener('dispose',()=>count++);return ()=>count;}
test('Evicting a room preserves resources used by another room, including normal maps',()=>{
 const texture=new THREE.Texture(),material=new THREE.MeshStandardMaterial({normalMap:texture});
 const geometry=new THREE.BoxGeometry(),room=new THREE.Group(),other=new THREE.Group();
 room.add(new THREE.Mesh(geometry,material));other.add(new THREE.Mesh(geometry,material));
 const counts=[geometry,material,texture].map(watch);
 disposeDetached(room,{retained:treeResources(other)});
 assert.deepEqual(counts.map(count=>count()),[0,0,0]);
 disposeDetached(room);assert.deepEqual(counts.map(count=>count()),[1,1,1]);
});
test('Disposing cloned models preserves cached template resources even when no clone is visible',()=>{
 const template=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshLambertMaterial({map:new THREE.Texture()}));
 const borrowed=new WeakSet(treeResources(template)),clone=template.clone();
 assert.equal(disposeDetached(clone,{borrowed}).size,0);
 const own=template.material.clone();clone.material=own;const count=watch(own);
 disposeDetached(clone,{borrowed});assert.equal(count(),1);
});
test('Avatar removal releases unique face geometry, label, material and skeleton once',()=>{
 const root=new THREE.Group(),material=new THREE.MeshLambertMaterial(),face=new THREE.Texture();
 const geometry=new THREE.BoxGeometry(),mesh=new THREE.SkinnedMesh(geometry,material);
 mesh.skeleton=new THREE.Skeleton([]);const label=new THREE.Sprite(new THREE.SpriteMaterial({map:face}));
 root.add(mesh,label,new THREE.Mesh(geometry,material));
 const resources=[geometry,material,face,label.material],counts=resources.map(watch);
 const released=disposeDetached(root);assert.ok(released.has(mesh.skeleton));
 assert.deepEqual(counts.map(count=>count()),[1,1,1,1]);
});
test('Material and geometry caches retain nested resources without retaining detached scene trees',()=>{
 const material=new THREE.MeshStandardMaterial({normalMap:new THREE.Texture()}),geometry=new THREE.BoxGeometry();
 const detached=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());
 const cache={materials:new Map([['stone',material]]),parts:{car:{body:geometry}},detached};cache.cycle=cache;
 const retained=cachedResources(cache);assert.ok(retained.has(material.normalMap));assert.ok(retained.has(geometry));
 assert.ok(!retained.has(detached.geometry));assert.ok(!retained.has(detached.material));
});
test('An attached object cannot be disposed accidentally',()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mesh);
 assert.throws(()=>disposeDetached(mesh),/Detach/);
});

// Registri del mondo 3D (luci notturne, pozze di luce, conversioni dei materiali): elenchi di riferimenti, non cache.
const ZONE_REFS=new Set(['glow','poolM','realMats','toonMats']);
function fakeWorld(){
 const shared=new THREE.MeshLambertMaterial(),beamM=new THREE.MeshBasicMaterial(),woodSrc=new THREE.MeshStandardMaterial({normalMap:new THREE.Texture()}),glsShared=new THREE.MeshStandardMaterial(),citySrc=new THREE.MeshStandardMaterial(),cityCopy=new THREE.MeshLambertMaterial();
 const scene=new THREE.Scene();scene.add(new THREE.Mesh(new THREE.BoxGeometry(),cityCopy));
 const world={scene,sms:new Map([['#fff',shared]]),beamM,interiorM:new Map([['wood',woodSrc]]),glsM:{k:glsShared},glow:new Set([glsShared]),poolM:[beamM],realMats:new Map([[citySrc,cityCopy]]),toonMats:new Map()};
 return {world,shared,beamM,woodSrc,glsShared,citySrc,cityCopy};
}
// Un locale come lo costruisce il gioco: materiali propri (copie Lambert dei materiali fisici, luce notturna, pozza di luce) più materiali condivisi.
function buildRoom(F){const woodCopy=F.world.realMats.get(F.woodSrc)||new THREE.MeshLambertMaterial();
 const room=new THREE.Group(),floor=new THREE.CanvasTexture({width:4,height:4}),src=new THREE.MeshStandardMaterial({map:floor,normalMap:new THREE.Texture()}),copy=new THREE.MeshLambertMaterial({map:floor});
 const lamp=new THREE.MeshBasicMaterial(),pool=new THREE.MeshBasicMaterial(),geo=new THREE.BoxGeometry();
 for(const m of [copy,woodCopy,lamp,pool,F.shared,F.beamM])room.add(new THREE.Mesh(geo,m));
 F.world.realMats.set(src,copy);F.world.realMats.set(F.woodSrc,woodCopy);F.world.glow.add(lamp);F.world.poolM.push(pool);
 return {room,src,copy,floor,woodCopy,lamp,pool,geo};
}
function release(F,root){const W=F.world,retained=sharedResources(W,ZONE_REFS,treeResources(W.scene));const conversions=[W.realMats,W.toonMats];const disposed=disposeDetached(root,{retained,borrowed:W.borrowed,conversions});forgetDisposed(disposed,[W.glow,W.poolM,...conversions]);return disposed;}
test('A released room frees materials kept only by glow, poolM and realMats, and keeps the shared ones',()=>{
 const F=fakeWorld(),R=buildRoom(F);
 const freed=[R.copy,R.src,R.src.normalMap,R.floor,R.woodCopy,R.lamp,R.pool,R.geo],kept=[F.woodSrc,F.woodSrc.normalMap,F.shared,F.beamM,F.glsShared,F.cityCopy,F.citySrc];
 const freedCounts=freed.map(watch),keptCounts=kept.map(watch);
 const disposed=release(F,R.room);
 assert.deepEqual(freedCounts.map(c=>c()),freed.map(()=>1));assert.deepEqual(keptCounts.map(c=>c()),kept.map(()=>0));
 for(const r of freed)assert.ok(disposed.has(r));
 assert.deepEqual([...F.world.glow],[F.glsShared]);assert.deepEqual(F.world.poolM,[F.beamM]);assert.deepEqual([...F.world.realMats.keys()],[F.citySrc]);
});
test('Registries lose an entry when only its key or only its value is freed',()=>{
 const a=new THREE.MeshBasicMaterial(),b=new THREE.MeshBasicMaterial(),c=new THREE.MeshBasicMaterial(),d=new THREE.MeshBasicMaterial(),e=new THREE.MeshBasicMaterial();
 const map=new Map([[a,b],[c,d],[e,e]]),set=new Set([a,c]),list=[b,d,b];
 forgetDisposed(new Set([a,d]),[map,set,list]);
 assert.deepEqual([...map],[[e,e]]);assert.deepEqual([...set],[c]);assert.deepEqual(list,[b,b]);
});
test('A material copy still used by another room stays alive and keeps its registry entry',()=>{
 const F=fakeWorld(),A=buildRoom(F),B=buildRoom(F);F.world.scene.add(B.room);
 assert.equal(A.woodCopy,B.woodCopy);const count=watch(A.woodCopy),src=watch(F.woodSrc);
 const disposed=release(F,A.room);
 assert.equal(count(),0);assert.equal(src(),0);assert.ok(!disposed.has(A.woodCopy));assert.equal(F.world.realMats.get(F.woodSrc),A.woodCopy);
 assert.ok(F.world.glow.has(B.lamp)&&!F.world.glow.has(A.lamp));assert.ok(F.world.poolM.includes(B.pool)&&!F.world.poolM.includes(A.pool));assert.ok(F.world.realMats.has(B.src)&&!F.world.realMats.has(A.src));
 assert.ok(!disposed.has(F.shared)&&!disposed.has(F.beamM));
});
test('A borrowed model material is never freed even when its simplified copy goes away',()=>{
 const F=fakeWorld(),model=new THREE.MeshStandardMaterial({map:new THREE.Texture()}),copy=new THREE.MeshLambertMaterial({map:model.map});
 F.world.borrowed=new WeakSet([model,model.map]);F.world.realMats.set(model,copy);
 const room=new THREE.Group();room.add(new THREE.Mesh(new THREE.BoxGeometry(),copy));
 const counts=[model,model.map,copy].map(watch),disposed=release(F,room);
 assert.deepEqual(counts.map(c=>c()),[0,0,1]);assert.ok(!F.world.realMats.has(model));assert.ok(!disposed.has(model.map));
});
test('Twenty rooms built and released bring the registries back to their starting size',()=>{
 const F=fakeWorld(),start=[F.world.glow.size,F.world.poolM.length,F.world.realMats.size];
 for(let i=0;i<20;i++){const R=buildRoom(F);F.world.scene.add(R.room);if(i%3===0)continue;F.world.scene.remove(R.room);release(F,R.room);}
 for(const room of F.world.scene.children.filter(o=>o.isGroup)){F.world.scene.remove(room);release(F,room);}
 assert.deepEqual([F.world.glow.size,F.world.poolM.length,F.world.realMats.size],start);
});
test('Shared resources skip the registries but still find nested caches',()=>{
 const nested=new THREE.BoxGeometry(),onlyInGlow=new THREE.MeshBasicMaterial(),both=new THREE.MeshBasicMaterial(),tex=new THREE.Texture();
 const world={parts:new Map([['car',{body:nested}]]),photos:{a:new THREE.MeshLambertMaterial({map:tex})},cache:both,glow:new Set([onlyInGlow,both]),poolM:[onlyInGlow],realMats:new Map([[onlyInGlow,onlyInGlow]])};
 const shared=sharedResources(world,ZONE_REFS);
 assert.ok(shared.has(nested)&&shared.has(tex)&&shared.has(both));assert.ok(!shared.has(onlyInGlow));
});
