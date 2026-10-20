// Modelli 3D veri dei mezzi (Vespa, maxi-scooter, maxi-enduro, cinquecento, panda): se il file esiste nella cartella viene usato al posto del modello disegnato a mano.
//   client/assets/world/napoli/vehicles/moto-vere/{vespa,xadv,africa}.glb      client/assets/world/napoli/vehicles/auto-vere/{fiat500,panda}.glb
// Ogni modello viene messo in scala (lunghezza vera in metri), con la lunghezza lungo z, il muso verso +z e le ruote a terra.
// Opzionale: config.json nella stessa cartella, es. {"vespa":{"yaw":3.1416,"len":1.8}} per girare/ridimensionare un modello.
import * as THREE from '../vendor/three/three.module.min.js';
import {GLTFLoader} from '../vendor/three/GLTFLoader.js';
const BASE='/assets/world/napoli/vehicles/';
// Collega i GLB effettivamente consultati da World3D. Il vecchio elenco
// scaricava sei modelli Kenney con chiavi che realCopy() non richiedeva,
// mentre sportscar.glb e africa.glb, presenti nel progetto, non venivano caricati.
export const REAL_VEHICLE_ASSETS=Object.freeze([
 Object.freeze({id:'sportscar',directory:'auto-vere',file:'sportscar',length:4.6,bytes:356896}),
 Object.freeze({id:'africa',directory:'moto-vere',file:'africa',length:2.3,bytes:5227400}),
]);
export const MOBILE_MODEL_LIMIT=1_500_000;
export function realVehicleAssetsFor(mobile=false){return REAL_VEHICLE_ASSETS.filter(a=>!mobile||a.bytes<=MOBILE_MODEL_LIMIT);}
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
export function loadRealVehicles(w){return w.realVehicleLoad??=loadOnce(w).then(()=>loadExtraVehicles(w));}
async function loadOnce(w){w.realV??={};const loader=new GLTFLoader(),cfg={},status=w.realVehicleStatus={state:'loading',mobile:!!w.mobile,requested:[],loaded:[],skipped:[],failed:[]};
 for(const d of ['moto-vere','auto-vere']){try{const r=await fetch(BASE+d+'/config.json',{cache:'no-cache'});if(r.ok)Object.assign(cfg,await r.json());}catch{}}
 const selected=realVehicleAssetsFor(!!w.mobile);status.requested=selected.map(asset=>asset.id);
 status.skipped=REAL_VEHICLE_ASSETS.filter(asset=>!selected.includes(asset)).map(asset=>({id:asset.id,bytes:asset.bytes,reason:'sopra il limite mobile'}));
 await Promise.all(selected.map(async asset=>{try{const {id,directory,file,length}=asset,url=BASE+directory+'/'+file+'.glb';
  const g=await new Promise((ok,no)=>loader.load(url+'?v='+(window.__build||''),ok,undefined,no)),root=g.scene,C=cfg[id]||{};root.rotation.y=C.yaw||0;root.updateMatrixWorld(true);
  let b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3());if(s.x>s.z*1.2){root.rotation.y+=Math.PI/2;root.updateMatrixWorld(true);b=new THREE.Box3().setFromObject(root);s=b.getSize(new THREE.Vector3());}
  const k=(C.len||length)/Math.max(s.z,.01),box=new THREE.Group();root.scale.multiplyScalar(k);root.updateMatrixWorld(true);b=new THREE.Box3().setFromObject(root);const c=b.getCenter(new THREE.Vector3());root.position.set(-c.x,-b.min.y,-c.z);box.add(root);
  let tris=0;enhanceVehicleMaterials(root,w);root.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});
  if(tris>40000)console.warn('[modelli veri]',id,'ha',Math.round(tris),'triangoli: troppo pesante per il telefono, meglio ridurlo sotto 30000');
  box.userData.real=true;w.realV[id]=box;status.loaded.push({id,triangles:Math.round(tris)});console.info('[modelli veri]',id,'caricato',Math.round(tris),'triangoli');}catch(e){const message=String(e?.message||e);status.failed.push({id:asset.id,message});console.warn('[modelli veri]',asset.id,message);}}));
 for(const item of status.skipped)console.info('[modelli veri]',item.id,'saltato sul telefono ('+Math.round(item.bytes/1024)+' KB; limite '+Math.round(MOBILE_MODEL_LIMIT/1024)+' KB)');
 status.state='ready';
}
export const realCopy=(w,id)=>{const t=w.realV?.[id];return t?t.clone(true):null;};

// ── Veicoli nuovi aggiunti con scripts/aggiungi-veicolo.mjs ──────────────────────────────
// Il manifest elenca i GLB (cartella nuovi/). Un modello che manca, è rotto o è troppo pesante per il telefono
// viene semplicemente saltato: il catalogo (shared/vehicles-extra.js) ha sempre un modello disegnato di riserva.
export const EXTRA_VEHICLE_MANIFEST=BASE+'nuovi/manifest.json';
/** Mette in scala un modello: lunghezza vera in metri lungo z, muso verso +z, ruote a terra, centrato. */
export function normalizeVehicleModel(root,{yaw=0,length=4}={}){
 root.rotation.y=yaw;root.updateMatrixWorld(true);
 let b=new THREE.Box3().setFromObject(root),s=b.getSize(new THREE.Vector3());
 if(s.x>s.z*1.2){root.rotation.y+=Math.PI/2;root.updateMatrixWorld(true);b=new THREE.Box3().setFromObject(root);s=b.getSize(new THREE.Vector3());}
 root.scale.multiplyScalar(length/Math.max(s.z,.01));root.updateMatrixWorld(true);
 b=new THREE.Box3().setFromObject(root);const c=b.getCenter(new THREE.Vector3());root.position.set(-c.x,-b.min.y,-c.z);
 const box=new THREE.Group();box.add(root);box.updateMatrixWorld(true);
 const size=new THREE.Box3().setFromObject(box).getSize(new THREE.Vector3());
 return {box,size};
}
export async function loadExtraVehicles(w){
 const status=w.realVehicleStatus??={state:'ready',loaded:[],skipped:[],failed:[]};
 const extra=status.extra={loaded:[],skipped:[],failed:[]};w.extraVehicleCredits=[];w.realV??={};
 try{
  const r=await fetch(EXTRA_VEHICLE_MANIFEST,{cache:'no-cache'});if(!r.ok)return extra;
  const list=(await r.json()).modelli||[],loader=new GLTFLoader();
  await Promise.all(list.map(async m=>{try{
   if(w.mobile&&m.bytes>MOBILE_MODEL_LIMIT){extra.skipped.push({id:m.id,reason:'sopra il limite mobile'});return;}
   const g=await new Promise((ok,no)=>loader.load(BASE+'nuovi/'+m.file+'?v='+(m.bytes||''),ok,undefined,no));
   const {box,size}=normalizeVehicleModel(g.scene,{yaw:m.yaw||0,length:m.length||4});
   enhanceVehicleMaterials(g.scene,w);
   let tris=0;g.scene.traverse(o=>{if(o.isMesh)tris+=(o.geometry.index?o.geometry.index.count:o.geometry.attributes.position.count)/3;});
   box.userData.real=true;box.userData.seat=m.seat||{x:.36,y:-size.y*.5,z:0,hw:size.x/2};
   w.realV[m.id]=box;extra.loaded.push({id:m.id,triangles:Math.round(tris)});
   if(m.credit?.text)w.extraVehicleCredits.push({text:m.credit.text,url:m.credit.url||''});
  }catch(e){extra.failed.push({id:m.id,message:String(e?.message||e)});console.warn('[veicoli nuovi]',m.id,e?.message||e);}}));
 }catch(e){console.warn('[veicoli nuovi] manifest non leggibile',e?.message||e);}
 return extra;
}
