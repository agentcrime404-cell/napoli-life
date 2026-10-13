import {mkdir,writeFile} from 'node:fs/promises';
import {join,resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createRequire} from 'node:module';
import {qaDevices} from '../playwright.config.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'..');
const profileButtons={
 'android-portrait':'portrait',
 'android-small-portrait':'small',
 'android-compact':'mini',
 'android-landscape':'landscape',
 'android-landscape-small':'landscape-small'
};
function getPlaywright(){
 try{return createRequire(import.meta.url)('playwright');}
 catch(error){throw new Error('Playwright non disponibile. Installa le dipendenze del progetto: '+error.message);}
}
async function readLiveState(page){
 return page.evaluate(()=>{
  const iframe=document.querySelector('#game-frame');
  if(!iframe)return null;
  try{
   const win=iframe.contentWindow,api=win.__NAPOLI_QA__,snapshot=api?.snapshot?.();
   return {
    viewport:{width:win.innerWidth,height:win.innerHeight,dpr:win.devicePixelRatio},
    state:snapshot?.state||null,performance:snapshot?.performance||null,
    errors:snapshot?.errors||[],interactions:snapshot?.interactions||[],
    hud:{overlap:document.querySelector('#overlap-count')?.textContent||'—',
     controls:document.querySelector('#control-count')?.textContent||'—',
     connection:document.querySelector('#connection-state')?.textContent||'—'}
   };
  }catch(error){return {accessError:String(error)};}
 });
}
function recordInputChecks(summary,profile,testName,steps){
 if(!Array.isArray(steps)||!steps.length){
  summary.checks.push({profile,test:testName+' · telemetria del test',pass:false,details:'Il gioco non ha registrato i passaggi.'});
  return;
 }
 for(const step of steps)summary.checks.push({profile,test:testName+' · '+step.name,pass:!!step.pass,details:step});
}
async function clickDashboard(page,id){
 await page.evaluate(buttonId=>document.getElementById(buttonId)?.click(),id);
 await page.waitForTimeout(350);
}
async function saveScreenshot(page,path){
 try{await page.screenshot({path,fullPage:true,animations:'disabled',timeout:20000});return true;}
 catch(error){return String(error?.message||error);}
}

export async function run({playwright=null,executablePath=process.env.PLAYWRIGHT_CHROMIUM_PATH||null,
 outputDir=join(root,'artifacts','qa-live'),baseURL=process.env.QA_BASE_URL||null,
 qaGuest=false,devices=qaDevices}={}){
 if(!baseURL)throw new Error('Per il test reale avvia il gioco e passa --base-url=http://127.0.0.1:PORT. Nessuna fixture verrà usata al posto del gioco.');
 const pw=playwright||getPlaywright();
 await mkdir(outputDir,{recursive:true});
 const videos=join(outputDir,'videos');
 await mkdir(videos,{recursive:true});
 const launch={headless:true,args:['--no-sandbox']};
 if(executablePath)launch.executablePath=executablePath;
 const browser=await pw.chromium.launch(launch);
 const summary={name:'Napoli Life · test mobile live',startedAt:new Date().toISOString(),
  baseURL,mode:'live-game',checks:[],profiles:[],knownLimits:[]};
 let context,page,video;
 try{
  context=await browser.newContext({viewport:{width:1440,height:1000},isMobile:true,hasTouch:true,deviceScaleFactor:1,recordVideo:{dir:videos}});
  page=await context.newPage();
  const consoleErrors=[],pageErrors=[];
  page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
  page.on('pageerror',error=>pageErrors.push(error.message));
  page.on('requestfailed',request=>summary.knownLimits.push('Richiesta fallita: '+request.url()+' '+(request.failure()?.errorText||'')));
  video=page.video();
  if(qaGuest){
   const response=await context.request.post(new URL('/api/auth/guest',baseURL).href,{data:{look:0},timeout:15000});
   if(!response.ok())throw new Error('Ospite QA non creato: HTTP '+response.status());
   const guest=await response.json();
   await page.addInitScript(token=>{
    try{localStorage.setItem('humana-token',token);sessionStorage.setItem('humana-token',token);}catch{}
   },guest.token);
   summary.qaAccount=guest.user?.username||'ospite temporaneo';
   console.log('Account QA temporaneo creato nel server di test.');
  }
  const response=await page.goto(new URL('/debug-controls',baseURL).href,{waitUntil:'domcontentloaded',timeout:20000});
  if(!response||response.status()>=400)throw new Error('Dashboard QA HTTP '+(response?.status()||'nessuna risposta'));
  if(!await page.locator('#game-frame').count())throw new Error('La dashboard non contiene il frame del gioco.');
  console.log('Dashboard reale HTTP '+response.status()+'. Attendo la telemetria Three.js.');
  try{
   await page.waitForFunction(()=>{
    try{return !!document.querySelector('#game-frame')?.contentWindow?.__NAPOLI_QA__;}
    catch{return false;}
   },undefined,{timeout:45000});
   summary.checks.push({test:'dashboard e telemetria della partita reale',pass:true});
  }catch(error){
   summary.checks.push({test:'dashboard e telemetria della partita reale',pass:false,details:error.message});
   summary.knownLimits.push('La telemetria Three.js non è pronta entro 45 secondi.');
  }
  // The multitouch probe requires the separate vehicle controls to be visible.
  // Enable the dashboard's vehicle preview before entering the QA session.
  await clickDashboard(page,'preview-mode');
  try{
   await page.waitForFunction(()=>{
    try{const win=document.querySelector('#game-frame')?.contentWindow;return !!win?.__NAPOLI_QA__&&new URL(win.location.href).searchParams.get('qaVehicle')==='1';}
    catch{return false;}
   },undefined,{timeout:30000});
   summary.checks.push({test:'modalità veicolo QA attiva',pass:true});
  }catch(error){
   summary.checks.push({test:'modalità veicolo QA attiva',pass:false,details:error.message});
   summary.knownLimits.push('La dashboard non ha attivato i comandi veicolo QA.');
  }
  // The app validates an existing QA guest token during renderer startup, then pauses at
  // the normal pre-game screen until the player presses "Entra in città".
  const gameFrame=page.frameLocator('#game-frame');
  try{
   await page.waitForFunction(()=>{
    try{const doc=document.querySelector('#game-frame')?.contentDocument;return !!doc?.querySelector('#pg-go')||!!(doc?.querySelector('#auth')&&!doc.querySelector('#auth').hidden&&doc.querySelector('#guest'));}
    catch{return false;}
   },undefined,{timeout:45000});
    if(qaGuest){
     // The temporary token is injected before the iframe starts, so the app
     // should open directly at the pre-game screen without a second guest flow.
     await gameFrame.locator('#pg-go').waitFor({state:'visible',timeout:45000});
     await gameFrame.locator('#pg-go').click({timeout:15000,force:true});
    }else if(await gameFrame.locator('#pg-go').count()){
    await gameFrame.locator('#pg-go').click({timeout:10000});
   }else{
    await gameFrame.locator('#guest').click({timeout:10000});
    await gameFrame.locator('#modal-body button').first().click({timeout:10000});
    await gameFrame.locator('#pg-go').click({timeout:30000});
   }
   console.log('Ingresso ospite e avvio partita eseguiti tramite i comandi reali.');
  }catch(error){
   summary.knownLimits.push('Il flusso di ingresso non ha mostrato il menu di gioco: '+error.message);
   try{summary.entryScreen=await gameFrame.locator('body').innerText({timeout:2000});}catch{}
   await saveScreenshot(page,join(outputDir,'entry-failure.png'));
   throw error;
  }
  console.log('Attendo stato di gioco e caricamento mappa.');
  let worldReady=false;
  try{
   await page.waitForFunction(()=>{
    try{const s=document.querySelector('#game-frame')?.contentWindow?.__NAPOLI_QA__?.snapshot?.();return !!(s?.state?.player&&s?.state?.world?.loaded);}
    catch{return false;}
   },undefined,{timeout:60000});
   worldReady=true;
  }catch{summary.knownLimits.push('Personaggio o mondo non pronti entro 60 secondi.');}
  summary.checks.push({test:'personaggio e mondo reale caricati',pass:worldReady});
  console.log('Mondo pronto: '+worldReady+'. Inizio le risoluzioni mobile.');
  for(const device of devices){
   const key=profileButtons[device.name];
   if(key)await page.evaluate(profile=>document.querySelector('[data-profile="'+profile+'"]')?.click(),key);
   await page.waitForTimeout(700);
   let data=await readLiveState(page);
   const overlapClean=String(data?.hud?.overlap||'').toLowerCase().includes('nessuna');
   summary.checks.push({profile:device.name,test:'HUD senza sovrapposizioni impreviste',pass:overlapClean,
    details:{overlap:data?.hud?.overlap,controls:data?.hud?.controls,viewport:data?.viewport}});
   const errorCount=(data?.errors||[]).length;
   summary.checks.push({profile:device.name,test:'nessun errore JavaScript nel gioco',pass:errorCount===0&&consoleErrors.length===0&&pageErrors.length===0,
    details:{telemetryErrors:errorCount,consoleErrors:consoleErrors.length,pageErrors:pageErrors.length}});
   await clickDashboard(page,'multitouch-test');
   data=await readLiveState(page);
   const vehicleEvent=[...(data?.interactions||[])].reverse().find(event=>event.kind==='qa-multitouch-test');
   recordInputChecks(summary,device.name,'multitouch veicolo',vehicleEvent?.detail?.steps);
  const screenshot='hud-'+device.name+'.png';
   const screenshotResult=await saveScreenshot(page,join(outputDir,screenshot));
  try{
   const frameBox=await page.locator('#game-frame').boundingBox();
   if(frameBox)await page.screenshot({path:join(outputDir,'game-'+device.name+'.png'),clip:frameBox,animations:'disabled',timeout:20000});
  }catch(error){summary.knownLimits.push('Impossibile acquisire il ritaglio del gioco: '+error.message);}
   summary.profiles.push({name:device.name,viewport:device.viewport,screenshot,
    screenshotResult,live:data,consoleErrors:[...consoleErrors],pageErrors:[...pageErrors]});
   console.log(device.name+': HUD '+(overlapClean?'senza sovrapposizioni':'anomalia')+', screenshot '+screenshot+'.');
  }
  if(devices.some(device=>device.name==='android-portrait')){
   await clickDashboard(page,'preview-mode');
   try{
    await page.waitForFunction(()=>{
     try{const win=document.querySelector('#game-frame')?.contentWindow;return !!win?.__NAPOLI_QA__&&new URL(win.location.href).searchParams.get('qaVehicle')==='0';}
     catch{return false;}
    },undefined,{timeout:30000});
   }catch{summary.knownLimits.push('Il gioco non ha confermato il passaggio alla modalità a piedi.');}
   await page.waitForTimeout(1000);
   await clickDashboard(page,'walk-test');
   const data=await readLiveState(page);
   const walkEvent=[...(data?.interactions||[])].reverse().find(event=>event.kind==='qa-walk-test');
   recordInputChecks(summary,'android-portrait','camminata/corsa',walkEvent?.detail?.steps);
   summary.walkScreenshot=await saveScreenshot(page,join(outputDir,'hud-android-portrait-walk.png'));
   console.log('Test a piedi completato.');
  }
  summary.browserErrors={console:consoleErrors,page:pageErrors};
 }catch(error){
  summary.fatalError=String(error?.stack||error);
  summary.checks.push({test:'apertura della partita reale',pass:false,details:String(error?.message||error)});
 }finally{
  if(context)await context.close().catch(()=>{});
  await browser.close().catch(()=>{});
 }
 try{summary.video=await video?.path();}catch{}
 summary.finishedAt=new Date().toISOString();
 summary.passed=summary.checks.filter(check=>check.pass).length;
 summary.failed=summary.checks.length-summary.passed;
 await writeFile(join(outputDir,'report.json'),JSON.stringify(summary,null,2));
 return summary;
}

if(process.argv[1]===fileURLToPath(import.meta.url)){
 const urlArg=process.argv.find(value=>value.startsWith('--base-url='));
 const summary=await run({baseURL:urlArg?.slice('--base-url='.length)||process.env.QA_BASE_URL||null,
  qaGuest:process.argv.includes('--qa-guest'),devices:process.argv.includes('--smoke')?[qaDevices[0]]:qaDevices,
  outputDir:process.env.QA_OUTPUT||join(root,'artifacts','qa-live')});
 console.log('QA mobile live: '+summary.passed+' pass, '+summary.failed+' fail; report: '+join(root,'artifacts','qa-live','report.json'));
 if(summary.failed)process.exitCode=1;
}
