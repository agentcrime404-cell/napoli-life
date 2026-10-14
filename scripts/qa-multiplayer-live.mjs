import {mkdir,writeFile} from 'node:fs/promises';
import {resolve} from 'node:path';
import {createRequire} from 'node:module';

const require=createRequire(import.meta.url);
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const baseURL=process.argv.find(value=>value.startsWith('--base-url='))?.slice('--base-url='.length)||process.env.QA_BASE_URL;
const viewportText=process.env.QA_VIEWPORT||'915x412',match=/^(\d{3,4})x(\d{3,4})$/.exec(viewportText);
if(!baseURL)throw new Error('Passa --base-url=http://127.0.0.1:PORT al server QA isolato.');
if(!match||Number(match[1])<800||Number(match[1])<=Number(match[2]))throw new Error('QA_VIEWPORT deve essere landscape, per esempio 915x412.');
const viewport={width:Number(match[1]),height:Number(match[2])},output=resolve(process.env.QA_OUTPUT||'artifacts/qa-multiplayer-live');
const browserPath=process.env.PLAYWRIGHT_CHROMIUM_PATH||undefined;
const pw=require('playwright');
await mkdir(output,{recursive:true});
const browser=await pw.chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox']});
const report={name:'Napoli Life · multiplayer live a due sessioni',baseURL,viewport,
 environment:'Due sessioni Playwright con touch emulato su browser desktop; non è un test su smartphone fisico.',startedAt:new Date().toISOString(),sessions:[],checks:[],errors:[],screenshots:[]};
const sessions=[];
try{
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport,isMobile:true,hasTouch:true,deviceScaleFactor:1,serviceWorkers:'block'});
  const response=await context.request.post(new URL('/api/auth/guest',baseURL).href,{data:{look:i},timeout:15000});
  if(!response.ok())throw new Error('Creazione ospite '+(i+1)+' fallita: HTTP '+response.status());
  const identity=await response.json();
  await context.addInitScript(token=>{localStorage.setItem('humana-token',token);sessionStorage.setItem('humana-token',token);},identity.token);
  const page=await context.newPage();
  page.on('pageerror',error=>report.errors.push({session:i+1,type:'page',message:error.message}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({session:i+1,type:'console',message:message.text()});});
  sessions.push({context,page,user:identity.user,token:identity.token});
 }
 await Promise.all(sessions.map(async({page},i)=>{
  const response=await page.goto(new URL('/?3d=1&qa=1',baseURL).href,{waitUntil:'domcontentloaded',timeout:30000});
  if(!response||response.status()>=400)throw new Error('Sessione '+(i+1)+' non caricata.');
  await page.locator('#pg-go').waitFor({state:'visible',timeout:90000});
  await page.locator('#pg-go').click();
  await page.waitForFunction(()=>!!window.__w3?.cur?.g&&!window.__w3.cur.loading&&document.querySelector('#scene-loading')?.hidden===true,{timeout:120000,polling:500});
 }));
 const [one,two]=sessions,firstId=one.user.id;
 await two.page.waitForFunction(id=>window.__w3?.players?.has(id)===true,firstId,{timeout:45000,polling:300});
 const initial=await two.page.evaluate(id=>{const avatar=window.__w3.players.get(id);return avatar?.root?{x:avatar.root.position.x,z:avatar.root.position.z,visible:avatar.root.visible}:null;},firstId);
 await one.page.keyboard.down('w');await sleep(2600);await one.page.keyboard.up('w');
 const localAfter=await one.page.evaluate(()=>window.__NAPOLI_QA__?.snapshot?.()?.state?.player||null);
 await two.page.waitForFunction(({id,from})=>{const root=window.__w3?.players?.get(id)?.root;if(!root||!from)return false;return Math.hypot(root.position.x-from.x,root.position.z-from.z)>.6;},{id:firstId,from:initial},{timeout:12000,polling:250});
 const remoteAfter=await two.page.evaluate(id=>{const avatar=window.__w3.players.get(id);return avatar?.root?{x:avatar.root.position.x,z:avatar.root.position.z,visible:avatar.root.visible}:null;},firstId);
 report.sessions=[{id:one.user.id,name:one.user.username,room:(await one.page.evaluate(()=>window.__NAPOLI_QA__?.snapshot?.()?.state?.player?.room))||null},
  {id:two.user.id,name:two.user.username,room:(await two.page.evaluate(()=>window.__NAPOLI_QA__?.snapshot?.()?.state?.player?.room))||null}];
 report.checks.push({name:'presenza reciproca nella stessa istanza',pass:!!initial&&initial.visible!==false,remoteBefore:initial});
 report.checks.push({name:'posizione sincronizzata dopo il movimento del primo giocatore',pass:!!initial&&!!remoteAfter&&Math.hypot(remoteAfter.x-initial.x,remoteAfter.z-initial.z)>.6&&!!localAfter,localAfter,remoteBefore:initial,remoteAfter});
 const text='qa-social-'+Date.now();
 await one.page.locator('#chat-toggle').click();await one.page.locator('#chat-input').fill(text);await one.page.locator('#chat-input').press('Enter');
 await two.page.waitForFunction(value=>document.querySelector('#messages')?.textContent?.includes(value)===true,text,{timeout:10000,polling:200});
 report.checks.push({name:'chat di gioco consegnata all’altra sessione',pass:await two.page.locator('#messages').getByText(text,{exact:false}).count().then(count=>count>0),message:text});
 for(let i=0;i<sessions.length;i++){
  const file=resolve(output,'sessione-'+(i+1)+'.png');await sessions[i].page.screenshot({path:file,animations:'disabled',timeout:20000});report.screenshots.push(file);
 }
}catch(error){report.fatalError=String(error?.stack||error);report.checks.push({name:'errore test multiplayer',pass:false,error:String(error?.message||error)});}
finally{
 for(const session of sessions)await session.context.close().catch(()=>{});
 await browser.close().catch(()=>{});
 report.finishedAt=new Date().toISOString();
 await writeFile(resolve(output,'report.json'),JSON.stringify(report,null,2));
}
console.log('Test multiplayer live: '+report.checks.filter(check=>check.pass).length+'/'+report.checks.length+' verifiche superate; report: '+resolve(output,'report.json'));
if(report.fatalError||report.checks.some(check=>check.pass===false))process.exitCode=1;
