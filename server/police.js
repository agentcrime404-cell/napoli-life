// Polizia di HUMANA life 3D: chi prende senza pagare può essere visto da un agente (si viene «ricercati» per qualche secondo) e finisce in cella per un minuto.
// Qui c'è anche l'elenco delle auto comprate e lasciate parcheggiate: restano dove le hai lasciate, anche dopo l'uscita dal gioco.
import {POLICE,PRISON,policeGeom,prisonCell,CAR_BASES,VEHICLE} from '../shared/catalog.js';
import {state} from './storage.js';
import {MAPS} from '../shared/world.js';
export class Police{
 constructor(game){this.game=game;}
 nearest(p){return [...POLICE].sort((a,b)=>Math.hypot(a.x-p.x,a.y-p.y)-Math.hypot(b.x-p.x,b.y-p.y))[0];}
 // Ricercato e cella restano salvati: uscire e rientrare non li cancella.
 save(p){if(!this.game.db)return;try{const g=state(this.game.db,p.id).progress;if(p.jail)g.jail={until:p.jail.until,t0:p.jail.t0,station:p.jail.station,name:p.jail.name};else delete g.jail;if(p.wanted)g.wanted={...p.wanted};else delete g.wanted;this.game.db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(g),p.id);}catch(e){console.warn('police.save',e.message);}}
 tell(p,message){this.game.send(p.ws,{type:'notification',message});}
 crime(p,amount){if(!p||p.jail)return;const now=Date.now(),st=this.nearest(p);
  if(p.wanted){this.tell(p,'🚨 Stai già rubando: gli agenti ti cercano!');return;}
  const caught=Math.random()<PRISON.catch,delay=PRISON.delay[0]+Math.random()*(PRISON.delay[1]-PRISON.delay[0]);
  p.wanted={t0:now,until:now+delay*1000,caught,station:st.id,value:Math.round(amount),x:p.x,y:p.y,room:p.room};this.save(p);this.tell(p,'🚨 Hai preso senza pagare! Scappa: allontanati di '+PRISON.escape+' metri per seminare la polizia…');this.game.rp?.alert(p);}
 // Mette il giocatore in cella (dentro la caserma più vicina); l'auto di proprietà resta parcheggiata dove si trovava.
 arrest(p){const now=Date.now(),st=POLICE.find(c=>c.id===p.wanted?.station)||this.nearest(p);
  this.game.releaseStreetVehicle?.(p);this.game.rp?.endTaxi?.(p);this.game.living?.parkCar(p);this.game.arena?.leave(p);p.wanted=null;p.vehicle=null;p.seat=null;p.passenger=null;p.music=null;p.ride=null;p.rideArt=null;p.rideA=null;p.call&&this.game.hangup?.(p,'arrested');try{const g=state(this.game.db,p.id).progress;g.activeVehicle=null;this.game.db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(g),p.id);}catch{}p.fueling=null;p.consuming=null;p.from=null;p.room='lungomare';
  const c=prisonCell(st);p.x=c.x;p.y=c.y;p.input={x:0,y:0};p.vel=0;p.jail={t0:now,until:now+PRISON.seconds*1000,station:st.id,name:st.name};
  this.save(p);this.tell(p,'🚔 Ti hanno beccato! Un minuto in prigione…');}
 release(p){const st=POLICE.find(c=>c.id===p.jail?.station)||POLICE[0],d=policeGeom(st).door;p.jail=null;p.room='lungomare';p.from=null;p.x=d.x;p.y=d.y+1.4;/* Dal Lungomare non c'è modo di tornare a Mergellina: se esiste, si esce lì. */if(MAPS.mergellina){p.room='mergellina';Object.assign(p,MAPS.mergellina.spawn);}p.input={x:0,y:0};this.save(p);this.tell(p,'👮 Un agente è venuto a liberarti. Comportati bene!');}
 loadCars(p){const g=state(this.game.db,p.id).progress;p.myCars=Object.entries(g.parked||{}).filter(([v])=>(g.vehicles||[]).includes(v)||(g.rentals?.[v]||0)>Date.now()).map(([v,c])=>({v,x:c.x,y:c.y,h:c.h,room:c.room||'lungomare'}));}
 // Al rientro nel gioco: se c'era una cella o una ricerca in corso si riprende da dove era (chi è scappato mentre lo cercavano viene arrestato).
 resume(p){const g=state(this.game.db,p.id).progress,now=Date.now();if(g.jail&&g.jail.until>now){const st=POLICE.find(c=>c.id===g.jail.station)||POLICE[0],c=prisonCell(st);p.room='lungomare';p.from=null;p.vehicle=null;p.x=c.x;p.y=c.y;p.jail={...g.jail};}else if(g.jail){p.jail=null;this.save(p);}
  else if(g.wanted){p.wanted={...g.wanted};if(p.wanted.until<=now&&p.wanted.caught)this.arrest(p);else if(p.wanted.until<=now){p.wanted=null;this.save(p);}}}
 // Fine ricerca: se gli agenti giocatori non ti hanno preso vale comunque la regola normale (visto e non scappato = cella), così un agente fermo non rende impuniti i furti.
 tick(p){const now=Date.now();if(p.myCars===undefined){this.loadCars(p);this.resume(p);}
  if(p.jail){p.input={x:0,y:0};p.vel=0;p.vehicle=null;p.ride=null;p.seat=null;if(p.room!=='lungomare'){const c=prisonCell(POLICE.find(q=>q.id===p.jail.station)||POLICE[0]);p.room='lungomare';p.from=null;p.x=c.x;p.y=c.y;}if(now>=p.jail.until)this.release(p);return;}
  if(p.wanted&&now>=p.wanted.until){const w=p.wanted,fled=w.x!=null&&(w.room!==p.room||Math.hypot(p.x-w.x,p.y-w.y)>=PRISON.escape);if(w.caught&&!fled)this.arrest(p);else if(fled&&w.caught){p.wanted=null;this.save(p);this.tell(p,'🏍️ Li hai seminati! Sei scappato in tempo.');}else{p.wanted=null;this.save(p);this.tell(p,'😮‍💨 Nessuno ti ha visto: l’hai fatta franca…');}}}
}
export const isCar=id=>CAR_BASES.includes(VEHICLE[id]?.base||id);
