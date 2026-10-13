// Modelli 3D veri dei mezzi (Vespa, maxi-scooter, maxi-enduro, cinquecento, panda): se il file esiste nella cartella viene usato al posto del modello disegnato a mano.
//   client/assets/world/napoli/vehicles/moto-vere/{vespa,xadv,africa}.glb      client/assets/world/napoli/vehicles/auto-vere/{fiat500,panda}.glb
// Ogni modello viene messo in scala (lunghezza vera in metri), con la lunghezza lungo z, il muso verso +z e le ruote a terra.
// Opzionale: config.json nella stessa cartella, es. {"vespa":{"yaw":3.1416,"len":1.8}} per girare/ridimensionare un modello.
import * as THREE from '../vendor/three/three.module.min.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
// In produzione carichiamo solo modelli con licenza già verificata nel kit CC0.
// I mezzi originali di Napoli Life (moto e auto) restano generati dal codice;
// eventuali GLB esterni nelle cartelle di lavoro non vengono distribuiti.
const LIST=[['city','kenney-car-kit',3.8],['sedan','kenney-car-kit',4.2],['suv','kenney-car-kit',4.4],['gt','kenney-car-kit',4.6],['super','kenney-car-kit',4.6],['coupe','kenney-car-kit',4.3]];
const BASE='/assets/world/napoli/vehicles/';
// I GLB arrivano da pacchetti diversi: normalizza il color management e i
// parametri PBR una sola volta, evitando auto troppo lucide o texture sbiadite.
function enhanceVehicleMaterials(root,w){
 const maxAniso=Math.min(w.gl?.capabilities?.getMaxAnisotropy?.()||1,w.gfx==='ultra'?16:8);
 root.traverse(o=>{
  if(!o.isMesh)return;
  o.castShadow=!w.mobile;o.receiveShadow=true;o.frustumCulled=true;
  for(const m of (Array.isArray(o.material)?o.material:[o.material])){
   if(!m)continue;
   if(m.map){m.map.colorSpace=THREE.SRGBColorSpace;m.map.anisotropy=maxAniso;}
   for(const t of [m.normalMap,m.roughnessMap,m.metalnessMap,m.aoMap,m.bumpMap])if(t)t.colorSpace=THREE.NoColorSpace;
   if(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial){
    m.envMapIntensity=w.mobile?.38:w.gfx==='ultra'?.78:.58;
    if(m.roughness!==undefined)m.roughness=Math.max(.2,Math.min(1,m.roughness));
    if(m.metalness!==undefined)m.metalness=Math.max(0,Math.min(1,m.metalness));
   }
   m.needsUpdate=true;
  }
 });
}
export function loadRealVehicles(w){return w.realVehicleLoad??=loadOnce(w);}
async function loadOnce(w){w.realV??={};const loader=new GLTFLoader(),cfg={};
 for(const d of ['moto-vere','auto-vere']){try{const r=await fetch(BASE+d+'/config.json',{cache:'no-cache'});if(r.ok)Object.assign(cfg,await r.json());}catch{}}
 await Promise.all(LIST.map(async([id,dir,len0])=>{try{const aliases={city:'hatchback-sports',sedan:'sedan',suv:'suv',gt:'sedan-sports',super:'race',coupe:'hatchback-sports'};const file=aliases[id]||id,url=BASE+dir+'/'+file+'.glb',h=await fetch(url,{method:'HEAD',cache:'no-cache'});if(!h.ok)return;if(w.mobile&&+h.headers.get('content-length')>1500000){console.info('[modelli veri]',id,'saltato sul telefono (file pesante)');return;}
  const g=await new Promise((ok,no)=>loader.load(url+'?v='+(window.__build||''),ok,undefined,no)),root=g.scene,C=cfg[id]||{};root.rotation.y=C.yaw||0;root.updateMatrixWorld(true);
  let b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3());if(s.x>s.z*1.2){root.rotation.y+=Math.PI/2;root.updateMatrixWorld(true);b=new THREE.Box3().setFromObject(root);s=b.getSize(new THREE.Vector3());}
  const k=(C.len||len0)/Math.max(s.z,.01),box=new THREE.Group();root.scale.multiplyScalar(k);root.updateMatrixWorld(true);b=new THREE.Box3().setFromObject(root);const c=b.getCenter(new THREE.Vector3());root.position.set(-c.x,-b.min.y,-c.z);box.add(root);
  let tris=0;enhanceVehicleMaterials(root,w);root.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});
  if(tris>40000)console.warn('[modelli veri]',id,'ha',Math.round(tris),'triangoli: troppo pesante per il telefono, meglio ridurlo sotto 30000');
  box.userData.real=true;w.realV[id]=box;console.info('[modelli veri]',id,'caricato',Math.round(tris),'triangoli');}catch(e){console.warn('[modelli veri]',id,e?.message||e);}}));}
export const realCopy=(w,id)=>{const t=w.realV?.[id];return t?t.clone(true):null;};
