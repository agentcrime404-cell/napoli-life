import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../client/vendor/three/three.module.min.js';
import {chunkStaticGeometry} from '../client/world/geometry-chunks.js';
function geometry(){const value=new THREE.BufferGeometry();value.setAttribute('position',new THREE.Float32BufferAttribute([0,0,0,2,0,0,0,2,0,2,0,0,2,2,0,0,2,0,400,0,400,402,0,400,400,2,400,402,0,400,402,2,400,400,2,400],3));value.computeVertexNormals();return value;}
function points(root){root.updateWorldMatrix(true,true);const values=[],p=new THREE.Vector3();root.traverse(object=>{if(!object.isMesh)return;const a=object.geometry.attributes.position,index=object.geometry.index;for(let i=0;i<(index?.count||a.count);i++){p.fromBufferAttribute(a,index?index.getX(i):i).applyMatrix4(object.matrixWorld);values.push([p.x,p.y,p.z].map(v=>Math.round(v*1000)).join(','));}});return values.sort();}

test('Geometrie spaziali: stesso numero di triangoli e posizioni, bounds limitati e materiali conservati',async()=>{
 const root=new THREE.Group(),source=geometry(),material=new THREE.MeshLambertMaterial(),mesh=new THREE.Mesh(source,material);root.position.set(20,3,0);root.rotation.y=.15;mesh.position.y=2;root.add(mesh);const before=points(root);
 assert.equal(await chunkStaticGeometry(root,{cellSize:64,minVertices:1}),2);assert.deepEqual(points(root),before);
 for(const part of root.children){assert.equal(part.material,material);assert.ok(part.geometry.boundingSphere.radius<3);assert.equal(part.userData.zone,true);assert.equal(part.frustumCulled,true);}
});

test('Geometrie spaziali: gli aggiornamenti LOD dei vertici sono condivisi senza copie disallineate',async()=>{
 const root=new THREE.Group(),source=geometry(),mesh=new THREE.Mesh(source,new THREE.MeshBasicMaterial());root.add(mesh);const attribute=source.attributes.position;
 await chunkStaticGeometry(root,{cellSize:64,minVertices:1});assert.ok(root.children.every(part=>part.geometry.attributes.position===attribute));
 attribute.setXYZ(0,1,1,1);attribute.needsUpdate=true;assert.ok(root.children.every(part=>part.geometry.attributes.position.version===1));
 assert.ok(root.children.some(part=>[...part.geometry.index.array].includes(0)));assert.equal(root.children[0].geometry.attributes.position.getX(0),1);
});

test('Geometrie spaziali: cancellazione e terreno panoramico non eliminano gli oggetti originali',async()=>{
 const root=new THREE.Group(),mesh=new THREE.Mesh(geometry(),new THREE.MeshBasicMaterial());root.add(mesh);
 assert.equal(await chunkStaticGeometry(root,{minVertices:1,cancelled:()=>true}),false);assert.equal(mesh.parent,root);
 const terrain=new THREE.Mesh(new THREE.PlaneGeometry(2000,2000,30,30),mesh.material),other=new THREE.Group();other.add(terrain);
 assert.equal(await chunkStaticGeometry(other,{minVertices:1}),0);assert.equal(terrain.parent,other);
});
