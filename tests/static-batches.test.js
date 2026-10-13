import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../client/vendor/three/three.module.min.js';
import {bakeStatic} from '../client/world/static-batches.js';

const material=()=>{const value=new THREE.MeshLambertMaterial({color:'#b5a585'});value.userData.merge=true;return value;};
function vertices(root){root.updateWorldMatrix(true,true);const points=[];root.traverse(object=>{if(!object.isMesh)return;const position=object.geometry.attributes.position,index=object.geometry.index,point=new THREE.Vector3();for(let i=0;i<(index?.count||position.count);i++){point.fromBufferAttribute(position,index?index.getX(i):i).applyMatrix4(object.matrixWorld);points.push([point.x,point.y,point.z].map(value=>Math.round(value*10000)).join(','));}});return points.sort();}

test('Batch spaziali: arredi lontani restano separati e le posizioni non cambiano',()=>{
 const root=new THREE.Group(),geometry=new THREE.BoxGeometry(2,3,2),mat=material();
 for(const x of [10,15,310,315]){const mesh=new THREE.Mesh(geometry,mat);mesh.position.set(x,2,12);root.add(mesh);}
 const before=vertices(root);assert.equal(bakeStatic(root,{mobile:true,spatial:true}),2);
 assert.deepEqual(vertices(root),before);assert.equal(root.children.length,2);
 for(const mesh of root.children){assert.equal(mesh.userData.zone,true);assert.ok(mesh.boundingSphere.radius<8);assert.equal(mesh.castShadow,false);}
 assert.equal(bakeStatic(root,{spatial:true}),0);
});

test('Batch: rotazioni e scale specchiate conservano geometria, orientamento e risorse condivise',()=>{
 const scene=new THREE.Scene(),root=new THREE.Group();root.position.set(40,8,-30);root.rotation.y=.4;scene.add(root);
 const geometry=new THREE.BoxGeometry(2,2,2),mat=material();let disposed=0;geometry.addEventListener('dispose',()=>disposed++);
 for(const [x,scale] of [[2,1],[8,-1]]){const holder=new THREE.Group();holder.position.x=x;holder.rotation.y=.7;const mesh=new THREE.Mesh(geometry,mat);mesh.scale.x=scale;holder.add(mesh);root.add(holder);}
 const before=vertices(root);assert.equal(bakeStatic(root),1);assert.deepEqual(vertices(root),before);assert.equal(disposed,0);
 const mesh=root.children.find(object=>object.isMesh),p=mesh.geometry.attributes.position,n=mesh.geometry.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),normal=new THREE.Vector3();
 for(let i=0;i<p.count;i+=3){a.fromBufferAttribute(p,i);b.fromBufferAttribute(p,i+1).sub(a);c.fromBufferAttribute(p,i+2).sub(a);normal.fromBufferAttribute(n,i);assert.ok(b.cross(c).normalize().dot(normal)>.99);}
 assert.ok(mesh.geometry.attributes.uv);assert.equal(mesh.material,mat);
});

test('Batch: materiali diversi e oggetti da mantenere non vengono mescolati',()=>{
 const root=new THREE.Group(),a=material(),b=material(),geometry=new THREE.BoxGeometry();
 for(const mat of [a,a,b,b])root.add(new THREE.Mesh(geometry,mat));
 const kept=new THREE.Mesh(geometry,a);kept.userData.keep=true;root.add(kept);
 assert.equal(bakeStatic(root),2);assert.equal(kept.parent,root);assert.equal(root.children.length,3);
 assert.deepEqual(new Set(root.children.filter(o=>o.userData.baked).map(o=>o.material)),new Set([a,b]));
});
