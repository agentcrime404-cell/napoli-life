import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {setNapoli,napoliSpawn,napoliParkedVehicles,napoliStand} from '../shared/napoli.js';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const out=resolve(process.env.QA_OUTPUT||join(root,'artifacts','qa-performance-live'));
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

async function readSnapshot(page,dashboard=false){
 try{return await page.evaluate(isDashboard=>{
  const frame=isDashboard?document.querySelector('#game-frame'):null;
  const win=frame?.contentWindow||window,qa=win.__NAPOLI_QA__;
  const snapshot=qa?.snapshot?.();if(!snapshot)return null;
  const render=win.__w3?.gl?.info?.render;
  snapshot.webgl=render?{frame:render.frame,calls:render.calls,triangles:render.triangles,points:render.points,lines:render.lines}:null;
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

async function walkToVehicle(session,vehicle){
 const {page}=session,initial=await readSnapshot(page),start=initial?.state?.player;if(!start)return{moved:false,reason:'posizione iniziale assente'};
 const path=routeToVehicle({x:start.x,y:start.y},vehicle);if(!path)return{moved:false,reason:'nessun percorso pedonale trovato',start};
 const trace=[{x:start.x,y:start.y}],keysHeld=new Set();let actions=0,stalled=0,previousDistance=null;
 try{
  for(let waypoint=1;waypoint<path.length&&actions<100;){
   const current=await readSnapshot(page),player=current?.state?.player;if(!player)break;
   const goal=path[waypoint],distance=Math.hypot(goal.x-player.x,goal.y-player.y);if(distance<.5){waypoint++;continue;}
   const yaw=await page.evaluate(()=>window.__w3?.yaw||0),keys=walkKeysToward(goal.x-player.x,goal.y-player.y,yaw);
   for(const key of keys){await page.keyboard.down(key);keysHeld.add(key);}await page.keyboard.down('Shift');keysHeld.add('Shift');
   await sleep(Math.max(100,Math.min(220,distance/4.4*1000)));for(const key of keysHeld){await page.keyboard.up(key);}keysHeld.clear();actions++;
   if(actions%4===0)trace.push({x:player.x,y:player.y,distanceToWaypoint:Math.round(distance*100)/100});
   if(previousDistance!==null&&distance>=previousDistance-.03)stalled++;else stalled=0;previousDistance=distance;if(stalled>=8)break;
  }
 }finally{for(const key of keysHeld)await page.keyboard.up(key).catch(()=>{});}
 const final=await readSnapshot(page),end=final?.state?.player||null;if(end)trace.push({x:end.x,y:end.y});
 return{moved:!!end&&Math.hypot(end.x-start.x,end.y-start.y)>.75,start:end?{x:start.x,y:start.y}:null,end:end?{x:end.x,y:end.y}:null,
  target:{x:vehicle.x,y:vehicle.y,distance:Math.hypot(vehicle.x-start.x,vehicle.y-start.y)},remaining:end?Math.round(Math.hypot(vehicle.x-end.x,vehicle.y-end.y)*100)/100:null,
  routeWaypoints:path.length,waypoints:path.map(({x,y})=>({x,y})),actions,stalled:stalled>=8,trace};
}

async function createGuest(context,baseURL){
 const response=await context.request.post(new URL('/api/auth/guest',baseURL).href,{data:{look:0},timeout:15000});
 if(!response.ok())throw new Error('Creazione profilo temporaneo fallita: HTTP '+response.status());
 return response.json();
}

export async function run({baseURL,executablePath=process.env.PLAYWRIGHT_CHROMIUM_PATH||null,
 outputDir=out,walkMs=6000,sampleMs=10000,profileOnly=false}={}){
 if(!baseURL)throw new Error('Passa --base-url=http://127.0.0.1:PORT al server locale di test.');
 await mkdir(outputDir,{recursive:true});
 const pw=playwright(),launch={headless:true,args:['--no-sandbox','--enable-precise-memory-info']};
 if(executablePath)launch.executablePath=executablePath;
 const browser=await pw.chromium.launch(launch),guestContext=await browser.newContext({serviceWorkers:'block'});
 const summary={name:'Napoli Life · audit prestazioni live',mode:'live-game',baseURL,
  startedAt:new Date().toISOString(),device:{viewport:{width:390,height:844},isMobile:true,hasTouch:true,
   benchmarkHost:'Chrome desktop with emulated mobile viewport; not a physical-phone measurement'},
  capture:{screenshots:true,video:false,reason:'Video encoding is disabled during FPS sampling to avoid distorting frame-time results.'},
  scenarios:[],runtimeProfiles:[],errors:{console:[],page:[],requests:[],http:[]},limits:[],screenshots:[],
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
 summary.nearbyVehicleAudit={spawn:spawnInfo,count:nearestVehicles.length,
  motorcycles:nearestVehicles.filter(vehicle=>vehicle.v!=='auto').slice(0,5),
  cars:nearestVehicles.filter(vehicle=>vehicle.v==='auto').slice(0,5)};
 let gpuInfo=null;try{const browserCDP=await browser.newBrowserCDPSession();await browserCDP.send('SystemInfo.getInfo').then(data=>{gpuInfo={modelName:data.gpu?.auxAttributes?.glRenderer||data.gpu?.devices?.[0]?.deviceString||null,vendor:data.gpu?.auxAttributes?.glVendor||null,driver:data.gpu?.auxAttributes?.glVersion||null};});await browserCDP.detach();}catch(error){summary.limits.push('Informazioni GPU non disponibili via CDP: '+String(error?.message||error));}
 summary.gpuInfo=gpuInfo;

 async function openScenario(name,{dashboard=false,quality=null,keepOpen=false}={}){
  console.log('[QA] avvio scenario: '+name+(quality?' ('+quality+')':''));
  const context=await browser.newContext({viewport:{width:390,height:844},
   isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
  await context.addInitScript(({token,gfx})=>{try{localStorage.setItem('humana-token',token);sessionStorage.setItem('humana-token',token);if(gfx)localStorage.setItem('humana-gfx',gfx);}catch{}},{token:guest.token,gfx:quality});
  const page=await context.newPage(),consoleErrors=[],pageErrors=[],requestFailures=[];
  const httpErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('requestfailed',request=>requestFailures.push({url:request.url(),error:request.failure()?.errorText||''}));
  page.on('response',response=>{if(response.status()>=400)httpErrors.push({url:response.url(),status:response.status()});});
  const cdp=await context.newCDPSession(page);await cdp.send('Performance.enable');
  let profileStarted=false;
  try{await cdp.send('Profiler.enable');await cdp.send('Profiler.setSamplingInterval',{interval:1000});await cdp.send('Profiler.start');profileStarted=true;}catch(error){summary.limits.push('Profiler JavaScript non disponibile: '+String(error?.message||error));}
  const url=dashboard?new URL('/debug-controls',baseURL):new URL('/?3d=1&qa=1',baseURL);
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
  let profile=null;if(profileStarted){try{profile=summarizeProfile((await cdp.send('Profiler.stop')).profile);}catch(error){summary.limits.push('Profilo CPU non leggibile: '+String(error?.message||error));}profileStarted=false;}
  const screenshot=join(outputDir,name+'.png');
  try{await page.screenshot({path:screenshot,fullPage:dashboard,animations:'disabled',timeout:20000});summary.screenshots.push(screenshot);}catch(error){summary.limits.push('Screenshot '+name+': '+String(error?.message||error));}
  const initial=await readSnapshot(page,dashboard),metricStart=await performanceMetrics(cdp),start=Date.now();
  await sleep(sampleMs);
  const final=await readSnapshot(page,dashboard),metricEnd=await performanceMetrics(cdp),elapsed=(Date.now()-start)/1000;
  const taskPct=metricStart.mainThreadTaskMs!==null&&metricEnd.mainThreadTaskMs!==null?
   Math.round((metricEnd.mainThreadTaskMs-metricStart.mainThreadTaskMs)/(elapsed*1000)*100):null;
  const renderedFrames=initial?.webgl?.frame!==undefined&&final?.webgl?.frame!==undefined?final.webgl.frame-initial.webgl.frame:null;
  const result={name,dashboard,quality:quality||'predefinita',entry,
   viewport:{game:final?.viewport||initial?.viewport||null,browser:{width:390,height:844},
    dashboard:dashboard?await page.evaluate(()=>({width:innerWidth,height:innerHeight,heapMb:performance.memory?.usedJSHeapSize?Math.round(performance.memory.usedJSHeapSize/104857.6)/10:null})).catch(()=>null):null},
   start:{performance:initial?.performance||null,player:initial?.state?.player||null,renderer:initial?.state?.renderer||null,world:initial?.state?.world||null,host:metricStart},
   end:{performance:final?.performance||null,player:final?.state?.player||null,renderer:final?.state?.renderer||null,world:final?.state?.world||null,host:metricEnd},
   taskTimePerWallPct:taskPct,webgl:{start:initial?.webgl||null,end:final?.webgl||null,
    renderedFrames,renderedFps:renderedFrames===null?null:Math.round(renderedFrames/elapsed*10)/10},
   profile,errors:{console:consoleErrors,page:pageErrors,requests:requestFailures,http:httpErrors}};
  if(!initial?.state)summary.limits.push('Telemetria renderer/gameplay non presente nello scenario '+name+'; FPS host e tempi CPU restano disponibili.');
  summary.scenarios.push(result);summary.errors.console.push(...consoleErrors);summary.errors.page.push(...pageErrors);summary.errors.requests.push(...requestFailures);summary.errors.http.push(...httpErrors);
  console.log('[QA] completato scenario: '+name);
  if(!keepOpen)await context.close().catch(()=>{});
  return {context,page,cdp,dashboard,result,consoleErrors,pageErrors,requestFailures};
 }

 async function scenarioSample(session,name,{duration=walkMs,startAction=null,endAction=null,dashboard=session?.dashboard||false}={}){
  const {page,cdp}=session,metricStart=await performanceMetrics(cdp),before=await readSnapshot(page,dashboard),t0=Date.now();
  let actionError=null;try{await startAction?.();}catch(error){actionError=String(error?.message||error);}
  await sleep(duration);
  try{await endAction?.();}catch(error){actionError=String(error?.message||error);}
  const after=await readSnapshot(page,dashboard),metricEnd=await performanceMetrics(cdp),elapsed=(Date.now()-t0)/1000;
  const taskPct=metricStart.mainThreadTaskMs!==null&&metricEnd.mainThreadTaskMs!==null?
   Math.round((metricEnd.mainThreadTaskMs-metricStart.mainThreadTaskMs)/(elapsed*1000)*100):null;
  const renderedFrames=before?.webgl?.frame!==undefined&&after?.webgl?.frame!==undefined?after.webgl.frame-before.webgl.frame:null;
  const screenshot=join(outputDir,name+'.png');
  try{await page.screenshot({path:screenshot,fullPage:dashboard,animations:'disabled',timeout:20000});summary.screenshots.push(screenshot);}catch(error){summary.limits.push('Screenshot '+name+': '+String(error?.message||error));}
  const scenario={name,pass:!after?.readError,actionError,
   start:{performance:before?.performance||null,player:before?.state?.player||null,renderer:before?.state?.renderer||null,host:metricStart},
   end:{performance:after?.performance||null,player:after?.state?.player||null,renderer:after?.state?.renderer||null,host:metricEnd},
   taskTimePerWallPct:taskPct,webgl:{start:before?.webgl||null,end:after?.webgl||null,
    renderedFrames,renderedFps:renderedFrames===null?null:Math.round(renderedFrames/elapsed*10)/10},
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
  const walk=await scenarioSample(current,'camminata-avanti',{duration:walkMs,startAction:()=>current.page.keyboard.down('w'),endAction:()=>current.page.keyboard.up('w')});
  walk.movement={from:beforePos?{x:beforePos.x,y:beforePos.y}:null,to:walk.end.player?{x:walk.end.player.x,y:walk.end.player.y}:null};
  await runtimeProfile(current,'profilo CPU · camminata',{duration:5000,startAction:()=>current.page.keyboard.down('w'),endAction:()=>current.page.keyboard.up('w')});
  const cameraButton=current.page.locator('#cam3d button').first();
  await scenarioSample(current,'camera-panoramica',{duration:walkMs,startAction:()=>cameraButton.click()});
  if(!profileOnly){
  let player=await readSnapshot(current.page),playerState=player?.state?.player,approach=null;
  const nearestBike=nearestVehicles.find(vehicle=>vehicle.v!=='auto');
  if(nearestBike){try{approach=await walkToVehicle(current,nearestBike);summary.vehicleApproach=approach;}catch(error){summary.limits.push('Percorso automatico verso la moto non completato: '+String(error?.message||error));}}
  try{
   await current.page.locator('#interact').click({timeout:5000});await sleep(1500);player=await readSnapshot(current.page);playerState=player?.state?.player;
  }catch(error){summary.limits.push('Interazione veicolo non attivabile: '+String(error?.message||error));}
  const mounted=!!(playerState?.vehicle||playerState?.seat);
  const vehicleScenario={name:'tentativo-ingresso-veicolo-reale',pass:mounted,blocked:!mounted,
   details:{player:playerState,spawn:spawnInfo,nearestVehicles:nearestVehicles.slice(0,5),approach},
   screenshot:join(outputDir,'tentativo-ingresso-veicolo-reale.png')};
  try{await current.page.screenshot({path:vehicleScenario.screenshot,animations:'disabled',timeout:20000});summary.screenshots.push(vehicleScenario.screenshot);}catch(error){summary.limits.push('Screenshot veicolo: '+String(error?.message||error));}
  summary.scenarios.push(vehicleScenario);
  if(mounted){
   const frame=current.page.locator('.dh-steer'),gas=current.page.locator('[data-drive="gas"]'),brake=current.page.locator('[data-drive="brake"]');
   await scenarioSample(current,'guida-accelerazione',{duration:walkMs,startAction:async()=>{const b=await gas.boundingBox();if(!b)throw new Error('acceleratore invisibile');await current.page.mouse.move(b.x+b.width/2,b.y+b.height/2);await current.page.mouse.down();},endAction:()=>current.page.mouse.up()});
   await scenarioSample(current,'guida-frenata',{duration:walkMs,startAction:async()=>{const b=await brake.boundingBox();if(!b)throw new Error('freno invisibile');await current.page.mouse.move(b.x+b.width/2,b.y+b.height/2);await current.page.mouse.down();},endAction:()=>current.page.mouse.up()});
   await scenarioSample(current,'guida-sterzo',{duration:walkMs,startAction:async()=>{const b=await frame.boundingBox();if(!b)throw new Error('sterzo invisibile');await current.page.mouse.move(b.x+b.width*.75,b.y+b.height/2);await current.page.mouse.down();},endAction:()=>current.page.mouse.up()});
   await scenarioSample(current,'controlli-multitouch',{duration:walkMs,startAction:async()=>{const g=await gas.boundingBox(),s=await frame.boundingBox();if(!g||!s)throw new Error('controlli guida invisibili');await current.cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{id:71,x:g.x+g.width/2,y:g.y+g.height/2},{id:72,x:s.x+s.width*.7,y:s.y+s.height/2}]});},endAction:()=>current.cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})});
   await current.page.locator('#interact').click({timeout:5000});await scenarioSample(current,'uscita-veicolo',{duration:1500});
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
 const arg=process.argv.find(value=>value.startsWith('--base-url='));
 const sample=process.argv.find(value=>value.startsWith('--sample-ms=')),walk=process.argv.find(value=>value.startsWith('--walk-ms=')),output=process.argv.find(value=>value.startsWith('--output-dir=')),chromium=process.argv.find(value=>value.startsWith('--chromium-path='));
 const outputDir=output?resolve(root,output.slice('--output-dir='.length)):out;
 const summary=await run({baseURL:arg?.slice('--base-url='.length)||process.env.QA_BASE_URL||null,
  outputDir,executablePath:chromium?.slice('--chromium-path='.length)||undefined,
  profileOnly:process.argv.includes('--profile-only'),sampleMs:sample?Number(sample.slice('--sample-ms='.length)):undefined,
  walkMs:walk?Number(walk.slice('--walk-ms='.length)):undefined});
 console.log('Audit prestazioni: '+summary.scenarios.length+' condizioni; report: '+join(outputDir,'report.json'));
 if(summary.fatalError)process.exitCode=1;
}
