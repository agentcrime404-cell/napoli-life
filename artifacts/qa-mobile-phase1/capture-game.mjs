import {mkdir,writeFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {fileURLToPath} from 'node:url';
import {join,dirname} from 'node:path';
const {chromium}=createRequire(import.meta.url)('playwright');
const baseURL='http://127.0.0.1:3181';
const outDir=dirname(fileURLToPath(import.meta.url));
await mkdir(outDir,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_PATH,args:['--no-sandbox','--enable-webgl','--ignore-gpu-blocklist']});
const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:1});
const errors=[];let page;
try{
 const auth=await context.request.post(baseURL+'/api/auth/guest',{data:{look:0},timeout:20000});
 if(!auth.ok())throw new Error('Guest QA HTTP '+auth.status());
 const guest=await auth.json();
 await context.addInitScript(token=>{localStorage.setItem('humana-token',token);sessionStorage.setItem('humana-token',token);},guest.token);
 page=await context.newPage();
 page.on('pageerror',e=>errors.push(e.message));
 const response=await page.goto(baseURL+'/?3d=1&qa=1',{waitUntil:'domcontentloaded',timeout:30000});
 if(!response||response.status()>=400)throw new Error('Game HTTP '+(response?.status()||'no response'));
 await page.locator('#pg-go').waitFor({state:'visible',timeout:90000});
 await page.locator('#pg-go').click({force:true,timeout:15000});
 let loaded=false;
 try{await page.waitForFunction(()=>window.__NAPOLI_QA__?.snapshot?.().state?.world?.loaded===true,undefined,{timeout:90000});loaded=true;}catch{}
 await page.waitForTimeout(1500);
 const snapshot=await page.evaluate(()=>window.__NAPOLI_QA__?.snapshot?.()||null);
 const screenshotPath=join(outDir,'game-live-390x844.png');
 await page.screenshot({path:screenshotPath,animations:'disabled',timeout:30000});
 const report={createdAt:new Date().toISOString(),baseURL,viewport:{width:390,height:844},account:guest.user?.username,enteredCity:!!snapshot?.state?.player,worldLoaded:loaded,performance:snapshot?.performance,state:snapshot?.state,errors,screenshot:screenshotPath};
 await writeFile(join(outDir,'capture-report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify({enteredCity:report.enteredCity,worldLoaded:loaded,fps:report.performance?.fps,frameMs:report.performance?.frameMs,p95:report.performance?.p95FrameMs,drawCalls:report.state?.renderer?.drawCalls,screenshot:report.screenshot,errors}));
}finally{await context.close().catch(()=>{});await browser.close().catch(()=>{});}
