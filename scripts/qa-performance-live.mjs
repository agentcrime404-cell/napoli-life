import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {setNapoli,napoliSpawn,napoliParkedVehicles,napoliStand} from '../shared/napoli.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.env.QA_OUTPUT||join(root,'artifacts','qa-performance-live'));
const mobileViewport=(()=>{
 const value=process.env.QA_VIEWPORT||'844x390',match=/^(\d{3,4})x(\d{3,4})$/.exec(value);
 if(!match)throw new Error('QA_VIEWPORT deve essere nel formato larghezzaxaltezza, per esempio 915x412.');
 const width=Number(match[1]),height=Number(match[2]);
 if(width<height||width<800||height<350)throw new Error('L’audit live richiede una viewport landscape mobile supportata.');
 return {width,height};
})();
const VEHICLE_APPROACH_DISTANCE=2.35;
const measurementWarmupMs=Math.max(0,Number(process.env.QA_WARMUP_MS??3500));
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const metricMap=response=>Object.fromEntries((response?.metrics||[]).map(item=>[item.name,item.value]));
const mb=bytes=>Number.isFinite(bytes)?Math.round(bytes/104857.6)/10:null;

function playwright(){try{return createRequire(import.meta.url)('playwright');}catch(error){throw new Error('Playwright non disponibile: '+error.message);}}

function summarizeProfile(profile){
 if(!profile?.nodes?.length||!profile.samples?.length)return null;
 const byId=new Map(profile.nodes.map(node=>[node.id,node])),parents=new Map();
 for(const node of profile.nodes)for(const child of node.children||[])parents.set(child,node.id);
 const totals=new Map(),inclusive=new Map(),stacks=new Map();let totalUs=0;
 for(let i=0;i<profile.samples.length;i++){
  const node=byId.get(profile.samples[i]);if(!node)continue;const frame=node.callFrame;
  const us=profile.timeDeltas?.[i]||profile.sampleInterval||1000;totalUs+=us;
  const key=[frame.functionName||'(anonima)',frame.url||'built-in',frame.lineNumber??''].join(' · ');
  totals.set(key,(totals.get(key)||0)+us);
  const chain=[];let current=node,depth=0;
  while(current&&depth++<32){const f=current.callFrame;const label=[f.functionName||'(anonima)',f.url||'built-in',f.lineNumber??''].join(' · ');inclusive.set(label,(inclusive.get(label)||0)+us);chain.push(label);current=byId.get(parents.get(current.id));}
  const stack=chain.reverse().slice(-10).join(' → ');stacks.set(stack,(stacks.get(stack)||0)+us);
 }
 const rows=map=>[...map].sort((a,b)=>b[1]-a[1]).slice(0,12).map(([frame,us])=>({frame,cpuMs:Math.round(us/1000),share:Math.round(us/totalUs*100)}));
 return {sampledCpuMs:Math.round(totalUs/1000),topFunctions:rows(totals),topInclusiveFunctions:rows(inclusive),topStacks:rows(stacks)};
}
function frameStats(values=[]){if(!values.length)return{count:0,averageMs:null,p95Ms:null,p99Ms:null,maxMs:null,minimumFps:null};const sorted=[...values].sort((a,b)=>a-b),sum=values.reduce((a,b)=>a+b,0),at=p=>Math.round(sorted[Math.min(sorted.length-1,Math.ceil(sorted.length*p)-1)]*10)/10;return{count:values.length,averageMs:Math.round(sum/values.length*10)/10,p95Ms:at(.95),p99Ms:at(.99),maxMs:Math.round(Math.max(...values)*10)/10,minimumFps:Math.round(100000/Math.max(...values))/100};}
function renderWindow(before,after){const count=Math.max(0,(after?.renderProbe?.count||0)-(before?.renderProbe?.count||0)),intervals=count?(after?.renderProbe?.intervals?.slice(-count)||[]):[],submit=count?(after?.renderProbe?.submitMs?.slice(-count)||[]):[],known=new Set((before?.renderProbe?.stalls||[]).map(item=>item.at));return{count,frameInterval:frameStats(intervals),cpuSubmit:frameStats(submit),stalls:(after?.renderProbe?.stalls||[]).filter(item=>!known.has(item.at))};}

async function readSnapshot(page,dashboard=false){
 try{return await page.evaluate(isDashboard=>{
  const frame=isDashboard?document.querySelector('#game-frame'):null;
  const win=frame?.contentWindow||window,qa=win.__NAPOLI_QA__;
  const snapshot=qa?.snapshot?.();if(!snapshot)return null;
  const render=win.__w3?.gl?.info?.render;
  snapshot.webgl=render?{frame:render.frame,calls:render.calls,triangles:render.triangles,points:render.points,lines:render.lines}:null;
  snapshot.renderingDiagnostics=win.__w3?{renderP95Ms:Number.isFinite(win.__w3.renderP95Ms)?Math.round(win.__w3.renderP95Ms*10)/10:null,renderSamples:win.__w3.renderSampleCount||0,lastRenderMs:Number.isFinite(win.__w3.lastRenderMs)?Math.round(win.__w3.lastRenderMs*10)/10:null,scale:Number.isFinite(win.__w3.scale)?Math.round(win.__w3.scale*100)/100:null,pixelRatio:win.__w3.gl?.getPixelRatio?.()??null,adaptive:!!win.__w3.adaptiveGraphics,mobile:!!win.__w3.mobile,gfx:win.__w3.gfx,fps:win.__w3.fps??null,fpsWindow:win.__w3.fpsT??null,visibility:win.__w3.visibility?{entries:win.__w3.visibility.entries.length,candidates:win.__w3.visibility.lastCandidateCount,visible:win.__w3.visibility.visibleEntries.size,range:win.__w3.visibility.range}:null,textureWarmup:win.__w3.cur?.textureWarmup||null,parkedVehicleWarmup:win.__w3.cur?.parkedVehicleWarmup||null,characterWarmup:win.__w3.cur?.characterWarmup||null}:null;
  snapshot.renderProbe=win.__QA_RENDER_METRICS?{count:win.__QA_RENDER_METRICS.count,intervals:win.__QA_RENDER_METRICS.intervals.slice(-2400),submitMs:win.__QA_RENDER_METRICS.submitMs.slice(-2400),gaps:win.__QA_RENDER_METRICS.gaps.slice(-40),stalls:win.__QA_RENDER_METRICS.stalls.slice(-20)}:null;
  snapshot.raycastProbe=win.__QA_RAY_METRICS?{count:win.__QA_RAY_METRICS.count,durationMs:win.__QA_RAY_METRICS.durationMs.slice(-240)}:null;
  return snapshot;
 },dashboard,{timeout:8000});}catch(error){return {readError:String(error?.message||error)};}
}

async function performanceMetrics(cdp){
 try{
  const values=metricMap(await cdp.send('Performance.getMetrics'));
  const dom=await cdp.send('Memory.getDOMCounters').catch(()=>null);
  return {heapMb:mb(values.JSHeapUsedSize),heapTotalMb:mb(values.JSHeapTotalSize),
   mainThreadTaskMs:Number.isFinite(values.TaskDuration)?Math.round(values.TaskDuration*1000):null,
   scriptMs:Number.isFinite(values.ScriptDuration)?Math.round(values.ScriptDuration*1000):null,
   layoutMs:Number.isFinite(values.LayoutDuration)?Math.round(values.LayoutDuration*1000):null,
   styleMs:Number.isFinite(values.RecalcStyleDuration)?Math.round(values.RecalcStyleDuration*1000):null,
   domNodes:dom?.nodes??values.Nodes??null,documents:dom?.documents??values.Documents??null,
   eventListeners:dom?.jsEventListeners??values.JSEventListeners??null};
 }catch(error){return {readError:String(error?.message||error)};}
}

async function installFrameBreakdown(page,dashboard){
 return page.evaluate(isDashboard=>{
  const frame=isDashboard?document.querySelector('#game-frame'):null,win=frame?.contentWindow||window,w=win.__w3;
  if(!w||win.__NAPOLI_FRAME_BREAKDOWN__)return false;
  const data=Object.create(null),capacity=3600,spikes=[];let activeFrame=null;
  const record=(name,elapsed)=>{if(activeFrame)activeFrame[name]=Math.round(elapsed*10)/10;let r=data[name];if(!r)r=data[name]={values:new Float32Array(capacity),count:0,write:0,total:0,max:0,over16:0,over33:0};r.values[r.write]=elapsed;r.write=(r.write+1)%capacity;r.count=Math.min(capacity,r.count+1);r.total+=elapsed;if(elapsed>r.max)r.max=elapsed;if(elapsed>16.67)r.over16++;if(elapsed>33.33)r.over33++;};
  const wrap=(target,key,name)=>{const original=target?.[key];if(typeof original!=='function')return false;target[key]=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{record(name,performance.now()-start);}};return true;};
  const methods=['draw','city','daylight','animRides','animFx','updateLife','updateStreetVehicles','lod','facadeDetail','groundTiles','updateLights','magic','present','vehicle','ride','guard','carGuard'];
  for(const name of methods)wrap(w,name,'world.'+name);
  wrap(w.gl,'render','renderer.render');
  const nativeRaf=win.requestAnimationFrame.bind(win);
  win.requestAnimationFrame=callback=>callback?.name==='frame'?nativeRaf(now=>{const start=performance.now(),frame={};activeFrame=frame;try{return callback(now);}finally{activeFrame=null;const elapsed=performance.now()-start;record('app.frame',elapsed);if(elapsed>33.33){spikes.push({durationMs:Math.round(elapsed*10)/10,methods:frame});if(spikes.length>80)spikes.shift();}}}):nativeRaf(callback);
  win.__NAPOLI_FRAME_BREAKDOWN__={reset(){spikes.length=0;for(const r of Object.values(data)){r.count=0;r.write=0;r.total=0;r.max=0;r.over16=0;r.over33=0;}},snapshot(){const out={};for(const [name,r] of Object.entries(data)){const values=Array.from(r.values.subarray(0,r.write));if(r.count===capacity)values.push(...r.values.subarray(r.write));values.sort((a,b)=>a-b);const at=p=>values.length?Math.round(values[Math.min(values.length-1,Math.ceil(values.length*p)-1)]*10)/10:null;out[name]={count:r.count,averageMs:r.count?Math.round(r.total/r.count*10)/10:null,p95Ms:at(.95),p99Ms:at(.99),maxMs:Math.round(r.max*10)/10,over16ms:r.over16,over33ms:r.over33};}return{methods:out,frameSpikes:spikes.slice()};}};
  return true;
 },dashboard).catch(()=>false);
}

async function cityReady(page,dashboard){
 const frame=dashboard?page.frameLocator('#game-frame'):page;
 const pgGo=frame.locator('#pg-go');
 try{await pgGo.waitFor({state:'visible',timeout:90000});}
 catch{
  const guest=frame.locator('#guest');
  if(await guest.count()){
   await guest.click({timeout:15000});
   await frame.locator('#modal-body button').first().click({timeout:15000});
   await pgGo.waitFor({state:'visible',timeout:90000});
  }else throw new Error('Né login ospite né menu di ingresso risultano disponibili.');
 }
 if(await pgGo.count())await pgGo.click({timeout:15000});
 const began=Date.now();
 try{
  await page.waitForFunction(isDashboard=>{
   try{
    const doc=isDashboard?document.querySelector('#game-frame')?.contentDocument:document;
    const win=isDashboard?document.querySelector('#game-frame')?.contentWindow:window;
    const s=win?.__NAPOLI_QA__?.snapshot?.();
    const qaReady=!!(s?.state?.player&&s?.state?.world?.loaded);
    const sceneReady=!!doc?.querySelector('#hud')&&!doc.querySelector('#hud').hidden&&
     !doc.querySelector('#pregame')&&doc.querySelector('#scene-loading')?.hidden===true;
    return qaReady||sceneReady;
   }catch{return false;}
  },dashboard,{timeout:120000,polling:1000});
  const frame=dashboard?page.frameLocator('#game-frame'):page;
  const diag=await frame.locator('#scene-loading').evaluate(el=>({hidden:el.hidden,text:el.innerText})).catch(()=>null);
  const qa=await readSnapshot(page,dashboard);
  return {ready:true,loadMs:Date.now()-began,telemetry:!!qa?.state,sceneLoading:diag};
 }catch(error){
  const frame=dashboard?page.frameLocator('#game-frame'):page;
  const diag=await frame.locator('#scene-loading').evaluate(el=>({hidden:el.hidden,text:el.innerText})).catch(()=>null);
  const shot=join(out,'caricamento-non-pronto.png');
  await page.screenshot({path:shot,fullPage:dashboard,timeout:15000}).catch(()=>{});
  return {ready:false,loadMs:Date.now()-began,last:String(error?.message||error),sceneLoading:diag,screenshot:shot};
 }
}

function routeToVehicle(start,vehicle){
 const spacing=.75,dirs=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]],key=(x,y)=>x+','+y;
 const first={x:0,y:0,position:{x:start.x,y:start.y},previous:null},queue=[first],seen=new Map([[key(0,0),first]]);
 const maxX=Math.ceil(Math.abs(vehicle.x-start.x)/spacing)+18,maxY=Math.ceil(Math.abs(vehicle.y-start.y)/spacing)+18;let goal=null;
 for(let at=0;at<queue.length&&at<14000;at++){
  const node=queue[at],distance=Math.hypot(node.position.x-vehicle.x,node.position.y-vehicle.y);
  if(distance<=2.35&&napoliStand(node.position.x,node.position.y,.35)){goal=node;break;}
  for(const [dx,dy] of dirs){const x=node.x+dx,y=node.y+dy,k=key(x,y);if(seen.has(k)||Math.abs(x)>maxX||Math.abs(y)>maxY)continue;
   const position={x:start.x+x*spacing,y:start.y+y*spacing};if(!napoliStand(position.x,position.y,.35))continue;
   if(dx&&dy&&(!napoliStand(node.position.x+dx*spacing,node.position.y,.35)||!napoliStand(node.position.x,node.position.y+dy*spacing,.35)))continue;
   const next={x,y,position,previous:node};seen.set(k,next);queue.push(next);
  }
 }
 if(!goal)return null;const path=[];for(let node=goal;node;node=node.previous)path.push(node.position);return path.reverse();
}

function walkKeysToward(dx,dy,yaw){
 const length=Math.hypot(dx,dy)||1,x=dx/length,y=dy/length,candidates=[['w'],['a'],['s'],['d'],['w','a'],['w','d'],['s','a'],['s','d']];let best=null,bestDot=-Infinity;
 for(const keys of candidates){const has=k=>keys.includes(k),inputX=(has('d')?1:0)-(has('a')?1:0),inputY=(has('s')?1:0)-(has('w')?1:0),sx=(inputX-inputY)/Math.SQRT2,sy=(inputX+inputY)/Math.SQRT2,c=Math.cos(yaw),s=Math.sin(yaw),vx=c*sx+s*sy,vy=-s*sx+c*sy,dot=(vx*x+vy*y)/(Math.hypot(vx,vy)||1);if(dot>bestDot){bestDot=dot;best=keys;}}
 return best||['w'];
}

async function walkToVehicle(session,vehicle,{maxAttempts=4,attemptLimitMs=9000}={}){
 const {page}=session,initial=await readSnapshot(page),start=initial?.state?.player;if(!start)return{moved:false,reason:'posizione iniziale assente'};
 let end=start,remaining=Math.hypot(vehicle.x-start.x,vehicle.y-start.y),attempts=0,stalled=false;const trace=[{x:start.x,y:start.y,distance:remaining}];
 while(remaining>=VEHICLE_APPROACH_DISTANCE&&attempts<maxAttempts){
  const accepted=await page.evaluate(target=>window.__NAPOLI_QA__?.walkTo?.(target.x,target.y)===true,{x:vehicle.x,y:vehicle.y});
  if(!accepted)return{moved:attempts>0,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},target:{x:vehicle.x,y:vehicle.y},remaining:Math.round(remaining*100)/100,attempts,stalled,reason:'il pathfinder reale ha rifiutato la destinazione'};
  attempts++;let best=remaining,lastProgress=Date.now();const attemptStarted=lastProgress;
  while(Date.now()-lastProgress<2200&&Date.now()-attemptStarted<attemptLimitMs){
   await sleep(300);const current=await readSnapshot(page),player=current?.state?.player;if(!player)break;
   end=player;remaining=Math.hypot(vehicle.x-end.x,vehicle.y-end.y);trace.push({x:end.x,y:end.y,distance:Math.round(remaining*100)/100,at:Date.now()});
   if(remaining<best-.2){best=remaining;lastProgress=Date.now();}
   if(remaining<VEHICLE_APPROACH_DISTANCE)break;
  }
  stalled=remaining>=VEHICLE_APPROACH_DISTANCE;
  if(!stalled)break;
 }
 return{moved:Math.hypot(end.x-start.x,end.y-start.y)>.75,start:{x:start.x,y:start.y},end:{x:end.x,y:end.y},target:{x:vehicle.x,y:vehicle.y,distance:Math.hypot(vehicle.x-start.x,vehicle.y-start.y)},remaining:Math.round(remaining*100)/100,attempts,stalled,trace};
}

async function createGuest(context,baseURL){
 const response=await context.request.post(new URL('/api/auth/guest',baseURL).href,{data:{look:0},timeout:15000});
 if(!response.ok())throw new Error('Creazione profilo temporaneo fallita: HTTP '+response.status());
 return response.json();
}

export async function run({baseURL,executablePath=process.env.PLAYWRIGHT_CHROMIUM_PATH||null,
 outputDir=out,walkMs=6000,sampleMs=10000,profileOnly=false,fpsLimit=0}={}){
 if(!baseURL)throw new Error('Passa --base-url=http://127.0.0.1:PORT al server locale di test.');
 await mkdir(outputDir,{recursive:true});
 const pw=playwright(),launch={headless:true,args:['--no-sandbox','--enable-precise-memory-info']};
 if(executablePath)launch.executablePath=executablePath;
 const browser=await pw.chromium.launch(launch),guestContext=await browser.newContext({serviceWorkers:'block'});
 const summary={name:'Napoli Life · audit prestazioni live',mode:'live-game',baseURL,
  startedAt:new Date().toISOString(),device:{viewport:mobileViewport,isMobile:true,hasTouch:true,
   benchmarkHost:'Desktop browser with emulated mobile viewport and touch; not a physical-phone measurement',cpuThrottlingRate:Number(process.env.QA_CPU_THROTTLE)||1},
  requestedFpsLimit:fpsLimit||'default (30 on coarse-pointer mobile; 60 on desktop)',
  capture:{screenshots:true,video:false,reason:'Video encoding is disabled during FPS sampling to avoid distorting frame-time results.'},
  scenarios:[],runtimeProfiles:[],renderInventories:[],errors:{console:[],page:[],requests:[],http:[],canceledRequests:[]},limits:[],screenshots:[],
  cpuMetricNote:'CDP TaskDuration/ScriptDuration misura tempo di lavoro del renderer, non l’uso percentuale dell’intera CPU; il rapporto può superare 100% se include contesti/worker paralleli.',
  gpuMetricNote:'Chrome espone adattatore e driver, ma non l’utilizzo GPU né la VRAM su questo sistema.',
  webglFrameMetricNote:'WebGLRenderer.info.render.frame conta le chiamate di rendering; sui profili mobile usati qui è un passaggio per frame, mentre il profilo ultra può eseguire più passaggi.'};
 let guest;
 try{guest=await createGuest(guestContext,baseURL);summary.qaUser=guest.user?.username||'ospite temporaneo';}
 catch(error){summary.fatalError='Creazione profilo di test: '+String(error?.stack||error);summary.scenarios.push({name:'creazione profilo temporaneo',pass:false,error:String(error?.message||error)});}
 finally{await guestContext.close().catch(()=>{});}
 if(!guest){summary.finishedAt=new Date().toISOString();await writeFile(join(outputDir,'report.json'),JSON.stringify(summary,null,2));await browser.close().catch(()=>{});return summary;}
 const mapData=JSON.parse(await readFile(join(root,'client','assets','world','napoli','map','mergellina.json'),'utf8'));
 setNapoli(mapData);
 const spawnInfo=napoliSpawn();
 const nearestVehicles=napoliParkedVehicles().map(vehicle=>({...vehicle,distance:Math.hypot(vehicle.x-spawnInfo.x,vehicle.y-spawnInfo.y)})).sort((a,b)=>a.distance-b.distance);
 const vehicleMode=process.env.QA_VEHICLE||process.argv.find(value=>value.startsWith('--vehicle='))?.slice('--vehicle='.length)||'bike';
 summary.nearbyVehicleAudit={spawn:spawnInfo,count:nearestVehicles.length,
  motorcycles:nearestVehicles.filter(vehicle=>vehicle.v!=='auto').slice(0,5),
  cars:nearestVehicles.filter(vehicle=>vehicle.v==='auto').slice(0,5)};
 let gpuInfo=null;try{const browserCDP=await browser.newBrowserCDPSession();await browserCDP.send('SystemInfo.getInfo').then(data=>{gpuInfo={modelName:data.gpu?.auxAttributes?.glRenderer||data.gpu?.devices?.[0]?.deviceString||null,vendor:data.gpu?.auxAttributes?.glVendor||null,driver:data.gpu?.auxAttributes?.glVersion||null};});await browserCDP.detach();}catch(error){summary.limits.push('Informazioni GPU non disponibili via CDP: '+String(error?.message||error));}
 summary.gpuInfo=gpuInfo;

  async function openScenario(name,{dashboard=false,quality=null,keepOpen=false}={}){
  console.log('[QA] avvio scenario: '+name+(quality?' ('+quality+')':''));
  const context=await browser.newContext({viewport:mobileViewport,
   isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(({token,gfx,fps})=>{try{localStorage.setItem('humana-token',token);sessionStorage.setItem('humana-token',token);if(gfx)localStorage.setItem('humana-gfx',gfx);if(fps)localStorage.setItem('humana-fps-limit',String(fps));}catch{}},{token:guest.token,gfx:quality,fps:fpsLimit});
  const page=await context.newPage(),consoleErrors=[],pageErrors=[],requestFailures=[],requestCancellations=[],worldBuildMilestones=[];
  const httpErrors=[];
  page.on('console',message=>{const text=message.text();if(message.type()==='error')consoleErrors.push(text);else if(text.startsWith('[napoli]'))worldBuildMilestones.push({at:Math.round(performance.now()),text});});
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('requestfailed',request=>{const item={url:request.url(),error:request.failure()?.errorText||''};if(/ERR_ABORTED|NS_BINDING_ABORTED/.test(item.error))requestCancellations.push(item);else requestFailures.push(item);});
  page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');const cpuThrottle=Number(process.env.QA_CPU_THROTTLE)||1;if(cpuThrottle>1){await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpuThrottle}).catch(error=>summary.limits.push('Throttle CPU browser non disponibile: '+String(error?.message||error)));}
  let profileStarted=false;
  try{await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');profileStarted=true;}catch(error){summary.limits.push('Profiler JavaScript non disponibile: '+String(error?.message||error));}
  const url=dashboard?new URL('/debug-controls.html',baseURL):new URL('/?3d=1&qa=1',baseURL);
  const response=await page.goto(url.href,{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||response.status()>=400)throw new Error(name+' non aperto: HTTP '+(response?.status()||'nessuna risposta'));
  if(dashboard){
   await page.frameLocator('#game-frame').locator('#pg-go').waitFor({state:'visible',timeout:120000}).catch(async()=>{
    const frame=page.frameLocator('#game-frame'),guestButton=frame.locator('#guest');
    if(await guestButton.count()){await guestButton.click({timeout:15000});await frame.locator('#modal-body button').first().click({timeout:15000});await frame.locator('#pg-go').waitFor({state:'visible',timeout:90000});}
    else throw new Error('La partita nel dashboard non ha mostrato il menu d’ingresso.');
   });
  }
  const entry=await cityReady(page,dashboard);
  console.log('[QA] '+name+' ingresso '+JSON.stringify(entry));
  if(!entry.ready){summary.limits.push('Scena non pronta nello scenario '+name+' dopo '+Math.round(entry.loadMs/1000)+' s; schermata e stato del caricatore salvati.');}
  if(!dashboard&&!summary.renderInventories.length){const inventory=await page.evaluate(()=>{const w=window.__w3,roots=[['static',w?.cur?.g],['dynamic',w?.dynamic],['scene',w?.scene]],out=[],sourceMaterials=new Map();for(const [source,target] of w?.realMats||[]){let rows=sourceMaterials.get(target);if(!rows)sourceMaterials.set(target,rows=[]);if(rows.length<3)rows.push({type:source.type,merge:source.userData?.merge,hasMap:!!source.map,transparent:!!source.transparent,alphaTest:source.alphaTest||0,hasUvTransform:!!source.map?.matrixAutoUpdate,sourceMap:source.map?.image?.constructor?.name||null});}for(const [label,root] of roots){if(!root)continue;const materials=new Map(),branches=new Map();let meshes=0,visibleMeshes=0;root.traverse(o=>{if(!o.isMesh)return;meshes++;let shown=o.visible;for(let p=o.parent;shown&&p&&p!==root;p=p.parent)shown=p.visible;if(shown)visibleMeshes++;const list=Array.isArray(o.material)?o.material:[o.material];for(const m of list)if(m){const key=m.uuid,entry=materials.get(key)||{name:m.name||'(senza nome)',type:m.type,draws:0,visibleDraws:0,textured:!!m.map,merge:!!m.userData?.merge,samples:[],sourceMaterials:sourceMaterials.get(m)||[]};entry.draws++;if(shown)entry.visibleDraws++;if(entry.samples.length<3&&shown)entry.samples.push({object:o.name||o.type,geometry:o.geometry?.type,vertices:o.geometry?.attributes?.position?.count||0,groups:o.geometry?.groups?.length||0,uv:!!o.geometry?.attributes?.uv,transparent:!!m.transparent,alphaTest:m.alphaTest||0,side:m.side,map:m.map?.image?.src||m.map?.image?.constructor?.name||null,meshFlags:Object.keys(o.userData||{}),parent:o.parent?.type,renderOrder:o.renderOrder});materials.set(key,entry);}let branch=o;while(branch.parent&&branch.parent!==root)branch=branch.parent;const key=branch.name||branch.type||'(radice)';branches.set(key,(branches.get(key)||0)+1);});out.push({root:label,children:root.children.length,meshes,visibleMeshes,uniqueMaterials:materials.size,materials:[...materials.values()].filter(m=>m.visibleDraws).sort((a,b)=>b.visibleDraws-a.visibleDraws).slice(0,16),branches:[...branches].sort((a,b)=>b[1]-a[1]).slice(0,12)});}return{mobile:w?.mobile,mode:w?.toon?'toon':'realistic',adaptive:w?.adaptiveGraphics,scale:w?.scale,pixelRatio:w?.gl?.getPixelRatio(),roots:out};}).catch(error=>({error:String(error)}));summary.renderInventories.push({name,inventory});}
  const renderProbeInstalled=await page.evaluate(isDashboard=>{try{const frame=isDashboard?document.querySelector('#game-frame'):null,win=frame?.contentWindow||window,renderer=win.__w3?.gl;if(!renderer)return false;if(!renderer.__qaRenderProbe){const original=renderer.render,probe={last:null,count:0,intervals:[],submitMs:[],stalls:[],gaps:[]};renderer.__qaRenderProbe=true;win.__QA_RENDER_METRICS=probe;renderer.render=function(...args){const start=performance.now();if(probe.last!==null){const gap=start-probe.last;probe.intervals.push(gap);if(probe.intervals.length>2400)probe.intervals.shift();if(gap>50){probe.gaps.push({at:Math.round(start),durationMs:Math.round(gap*10)/10});if(probe.gaps.length>40)probe.gaps.shift();}}probe.last=start;probe.count++;try{return original.apply(this,args);}finally{const elapsed=performance.now()-start;probe.submitMs.push(elapsed);if(probe.submitMs.length>2400)probe.submitMs.shift();if(elapsed>50){const world=win.__w3,cam=world?.camera,ml=world?.mlife,cl=world?.life,local=world?._me&&world.players?.get(world._me.id);let localMeshes=0,localTextures=0;local?.body?.traverse?.(o=>{if(o.isMesh){localMeshes++;for(const m of [].concat(o.material||[]))if(m?.map)localTextures++;}});probe.stalls.push({at:Math.round(start),durationMs:Math.round(elapsed*10)/10,mode:world?.mode(world?._me)||null,yaw:Number.isFinite(world?.yaw)?Math.round(world.yaw*1000)/1000:null,camera:cam?{x:+cam.position.x.toFixed(1),y:+cam.position.y.toFixed(1),z:+cam.position.z.toFixed(1)}:null,player:world?._me?{x:+world._me.x.toFixed(1),y:+world._me.y.toFixed(1),velocity:+(world._me.vel||0).toFixed(1),vehicle:world._me.vehicle||null}:null,drawCalls:renderer.info?.render?.calls??null,programs:renderer.info?.programs?.length??null,gpuResources:{geometries:renderer.info?.memory?.geometries??null,textures:renderer.info?.memory?.textures??null},streetVehicles:world?.streetVehicleRefreshDiagnostics||null,dynamicChildren:world?.dynamic?.children?.length??null,localAvatar:local?{loaded:!!local.body,model:local.real?.name||null,fem:local.real?.fem??null,visible:local.body?.visible??null,meshes:localMeshes,texturedMeshes:localTextures}:null,life:{mergellina:ml?{active:ml.agents?.filter(a=>a.on).length??0,rigs:ml.rigs?.filter(r=>r.o).length??0,pending:ml.pending??0,visible:ml.agents?.filter(a=>a.rig?.o?.root.visible).length??0,models:ml.rigs?.filter(r=>r.o).map(r=>r.o.real?.name??(r.o.real?.fem?'real-female':'real-male')).slice(0,12)??[]}:null,lungomare:cl?{active:cl.agents?.filter(a=>a.on).length??0,rigs:cl.rigs?.filter(r=>r.o).length??0,pending:cl.pending??0}:null}});if(probe.stalls.length>20)probe.stalls.shift();}}};}const ray=win.__w3?.ray;if(ray&&!ray.__qaRayProbe){const original=ray.intersectObjects,probe={count:0,durationMs:[]};ray.__qaRayProbe=true;win.__QA_RAY_METRICS=probe;ray.intersectObjects=function(...args){const start=performance.now();try{return original.apply(this,args);}finally{probe.count++;probe.durationMs.push(performance.now()-start);if(probe.durationMs.length>240)probe.durationMs.shift();}};}return true;}catch{return false;}},dashboard).catch(()=>false);
  if(!renderProbeInstalled)summary.limits.push('Il probe dei tempi di presentazione Three.js non è disponibile nello scenario '+name+'.');
  if(process.env.QA_FRAME_TIMING==='1'&&!dashboard){const installed=await installFrameBreakdown(page,false);summary.frameTimingProbe=installed?'timings per frame su app, metodi world e renderer WebGL':'strumentazione frame non installata';if(!installed)summary.limits.push('La strumentazione dei metodi per frame non si è agganciata nello scenario '+name+'.');}
  // Isolate steady gameplay from scene construction, shader compilation and the
  // first asset uploads. Startup stalls remain visible in the telemetry.
  if(entry.ready&&measurementWarmupMs>0)await sleep(measurementWarmupMs);
  let profile=null;if(profileStarted){try{profile=summarizeProfile((await cdp.send('Profiler.stop')).profile);}catch(error){summary.limits.push('Profilo CPU non leggibile: '+String(error?.message||error));}profileStarted=false;}
  const screenshot=join(outputDir,name+'.png');
  try{await page.screenshot({path:screenshot,fullPage:dashboard,animations:'disabled',timeout:20000});summary.screenshots.push(screenshot);}catch(error){summary.limits.push('Screenshot '+name+': '+String(error?.message||error));}
  const initial=await readSnapshot(page,dashboard),metricStart=await performanceMetrics(cdp),start=Date.now();
  await sleep(sampleMs);
  const final=await readSnapshot(page,dashboard),metricEnd=await performanceMetrics(cdp),elapsed=(Date.now()-start)/1000;
  const taskPct=metricStart.mainThreadTaskMs!==null&&metricEnd.mainThreadTaskMs!==null?
   Math.round((metricEnd.mainThreadTaskMs-metricStart.mainThreadTaskMs)/(elapsed*1000)*100):null;
  const renderedFrames=initial?.webgl?.frame!==undefined&&final?.webgl?.frame!==undefined?final.webgl.frame-initial.webgl.frame:null,
   renderCount=Math.max(0,(final?.renderProbe?.count||0)-(initial?.renderProbe?.count||0)),renderIntervals=renderCount?(final?.renderProbe?.intervals?.slice(-renderCount)||[]):[],renderSubmit=renderCount?(final?.renderProbe?.submitMs?.slice(-renderCount)||[]):[];
  const result={name,dashboard,quality:quality||'predefinita',entry,measurementWarmupMs,
   viewport:{game:final?.viewport||initial?.viewport||null,browser:mobileViewport,
    dashboard:dashboard?await page.evaluate(()=>({width:innerWidth,height:innerHeight,heapMb:performance.memory?.usedJSHeapSize?Math.round(performance.memory.usedJSHeapSize/104857.6)/10:null})).catch(()=>null):null},
   start:{performance:initial?.performance||null,player:initial?.state?.player||null,camera:initial?.state?.camera||null,renderer:initial?.state?.renderer||null,renderingDiagnostics:initial?.renderingDiagnostics||null,world:initial?.state?.world||null,host:metricStart},
   end:{performance:final?.performance||null,player:final?.state?.player||null,camera:final?.state?.camera||null,renderer:final?.state?.renderer||null,renderingDiagnostics:final?.renderingDiagnostics||null,world:final?.state?.world||null,host:metricEnd},
   taskTimePerWallPct:taskPct,webgl:{start:initial?.webgl||null,end:final?.webgl||null,
   renderedFrames,renderedFps:renderedFrames===null?null:Math.round(renderedFrames/elapsed*10)/10,frameInterval:frameStats(renderIntervals),cpuSubmit:frameStats(renderSubmit)},
   profile,worldBuildMilestones,errors:{console:consoleErrors,page:pageErrors,requests:requestFailures,http:httpErrors,canceledRequests:requestCancellations}};
  if(!initial?.state)summary.limits.push('Telemetria renderer/gameplay non presente nello scenario '+name+'; FPS host e tempi CPU restano disponibili.');
  summary.scenarios.push(result);summary.errors.console.push(...consoleErrors);summary.errors.page.push(...pageErrors);summary.errors.requests.push(...requestFailures);summary.errors.http.push(...httpErrors);summary.errors.canceledRequests.push(...requestCancellations);
  console.log('[QA] completato scenario: '+name);
  if(!keepOpen)await context.close().catch(()=>{});
  return {context,page,cdp,dashboard,result,consoleErrors,pageErrors,requestFailures,requestCancellations};
 }

 async function scenarioSample(session,name,{duration=walkMs,startAction=null,duringAction=null,endAction=null,dashboard=session?.dashboard||false}={}){
  const {page,cdp}=session,metricStart=await performanceMetrics(cdp),before=await readSnapshot(page,dashboard),renderStart=await page.evaluate(()=>performance.now()).catch(()=>0),t0=Date.now();
  if(process.env.QA_FRAME_TIMING==='1')await page.evaluate(()=>window.__NAPOLI_FRAME_BREAKDOWN__?.reset()).catch(()=>{});
  let actionError=null,during=null;try{await startAction?.();}catch(error){actionError=String(error?.message||error);}
  await sleep(duration);try{during=await duringAction?.()??null;}catch(error){actionError=actionError||String(error?.message||error);}
  try{await endAction?.();}catch(error){actionError=String(error?.message||error);}
  const after=await readSnapshot(page,dashboard),methodTimings=process.env.QA_FRAME_TIMING==='1'?await page.evaluate(()=>window.__NAPOLI_FRAME_BREAKDOWN__?.snapshot()||null).catch(()=>null):null,metricEnd=await performanceMetrics(cdp),elapsed=(Date.now()-t0)/1000;
  const taskPct=metricStart.mainThreadTaskMs!==null&&metricEnd.mainThreadTaskMs!==null?
   Math.round((metricEnd.mainThreadTaskMs-metricStart.mainThreadTaskMs)/(elapsed*1000)*100):null;
  const renderedFrames=before?.webgl?.frame!==undefined&&after?.webgl?.frame!==undefined?after.webgl.frame-before.webgl.frame:null;
  const screenshot=join(outputDir,name+'.png');
  try{await page.screenshot({path:screenshot,fullPage:dashboard,animations:'disabled',timeout:20000});summary.screenshots.push(screenshot);}catch(error){summary.limits.push('Screenshot '+name+': '+String(error?.message||error));}
  const renderCount=Math.max(0,(after?.renderProbe?.count||0)-(before?.renderProbe?.count||0)),renderIntervals=renderCount?(after?.renderProbe?.intervals?.slice(-renderCount)||[]):[],renderSubmit=renderCount?(after?.renderProbe?.submitMs?.slice(-renderCount)||[]):[],rayCount=Math.max(0,(after?.raycastProbe?.count||0)-(before?.raycastProbe?.count||0)),rayDuration=rayCount?(after?.raycastProbe?.durationMs?.slice(-rayCount)||[]):[];
  const scenario={name,pass:!after?.readError,actionError,measurementDurationMs:Math.round(elapsed*1000),
   start:{performance:before?.performance||null,player:before?.state?.player||null,camera:before?.state?.camera||null,renderer:before?.state?.renderer||null,renderingDiagnostics:before?.renderingDiagnostics||null,host:metricStart},
   end:{performance:after?.performance||null,player:after?.state?.player||null,camera:after?.state?.camera||null,renderer:after?.state?.renderer||null,renderingDiagnostics:after?.renderingDiagnostics||null,host:metricEnd},
   input:{walk:after?.walkInput||null,vehicle:after?.vehicleInput||null,pointers:after?.input?.pointers||[]},during,
   taskTimePerWallPct:taskPct,methodTimings,webgl:{start:before?.webgl||null,end:after?.webgl||null,
    renderedFrames,renderedFps:renderedFrames===null?null:Math.round(renderedFrames/elapsed*10)/10,
    frameInterval:frameStats(renderIntervals),cpuSubmit:frameStats(renderSubmit)},
   cameraRaycast:{count:rayCount,duration:frameStats(rayDuration),renderStalls:after?.renderProbe?.stalls?.filter(item=>item.at>=renderStart)||[],longFrameGaps:after?.renderProbe?.gaps?.filter(item=>item.at>=renderStart)||[]},
   mainThreadLongTasks:(after?.performance?.longTasks||[]).filter(task=>task.start>=renderStart),mainThreadLongAnimationFrames:(after?.performance?.longAnimationFrames||[]).filter(task=>task.start>=renderStart),
   screenshot,errors:{console:session.consoleErrors,page:session.pageErrors}};
  summary.scenarios.push(scenario);return scenario;
 }

 async function runtimeProfile(session,name,{duration=5000,startAction=null,endAction=null}={}){
  const {cdp,page,dashboard}=session;let started=false;
  const before=await readSnapshot(page,dashboard),hostStart=await performanceMetrics(cdp);let profile=null,actionError=null;
  try{await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');started=true;
   await startAction?.();await sleep(duration);await endAction?.();
   profile=summarizeProfile((await cdp.send('Profiler.stop')).profile);started=false;
  }catch(error){actionError=String(error?.message||error);if(started){await endAction?.().catch?.(()=>{});await cdp.send('Profiler.stop').catch(()=>{});}}
  const after=await readSnapshot(page,dashboard),hostEnd=await performanceMetrics(cdp);
  const result={name,durationMs:duration,actionError,frameBefore:before?.performance||null,frameAfter:after?.performance||null,
   renderer:after?.state?.renderer||null,hostStart,hostEnd,profile};summary.runtimeProfiles.push(result);return result;
 }

 let current=null;
 try{
  current=await openScenario('gioco-normale-mobile',{keepOpen:true,sampleMs});
  if(!current.result.entry.ready)throw new Error('Il caricamento reale della scena di gioco non è terminato; vedi schermata e diagnostica nel report.');
  await scenarioSample(current,'gioco-fermo',{duration:sampleMs});
  await runtimeProfile(current,'profilo CPU · giocatore fermo');
  const beforeWalk=await readSnapshot(current.page),beforePos=beforeWalk?.state?.player;
  let walkProfile=null,walkingProfiler=false;
  try{await current.cdp.send('Profiler.enable');await current.cdp.send('Profiler.setSamplingInterval',{interval:1000});await current.cdp.send('Profiler.start');walkingProfiler=true;}catch{}
  const walk=await scenarioSample(current,'camminata-avanti',{duration:walkMs,startAction:()=>current.page.keyboard.down('w'),endAction:()=>current.page.keyboard.up('w')});
  if(walkingProfiler){try{walkProfile=summarizeProfile((await current.cdp.send('Profiler.stop')).profile);}catch{}walkingProfiler=false;}walk.cpuProfile=walkProfile;
  walk.movement={from:beforePos?{x:beforePos.x,y:beforePos.y}:null,to:walk.end.player?{x:walk.end.player.x,y:walk.end.player.y}:null};
  const sprintJoystick=await current.page.locator('#joystick').boundingBox(),sprintButton=await current.page.locator('#run').boundingBox();
  if(!sprintJoystick||!sprintButton)throw new Error('Joystick o corsa non visibili per la prova sprint.');
  const sprintCenter={id:121,x:Math.round(sprintJoystick.x+sprintJoystick.width/2),y:Math.round(sprintJoystick.y+sprintJoystick.height/2)},sprintRunPoint={id:122,x:Math.round(sprintButton.x+sprintButton.width/2),y:Math.round(sprintButton.y+sprintButton.height/2)},sprintDirections=[{name:'su',x:0,y:-24},{name:'destra',x:24,y:0},{name:'sinistra',x:-24,y:0},{name:'giu',x:0,y:24}];
  const beginSprint=async(direction=sprintDirections[0])=>{await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[sprintCenter]});await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[sprintCenter,sprintRunPoint]});await current.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...sprintCenter,x:sprintCenter.x+direction.x,y:sprintCenter.y+direction.y},sprintRunPoint]});};
  const endSprint=()=>current.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  let sprintDirection=null,sprintDirectionProbe=[];
  for(const direction of sprintDirections){const before=await readSnapshot(current.page),from=before?.state?.player;await beginSprint(direction);await sleep(420);const after=await readSnapshot(current.page),to=after?.state?.player,travel=from&&to?Math.hypot(to.x-from.x,to.y-from.y):0;await endSprint();await sleep(100);sprintDirectionProbe.push({direction:direction.name,distance:Number(travel.toFixed(2)),running:after?.walkInput?.running===true});if(travel>.25&&after?.walkInput?.running===true){sprintDirection=direction;break;}}
  const sprint=await scenarioSample(current,'corsa-sprint',{duration:walkMs,startAction:()=>beginSprint(sprintDirection||sprintDirections[0]),duringAction:async()=>{const live=await readSnapshot(current.page);return{running:live?.walkInput?.running===true,walkInput:live?.walkInput||null,player:live?.state?.player||null};},endAction:endSprint});
  const sprintFrom=sprint.start.player;
  const sprintTo=sprint.end.player, sprintDistance=sprintFrom&&sprintTo?Math.hypot(sprintTo.x-sprintFrom.x,sprintTo.y-sprintFrom.y):0;
  sprint.assertion={runningObserved:sprint.during?.running===true,direction:sprintDirection?.name||null,directionProbe:sprintDirectionProbe,distance:Number(sprintDistance.toFixed(2))};sprint.pass=sprint.pass&&sprint.assertion.runningObserved&&sprintDistance>.5;
  await runtimeProfile(current,'profilo CPU · corsa sprint',{duration:5000,startAction:()=>beginSprint(sprintDirection||sprintDirections[0]),endAction:endSprint});
  const cameraButton=current.page.locator('#cam3d button').first();
  const cameraCycle=await scenarioSample(current,'camera-cambio-visuale',{duration:walkMs,startAction:()=>cameraButton.click()});
  cameraCycle.assertion={modeChanged:cameraCycle.start.camera?.mode!==cameraCycle.end.camera?.mode,from:cameraCycle.start.camera?.mode||null,to:cameraCycle.end.camera?.mode||null,firstPersonAligned:cameraCycle.end.camera?.mode!=='first'||!Number.isFinite(cameraCycle.end.player?.heading)||Math.abs(Math.atan2(Math.sin(cameraCycle.end.camera.yaw-Math.atan2(-Math.cos(cameraCycle.end.player.heading),-Math.sin(cameraCycle.end.player.heading))),Math.cos(cameraCycle.end.camera.yaw-Math.atan2(-Math.cos(cameraCycle.end.player.heading),-Math.sin(cameraCycle.end.player.heading)))))<.04};
  cameraCycle.pass=!!cameraCycle.assertion.modeChanged&&cameraCycle.assertion.firstPersonAligned;
  const cameraTouchStart=await readSnapshot(current.page),cameraWorld=await current.page.locator('#world').boundingBox();let cameraTouchError=null;
  const cameraTouch=await scenarioSample(current,'camera-touch-a-piedi',{duration:walkMs,startAction:async()=>{try{if(!cameraWorld)throw new Error('area libera della camera non visibile');const x=Math.round(cameraWorld.x+cameraWorld.width*.64),y=Math.round(cameraWorld.y+cameraWorld.height*.48);await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:66,x,y}]});await sleep(120);await current.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{id:66,x:x-44,y}]});}catch(error){cameraTouchError=String(error?.message||error);}},endAction:async()=>current.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})});
  const cameraYawDelta=Number.isFinite(cameraTouchStart?.state?.camera?.yaw)&&Number.isFinite(cameraTouch.end.camera?.yaw)?Math.atan2(Math.sin(cameraTouch.end.camera.yaw-cameraTouchStart.state.camera.yaw),Math.cos(cameraTouch.end.camera.yaw-cameraTouchStart.state.camera.yaw)):null;
  cameraTouch.assertion={error:cameraTouchError,yawDelta:cameraYawDelta,walkVector:cameraTouch.end?.walkInput?.vector||null,playerDisplacement:cameraTouchStart?.state?.player&&cameraTouch.end?.player?Math.hypot(cameraTouch.end.player.x-cameraTouchStart.state.player.x,cameraTouch.end.player.y-cameraTouchStart.state.player.y):null};
  cameraTouch.pass=!cameraTouchError&&Number.isFinite(cameraYawDelta)&&Math.abs(cameraYawDelta)>.04&&Math.hypot(Number(cameraTouch.assertion.walkVector?.x)||0,Number(cameraTouch.assertion.walkVector?.y)||0)<.05&&cameraTouch.assertion.playerDisplacement<.3;
  if(!profileOnly){
  let player=await readSnapshot(current.page),playerState=player?.state?.player,approach=null;
  // Static OSM props are only the authored starting positions. A previous
  // multiplayer session may have moved a street vehicle, so choose from the
  // live client state delivered by the game server before navigating to it.
  const liveVehicles=await current.page.evaluate(()=>window.__NAPOLI_QA__?.inspectInteraction?.()?.nearbyVehicles||[]).catch(()=>[]);
  const eligibleVehicle=vehicle=>vehicleMode==='car'?vehicle.v==='auto':vehicle.v!=='auto',currentPosition=playerState||spawnInfo,
   allVehicleCandidates=[...liveVehicles,...nearestVehicles].filter((vehicle,index,list)=>eligibleVehicle(vehicle)&&list.findIndex(other=>other.id===vehicle.id)===index).map(vehicle=>({...vehicle,distance:Math.hypot(vehicle.x-currentPosition.x,vehicle.y-currentPosition.y)})).sort((a,b)=>a.distance-b.distance),
   requestedVehicle=process.env.QA_VEHICLE_ID?allVehicleCandidates.find(vehicle=>vehicle.id===process.env.QA_VEHICLE_ID):allVehicleCandidates[0];
  summary.vehicleSelection={mode:vehicleMode,player:{x:currentPosition.x,y:currentPosition.y},requestedId:process.env.QA_VEHICLE_ID||null,closest:allVehicleCandidates.slice(0,8),selected:requestedVehicle||null};
  summary.liveVehicleCandidates=liveVehicles;
  if(process.env.QA_VEHICLE_ID&&!requestedVehicle)summary.limits.push('Veicolo QA richiesto non trovato: '+process.env.QA_VEHICLE_ID);
  if(requestedVehicle){try{const attemptLimitMs=Math.max(3000,Number(process.env.QA_VEHICLE_ATTEMPT_MS??(vehicleMode==='car'?12000:9000))),maxAttempts=Math.max(1,Number(process.env.QA_VEHICLE_ATTEMPTS??(vehicleMode==='car'?18:4)));approach=await walkToVehicle(current,requestedVehicle,{maxAttempts,attemptLimitMs});summary.vehicleApproach=approach;}catch(error){summary.limits.push('Percorso automatico verso '+(vehicleMode==='car'?'l’auto':'la moto')+' non completato: '+String(error?.message||error));}}
  await current.page.evaluate(()=>window.__NAPOLI_QA__?.cancelWalk?.()).catch(()=>{});
  const stopDeadline=Date.now()+2400;do{await sleep(120);player=await readSnapshot(current.page);playerState=player?.state?.player;if(!playerState||Math.abs(Number(playerState.velocity)||0)<.2)break;}while(Date.now()<stopDeadline);
  const beforeInteraction=await current.page.evaluate(()=>{const button=document.querySelector('#interact'),rect=button?.getBoundingClientRect(),qa=window.__NAPOLI_QA__?.snapshot?.();return {player:qa?.state?.player||null,hint:document.querySelector('#nearby-hint')?.textContent||'',button:button?{hidden:button.hidden,disabled:button.disabled,text:button.innerText,className:button.className,pointerEvents:getComputedStyle(button).pointerEvents,opacity:getComputedStyle(button).opacity,hit:rect?document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.id||document.elementFromPoint(rect.x+rect.width/2,rect.y+rect.height/2)?.className||null:null,rect:rect?{x:Math.round(rect.x),y:Math.round(rect.y),width:Math.round(rect.width),height:Math.round(rect.height)}:null}:null,interactionProbe:window.__NAPOLI_QA__?.inspectInteraction?.()||null,walkInput:qa?.walkInput||null};}).catch(error=>({probeError:String(error?.message||error)}));
  await current.page.evaluate(()=>{window.__qaOutbound=[];if(window.__qaTraceInstalled)return;window.__qaTraceInstalled=true;const send=WebSocket.prototype.send;WebSocket.prototype.send=function(data){try{const message=JSON.parse(data);if(message?.type==='interact')window.__qaOutbound.push({type:message.type,at:performance.now()});}catch{}return send.call(this,data);};});
  let interactionResult=null,mountBefore=null,mountElapsedMs=0;
  try{
   const interactBox=await current.page.locator('#interact').boundingBox();if(!interactBox)throw new Error('Pulsante contestuale non visibile');
   mountBefore=await readSnapshot(current.page);const mountT0=await current.page.evaluate(()=>performance.now());
   await current.page.touchscreen.tap(interactBox.x+interactBox.width/2,interactBox.y+interactBox.height/2);const deadline=Date.now()+3500;do{await sleep(150);player=await readSnapshot(current.page);playerState=player?.state?.player;if(playerState?.vehicle||playerState?.seat)break;}while(Date.now()<deadline);
   mountElapsedMs=(await current.page.evaluate(()=>performance.now())-mountT0);
   interactionResult=await current.page.evaluate(()=>({outbound:window.__qaOutbound||[],hint:document.querySelector('#nearby-hint')?.textContent||'',interactionProbe:window.__NAPOLI_QA__?.inspectInteraction?.()||null,notices:[...document.querySelectorAll('#notifications .toast,#toasts .toast,.toast,[role="alert"]')].filter(el=>!el.hidden&&getComputedStyle(el).display!=='none'&&getComputedStyle(el).visibility!=='hidden'&&el.getBoundingClientRect().width>0&&el.getBoundingClientRect().height>0).map(el=>el.textContent?.trim()).filter(Boolean).slice(-4),qa:window.__NAPOLI_QA__?.snapshot?.()?.interactions?.slice(-8)||[]}));
  }catch(error){summary.limits.push('Interazione veicolo non attivabile: '+String(error?.message||error));}
  const mounted=!!(playerState?.vehicle||playerState?.seat);
  const mountFrames=renderWindow(mountBefore,player),mountRenderedFrames=mountBefore?.webgl?.frame!==undefined&&player?.webgl?.frame!==undefined?player.webgl.frame-mountBefore.webgl.frame:null;
  const vehicleScenario={name:'tentativo-ingresso-veicolo-reale',vehicleMode,pass:mounted&&(!requestedVehicle||playerState?.vehicle===requestedVehicle.v),blocked:!mounted,
   details:{player:playerState,spawn:spawnInfo,nearestVehicles:nearestVehicles.slice(0,5),liveVehicles,approach,beforeInteraction,interactionResult},
   mountRendering:{durationMs:Math.round(mountElapsedMs),renderedFrames:mountRenderedFrames,renderedFps:mountRenderedFrames===null||!mountElapsedMs?null:Math.round(mountRenderedFrames/(mountElapsedMs/1000)*10)/10,frameInterval:mountFrames.frameInterval,cpuSubmit:mountFrames.cpuSubmit,stalls:mountFrames.stalls,
    rendererBefore:mountBefore?.renderingDiagnostics||null,rendererAfter:player?.renderingDiagnostics||null},
   screenshot:join(outputDir,'tentativo-ingresso-veicolo-reale.png')};
  try{await current.page.screenshot({path:vehicleScenario.screenshot,animations:'disabled',timeout:20000});summary.screenshots.push(vehicleScenario.screenshot);}catch(error){summary.limits.push('Screenshot veicolo: '+String(error?.message||error));}
  summary.scenarios.push(vehicleScenario);
  if(mounted){
   const frame=current.page.locator('.dh-steer'),gas=current.page.locator('[data-drive="gas"]'),brake=current.page.locator('[data-drive="brake"]');
   const touchControl=async(selector,id,ratio=.5)=>{const b=await current.page.locator(selector).boundingBox();if(!b)throw new Error('controllo touch non visibile: '+selector);const x=Math.round(b.x+b.width*ratio),y=Math.round(b.y+b.height/2);await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id,x,y}]});return {x,y};};
   const releaseTouch=async()=>current.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
   const driveSample=async(name,selector,id,ratio=.5,duration=walkMs,duringAction=null)=>scenarioSample(current,name,{duration,startAction:()=>touchControl(selector,id,ratio),duringAction,endAction:releaseTouch});
    if(process.env.QA_PROFILE_DRIVE==='1'){
     const profileError=await runtimeProfile(current,'profilo CPU · guida '+vehicleMode,{duration:5000,startAction:async()=>{const sb=await frame.boundingBox(),gb=await gas.boundingBox();if(!sb||!gb)throw new Error('sterzo o acceleratore non visibili');await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:101,x:Math.round(gb.x+gb.width/2),y:Math.round(gb.y+gb.height/2)},{id:102,x:Math.round(sb.x+sb.width*.76),y:Math.round(sb.y+sb.height/2)}]});},endAction:releaseTouch});
     if(profileError.actionError)summary.limits.push('Profilo guida: '+profileError.actionError);
    }
   const nearShot=join(outputDir,vehicleMode==='car'?'auto-vicina.png':'moto-vicina.png');
   await current.page.screenshot({path:nearShot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot mezzo vicino: '+String(error?.message||error)));
   summary.screenshots.push(nearShot);
   const mountedVehicle=playerState?.vehicle;
   const auxiliary=await current.page.evaluate(()=>{
    window.__qaVehicleMessages=[];
    if(!window.__qaVehicleSendHook){const previous=WebSocket.prototype.send;WebSocket.prototype.send=function(data){try{const message=JSON.parse(data);if(message?.type==='horn'||message?.type==='vehicleLights')window.__qaVehicleMessages.push(message.type);}catch{}return previous.call(this,data);};window.__qaVehicleSendHook=true;}
    const original=window.humanaHorn;window.__qaHornAudioCalls=0;window.humanaHorn=()=>{window.__qaHornAudioCalls++;return original?.();};
    const light=document.querySelector('.dh-lights'),horn=document.querySelector('.dh-horn'),rect=e=>{const r=e?.getBoundingClientRect();return r?{x:r.x,y:r.y,width:r.width,height:r.height}:null;};
    return{initialLights:!!window.__NAPOLI_QA__?.snapshot?.()?.state?.player?.lightsOn,lightVisible:!!light&&!light.hidden&&getComputedStyle(light).display!=='none',hornVisible:!!horn&&!horn.hidden&&getComputedStyle(horn).display!=='none',lightRect:rect(light),hornRect:rect(horn),hornSoundAvailable:typeof original==='function'};
   }).catch(error=>({error:String(error?.message||error)}));
   let lightOn=null,lightRestored=null,auxError=auxiliary.error||null;
   try{
    if(!auxiliary.lightVisible||!auxiliary.hornVisible)throw new Error('fari o clacson non visibili per il mezzo guidato');
    const lights=current.page.locator('.dh-lights'),horn=current.page.locator('.dh-horn');
    await lights.click({timeout:5000});
    await current.page.waitForFunction(initial=>window.__NAPOLI_QA__?.snapshot?.()?.state?.player?.lightsOn!==initial,auxiliary.initialLights,{timeout:3000});
    lightOn=await readSnapshot(current.page);
    const auxShot=join(outputDir,'comandi-veicolo-fari-clacson.png');await current.page.screenshot({path:auxShot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot fari/clacson: '+String(error?.message||error)));summary.screenshots.push(auxShot);
    await current.page.evaluate(()=>{let current=window.humanaHorn;window.__qaHornAudioCalls=0;const observed=(...args)=>{window.__qaHornAudioCalls++;return current?.(...args);};Object.defineProperty(window,'humanaHorn',{configurable:true,get(){return observed;},set(fn){current=fn;}});});
    await horn.click({timeout:5000});
    await current.page.waitForFunction(()=>window.__qaVehicleMessages?.includes('horn'),{timeout:2000});
    await lights.click({timeout:5000});
    await current.page.waitForFunction(initial=>window.__NAPOLI_QA__?.snapshot?.()?.state?.player?.lightsOn===initial,auxiliary.initialLights,{timeout:3000});
    lightRestored=await readSnapshot(current.page);
   }catch(error){auxError=String(error?.message||error);}
   const auxiliaryEnd=await current.page.evaluate(()=>({messages:window.__qaVehicleMessages||[],hornSoundCalls:window.__qaHornAudioCalls||0})).catch(()=>({messages:[],hornSoundCalls:0}));
   const auxiliaryScenario={name:'fari-e-clacson-veicolo',pass:!auxError&&!!auxiliary.lightVisible&&!!auxiliary.hornVisible&&lightOn?.state?.player?.lightsOn===!auxiliary.initialLights&&auxiliaryEnd.messages.includes('horn')&&auxiliaryEnd.messages.includes('vehicleLights')&&auxiliaryEnd.hornSoundCalls>0&&lightRestored?.state?.player?.lightsOn===auxiliary.initialLights,
    actionError:auxError,details:{...auxiliary,lightsAfterToggle:lightOn?.state?.player?.lightsOn??null,lightsRestored:lightRestored?.state?.player?.lightsOn??null,...auxiliaryEnd}};
   summary.scenarios.push(auxiliaryScenario);
   // The closest test motorcycle is parked beside a building. Drive it out
   // with simultaneous throttle and steering before measuring straight-line
   // acceleration, so a collision with the parking frontage cannot invalidate
   // an otherwise real throttle test.
   if(vehicleMode==='bike'&&!process.env.QA_VEHICLE_ID){
    const leadBefore=await readSnapshot(current.page),leadT0=await current.page.evaluate(()=>performance.now());let leadError=null;
    try{
     const sb=await frame.boundingBox(),gb=await gas.boundingBox();if(!sb||!gb)throw new Error('sterzo o acceleratore non visibile per uscire dal parcheggio');
     await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:79,x:Math.round(gb.x+gb.width/2),y:Math.round(gb.y+gb.height/2)},{id:80,x:Math.round(sb.x+sb.width*.76),y:Math.round(sb.y+sb.height/2)}]});
     await sleep(Math.max(1200,Number(process.env.QA_BIKE_LEAD_IN_MS??3000)));
    }catch(error){leadError=String(error?.message||error);}finally{await releaseTouch().catch(()=>{});}
    const leadAfter=await readSnapshot(current.page),leadElapsed=(await current.page.evaluate(()=>performance.now())-leadT0)/1000,leadFrames=renderWindow(leadBefore,leadAfter),leadA=leadBefore?.state?.player,leadB=leadAfter?.state?.player;
    const leadShot=join(outputDir,'moto-uscita-parcheggio.png');await current.page.screenshot({path:leadShot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot uscita parcheggio: '+String(error?.message||error)));summary.screenshots.push(leadShot);
    const headingDelta=leadA&&leadB?Math.atan2(Math.sin(leadB.heading-leadA.heading),Math.cos(leadB.heading-leadA.heading)):null;
    const leadScenario={name:'moto-uscita-parcheggio',pass:!leadError&&!!leadA&&!!leadB&&Math.hypot(leadB.x-leadA.x,leadB.y-leadA.y)>.8&&Math.abs(headingDelta||0)>.08,
     actionError:leadError,measurementDurationMs:Math.round(leadElapsed*1000),start:{player:leadA||null},end:{player:leadB||null},
     webgl:{renderedFrames:leadBefore?.webgl?.frame!==undefined&&leadAfter?.webgl?.frame!==undefined?leadAfter.webgl.frame-leadBefore.webgl.frame:null,renderedFps:leadBefore?.webgl?.frame!==undefined&&leadAfter?.webgl?.frame!==undefined?Math.round((leadAfter.webgl.frame-leadBefore.webgl.frame)/Math.max(.001,leadElapsed)*10)/10:null,frameInterval:leadFrames.frameInterval,cpuSubmit:leadFrames.cpuSubmit},cameraRaycast:{renderStalls:leadFrames.stalls},renderer:{before:leadBefore?.renderer||null,after:leadAfter?.renderer||null,diagnosticsBefore:leadBefore?.renderingDiagnostics||null,diagnosticsAfter:leadAfter?.renderingDiagnostics||null},
     assertion:{displacement:leadA&&leadB?Math.hypot(leadB.x-leadA.x,leadB.y-leadA.y):null,headingDelta,velocity:leadB?.velocity??null},screenshot:leadShot};summary.scenarios.push(leadScenario);
    // Release leaves realistic momentum. Stop the bike with the actual brake
    // before the straight-line throttle check, otherwise it coasts into the
    // sea-wall collision and falsely reports a broken accelerator.
    const stopBefore=await readSnapshot(current.page),stopT0=await current.page.evaluate(()=>performance.now());let stopError=null;
    try{await touchControl('[data-drive="brake"]',83);const deadline=Date.now()+3200;while(Date.now()<deadline){const q=await readSnapshot(current.page);if(Math.abs(Number(q?.state?.player?.velocity)||0)<.3)break;await sleep(120);}}
    catch(error){stopError=String(error?.message||error);}finally{await releaseTouch().catch(()=>{});}
    await sleep(250);const stopAfter=await readSnapshot(current.page),stopElapsed=(await current.page.evaluate(()=>performance.now())-stopT0)/1000,stopStartVelocity=Math.abs(Number(stopBefore?.state?.player?.velocity)||0),stopEndVelocity=Math.abs(Number(stopAfter?.state?.player?.velocity)||0);
    const stopShot=join(outputDir,'moto-arresto-dopo-uscita.png');await current.page.screenshot({path:stopShot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot arresto moto: '+String(error?.message||error)));summary.screenshots.push(stopShot);
    summary.scenarios.push({name:'arresto-moto-dopo-uscita',pass:!stopError&&stopStartVelocity>=stopEndVelocity&&stopEndVelocity<.35,actionError:stopError,measurementDurationMs:Math.round(stopElapsed*1000),start:{player:stopBefore?.state?.player||null},end:{player:stopAfter?.state?.player||null},screenshot:stopShot});
   }
  // Test throttle and brake back-to-back, with independent frame windows.
  // Screenshots are captured after each measured input so encoding cannot pollute the FPS sample.
  // Let the first mount/scene transition settle before measuring sustained driving.
  // This separates one-time vehicle setup from steady-state throttle frame pacing.
  await sleep(Math.max(0,Number(process.env.QA_VEHICLE_SETTLE_MS??1200)));
  const accelStart=await readSnapshot(current.page),accelT0=await current.page.evaluate(()=>performance.now());
  const accelHoldMs=Math.max(900,Number(process.env.QA_ACCEL_HOLD_MS??(vehicleMode==='car'?3000:1000))),brakeHoldMs=vehicleMode==='car'?3000:1800;
  const accelerationShot=join(outputDir,vehicleMode==='car'?'accelerazione-auto.png':'accelerazione-moto.png');
  let throttleCheck=null,afterThrottle=null,brakeStart=null,brakeDuring=null,brakeActionError=null,accelElapsed=0;
  try{
   await touchControl('[data-drive="gas"]',81);
   const confirmAfterMs=Math.min(accelHoldMs,Math.max(500,Number(process.env.QA_ACCEL_CONFIRM_MS??1500)));
   await sleep(confirmAfterMs);
   throttleCheck=await readSnapshot(current.page);
   await sleep(Math.max(0,accelHoldMs-confirmAfterMs));
   afterThrottle=await readSnapshot(current.page);
   accelElapsed=(await current.page.evaluate(()=>performance.now())-accelT0)/1000;
   await releaseTouch();
   brakeStart=await readSnapshot(current.page);
   const brakeT0=await current.page.evaluate(()=>performance.now());
   await touchControl('[data-drive="brake"]',82);
   const brakeProbeMs=Math.min(brakeHoldMs,vehicleMode==='car'?800:550);await sleep(brakeProbeMs);
   brakeDuring=await current.page.evaluate(()=>{const gear=document.querySelector('.dh-gear'),s=window.__NAPOLI_QA__?.snapshot?.();return{gearVisible:!!gear&&!gear.hidden&&getComputedStyle(gear).display!=='none',gearText:gear?.textContent?.trim()||'',player:s?.state?.player||null};}).catch(()=>null);
   // Capture both screenshots after the brake response has been sampled. Taking
   // a screenshot between throttle and brake can stall the renderer long enough
   // for a bike to coast into a curb, turning the brake probe into a reverse test.
   await current.page.screenshot({path:accelerationShot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot accelerazione: '+String(error?.message||error)));summary.screenshots.push(accelerationShot);
   await sleep(Math.max(0,brakeHoldMs-brakeProbeMs));
   var brakeElapsed=(await current.page.evaluate(()=>performance.now())-brakeT0)/1000;
  }catch(error){brakeActionError=String(error?.message||error);}
  finally{await releaseTouch().catch(()=>{});}
  const brakeEnd=await readSnapshot(current.page),accelFrames=renderWindow(accelStart,afterThrottle),brakeFrames=renderWindow(brakeStart,brakeEnd);
  const accelRenderedFrames=accelStart?.webgl?.frame!==undefined&&afterThrottle?.webgl?.frame!==undefined?afterThrottle.webgl.frame-accelStart.webgl.frame:null;
  const brakeRenderedFrames=brakeStart?.webgl?.frame!==undefined&&brakeEnd?.webgl?.frame!==undefined?brakeEnd.webgl.frame-brakeStart.webgl.frame:null;
  const acceleration={name:vehicleMode==='car'?'accelerazione-auto':'accelerazione-moto',pass:false,actionError:brakeActionError,
   measurementDurationMs:Math.round(accelElapsed*1000),start:{player:accelStart?.state?.player||null,camera:accelStart?.state?.camera||null,performance:accelStart?.performance||null},end:{player:afterThrottle?.state?.player||null,camera:afterThrottle?.state?.camera||null,performance:afterThrottle?.performance||null},
   input:{vehicle:afterThrottle?.vehicleInput||null},during:throttleCheck?.state?.player||null,
   webgl:{start:accelStart?.webgl||null,end:afterThrottle?.webgl||null,renderedFrames:accelRenderedFrames,renderedFps:accelRenderedFrames===null?null:Math.round(accelRenderedFrames/Math.max(.001,accelElapsed)*10)/10,frameInterval:accelFrames.frameInterval,cpuSubmit:accelFrames.cpuSubmit},cameraRaycast:{renderStalls:accelFrames.stalls}};
  acceleration.assertion={vehicle:mountedVehicle,velocityIncreased:(Number(acceleration.during?.velocity)||0)>(Number(acceleration.start.player?.velocity)||0)+.1,velocityAtConfirmation:Number(acceleration.during?.velocity)||0,velocityAtEnd:Number(acceleration.end.player?.velocity)||0,worldPositionChanged:!!acceleration.start.player&&!!acceleration.end.player&&Math.hypot(acceleration.end.player.x-acceleration.start.player.x,acceleration.end.player.y-acceleration.start.player.y)>.25};
  acceleration.pass=!!acceleration.assertion.velocityIncreased&&!!acceleration.assertion.worldPositionChanged;
  acceleration.screenshot=accelerationShot;summary.scenarios.push(acceleration);
  const braking={name:vehicleMode==='car'?'frenata-auto':'frenata-moto',pass:false,actionError:brakeActionError,
   start:{player:brakeStart?.state?.player||null,camera:brakeStart?.state?.camera||null,performance:brakeStart?.performance||null},end:{player:brakeEnd?.state?.player||null,camera:brakeEnd?.state?.camera||null,performance:brakeEnd?.performance||null},input:{vehicle:brakeEnd?.vehicleInput||null},during:brakeDuring,
   measurementDurationMs:Math.round(brakeElapsed*1000),
   webgl:{start:brakeStart?.webgl||null,end:brakeEnd?.webgl||null,renderedFrames:brakeRenderedFrames,
    renderedFps:brakeRenderedFrames===null?null:Math.round(brakeRenderedFrames/brakeElapsed*10)/10,
    frameInterval:brakeFrames.frameInterval,cpuSubmit:brakeFrames.cpuSubmit},cameraRaycast:{renderStalls:brakeFrames.stalls}};
  braking.assertion={velocityBeforeBrake:Number(afterThrottle?.state?.player?.velocity)||0,velocityDuringBrake:Number(brakeDuring?.player?.velocity)||0,
   velocityReduced:(Number(brakeDuring?.player?.velocity)||0)<(Number(afterThrottle?.state?.player?.velocity)||0)-.1,
   gearR:!!brakeDuring?.gearVisible,gearText:brakeDuring?.gearText||''};
  braking.pass=!!braking.assertion.velocityReduced;
  braking.screenshot=join(outputDir,braking.name+'.png');await current.page.screenshot({path:braking.screenshot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot '+braking.name+': '+String(error?.message||error)));summary.screenshots.push(braking.screenshot);summary.scenarios.push(braking);
   if(vehicleMode==='car'){
    const reverse=await driveSample('retromarcia-auto','[data-drive="brake"]',83,.5,3000,()=>current.page.evaluate(()=>{const gear=document.querySelector('.dh-gear'),s=window.__NAPOLI_QA__?.snapshot?.();return{gearVisible:!!gear&&!gear.hidden&&getComputedStyle(gear).display!=='none',gearText:gear?.textContent?.trim()||'',player:s?.state?.player||null};}));
    const reverseStart=reverse.start.player,reverseEnd=reverse.end.player,reverseHeading=Number(reverseStart?.heading)||0,reverseDx=(Number(reverseEnd?.x)||0)-(Number(reverseStart?.x)||0),reverseDy=(Number(reverseEnd?.y)||0)-(Number(reverseStart?.y)||0),backwardDistance=-(reverseDx*Math.cos(reverseHeading)+reverseDy*Math.sin(reverseHeading));
    reverse.assertion={reverseVelocity:Math.min(Number(reverse.during?.player?.velocity)||0,Number(reverseEnd?.velocity)||0)<-.1,backwardDistance:Number(backwardDistance.toFixed(2)),movedBackward:backwardDistance>.35,gearR:!!reverse.during?.gearVisible,gearText:reverse.during?.gearText||''};
    reverse.pass=!!reverse.assertion.gearR&&(reverse.assertion.reverseVelocity||reverse.assertion.movedBackward);
   }
   const steeringBefore=await readSnapshot(current.page),steerBox=await frame.boundingBox(),gasBox=await gas.boundingBox();let steeringHeld=null,steeringError=null;
   try{if(!steerBox||!gasBox)throw new Error('sterzo o acceleratore non visibile');await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:84,x:Math.round(gasBox.x+gasBox.width/2),y:Math.round(gasBox.y+gasBox.height/2)},{id:85,x:Math.round(steerBox.x+steerBox.width*.76),y:Math.round(steerBox.y+steerBox.height/2)}]});await sleep(Math.max(1000,walkMs));steeringHeld=await readSnapshot(current.page);}catch(error){steeringError=String(error?.message||error);}finally{await releaseTouch().catch(()=>{});}
   const steeringAfter=await readSnapshot(current.page),steeringStart=steeringBefore?.state?.player,steeringEnd=steeringHeld?.state?.player;
   const wrapAngle=(a,b)=>Math.atan2(Math.sin(b-a),Math.cos(b-a));const steeringScenario={name:vehicleMode==='car'?'sterzata-auto':'sterzata-moto',pass:!!steeringHeld&&!steeringError&&Number(steeringHeld.vehicleInput?.values?.throttle)>0&&Math.abs(Number(steeringHeld.vehicleInput?.steer)||0)>.05&&!!steeringStart&&!!steeringEnd&&Math.abs(wrapAngle(steeringStart.heading,steeringEnd.heading))>.01,
    details:{error:steeringError,start:steeringStart,end:steeringEnd,vehicleInput:steeringHeld?.vehicleInput||null,headingDelta:Number.isFinite(steeringStart?.heading)&&Number.isFinite(steeringEnd?.heading)?wrapAngle(steeringStart.heading,steeringEnd.heading):null,afterInput:steeringAfter?.vehicleInput||null}};
   steeringScenario.screenshot=join(outputDir,steeringScenario.name+'.png');await current.page.screenshot({path:steeringScenario.screenshot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot sterzo: '+String(error?.message||error)));summary.screenshots.push(steeringScenario.screenshot);summary.scenarios.push(steeringScenario);
   const multiBefore=await readSnapshot(current.page),world=await current.page.locator('#world').boundingBox(),g=await gas.boundingBox(),s=await frame.boundingBox();
   let multiHeld=null,multiError=null;
   try{
    if(!world||!g||!s)throw new Error('camera o comandi guida non visibili');
    const touches=[{id:71,x:Math.round(g.x+g.width/2),y:Math.round(g.y+g.height/2)},{id:72,x:Math.round(s.x+s.width*.76),y:Math.round(s.y+s.height/2)},{id:73,x:Math.round(world.x+world.width*.54),y:Math.round(world.y+world.height*.45)}];
    await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:touches});await sleep(250);
    await current.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[touches[0],touches[1],{...touches[2],x:touches[2].x+34}]});await sleep(Math.max(800,walkMs));multiHeld=await readSnapshot(current.page);
   }catch(error){multiError=String(error?.message||error);}
   finally{await current.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}).catch(()=>{});}
   const multiAfter=await readSnapshot(current.page),multiStart=multiBefore?.state?.player,multiEnd=multiHeld?.state?.player;
   const threeTouchScenario={name:'acceleratore-sterzo-camera-multitouch',pass:!!multiHeld&&!multiError&&Number(multiHeld.vehicleInput?.values?.throttle)>0&&Math.abs(Number(multiHeld.vehicleInput?.steer)||0)>.05&&Number.isFinite(multiBefore?.state?.camera?.yaw)&&Number.isFinite(multiHeld?.state?.camera?.yaw)&&Math.abs(multiHeld.state.camera.yaw-multiBefore.state.camera.yaw)>.005&&!!multiStart&&!!multiEnd&&Math.hypot(multiEnd.x-multiStart.x,multiEnd.y-multiStart.y)>.1,
    details:{error:multiError,held:{vehicleInput:multiHeld?.vehicleInput||null,player:multiEnd||null,camera:multiHeld?.state?.camera||null},cameraYawDelta:Number.isFinite(multiBefore?.state?.camera?.yaw)&&Number.isFinite(multiHeld?.state?.camera?.yaw)?multiHeld.state.camera.yaw-multiBefore.state.camera.yaw:null,releasedPointers:multiAfter?.vehicleInput?.pointers||[],afterInput:multiAfter?.vehicleInput||null}};
   const multiShot=join(outputDir,'acceleratore-sterzo-camera.png');await current.page.screenshot({path:multiShot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot multitouch: '+String(error?.message||error)));threeTouchScenario.screenshot=multiShot;summary.screenshots.push(multiShot);summary.scenarios.push(threeTouchScenario);
   const prolongedMs=Math.max(0,Number(process.env.QA_PROLONGED_DRIVE_MS)||0);
   if(prolongedMs>0){
    const prolongedBefore=await readSnapshot(current.page);if(process.env.QA_FRAME_TIMING==='1')await current.page.evaluate(()=>window.__NAPOLI_FRAME_BREAKDOWN__?.reset()).catch(()=>{});const prolongedHostStart=await performanceMetrics(current.cdp),prolongedT0=await current.page.evaluate(()=>performance.now()),samples=[];let prolongedError=null,touchPoints=[];
    try{
     const gb=await gas.boundingBox(),sb=await frame.boundingBox();if(!gb||!sb)throw new Error('gas o sterzo non visibili per la guida prolungata');
     touchPoints=[{id:101,x:Math.round(gb.x+gb.width/2),y:Math.round(gb.y+gb.height/2)},{id:102,x:Math.round(sb.x+sb.width*.76),y:Math.round(sb.y+sb.height/2)}];
     await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints});
     let elapsed=0,turn=0;while(elapsed<prolongedMs){await sleep(Math.min(3000,prolongedMs-elapsed));elapsed=await current.page.evaluate(()=>performance.now())-prolongedT0;turn=Math.floor(elapsed/4500)%2;const steerX=Math.round(sb.x+sb.width*(turn?.24:.76));touchPoints[1]={...touchPoints[1],x:steerX};await current.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints});const snap=await readSnapshot(current.page);if(snap?.state?.player)samples.push({at:Math.round(elapsed),x:snap.state.player.x,y:snap.state.player.y,velocity:Number(snap.state.player.velocity)||0,heading:Number(snap.state.player.heading)||0,vehicle:snap.state.player.vehicle,input:snap.vehicleInput?.values||null});}
    }catch(error){prolongedError=String(error?.message||error);}finally{await current.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]}).catch(()=>{});}
    const prolongedAfter=await readSnapshot(current.page),frameMethodTimings=process.env.QA_FRAME_TIMING==='1'?await current.page.evaluate(()=>window.__NAPOLI_FRAME_BREAKDOWN__?.snapshot()||null).catch(()=>null):null,prolongedHostEnd=await performanceMetrics(current.cdp),prolongedElapsed=Math.max(.001,(await current.page.evaluate(()=>performance.now())-prolongedT0)/1000),renderN=Math.max(0,(prolongedAfter?.renderProbe?.count||0)-(prolongedBefore?.renderProbe?.count||0)),frameIntervals=prolongedAfter?.renderProbe?.intervals?.slice(-renderN)||[],cpuSubmit=prolongedAfter?.renderProbe?.submitMs?.slice(-renderN)||[],longTaskStart=prolongedBefore?.performance?.longTasks?.at(-1)?.start??-1,longFrameStart=prolongedBefore?.performance?.longAnimationFrames?.at(-1)?.start??-1,positionSamples=samples.filter(p=>Number.isFinite(p.x)&&Number.isFinite(p.y));let totalDistance=0,headingChanges=0;for(let i=1;i<positionSamples.length;i++){totalDistance+=Math.hypot(positionSamples[i].x-positionSamples[i-1].x,positionSamples[i].y-positionSamples[i-1].y);const dh=Math.atan2(Math.sin(positionSamples[i].heading-positionSamples[i-1].heading),Math.cos(positionSamples[i].heading-positionSamples[i-1].heading));if(Math.abs(dh)>.02)headingChanges++;}
    const prolongedShot=join(outputDir,'guida-prolungata.png');await current.page.screenshot({path:prolongedShot,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot guida prolungata: '+String(error?.message||error)));summary.screenshots.push(prolongedShot);
    const prolongedScenario={name:'guida-prolungata',pass:!prolongedError&&!!prolongedBefore?.state?.player?.vehicle&&prolongedAfter?.state?.player?.vehicle===prolongedBefore.state.player.vehicle&&totalDistance>2,actionError:prolongedError,measurementDurationMs:Math.round(prolongedElapsed*1000),start:{player:prolongedBefore?.state?.player||null,performance:prolongedBefore?.performance||null,host:prolongedHostStart},end:{player:prolongedAfter?.state?.player||null,performance:prolongedAfter?.performance||null,host:prolongedHostEnd},webgl:{renderedFrames:renderN,renderedFps:Math.round(renderN/prolongedElapsed*10)/10,frameInterval:frameStats(frameIntervals),cpuSubmit:frameStats(cpuSubmit)},methodTimings:frameMethodTimings,mainThreadLongTasks:(prolongedAfter?.performance?.longTasks||[]).filter(task=>task.start>longTaskStart),mainThreadLongAnimationFrames:(prolongedAfter?.performance?.longAnimationFrames||[]).filter(task=>task.start>longFrameStart),samples,assertion:{totalDistance:Number(totalDistance.toFixed(2)),headingChanges,stillMounted:prolongedAfter?.state?.player?.vehicle===prolongedBefore?.state?.player?.vehicle,sampleCount:samples.length},screenshot:prolongedShot};summary.scenarios.push(prolongedScenario);
   }
   if(process.env.QA_PROFILE_DRIVE==='1')await runtimeProfile(current,'profilo CPU · guida, sterzo e camera',{duration:5000,startAction:async()=>{const box=await current.page.locator('#world').boundingBox(),gb=await gas.boundingBox(),sb=await frame.boundingBox();if(!box||!gb||!sb)throw new Error('zone touch guida non visibili nel profilo');const points=[{id:91,x:Math.round(gb.x+gb.width/2),y:Math.round(gb.y+gb.height/2)},{id:92,x:Math.round(sb.x+sb.width*.76),y:Math.round(sb.y+sb.height/2)},{id:93,x:Math.round(box.x+box.width*.55),y:Math.round(box.y+box.height*.46)}];await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:points});await sleep(120);await current.cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[points[0],points[1],{...points[2],x:points[2].x+28}]});},endAction:()=>current.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})});
   const beforeExit=await readSnapshot(current.page),beforeExitPlayer=beforeExit?.state?.player,streetVehicleId=beforeExitPlayer?.vehicleSource==='street'?beforeExitPlayer.streetVehicleId:null;
   await current.page.locator('.dh-off').click({timeout:5000});
   await current.page.waitForFunction(()=>window.__NAPOLI_QA__?.snapshot?.()?.state?.player?.vehicle===null,{timeout:5000}).catch(()=>{});
   const exitScenario=await scenarioSample(current,'uscita-veicolo',{duration:1500});
   const previousWalkCamera=await current.page.evaluate(()=>{const world=window.__w3;if(!world)return null;const previous=world.walkMode;world.walkMode='third';world.snap=true;return previous;}).catch(()=>null);
   if(previousWalkCamera){await sleep(450);const visual=join(outputDir,'uscita-veicolo-terza-persona.png');await current.page.screenshot({path:visual,animations:'disabled',timeout:20000}).catch(error=>summary.limits.push('Screenshot uscita in terza persona: '+String(error?.message||error)));summary.screenshots.push(visual);await current.page.evaluate(mode=>{if(window.__w3){window.__w3.walkMode=mode;window.__w3.snap=true;}},previousWalkCamera).catch(()=>{});}
   if(streetVehicleId){const exitPlayer=exitScenario.end.player||beforeExitPlayer,expectedDrop={x:exitPlayer.x,y:exitPlayer.y};const streetReturn=await current.page.evaluate(({id,expected})=>{const world=window.__w3,item=world?.parkedStreetObjects?.get(id),object=item?.object,position=object?{x:object.position.x,z:object.position.z}:null;return{id,found:!!object,inStreetLayer:!!world?.parkedStreetLayer&&object?.parent===world.parkedStreetLayer,position,expectedDrop:expected,dropDistance:position?Math.hypot(position.x-expected.x,position.z-expected.y):null,headlightHidden:!object?.userData?.headlightBeam||!object.userData.headlightBeam.visible};},{id:streetVehicleId,expected:expectedDrop}).catch(error=>({id:streetVehicleId,error:String(error?.message||error)}));
    exitScenario.assertion={streetVehicleId,...streetReturn,returnedNearDrop:streetReturn.inStreetLayer===true&&streetReturn.headlightHidden===true&&streetReturn.dropDistance<=3};exitScenario.pass=exitScenario.pass&&exitScenario.assertion.returnedNearDrop;}
  }else{
   summary.limits.push('La guida reale è bloccata dal mancato ingresso in un veicolo vicino allo spawn; il report include la distanza dai veicoli statici.');
   for(const name of ['accelerazione-moto','frenata-moto','sterzata-moto','accelerazione-auto','frenata-auto','retromarcia-auto','multitouch-guida']){
    await scenarioSample(current,name,{duration:1800});
    summary.scenarios.at(-1).pass=false;summary.scenarios.at(-1).blocked=true;summary.scenarios.at(-1).reason='Nessun veicolo guidabile raggiunto; non simulo il risultato.';
   }
  }
  await current.context.close().catch(()=>{});
  current=await openScenario('dashboard-attivo',{dashboard:true,sampleMs});
  if(!current.result.entry.ready)throw new Error('La partita incorporata nella dashboard non è arrivata alla scena giocabile.');
  current=await openScenario('qualita-ridotta',{quality:'min',sampleMs});
  if(!current.result.entry.ready)throw new Error('La partita con qualità ridotta non è arrivata alla scena giocabile.');
  }else await current.context.close().catch(()=>{});
 }catch(error){summary.fatalError=String(error?.stack||error);summary.scenarios.push({name:'audit interrotto',pass:false,error:String(error?.message||error)});}
 finally{await browser.close().catch(()=>{});}
 summary.finishedAt=new Date().toISOString();
 await writeFile(join(outputDir,'report.json'),JSON.stringify(summary,null,2));
 return summary;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const arg=process.argv.find(value=>value.startsWith('--base-url=')),fpsArg=process.argv.find(value=>value.startsWith('--fps-limit='));
 const sample=process.argv.find(value=>value.startsWith('--sample-ms=')),walk=process.argv.find(value=>value.startsWith('--walk-ms=')),output=process.argv.find(value=>value.startsWith('--output-dir=')),chromium=process.argv.find(value=>value.startsWith('--chromium-path='));
 const outputDir=output?resolve(root,output.slice('--output-dir='.length)):out;
 const summary=await run({baseURL:arg?.slice('--base-url='.length)||process.env.QA_BASE_URL||null,
  outputDir,executablePath:chromium?.slice('--chromium-path='.length)||undefined,
  profileOnly:process.argv.includes('--profile-only'),sampleMs:sample?Number(sample.slice('--sample-ms='.length)):undefined,
  walkMs:walk?Number(walk.slice('--walk-ms='.length)):undefined,
  fpsLimit:fpsArg?Math.max(30,Math.min(60,Number(fpsArg.slice('--fps-limit='.length))||0)):undefined});
 console.log('Audit prestazioni: '+summary.scenarios.length+' condizioni; report: '+join(outputDir,'report.json'));
 if(summary.fatalError)process.exitCode=1;
}
