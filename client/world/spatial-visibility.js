import * as THREE from '../vendor/three/three.module.min.js';
import {nextTask} from './next-task.js';

// Only rendering changes: collisions and map coordinates remain authoritative.
export class SpatialVisibility{
 constructor(root,{range=260,landmarkRadius=60,cellSize=64,moveThreshold=.65}={}){this.root=root;this.range=range;this.landmarkRadius=landmarkRadius;this.cellSize=cellSize;this.moveThreshold=moveThreshold;this.entries=[];this.cells=new Map();this.largeEntries=[];this.alwaysEntries=[];this.maxIndexedRadius=0;this.visibleEntries=new Set();this.nextVisibleEntries=new Set();this.lastX=this.lastZ=this.lastRange=null;this.lastCandidateCount=0;this.initialized=false;}
 async prepare(cancelled=()=>false){
  this.root.updateWorldMatrix(true,true);
  const objects=[...this.root.children];
  for(let i=0;i<objects.length;i++){
   if(cancelled()){this.entries.length=0;this.largeEntries.length=0;this.alwaysEntries.length=0;this.cells.clear();return false;}
   const object=objects[i],box=new THREE.Box3().setFromObject(object),sphere=new THREE.Sphere();
   if(box.isEmpty())continue;
   box.getBoundingSphere(sphere);
   const always=sphere.radius>this.landmarkRadius&&!object.userData.zone,entry={object,sphere,always};this.entries.push(entry);
   if(always){this.alwaysEntries.push(entry);continue;}
   if(sphere.radius>this.landmarkRadius){this.largeEntries.push(entry);continue;}
   // Index each static object once by its center. The query expands by the
   // largest indexed radius, so objects crossing a cell edge are still found.
   if(sphere.radius>this.maxIndexedRadius)this.maxIndexedRadius=sphere.radius;
   const x=Math.floor(sphere.center.x/this.cellSize),z=Math.floor(sphere.center.z/this.cellSize);
   let column=this.cells.get(x);if(!column)this.cells.set(x,column=new Map());
   let bucket=column.get(z);if(!bucket)column.set(z,bucket=[]);bucket.push(entry);
   if(i%32===31)await nextTask();
  }
  return true;
 }
 update(x,z){
  if(!Number.isFinite(x)||!Number.isFinite(z))return this.visibleEntries.size;
  const moved=this.lastX===null||(x-this.lastX)**2+(z-this.lastZ)**2>=this.moveThreshold*this.moveThreshold,rangeChanged=this.lastRange!==this.range;
  if(!moved&&!rangeChanged)return this.visibleEntries.size;
  if(!this.initialized){for(const entry of this.entries)entry.object.visible=entry.always;this.initialized=true;}
  this.lastX=x;this.lastZ=z;this.lastRange=this.range;this.lastCandidateCount=0;
  const next=this.nextVisibleEntries;next.clear();
  for(const entry of this.alwaysEntries){this.lastCandidateCount++;if(!entry.object.visible)entry.object.visible=true;next.add(entry);}
  for(const entry of this.largeEntries){this.lastCandidateCount++;const {object,sphere}=entry,reach=this.range+sphere.radius,dx=sphere.center.x-x,dz=sphere.center.z-z;if(dx*dx+dz*dz<=reach*reach){next.add(entry);if(!object.visible)object.visible=true;}}
  const radius=this.range+(this.maxIndexedRadius||0),size=this.cellSize,minX=Math.floor((x-radius)/size),maxX=Math.floor((x+radius)/size),minZ=Math.floor((z-radius)/size),maxZ=Math.floor((z+radius)/size);
  for(let cx=minX;cx<=maxX;cx++){
   const column=this.cells.get(cx);if(!column)continue;
   for(let cz=minZ;cz<=maxZ;cz++){
    const bucket=column.get(cz);if(!bucket)continue;
    for(const entry of bucket){this.lastCandidateCount++;const {object,sphere}=entry,reach=this.range+sphere.radius,dx=sphere.center.x-x,dz=sphere.center.z-z;
     if(dx*dx+dz*dz<=reach*reach){next.add(entry);if(!object.visible)object.visible=true;}
    }
   }
  }
  for(const entry of this.visibleEntries)if(!next.has(entry))entry.object.visible=false;
  const previous=this.visibleEntries;this.visibleEntries=next;this.nextVisibleEntries=previous;
  return next.size;
 }
}
