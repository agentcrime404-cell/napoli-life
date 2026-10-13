// Three.js clones share materials, textures and geometry with their templates.
// Dispose only resources that belong exclusively to the detached object.
export function treeResources(root, resources=new Set()) {
 root?.traverse(object=>{
  if(object.geometry)resources.add(object.geometry);
  if(object.skeleton)resources.add(object.skeleton);
  if(object.isInstancedMesh)resources.add(object);
  for(const material of [].concat(object.material||[])){
   resources.add(material);
   for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
   for(const uniform of Object.values(material.uniforms||{})){
    for(const value of [].concat(uniform?.value||[]))if(value?.isTexture)resources.add(value);
   }
  }
 });
 return resources;
}

// Inspect resource caches, never descend into scene objects or browser objects.
export function cachedResources(values, resources=new Set(), depth=4, seen=new Set()) {
 if(!values||typeof values!=='object'||seen.has(values))return resources;
 seen.add(values);
 if(values.isTexture||values.isMaterial||values.isBufferGeometry){
  resources.add(values);
  if(values.isMaterial)for(const value of Object.values(values))if(value?.isTexture)resources.add(value);
  return resources;
 }
 if(depth<=0||values.isObject3D)return resources;
 const entries=values instanceof Map?[...values.keys(),...values.values()]:values instanceof Set?[...values]:Array.isArray(values)?values:Object.getPrototypeOf(values)===Object.prototype?Object.values(values):[];
 for(const value of entries)cachedResources(value,resources,depth-1,seen);
 return resources;
}

// Risorse davvero condivise di un proprietario (il mondo 3D): le cache nelle sue proprietà.
// Le proprietà elencate in "registries" sono solo elenchi di riferimenti (luci notturne, pozze di luce, conversioni dei materiali):
// contengono anche risorse delle zone già tolte, quindi non devono tenerle in vita.
export function sharedResources(owner, registries=new Set(), resources=new Set()) {
 const seen=new Set();
 for(const [key,value] of Object.entries(owner||{}))if(!registries.has(key))cachedResources(value,resources,3,seen);
 return resources;
}

// "conversions": Map originale → copia (materiali semplificati). L'originale non sta nella scena, solo nella Map:
// quando la sua copia viene liberata va liberato anche lui, con le texture che la copia non usa, se nessuno lo conserva.
export function disposeDetached(root,{retained=new Set(),borrowed=new WeakSet(),conversions=[]}={}) {
 if(root.parent)throw new Error('Detach the object before disposing its resources');
 const kept=resource=>retained.has(resource)||borrowed.has(resource),own=treeResources(root),candidates=new Set(own);
 for(const map of conversions)for(const [source,copy] of map){
  if(!own.has(copy)||kept(copy)||kept(source)||own.has(source))continue;
  candidates.add(source);for(const value of Object.values(source))if(value?.isTexture)candidates.add(value);
 }
 const disposed=new Set();
 for(const resource of candidates)if(!kept(resource)){
  resource.dispose?.();disposed.add(resource);
 }
 return disposed;
}

// Toglie dai registri (Set, array o Map) le voci delle risorse liberate; una voce di Map se ne va se è liberata la chiave o il valore.
export function forgetDisposed(disposed, registries=[]) {
 for(const registry of registries){
  if(registry instanceof Map){for(const [key,value] of registry)if(disposed.has(key)||disposed.has(value))registry.delete(key);}
  else if(registry instanceof Set){for(const value of registry)if(disposed.has(value))registry.delete(value);}
  else if(Array.isArray(registry)){for(let i=registry.length-1;i>=0;i--)if(disposed.has(registry[i]))registry.splice(i,1);}
 }
}
