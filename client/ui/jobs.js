// Lavoro e missioni: app "Lavoro" nel telefono, indicatore della consegna con freccia e tempo, avvisi di paga e livello.
import {rpCard} from './rp.js';import {bizCard} from './biz.js';
export function installJobs({api,net,notify,modal,button,getMe,renderer}){
 // Elemento: tag, classe, testo.
 const mk=(t,c,x)=>{const e=document.createElement(t);if(c)e.className=c;if(x!==undefined)e.textContent=x;return e;};
 const hud=document.createElement('div');hud.id='job-hud';hud.hidden=true;hud.setAttribute('aria-label','Missione attiva');hud.innerHTML='<i class="arrow" aria-hidden="true">➤</i><div class="job-hud-copy"><b></b><small></small></div><button type="button" class="job-hud-open" aria-label="Apri missioni e lavori">›</button>';document.body.append(hud);
 const fmt=ms=>{const s=Math.max(0,Math.round(ms/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0');};
 // Indicatore: destinazione, distanza, tempo per il bonus e freccia che punta nella direzione giusta sullo schermo.
 hud.querySelector('.job-hud-open').addEventListener('click',()=>open());
 let hudMode='';
 setInterval(()=>{const me=getMe(),j=me?.job,gameVisible=document.body.classList.contains('is3d')&&!document.getElementById('hud')?.hidden;if(!me||!gameVisible){hud.hidden=true;renderer.jobTarget=null;return;}hud.hidden=false;
  if(!j||me.room!=='lungomare'){renderer.jobTarget=null;hud.classList.remove('late','active-job');if(hudMode!=='available'){hud.querySelector('b').textContent='Missioni';hud.querySelector('small').textContent='Apri per lavori e obiettivi di oggi';hud.querySelector('.arrow').textContent='!';hud.querySelector('.arrow').style.transform='none';hudMode='available';}return;}
  renderer.jobTarget=j;hud.classList.add('active-job');hudMode='active';
  const dx=j.x-me.x,dy=j.y-me.y,d=Math.hypot(dx,dy),sx=(dx-dy),sy=(dx+dy)/2,left=j.deadline-Date.now();
  hud.querySelector('b').textContent='Consegna · '+j.name;hud.querySelector('small').textContent=Math.round(d)+' m · '+(left>0?'bonus '+fmt(left):'paga normale')+' · '+j.reward+' 🪙';
  hud.querySelector('.arrow').textContent='➤';hud.querySelector('.arrow').style.transform='rotate('+Math.atan2(sy,sx)+'rad)';hud.classList.toggle('late',left<=0);},250);
 net.addEventListener('jobDone',e=>{const m=e.detail;notify('✅ Consegna a '+m.place+' completata: +'+m.coins+' 🪙'+(m.fast?' (bonus veloce!)':''));document.dispatchEvent(new CustomEvent('humana:wallet'));});
 net.addEventListener('levelUp',e=>{notify('⭐ Livello '+e.detail.level+'! Premio: +'+e.detail.coins+' 🪙');document.dispatchEvent(new CustomEvent('humana:wallet'));});
 async function open(){const box=modal('💼 Lavoro e missioni');box.append(mk('p','muted','Caricamento…'));let v;try{v=await api('/jobs');}catch(e){box.replaceChildren(mk('p',null,e.message));return;}paint(box,v);}
 function paint(box,v){box.replaceChildren();box.append(rpCard({api,notify,button,net}));box.append(bizCard({api,notify,button}));
  const job=mk('section','job-card');job.append(mk('h3',null,'🛵 Rider · consegne'));
  if(v.job){job.append(mk('p',null,'In corso: porta il pacco a '+v.job.name+'. Segui la freccia in alto.'));job.append(button('Annulla consegna',async()=>paint(box,await api('/jobs/cancel','POST',{}))));}
  else{job.append(mk('p','muted','Ritira un pacco e consegnalo in città. Più arrivi in fretta, più guadagni: usa monopattino, scooter o auto!'));job.append(button('📦 Prendi una consegna',async()=>{try{const r=await api('/jobs/start','POST',{});notify('📦 Consegna a '+r.job.name+' · '+r.job.reward+' 🪙');paint(box,r);}catch(e){notify(e.message);}}));}
  const ms=mk('section','job-card');ms.append(mk('h3',null,'🎯 Missioni di oggi'));
  for(const m of v.missions){const row=mk('div','mission'+(m.claimed?' claimed':''));const bar=mk('i');bar.style.width=Math.round(m.progress/m.goal*100)+'%';const track=mk('span','track');track.append(bar);
   row.append(mk('b',null,m.name),track,mk('small',null,m.progress+' / '+m.goal+' · premio '+m.reward+' 🪙'));
   if(m.claimed)row.append(mk('small','ok','✔ Riscosso'));else if(m.done)row.append(button('Riscuoti '+m.reward+' 🪙',async()=>{try{paint(box,await api('/jobs/claim/'+m.id,'POST',{}));document.dispatchEvent(new CustomEvent('humana:wallet'));notify('🎉 +'+m.reward+' 🪙');}catch(e){notify(e.message);}}));
   ms.append(row);}
   box.append(job,ms,mk('p','muted','Ogni nuovo livello ti regala 50 🪙. Le missioni si rinnovano a mezzanotte.'));}
 return {open};
}
