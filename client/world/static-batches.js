import * as THREE from '../vendor/three/three.module.min.js';
import {mergeGeometries} from '../vendor/three/BufferGeometryUtils.js';

// Keep each batch local so distant furniture can be culled without changing its position.
export function bakeStatic(root,{mobile=false,spatial=false,cellSize=100}={}){
 root.updateWorldMatrix(true,true);
 const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),by=new Map(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();
 root.traverse(object=>{
  if(!object.isMesh||object.isInstancedMesh||Array.isArray(object.material)||!object.material.userData.merge||object.userData.keep||object.userData.baked||!object.geometry.attributes.normal)return;
  point.setFromMatrixPosition(matrix.multiplyMatrices(inverse,object.matrixWorld));
  const cell=spatial?Math.floor(point.x/cellSize)+','+Math.floor(point.z/cellSize):'room';
  let cells=by.get(object.material);if(!cells)by.set(object.material,cells=new Map());
  let list=cells.get(cell);if(!list)cells.set(cell,list=[]);list.push(object);
 });
 let batches=0;
 for(const [material,cells] of by)for(const list of cells.values()){
  if(list.length<2)continue;
  const keep=['position','normal','uv','color'].filter(key=>list.every(object=>object.geometry.attributes[key]));
  const parts=list.map(object=>{
   const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();
   for(const key of Object.keys(geometry.attributes))if(!keep.includes(key))geometry.deleteAttribute(key);
   matrix.multiplyMatrices(inverse,object.matrixWorld);geometry.applyMatrix4(matrix);
   if(matrix.determinant()<0)for(const attribute of Object.values(geometry.attributes)){
    const array=attribute.array,size=attribute.itemSize;
    for(let vertex=0;vertex<attribute.count;vertex+=3)for(let component=0;component<size;component++){
     const a=(vertex+1)*size+component,b=(vertex+2)*size+component,value=array[a];array[a]=array[b];array[b]=value;
    }
   }
   return geometry;
  });
  const geometry=mergeGeometries(parts);for(const part of parts)part.dispose();if(!geometry)continue;
  geometry.computeBoundingSphere();
  for(const object of list)object.removeFromParent();
  const mesh=new THREE.Mesh(geometry,material);mesh.castShadow=!mobile&&!material.userData.noShadow;mesh.receiveShadow=!mobile;mesh.userData.baked=true;
  if(spatial){mesh.userData.zone=true;mesh.boundingSphere=geometry.boundingSphere;}
  root.add(mesh);batches++;
 }
 return batches;
}
