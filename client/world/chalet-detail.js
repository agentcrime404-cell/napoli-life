import * as THREE from '../vendor/three/three.module.min.js';
import {bakeStatic} from './static-batches.js';

// Architectural detail for the Ultra sample area. The builder's normal static
// batching combines these pieces; no lights, animation or collision are added.
export function chaletDetail(parent, width, depth, materials) {
 const group=new THREE.Group();group.name='chalet-ultra-detail';
 const geometries=new Map();
 const box=(w,h,d,x,y,z,material)=>{
  const key=[w,h,d].join(':');
  if(!geometries.has(key))geometries.set(key,new THREE.BoxGeometry(w,h,d));
  const mesh=new THREE.Mesh(geometries.get(key),material);
  mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;
  mesh.userData.real=mesh.userData.toon=true;group.add(mesh);return mesh;
 };
 // Stepped stone cornice, a recessed dark joint and a projecting drip edge.
 for(const side of [-1,1]){
  const z=side*(depth/2+.09);
  box(width+.28,.13,.22,0,3.32,z,materials.stone);
  box(width+.34,.045,.26,0,3.43,z,materials.joint);
  box(width+.42,.09,.32,0,3.51,z,materials.stone);
 }
 for(const side of [-1,1]){
  const x=side*(width/2+.09);
  box(.22,.13,depth,x,3.32,0,materials.stone);
  box(.26,.045,depth,x,3.43,0,materials.joint);
  box(.32,.09,depth,x,3.51,0,materials.stone);
  box(.25,.38,depth,x,.19,0,materials.stone);
 }
 // Metal frame and handles stay on existing mullions, clear of door openings.
 for(let x=-width/2+1.2;x<=width/2-1.2;x+=2.4){
  box(.035,2.35,.035,x,1.72,depth/2+.15,materials.metal);
  box(.035,.32,.045,x+.075,1.22,depth/2+.23,materials.metal);
  for(const y of [1.08,1.36])box(.11,.025,.10,x+.04,y,depth/2+.19,materials.metal);
 }
 const bays=Math.max(3,Math.round((width-1)/3.4)),bay=(width-1)/bays;
 for(let i=0;i<=bays;i++){
  const x=-width/2+.5+bay*i;
  const arm=box(.035,.035,1.85,x,2.83,depth/2+1.04,materials.metal);
  arm.rotation.x=.26;
 }
 bakeStatic(group);
 const retained=new Set(group.children.filter(o=>o.isMesh).map(o=>o.geometry));
 for(const geometry of geometries.values())if(!retained.has(geometry))geometry.dispose();
 parent.add(group);return group;
}
