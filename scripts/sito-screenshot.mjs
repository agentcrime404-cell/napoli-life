import {chromium} from '@playwright/test';
const out=process.env.TEMP+'/sito-shots';import {mkdirSync} from 'node:fs';mkdirSync(out,{recursive:true});
let browser;try{browser=await chromium.launch();}catch(e){browser=await chromium.launch({channel:'chrome'});}
for(const [name,vp,mobile] of [['desktop',{width:1366,height:820},false],['mobile',{width:390,height:844},true]]){
 const ctx=await browser.newContext({viewport:vp,deviceScaleFactor:1,isMobile:mobile,hasTouch:mobile,reducedMotion:'reduce'});const p=await ctx.newPage();const errs=[];p.on('pageerror',e=>errs.push(e.message));p.on('console',m=>{if(m.type()==='error')errs.push(m.text())});
 await p.goto('http://localhost:3081/sito',{waitUntil:'networkidle'});await p.evaluate(()=>document.querySelectorAll('.rv').forEach(e=>e.classList.add('in')));
 // carica le immagini lazy
 await p.evaluate(async()=>{for(let y=0;y<document.body.scrollHeight;y+=600){scrollTo(0,y);await new Promise(r=>setTimeout(r,60));}scrollTo(0,0);});await p.waitForTimeout(800);
 await p.screenshot({path:`${out}/${name}-full.jpg`,fullPage:true,quality:70,type:'jpeg'});
 const sw=await p.evaluate(()=>document.documentElement.scrollWidth-innerWidth);console.log(name,'overflow-x',sw,'errori',JSON.stringify(errs));await ctx.close();}
await browser.close();
