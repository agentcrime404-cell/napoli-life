import * as THREE from '../vendor/three/three.module.min.js';
import {mergeGeometries} from '../vendor/three/BufferGeometryUtils.js';

const numberKey=value=>Number.isFinite(value)?Number(value.toFixed(6)):value;
function flatMaterialKey(material){
 const color=material.color,emissive=material.emissive,data=material.userData||{};
 const renderState=[material.type,
  color&&[numberKey(color.r),numberKey(color.g),numberKey(color.b)],
  emissive&&[numberKey(emissive.r),numberKey(emissive.g),numberKey(emissive.b)],
  numberKey(material.emissiveIntensity),numberKey(material.roughness),numberKey(material.metalness),numberKey(material.shininess),
  numberKey(material.reflectivity),numberKey(material.refractionRatio),numberKey(material.ior),material.side,material.visible,
  material.flatShading,material.fog,material.toneMapped,material.depthFunc,material.depthTest,material.depthWrite,material.colorWrite,
  material.blending,material.blendSrc,material.blendDst,material.blendEquation,material.blendSrcAlpha,material.blendDstAlpha,material.blendEquationAlpha,
  material.transparent,numberKey(material.opacity),numberKey(material.alphaTest),material.alphaHash,material.alphaToCoverage,
  material.polygonOffset,numberKey(material.polygonOffsetFactor),numberKey(material.polygonOffsetUnits),
  material.wireframe,numberKey(material.wireframeLinewidth),material.dithering,material.premultipliedAlpha,
  material.stencilWrite,material.stencilFunc,material.stencilRef,material.stencilFuncMask,material.stencilWriteMask,
  material.stencilFail,material.stencilZFail,material.stencilZPass,material.forceSinglePass,
  JSON.stringify(material.defines||{}),JSON.stringify(material.extensions||{}),
  Object.keys(data).filter(key=>key!=='merge').sort().map(key=>[key,data[key]])];
 return JSON.stringify(renderState);
}

// Keep each batch local so distant furniture can be culled without changing its position.
export function bakeStatic(root,{mobile=false,spatial=false,cellSize=100}={}){
 root.updateWorldMatrix(true,true);
 const inverse=new THREE.Matrix4().copy(root.matrixWorld).invert(),by=new Map(),point=new THREE.Vector3(),matrix=new THREE.Matrix4();
 root.traverse(object=>{
  if(!object.isMesh||object.isInstancedMesh||Array.isArray(object.material)||object.userData.keep||object.userData.baked||!object.geometry.attributes.normal||object.geometry.morphAttributes&&Object.keys(object.geometry.morphAttributes).length)return;
  const material=object.material,userDataKeys=Object.keys(material.userData||{}),flatMobile=mobile&&material.userData.merge!==false&&!material.map&&!material.normalMap&&!material.bumpMap&&!material.displacementMap&&!material.aoMap&&!material.lightMap&&!material.emissiveMap&&!material.alphaMap&&!material.envMap&&!material.transparent&&material.opacity>=1&&!material.alphaTest&&!material.vertexColors&&!material.clippingPlanes&&(material.isMeshBasicMaterial||material.isMeshLambertMaterial||material.isMeshStandardMaterial)&&material.onBeforeCompile===THREE.Material.prototype.onBeforeCompile&&material.customProgramCacheKey===THREE.Material.prototype.customProgramCacheKey&&userDataKeys.every(key=>key==='merge'||key==='outlineParameters')&&object.geometry.attributes.uv;
  if(!material.userData.merge&&!flatMobile)return;
  point.setFromMatrixPosition(matrix.multiplyMatrices(inverse,object.matrixWorld));
  const batchCell=spatial&&flatMobile?Math.max(cellSize,180):cellSize,cell=spatial?Math.floor(point.x/batchCell)+','+Math.floor(point.z/batchCell):'room';
  const key=flatMobile?'flat:'+flatMaterialKey(material):material;let batch=by.get(key);if(!batch)by.set(key,batch={material,cells:new Map()});
  let list=batch.cells.get(cell);if(!list)batch.cells.set(cell,list=[]);list.push(object);
 });
 let batches=0;
 for(const {material,cells} of by.values())for(const list of cells.values()){
  if(list.length<2)continue;
  const keep=['position','normal','uv','color'].filter(key=>list.every(object=>object.geometry.attributes[key]));
  const parts=list.map(object=>{
   const geometry=object.geometry.index?object.geometry.toNonIndexed():object.geometry.clone();geometry.clearGroups();
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
