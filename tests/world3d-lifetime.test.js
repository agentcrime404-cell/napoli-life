import test from 'node:test';
import assert from 'node:assert/strict';
import {register} from 'node:module';
import * as THREE from '../client/vendor/three/three.module.min.js';

// Il client importa i moduli comuni con indirizzi del sito ("/shared/world.js"): in Node si fanno puntare alla cartella shared/ del progetto.
const ROOT=new URL('../',import.meta.url).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){return n(s.startsWith('/shared/')?${JSON.stringify(ROOT)}+s.slice(1):s,c);}`));
const {World3D}=await import('../client/world/world3d.js');

// Metodi veri del mondo 3D su un oggetto ridotto: solo i campi che servono (niente WebGL, niente pagina).
function watch(resource){let count=0;resource.addEventListener('dispose',()=>count++);return ()=>count;}
const tick=()=>new Promise(r=>setImmediate(r));
async function settle(){for(let i=0;i<6;i++)await tick();}
function quiet(t){t.mock.method(console,'warn',()=>{});t.mock.method(console,'info',()=>{});return t.mock.method(console,'error',()=>{});}
function world(fields={}){
 const w=Object.create(World3D.prototype),scene=new THREE.Scene(),dynamic=new THREE.Group();scene.add(dynamic);
 return Object.assign(w,{scene,dynamic,static:new THREE.Group(),camera:new THREE.PerspectiveCamera(),players:new Map(),glow:new Set(),poolM:[],realMats:new Map(),toonMats:new Map(),toonify(){},lev:()=>0},fields);
}
function prepWorld(compileAsync){const programs=[],w=world();w.gl={info:{programs},compileAsync:(...a)=>compileAsync(w,...a),getContext:()=>({isContextLost:()=>false})};return w;}
function program(name,{runnable=true}={}){return {name,checked:0,isReady:()=>true,getUniforms(){this.checked++;if(!runnable)this.diagnostics={runnable:false,programLog:'',vertexShader:{log:''},fragmentShader:{log:'ERROR: '+name}};return {};}};}

test('Facade detail split by architectural bays preserves the exact geometry attributes',()=>{
 const keys=['pl','bg','gl','sh','ir','dr','fl','ao'],make=()=>Object.fromEntries(keys.map(key=>[key,{p:[],u:[],c:[]} ]));
 const w=world({groundY:0}),full=make(),sliced=make(),a=[0,0],b=[12,0],wall=[.78,.7,.62],floors=5,seed=137;
 w.facadeDetail(full,a,b,0,1,floors,seed,wall,{noShops:true});
 const bays=Math.max(1,Math.round(12/3.1));
 for(let bay=0;bay<bays;bay++)w.facadeDetail(sliced,a,b,0,1,floors,seed,wall,{noShops:true,_bayStart:bay,_bayEnd:bay+1});
 assert.deepEqual(sliced,full);
});

// Schermata di caricamento: bastano gli elementi che usa loadingStatus.
function fakeDocument(t){
 const el=tag=>({tagName:tag,children:[],hidden:false,textContent:'',dataset:{},attrs:{},type:'',onclick:null,setAttribute(k,v){this.attrs[k]=String(v);},getAttribute(k){return this.attrs[k]??null;},append(...c){this.children.push(...c);}});
 globalThis.document={createElement:el,body:el('body')};t.after(()=>{delete globalThis.document;});
}
function notices(t){const list=[];globalThis.dispatchEvent=e=>{list.push(e.detail);return true;};t.after(()=>{delete globalThis.dispatchEvent;});return list;}

test('Zone graphics slower than the limit keep waiting, say so with Riprova and resume by themselves',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});quiet(t);fakeDocument(t);
 let finish;const w=prepWorld(()=>new Promise(ok=>{finish=ok;})),z={room:'lungomare'};w.cur=z;
 const done=w.zonePrep(z);assert.equal(z.loading,true);assert.equal(z.stage,'grafica');assert.equal(w.preparing,1);
 t.mock.timers.tick(9999);assert.equal(z.slow,false);t.mock.timers.tick(1);
 assert.equal(z.slow,true);assert.equal(z.error,null);assert.equal(z.loading,true);assert.equal(w.preparing,1,'ancora niente disegno');
 w.loadingStatus(z);const [text,info,button]=w.loadingUI.children;
 assert.equal(text.textContent,'La preparazione della grafica richiede più tempo del solito…');assert.equal(info.hidden,false);assert.equal(button.hidden,false);assert.equal(button.textContent,'Riprova');assert.equal(w.loadingUI.dataset.state,'loading');
 finish();await done;
 assert.equal(z.loading,false);assert.equal(z.slow,false);assert.equal(z.error,null);assert.equal(w.preparing,0);
 w.loadingStatus(null);assert.equal(w.loadingUI.hidden,true);
});

test('Riprova replaces a compileAsync that never finishes and the zone completes',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});quiet(t);fakeDocument(t);
 let calls=0;const w=prepWorld(()=>++calls===1?new Promise(()=>{}):Promise.resolve()),z={room:'lungomare'};w.cur=z;
 w.zonePrep(z);t.mock.timers.tick(10000);assert.equal(z.slow,true);
 w.retryZone();assert.equal(calls,2);await settle();
 assert.equal(z.loading,false);assert.equal(z.slow,false);assert.equal(z.error,null);assert.equal(w.preparing,0);assert.equal(w.prepJobs.size,0);
 t.mock.timers.tick(20000);assert.equal(z.slow,false,'il tentativo abbandonato non torna a segnalare');
 w.retryZone();assert.equal(calls,2,'senza errore né attesa Riprova non fa niente');
});

test('A real graphics error keeps Riprova without reloading; a failed build still asks to reload',async t=>{
 quiet(t);fakeDocument(t);
 let calls=0;const w=prepWorld(()=>++calls===1?Promise.reject(new Error('compileAsync rotto')):Promise.resolve()),z={room:'lungomare'};w.cur=z;
 await w.zonePrep(z);assert.match(z.error?.message||'',/compileAsync rotto/);assert.equal(z.loading,false);
 w.loadingStatus(z);assert.equal(w.loadingUI.children[2].textContent,'Riprova');assert.equal(w.loadingUI.dataset.state,'error');
 w.retryZone();await settle();assert.equal(z.error,null);assert.equal(z.loading,false);
 assert.equal(w.retryReloads({stage:'costruzione'}),true);assert.equal(w.retryReloads({stage:'grafica'}),false);
});

test('Shaders that do not link are a non-blocking warning about the new programs only',async t=>{
 const errors=quiet(t),said=notices(t);
 const old=program('vecchio rotto',{runnable:false}),fresh=program('nuovo rotto',{runnable:false}),fine=program('MeshLambertMaterial');
 const w=prepWorld(w=>{w.gl.info.programs.push(fresh,fine);return Promise.resolve();});w.gl.info.programs.push(old);
 const z={room:'lungomare'};await w.zonePrep(z);
 assert.equal(z.error,null);assert.equal(z.loading,false);assert.equal(w.preparing,0);
 assert.equal(old.checked,0,'i programmi di prima non si guardano');assert.equal(fresh.checked,1);
 assert.equal(said.length,1);assert.match(said[0],/uno shader non compilato/);
 const logged=errors.mock.calls.map(c=>c.arguments);assert.ok(logged.some(a=>/nuovo rotto/.test(a[0])&&a[1]?.[0]?.fragmentLog==='ERROR: nuovo rotto'));
 await w.zonePrep(z);assert.equal(said.length,1,'segnalato una volta sola');assert.equal(fresh.checked,1);
});

test('A newer preparation that succeeds also completes the older ones still waiting and checks their programs',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});quiet(t);const said=notices(t),broken=program('rotto durante la prima',{runnable:false});
 let calls=0;const w=prepWorld(w=>{if(++calls===1){w.gl.info.programs.push(broken);return new Promise(()=>{});}return Promise.resolve();});
 const first=w.prepareShaders('prima'),second=w.prepareShaders('seconda');assert.equal(w.preparing,2);
 assert.equal(await second,'ok');assert.equal(await first,'superseded');assert.equal(w.preparing,0);
 assert.equal(broken.checked,1);assert.equal(said.length,1);
});

test('Graphics released during a shader preparation are disposed only when it ends',async t=>{
 quiet(t);let finish;const w=prepWorld(()=>new Promise(ok=>{finish=ok;}));
 const root=new THREE.Group(),mesh=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshBasicMaterial());root.add(mesh);
 const geo=watch(mesh.geometry),mat=watch(mesh.material),done=w.prepareShaders('prova');
 assert.equal(w.releaseGraphics(root),null);assert.equal(root.userData.dead,true);assert.equal(geo(),0);assert.equal(mat(),0);
 finish();await done;assert.equal(geo(),1);assert.equal(mat(),1);assert.deepEqual(w.releaseLater,[]);
});

test('A parked car is removed and released when its time ends, when replaced, when the player gets back in and when the player leaves',t=>{
 t.mock.timers.enable({apis:['setTimeout','Date'],now:5_000_000});
 const sharedGeo=new THREE.BoxGeometry(),sharedMat=new THREE.MeshStandardMaterial(),w=world({carP:{sedan:{body:sharedGeo}},paints:new Map([['red',sharedMat]])});
 const doors=[];w.ride=()=>{const g=new THREE.Group(),door=new THREE.Mesh(new THREE.BoxGeometry(),sharedMat);g.add(new THREE.Mesh(sharedGeo,sharedMat),door);g.userData.door=door;doors.push(watch(door.geometry));return g;};
 const shared=[watch(sharedGeo),watch(sharedMat)],e={root:new THREE.Group()};w.dynamic.add(e.root);w.players.set('p1',e);
 const spot=()=>({t:Date.now(),v:'auto',x:3,y:4,h:0});
 w.park(spot(),e,false);const first=e.parkedObj;assert.equal(first.parent,w.dynamic);
 w.park(spot(),e,false);const second=e.parkedObj;assert.equal(first.parent,null);assert.equal(doors[0](),1,'auto sostituita liberata');
 t.mock.timers.tick(60000);assert.equal(second.parent,null);assert.equal(e.parkedObj,null);assert.equal(doors[1](),1,'tempo scaduto: liberata');
 w.park(spot(),e,true);const third=e.parkedObj;w.unpark(e);assert.equal(third.parent,null);assert.equal(doors[2](),1,'risalita in auto: liberata');
 t.mock.timers.tick(5000);assert.equal(doors[2](),1,'niente doppia liberazione');
 w.park(spot(),e,false);const fourth=e.parkedObj;w.dropAvatar('p1',e);assert.equal(fourth.parent,null);assert.equal(doors[3](),1,'giocatore uscito: liberata');assert.ok(!w.players.has('p1'));
 t.mock.timers.tick(60000);assert.equal(doors[3](),1);
 assert.deepEqual(shared.map(c=>c()),[0,0],'risorse condivise intatte');
});

test('Changing avatar kind stops and releases the old passers-by, keeping shared resources',t=>{
 const w=world();w.cityG=new THREE.Group();w.scene.add(w.cityG);const shared=w.avatarMat=new THREE.MeshStandardMaterial();
 const person=new THREE.Group(),ownGeo=new THREE.BoxGeometry(),ownMat=new THREE.MeshStandardMaterial();person.add(new THREE.Mesh(ownGeo,ownMat),new THREE.Mesh(new THREE.BoxGeometry(),shared));
 const holder=new THREE.Group();holder.add(person);const mixer=new THREE.AnimationMixer(person),walk=mixer.clipAction(new THREE.AnimationClip('Walk',1,[new THREE.NumberKeyframeTrack('.position[x]',[0,1],[0,1])]));walk.play();mixer.update(.1);
 const face=new THREE.CanvasTexture({width:4,height:4}),sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:face}));
 w.npcs=[{av:{root:holder},mix:mixer},{av:{root:sprite},fg:{sprite,tex:face}}];w.cityG.add(holder,sprite);const npcs=w.npcs;
 const freed=[ownGeo,ownMat,sprite.material,face].map(watch),kept=[shared,sprite.geometry].map(watch);
 assert.equal(mixer.stats.actions.inUse,1);
 w.setAvatarKind('q3d');
 assert.equal(w.npcs,null);assert.equal(holder.parent,null);assert.equal(sprite.parent,null);assert.ok(npcs.every(n=>n.dead));
 assert.equal(walk.isRunning(),false);assert.equal(mixer.stats.actions.total,0,'azioni tolte dalla cache del mixer');
 assert.deepEqual(freed.map(c=>c()),[1,1,1,1]);assert.deepEqual(kept.map(c=>c()),[0,0],'materiale comune e geometria unica degli Sprite restano');
});
