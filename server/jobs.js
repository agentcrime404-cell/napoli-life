// Giocabilità: lavoro di consegne (rider), missioni giornaliere e premi di livello. Tutto verificato dal server.
import {MAPS,canStand,distance,doors} from '../shared/world.js';
import {state} from './storage.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
const today=()=>new Date().toISOString().slice(0,10);
export const DAILY=[{id:'walk',name:'Cammina 500 metri',goal:500,reward:60},{id:'deliver',name:'Completa 3 consegne',goal:3,reward:150},{id:'visit',name:'Entra in 3 locali diversi',goal:3,reward:50},{id:'service',name:'Resta in servizio 5 minuti',goal:300,reward:100}];
export const LEVEL_REWARD=50;
export class Jobs{
 constructor(db,game){this.db=db;this.game=game;}
 save(id,progress){this.db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(progress),id);}
 pay(id,coins){this.db.prepare('UPDATE player_state SET balance=balance+? WHERE user_id=?').run(coins,id);}
 // Giornata corrente: si azzera a mezzanotte; i metri si contano dall'esperienza (che cresce solo camminando).
 daily(id){const s=state(this.db,id),pr=s.progress;if(pr.daily?.date!==today()){pr.daily={date:today(),xp0:pr.xp||0,deliver:0,visits:[],service:0,claimed:[]};this.save(id,pr);}return {pr,d:pr.daily};}
 view(id){const {pr,d}=this.daily(id),p=this.game.players.get(id),walk=Math.floor((pr.xp||0)+(p?.travel||0)-d.xp0);
  const value={walk,deliver:d.deliver,visit:d.visits.length,service:Math.floor(d.service||0)};
  return {missions:DAILY.map(m=>({...m,progress:Math.min(m.goal,value[m.id]),done:value[m.id]>=m.goal,claimed:d.claimed.includes(m.id)})),job:p?.job?{name:p.job.name,x:p.job.x,y:p.job.y,reward:p.job.reward,deadline:p.job.deadline}:null,level:1+Math.floor((pr.xp||0)/100),balance:state(this.db,id).balance};}
 claim(id,mid){const m=DAILY.find(x=>x.id===mid);if(!m)fail('Missione sconosciuta');const v=this.view(id).missions.find(x=>x.id===mid);if(!v.done)fail('Missione non ancora completata');if(v.claimed)fail('Premio già riscosso');
  const {pr}=this.daily(id);pr.daily.claimed.push(mid);this.save(id,pr);this.pay(id,m.reward);return this.view(id);}
 // Consegna: destinazione casuale raggiungibile a 25-110 m, paga base + bonus se arrivi in fretta.
 // Si lavora all'aperto sia sul Lungomare sia a Mergellina (dove si gioca di solito): le destinazioni sono le porte della zona.
 start(id){const p=this.game.players.get(id),room=p?.room;if(!p||(room!=='lungomare'&&room!=='mergellina'))fail('Esci all’aperto per lavorare');if(p.job)fail('Hai già una consegna in corso');
  const places=[...doors(room).map(d=>({name:d.name,x:d.x,y:d.y}))].filter(t=>{const dd=distance(t,p);return dd>25&&dd<110&&canStand(room,t.x,t.y,.3);});
  if(!places.length)fail('Nessuna consegna disponibile qui vicino');const t=places[Math.floor(Math.random()*places.length)],dist=distance(t,p);
  p.job={name:t.name,room,x:t.x,y:t.y,started:Date.now(),deadline:Date.now()+Math.round(dist/2.5*1000+30000),reward:Math.round(20+dist*.8)};return this.view(id);}
 cancel(id){const p=this.game.players.get(id);if(p)p.job=null;return this.view(id);}
 // Il tempo in servizio si accumula in memoria e si scrive ogni secondo: rileggendo dal DB a ogni tick gli incrementi non salvati andavano persi.
 service(p,dt){if(!p?.duty||!p.work||!Number.isFinite(dt)||dt<=0)return;p.serviceAcc=(p.serviceAcc||0)+dt;if(p.serviceAcc<1)return;const {pr,d}=this.daily(p.id);d.service=(d.service||0)+p.serviceAcc;p.serviceAcc=0;this.save(p.id,pr);}
 // Chiamato dal ciclo di gioco: consegna completata quando arrivi a destinazione.
 tick(p){if(!p.job||p.room!==(p.job.room||'lungomare')||distance(p,p.job)>2.6)return;const j=p.job;p.job=null;const fast=Date.now()<=j.deadline,coins=j.reward+(fast?Math.round(j.reward*.5):0);
  this.pay(p.id,coins);const {pr}=this.daily(p.id);pr.daily.deliver++;this.save(p.id,pr);this.game.send(p.ws,{type:'jobDone',coins,fast,place:j.name});}
 visit(p,room){if(!room||room==='lungomare'||room.startsWith('home:'))return;const {pr}=this.daily(p.id);if(!pr.daily.visits.includes(room)){pr.daily.visits.push(room);this.save(p.id,pr);}}
 // Premio di livello: 50 monete per ogni livello nuovo raggiunto.
 level(p){const s=state(this.db,p.id),pr=s.progress,lvl=1+Math.floor(((pr.xp||0)+(p.travel||0))/100);if(!pr.levelPaid){pr.levelPaid=lvl;this.save(p.id,pr);return;}
  if(lvl>pr.levelPaid){const coins=(lvl-pr.levelPaid)*LEVEL_REWARD;pr.levelPaid=lvl;this.save(p.id,pr);this.pay(p.id,coins);this.game.send(p.ws,{type:'levelUp',level:lvl,coins});}}
 route(path,method,user){const id=user.id;
  if(path==='/api/jobs'&&method==='GET')return this.view(id);
  if(path==='/api/jobs/start'&&method==='POST')return this.start(id);
  if(path==='/api/jobs/cancel'&&method==='POST')return this.cancel(id);
  if(path.startsWith('/api/jobs/claim/')&&method==='POST')return this.claim(id,path.slice(16));}
}
