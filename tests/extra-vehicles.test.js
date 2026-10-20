import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,existsSync,rmSync} from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {EXTRA_VEHICLES} from '../shared/vehicles-extra.js';
import {VEHICLE,VEHICLES_3D} from '../shared/catalog.js';
import {analizzaGlb,esegui,TIPI} from '../scripts/aggiungi-veicolo.mjs';

const ROOT=fileURLToPath(new URL('../',import.meta.url)),NUOVI=path.join(ROOT,'client/assets/world/napoli/vehicles/nuovi');

// GLB minimo: un solo triangolo.
function glb({uri}={}){
 const pos=Buffer.alloc(36);[0,0,0,1,0,0,0,1,0].forEach((v,i)=>pos.writeFloatLE(v,i*4));
 const doc={asset:{version:'2.0'},buffers:[{byteLength:36,...(uri?{uri}:{})}],bufferViews:[{buffer:0,byteLength:36}],accessors:[{bufferView:0,componentType:5126,count:3,type:'VEC3',min:[0,0,0],max:[1,1,0]}],meshes:[{primitives:[{attributes:{POSITION:0}}]}],nodes:[{mesh:0}],scenes:[{nodes:[0]}],scene:0};
 let json=Buffer.from(JSON.stringify(doc));json=Buffer.concat([json,Buffer.alloc((4-json.length%4)%4,32)]);
 const head=Buffer.alloc(12);head.write('glTF',0,'ascii');head.writeUInt32LE(2,4);
 const jh=Buffer.alloc(8);jh.writeUInt32LE(json.length,0);jh.write('JSON',4,'ascii');
 const bh=Buffer.alloc(8);bh.writeUInt32LE(36,0);bh.write('BIN',4,'ascii');
 const out=Buffer.concat([head,jh,json,bh,pos]);out.writeUInt32LE(out.length,8);return out;
}
function progettoFinto(){
 const root=mkdtempSync(path.join(os.tmpdir(),'napoli-veh-'));
 mkdirSync(path.join(root,'shared'),{recursive:true});mkdirSync(path.join(root,'client/assets/world/napoli/vehicles/nuovi'),{recursive:true});
 writeFileSync(path.join(root,'shared/vehicles-extra.js'),'export const EXTRA_VEHICLES=[];\n');
 writeFileSync(path.join(root,'client/assets/world/napoli/vehicles/nuovi/manifest.json'),'{"modelli":[]}\n');
 writeFileSync(path.join(root,'client/assets/world/napoli/LICENZE.md'),'# Licenze\n');
 return root;
}
const base=['--id','vespa-prova','--tipo','scooter','--nome','Scooter Prova','--prezzo','900','--autore','Mario Rossi','--fonte','https://sketchfab.com/3d-models/prova','--licenza','CC BY 4.0'];
const con=(args,da,a)=>args.map(x=>x===da?a:x);

test('manifest e catalogo dei veicoli nuovi sono coerenti con i file',()=>{
 const manifest=JSON.parse(readFileSync(path.join(NUOVI,'manifest.json'),'utf8')).modelli;
 assert.deepEqual(manifest.map(m=>m.id).sort(),EXTRA_VEHICLES.map(v=>v.glb).sort());
 const ids=new Set();
 for(const v of EXTRA_VEHICLES){
  assert.match(v.id,/^x-[a-z0-9-]+$/);assert.ok(!ids.has(v.id),'id doppio '+v.id);ids.add(v.id);
  assert.ok(['auto','moto','bici'].includes(v.shop));assert.ok(['auto','cabrio','scooter','bici'].includes(v.base));
  assert.ok(v.buy>=50&&v.speed>0&&v.name&&v.model&&/^#[0-9a-f]{6}$/i.test(v.color));
  assert.equal(VEHICLE[v.id],v);assert.ok(VEHICLES_3D.includes(v));
  const m=manifest.find(x=>x.id===v.glb);assert.ok(m,'manca nel manifest '+v.glb);
  const info=analizzaGlb(path.join(NUOVI,m.file));
  assert.equal(info.bytes,m.bytes);assert.match(m.credit.text,/licenza (CC0|CC BY)/);assert.match(m.credit.url,/^https?:\/\//);
 }
});

test('lo script aggiunge, aggiorna e rimuove un veicolo',async t=>{
 const root=progettoFinto(),file=path.join(root,'m.glb');t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(file,glb());
 const r=await esegui([file,...base,'--colore','#d9d3c3'],{root,log:()=>{}});
 assert.equal(r.id,'x-vespa-prova');assert.equal(r.triangoli,1);
 const extraJs=path.join(root,'shared/vehicles-extra.js'),mfFile=path.join(root,'client/assets/world/napoli/vehicles/nuovi/manifest.json'),lic=path.join(root,'client/assets/world/napoli/LICENZE.md');
 const extra=readFileSync(extraJs,'utf8');
 assert.match(extra,/"glb":"vespa-prova"/);assert.match(extra,/"base":"scooter"/);assert.match(extra,/"model":"scooter"/);
 const mf=JSON.parse(readFileSync(mfFile,'utf8'));
 assert.equal(mf.modelli.length,1);assert.equal(mf.modelli[0].length,TIPI.scooter.lunghezza);
 assert.ok(existsSync(path.join(root,'client/assets/world/napoli/vehicles/nuovi/vespa-prova.glb')));
 assert.match(readFileSync(lic,'utf8'),/vespa-prova\.glb.*CC BY 4\.0/);
 await esegui([file,...con(base,'900','1200'),'--yaw','3.1416'],{root,log:()=>{}});
 assert.equal(JSON.parse(readFileSync(mfFile,'utf8')).modelli.length,1);
 assert.equal((readFileSync(extraJs,'utf8').match(/"glb"/g)||[]).length,1);
 assert.match(readFileSync(extraJs,'utf8'),/"buy":1200/);
 assert.equal((readFileSync(lic,'utf8').match(/vespa-prova/g)||[]).length,1);
 await esegui(['--rimuovi','vespa-prova'],{root,log:()=>{}});
 assert.match(readFileSync(extraJs,'utf8'),/EXTRA_VEHICLES=\[\];/);
 assert.ok(!existsSync(path.join(root,'client/assets/world/napoli/vehicles/nuovi/vespa-prova.glb')));
 assert.doesNotMatch(readFileSync(lic,'utf8'),/vespa-prova/);
});

test('lo script rifiuta modelli e dati non sicuri',async t=>{
 const root=progettoFinto(),ok=path.join(root,'ok.glb'),ext=path.join(root,'ext.glb'),txt=path.join(root,'finto.glb');t.after(()=>rmSync(root,{recursive:true,force:true}));
 writeFileSync(ok,glb());writeFileSync(ext,glb({uri:'texture.bin'}));writeFileSync(txt,'non sono un glb');
 const no=(args,re)=>assert.rejects(esegui(args,{root,log:()=>{}}),re);
 await no([txt,...base],/GLB valido/);
 await no([ext,...base],/file esterni/);
 await no([ok,...con(base,'CC BY 4.0','CC BY-NC 4.0')],/NC/);
 await no([ok,...con(base,'CC BY 4.0','Royalty free')],/licenza ammessa/);
 await no([ok,...con(base,'https://sketchfab.com/3d-models/prova','ftp://x')],/fonte/);
 await no([ok,...con(base,'vespa-prova','Vespa Prova!')],/--id/);
 await no([ok,...con(base,'scooter','razzo')],/--tipo/);
 await no([ok,...con(base,'900','5')],/--prezzo/);
 assert.equal(JSON.parse(readFileSync(path.join(root,'client/assets/world/napoli/vehicles/nuovi/manifest.json'),'utf8')).modelli.length,0);
});

test('il gioco usa il GLB con riserva e carica il manifest senza rompersi',()=>{
 const rv=readFileSync(path.join(ROOT,'client/world/realvehicles.js'),'utf8'),w3=readFileSync(path.join(ROOT,'client/world/world3d.js'),'utf8');
 assert.match(rv,/loadOnce\(w\)\.then\(\(\)=>loadExtraVehicles\(w\)\)/);
 assert.match(rv,/catch\(e\)\{console\.warn\('\[veicoli nuovi\] manifest/);
 assert.match(w3,/if\(V\?\.glb\)\{const rc=realCopy\(this,V\.glb\);if\(rc\)return rc;\}if\(V\?\.model\)/);
});
