import * as THREE from '../vendor/three/three.module.min.js';
import {nextTask} from './next-task.js';

// Only rendering changes: collisions and map coordinates remain authoritative.
export class SpatialVisibility{
 constructor(root,{range=260,landmarkRadius=60}={}){this.root=root;this.range=range;this.landmarkRadius=landmarkRadius;this.entries=[];}
 async prepare(cancelled=()=>false){
  this.root.updateWorldMatrix(true,true);
  const objects=[...this.root.children];
  for(let i=0;i<objects.length;i++){
   if(cancelled())return false;
   const object=objects[i],box=new THREE.Box3().setFromObject(object),sphere=new THREE.Sphere();
   if(box.isEmpty())continue;
   box.getBoundingSphere(sphere);
   this.entries.push({object,sphere,always:sphere.radius>this.landmarkRadius&&!object.userData.zone});
   if(i%32===31)await nextTask();
  }
  return true;
 }
 update(x,z){
  let visible=0;
  for(const {object,sphere,always} of this.entries){
   const reach=this.range+sphere.radius,dx=sphere.center.x-x,dz=sphere.center.z-z;
   object.visible=always||dx*dx+dz*dz<=reach*reach;
   if(object.visible)visible++;
  }
  return visible;
 }
}
