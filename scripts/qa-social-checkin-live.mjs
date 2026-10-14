import { chromium } from '@playwright/test';
import { mkdir, writeFile } from 'node:fs/promises';
import { join, resolve } from 'node:path';

const baseURL=(process.env.QA_BASE_URL||'http://127.0.0.1:33098').replace(/\/$/,'');
const outputDir=resolve(process.env.QA_OUTPUT_DIR||'artifacts/qa-social-checkin-2026-10-14');
const browserPath=process.env.PLAYWRIGHT_CHROMIUM_PATH||'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';
const pause=ms=>new Promise(r=>setTimeout(r,ms));
const report={startedAt:new Date().toISOString(),baseURL,scenario:'Due sessioni online; un membro raggiunge il ritrovo, segna l’arrivo e l’amico riceve l’aggiornamento live.',checks:[],errors:[],limits:['Viewport e touch emulati in Edge desktop; test su Android fisico non eseguito.']};
const check=(name,pass,details={})=>report.checks.push({name,pass,...details});
const assert=(condition,message,details={})=>{check(message,!!condition,details);if(!condition)throw new Error(message);};
async function request(path,token,body){const response=await fetch(baseURL+path,{method:body?'POST':'GET',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{})});const data=await response.json();if(!response.ok)throw new Error(`${path}: HTTP ${response.status} ${data.error||''}`);return data;}
async function enter(browser,token,label){
 const context=await browser.newContext({viewport:{width:844,height:390},isMobile:true,hasTouch:true,deviceScaleFactor:1});
 const page=await context.newPage();page.on('pageerror',e=>report.errors.push({session:label,type:'pageerror',message:e.message}));page.on('console',m=>{if(m.type()==='error')report.errors.push({session:label,type:'console',message:m.text()});});
 await page.addInitScript(t=>{localStorage.setItem('humana-token',t);sessionStorage.setItem('humana-token',t);},token);
 const response=await page.goto(baseURL+'/?3d=1&qa=1',{waitUntil:'domcontentloaded',timeout:30000});assert(response&&response.status()<400,`${label}: pagina di gioco HTTP OK`,{status:response?.status()});
 await page.locator('#pg-go').waitFor({state:'visible',timeout:60000});await page.locator('#pg-go').click({timeout:15000});
 await page.waitForFunction(()=>!!(window.__NAPOLI_QA__?.snapshot?.()?.state?.player&&window.__NAPOLI_QA__?.snapshot?.()?.state?.world?.loaded),null,{timeout:90000});
 return {context,page,label};
}

await mkdir(outputDir,{recursive:true});
let browser;
try{
 browser=await chromium.launch({headless:true,executablePath:browserPath,args:['--no-sandbox']});
 const suffix=Date.now().toString(36),leaderName='MeetupLead_'+suffix,friendName='MeetupPeer_'+suffix,password='SocialQA-password-314';
 const leader=await request('/api/auth/register',null,{username:leaderName,password}),friend=await request('/api/auth/register',null,{username:friendName,password});
 await request('/api/friends',leader.token,{id:friend.user.id});await request('/api/friends',friend.token,{id:leader.user.id,action:'accept'});
 await request('/api/social-group',leader.token,{action:'create'});
 const invite=await request('/api/social-group',leader.token,{action:'invite',targetId:friend.user.id});await request('/api/social-group',friend.token,{action:'accept',inviteId:invite.inviteId});
 const setup=await request('/api/social-group',leader.token,{action:'set-meetup',spotId:'mergellina:m31'});
 assert(setup.party?.meetup?.name==='Chalet del Golfo','Il gruppo ha il ritrovo reale Chalet del Golfo');
 const a=await enter(browser,leader.token,'leader'),b=await enter(browser,friend.token,'amico');
 check('viewport browser mobile landscape per entrambe le sessioni',true,{leader:await a.page.evaluate(()=>({width:innerWidth,height:innerHeight,touch:'ontouchstart'in window})),friend:await b.page.evaluate(()=>({width:innerWidth,height:innerHeight,touch:'ontouchstart'in window}))});
 for(const session of [a,b]){await session.page.locator('#friends').click({timeout:15000,force:true});await session.page.locator('#modal[open]').waitFor({timeout:15000});await session.page.getByText('Ritrovo del gruppo',{exact:false}).waitFor({timeout:15000});}
 const start=await a.page.evaluate(()=>window.__NAPOLI_QA__.snapshot().state.player);
 const target=setup.party.meetup;const initialDistance=Math.hypot(start.x-target.x,start.y-target.y);
 const walkAccepted=await a.page.evaluate(({x,y})=>window.__NAPOLI_QA__.walkTo(x,y),{x:target.x,y:target.y});
 assert(walkAccepted,'Il personaggio accetta il percorso pedonale verso il ritrovo',{from:{x:start.x,y:start.y},to:{x:target.x,y:target.y},initialDistance});
 let current=null;const deadline=Date.now()+45000;
 while(Date.now()<deadline){current=await a.page.evaluate(()=>window.__NAPOLI_QA__.snapshot().state.player);if(current?.room===target.room&&Math.hypot(current.x-target.x,current.y-target.y)<=11.6)break;await pause(400);}
 const distance=Math.hypot(current.x-target.x,current.y-target.y);
 assert(current?.room===target.room&&distance<=11.6,'Percorso reale: personaggio entro il raggio server di 12 m',{room:current?.room,distance:+distance.toFixed(2),position:{x:current?.x,y:current?.y}});
 const checkIn=a.page.getByRole('button',{name:'Segna arrivo'});await checkIn.waitFor({timeout:15000});await checkIn.waitFor({state:'visible'});
 await a.page.waitForFunction(()=>{const button=[...document.querySelectorAll('#modal-body button')].find(b=>b.textContent.includes('Segna arrivo'));return !!button&&!button.disabled;},null,{timeout:10000});
 await a.page.screenshot({path:join(outputDir,'prima-check-in-844x390.png'),animations:'disabled'});
 await checkIn.click({timeout:15000});
 await a.page.getByRole('button',{name:/Sei arrivato/}).waitFor({timeout:15000});
 await b.page.getByText(/1 \/ 2 già sul posto/).waitFor({timeout:15000});
 await a.page.screenshot({path:join(outputDir,'check-in-completato-844x390.png'),animations:'disabled'});
 await b.page.screenshot({path:join(outputDir,'aggiornamento-amico-live-844x390.png'),animations:'disabled'});
 const persisted=await request('/api/social-group',friend.token);
 assert(Object.hasOwn(persisted.party.meetup.arrivals,leader.user.id),'L’arrivo è persistito ed è visibile all’altro membro',{arrivals:Object.keys(persisted.party.meetup.arrivals),responses:persisted.party.meetup.responses});
 const ui=await b.page.locator('#modal-body').innerText();assert(/1 \/ 2 già sul posto/.test(ui),'L’interfaccia dell’amico si aggiorna via notifica multiplayer',{text:ui.slice(0,800)});
 check('nessun errore JavaScript o console nelle due sessioni',report.errors.length===0,{errors:report.errors});
 await a.context.close();await b.context.close();
}catch(error){report.failure=error.stack||String(error);}
finally{if(browser)await browser.close();report.finishedAt=new Date().toISOString();await writeFile(join(outputDir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(report.failure||report.checks.some(c=>!c.pass)||report.errors.length)process.exitCode=1;}
