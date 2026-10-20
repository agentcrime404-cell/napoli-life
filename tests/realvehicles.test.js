import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,statSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {REAL_VEHICLE_ASSETS,MOBILE_MODEL_LIMIT,realVehicleAssetsFor} from '../client/world/realvehicles.js';

const ROOT=fileURLToPath(new URL('../',import.meta.url));
function inspectGlb(file){
 const data=readFileSync(file);
 assert.equal(data.toString('ascii',0,4),'glTF',`${path.basename(file)} deve essere un GLB valido`);
 const jsonLength=data.readUInt32LE(12),doc=JSON.parse(data.toString('utf8',20,20+jsonLength));
 const triangles=(doc.meshes||[]).flatMap(mesh=>mesh.primitives||[]).reduce((sum,primitive)=>{
  const accessor=doc.accessors?.[primitive.indices];
  return sum+(accessor?accessor.count:doc.accessors?.[primitive.attributes?.POSITION]?.count||0)/3;
 },0);
 return {bytes:data.byteLength,triangles:Math.round(triangles)};
}

test('i GLB realistici dichiarati sono presenti e le dimensioni del catalogo corrispondono ai file',()=>{
 assert.deepEqual(REAL_VEHICLE_ASSETS.map(asset=>asset.id),['sportscar','africa']);
 for(const asset of REAL_VEHICLE_ASSETS){
  const file=path.join(ROOT,'client/assets/world/napoli/vehicles',asset.directory,asset.file+'.glb');
  const actual=inspectGlb(file);
  assert.equal(statSync(file).size,asset.bytes,`${asset.id}: aggiornare il catalogo se cambia il file`);
  assert.ok(actual.triangles>0,`${asset.id}: il modello deve contenere triangoli`);
  if(asset.id==='sportscar')assert.ok(actual.triangles<=30000,'l’auto leggera deve restare nel budget mobile triangoli');
  if(asset.id==='africa')assert.ok(actual.triangles>30000,'la maxi-enduro va esclusa dal budget mobile finché non viene ridotta');
 }
});

test('il caricamento mobile esclude solo la maxi-enduro oltre il budget e conserva l’auto leggera',()=>{
 const mobile=realVehicleAssetsFor(true),desktop=realVehicleAssetsFor(false);
 assert.deepEqual(desktop.map(asset=>asset.id),['sportscar','africa']);
 assert.deepEqual(mobile.map(asset=>asset.id),['sportscar']);
 assert.ok(mobile.every(asset=>asset.bytes<=MOBILE_MODEL_LIMIT));
 assert.ok(REAL_VEHICLE_ASSETS.find(asset=>asset.id==='africa').bytes>MOBILE_MODEL_LIMIT);
});

test('nessun caricamento runtime punta ai sei GLB Kenney scollegati dal catalogo',()=>{
 const source=readFileSync(new URL('../client/world/realvehicles.js',import.meta.url),'utf8');
 assert.doesNotMatch(source,/hatchback-sports|sedan-sports|kenney-car-kit/);
 assert.match(source,/id:'sportscar',directory:'auto-vere',file:'sportscar'/);
 assert.match(source,/id:'africa',directory:'moto-vere',file:'africa'/);
});
