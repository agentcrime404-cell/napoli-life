// Rapine in stile server FiveM: dentro un locale si «rapina la cassa» e bisogna restare dentro fino alla fine del conto alla rovescia.
// Allarme alla polizia dei giocatori (che può arrivare e arrestare), bottino in monete, poi si scappa con le stesse regole dei furti:
// chi esce dal locale in tempo semina gli agenti del gioco. Tutto deciso dal server; p.heist viaggia agli altri come gli altri campi del giocatore.
import {HEISTS,HEIST_TIERS,PRISON,RP} from '../shared/catalog.js';
import {MAPS,doors} from '../shared/world.js';
const fail=(message,status=400)=>{throw Object.assign(new Error(message),{status});};
export class Heists{
 constructor(game){this.game=game;this.ready=new Map();}
 tell(p,message){if(p?.ws)this.game.send(p.ws,{type:'notification',message});}
 cops(p){return (this.game.rp?.cops?.()||[]).filter(c=>c.id!==p.id);}
 // Nome del posto per l'allarme: a Mergellina la porta da cui si è entrati (es. «Chalet Ciro (Mergellina)»), altrimenti il nome del locale.
 place(p){const base=MAPS[p.room]?.name||p.room,f=p.from;if(f?.room!=='mergellina')return base;let best=null,bd=6;
  for(const d of doors('mergellina')){if(d.to!==p.room)continue;const k=Math.hypot((d.exitX??d.x)-f.x,(d.exitY??d.y)-f.y);if(k<bd){bd=k;best=d;}}return best?best.name+' (Mergellina)':base;}
 start(p){const T=HEIST_TIERS[HEISTS[p.room]];if(!T)fail('Qui non c’è niente da rapinare');
  if(p.jail)fail('Sei in prigione');if(p.heist)fail('Stai già rapinando');if(p.wanted)fail('Hai già la polizia alle calcagna: aspetta che si calmino le acque');
  if(p.work==='polizia'&&p.duty)fail('Sei un agente in servizio!');if(p.vehicle||p.seat)fail('Scendi prima dal mezzo');
  const now=Date.now(),ready=this.ready.get(p.room)||0;if(ready>now)fail('Qui hanno appena rapinato: riprova tra '+Math.ceil((ready-now)/60000)+' minuti');
  this.ready.set(p.room,now+T.cool*1000);
  const loot=Math.round(T.loot[0]+Math.random()*(T.loot[1]-T.loot[0])),name=this.place(p),cops=this.cops(p);
  p.heist={room:p.room,name,t0:now,until:now+T.sec*1000,loot};
  // Con agenti giocatori in servizio si è ricercati da subito (possono arrestare durante il colpo) e gli agenti del gioco non intervengono.
  if(cops.length){const st=this.game.police.nearest(p);p.wanted={t0:now,until:now+(T.sec+RP.chase)*1000,/* se gli agenti giocatori non arrestano, alla fine vale la regola normale (police.tick) */caught:Math.random()<PRISON.catch,station:st.id,value:loot,x:p.x,y:p.y,room:p.room,cops:true};this.game.police.save(p);
   for(const c of cops)this.tell(c,'🚨 Centrale: RAPINA in corso a '+name+'! '+p.username+' è ricercato. Hai '+T.sec+' secondi: corri!');}
  for(const q of this.game.players.values())if(q!==p&&q.room===p.room)this.tell(q,'😱 Rapina! '+p.username+' sta svuotando '+T.label+'!');
  this.tell(p,'💰 Rapina iniziata: resta dentro per '+T.sec+' secondi'+(cops.length?'. La polizia è stata avvisata!':'!'));return p.heist;}
 tick(p){const h=p.heist;if(!h)return;if(p.jail){p.heist=null;return;}
  if(p.room!==h.room){p.heist=null;this.tell(p,'❌ Rapina fallita: sei uscito prima di prendere i soldi');return;}
  const now=Date.now();if(now<h.until)return;p.heist=null;
  this.game.db.prepare('UPDATE player_state SET balance=balance+? WHERE user_id=?').run(h.loot,p.id);this.game.gangs?.loot(p,h.loot);this.game.send(p.ws,{type:'wallet'});
  if(p.wanted?.cops){p.wanted.until=Math.max(p.wanted.until,now+RP.chase*1000);this.game.police.save(p);for(const c of this.cops(p))this.tell(c,'🚨 Centrale: '+p.username+' è scappato con il bottino da '+h.name+'!');}
  else{const st=this.game.police.nearest(p),d=PRISON.delay[0]+Math.random()*(PRISON.delay[1]-PRISON.delay[0]);p.wanted={t0:now,until:now+d*1000,caught:Math.random()<PRISON.catch,station:st.id,value:h.loot,x:p.x,y:p.y,room:p.room};this.game.police.save(p);}
  this.tell(p,'💰 Colpo riuscito: +'+h.loot+' 🪙! Ora scappa: esci dal locale prima che arrivi la polizia!');}
 route(path,method,p,b){if(!p)fail('Entra prima nel gioco');
  if(path==='/api/heist/start'&&method==='POST')return {heist:this.start(p)};
  return undefined;}
}
