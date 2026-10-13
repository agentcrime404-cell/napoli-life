import * as THREE from '../vendor/three/three.module.min.js';
import {nextTask} from './next-task.js';

// Index buffers select spatial subsets. Shared vertex attributes keep facade LOD edits in sync.
export async function chunkStaticGeometry(root,{cellSize=128,minVertices=9000,cancelled=()=>false}={}){
 root.updateWorldMatrix(true,true);
 const meshes=[];root.traverse(object=>{if(object.isMesh&&!object.isInstancedMesh&&!object.isSkinnedMesh&&!Array.isArray(object.material)&&!object.userData.spatialChunk)meshes.push(object);});
 let chunks=0;
 for(const object of meshes){
  if(cancelled())return false;
  const source=object.geometry,position=source.attributes.position;
  if(!position||position.count<minVertices||Object.keys(source.morphAttributes||{}).length)continue;
  source.computeBoundingSphere();
  if(source.boundingSphere.radius<cellSize||source.type==='PlaneGeometry')continue;
  const index=source.index,buckets=new Map(),point=new THREE.Vector3(),a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3();
  const start=source.drawRange.start,end=Math.min(index?.count||position.count,start+source.drawRange.count);
  for(let triangle=start;triangle+2<end;triangle+=3){
   const ids=[index?index.getX(triangle):triangle,index?index.getX(triangle+1):triangle+1,index?index.getX(triangle+2):triangle+2];
   a.fromBufferAttribute(position,ids[0]);b.fromBufferAttribute(position,ids[1]);c.fromBufferAttribute(position,ids[2]);
   point.copy(a).add(b).add(c).multiplyScalar(1/3).applyMatrix4(object.matrixWorld);
   const key=Math.floor(point.x/cellSize)+','+Math.floor(point.z/cellSize);
   let bucket=buckets.get(key);if(!bucket)buckets.set(key,bucket={indices:[],bounds:new THREE.Box3()});
   bucket.indices.push(...ids);bucket.bounds.expandByPoint(a).expandByPoint(b).expandByPoint(c);
   if(triangle%30000===0){await nextTask();if(cancelled())return false;}
  }
  if(buckets.size<2)continue;
  const parent=object.parent;
  for(const bucket of buckets.values()){
   const geometry=new THREE.BufferGeometry();for(const [name,attribute] of Object.entries(source.attributes))geometry.setAttribute(name,attribute);
   geometry.setIndex(new THREE.BufferAttribute(new Uint32Array(bucket.indices),1));bucket.indices.length=0;
   geometry.boundingBox=bucket.bounds;geometry.boundingSphere=bucket.bounds.getBoundingSphere(new THREE.Sphere());
   const mesh=object.clone(false);mesh.geometry=geometry;mesh.frustumCulled=true;mesh.userData={...object.userData,zone:true,spatialChunk:true,baked:true};parent.add(mesh);chunks++;
  }
  object.removeFromParent();
 }
 return chunks;
}
