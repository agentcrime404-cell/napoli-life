import {restore,savePlayer,ensureState,state} from './storage.js';
import {MAPS,doors,distance,step,canStand,parkedVehicleOf,VEHICLE_INTERACTION_RANGE,registerPersonalVilla} from '../shared/world.js';
import {napoliParkedVehicles} from '../shared/napoli.js';
import {BUS_STOPS,ROUTE_LENGTH,routeDistance,routePoint} from '../shared/district.js';
import {publicUser,resolve} from './auth.js';
import {VEHICLE} from '../shared/catalog.js';
import {removeLegacyCrimeProgress,SOCIAL_LIFE_MODE} from '../shared/social-mode.js';
export class Game{
 constructor(db){this.db=db;this.players=new Map();this.clock=setInterval(()=>this.tick(),50);this.frames=0;this.auth=new WeakMap();this.jukebox=new Map();this.streetVehicleStates=new Map();}
 streetVehicleState(id){return this.streetVehicleStates.get(id);}
 parkStreetVehicle(p,occupied){const id=p?.streetVehicleId;if(!id)return null;const state={id,/* mai un tipo nullo: se il guidatore l'ha già perso si tiene quello di prima */v:p.vehicle||this.streetVehicleStates.get(id)?.v||null,x:p.x,y:p.y,rot:Number.isFinite(p.heading)?p.heading:p.direction||0,occupied:!!occupied,room:p.room};this.streetVehicleStates.set(id,state);return state;}
 // Il mezzo di strada guidato torna libero dov'è (con il suo tipo) e il giocatore resta a piedi: arresto, svenimento, Scendi, noleggio, nuova sessione.
 releaseStreetVehicle(p){if(p?.vehicleSource!=='street')return;if(p.streetVehicleId)this.parkStreetVehicle(p,false);p.vehicle=null;p.vehicleSource=null;p.streetVehicleId=null;p.vehicleOwner=null;p.vehicleLocked=false;}
 streetVehiclesFor(viewer){if(viewer?.room!=='mergellina'||!this.streetVehicleStates.size)return [];return [...this.streetVehicleStates.values()].filter(v=>v.room==='mergellina'&&(v.occupied||distance(v,viewer)<180)).map(v=>({...v}));}
 blocked(a,b){return !!this.db.prepare('SELECT 1 FROM blocks WHERE (owner=? AND target=?) OR (owner=? AND target=?)').get(a,b,b,a);}
 send(ws,m){if(ws.readyState===1&&ws.bufferedAmount<256000)ws.send(JSON.stringify(m));}
 connect(ws){
  ws.alive=true;ws.on('pong',()=>ws.alive=true);ws.on('error',()=>ws.close());
  let player=null,count=0;let epoch=Date.now();
  const timer=setTimeout(()=>{if(!player)ws.close(4001,'Login richiesto');},5000);
  ws.on('message',buffer=>{try{
   if(Date.now()-epoch>1000){count=0;epoch=Date.now();}if(++count>70)return ws.close(4008,'Troppe richieste');
   const m=JSON.parse(buffer.toString());
   if(!player){
    if(m.type!=='auth')return;const user=resolve(this.db,m.token);if(!user)return ws.close(4001,'Sessione scaduta');
    const previous=this.players.get(user.id);if(previous){const other=this.auth.get(previous)?.token!==m.token;if(previous.call)this.hangup(previous,'offline');this.releaseStreetVehicle(previous);this.rp?.endTaxi(previous);if(previous.fueling){/* benzina già pagata: il pieno si completa */previous.fueling.until=0;this.fuel?.tick(previous,0);}savePlayer(this.db,previous);this.players.delete(user.id);previous.ws.close(4011,other?'Accesso da un altro dispositivo':'Sessione ripresa');}
    ensureState(this.db,user.id);if(this.socialMode===SOCIAL_LIFE_MODE){const progress=state(this.db,user.id).progress,clean=removeLegacyCrimeProgress(progress);if(clean.changed)this.db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(clean.progress),user.id);}this.living?.homeMap(user.id);const saved=JSON.parse(this.db.prepare('SELECT position FROM player_state WHERE user_id=?').get(user.id).position);if(saved.room===`villa:${user.id}`)registerPersonalVilla(user.id);if(saved.room?.startsWith('home:')&&this.living?.homeAllowed(saved.room.slice(5),user.id))this.living.homeMap(saved.room.slice(5));
    if(this.players.size>=32)return ws.close(4010,'Server pieno');
    player={...publicUser(user),...restore(this.db,user.id),ws,input:{x:0,y:0},lastInput:Date.now(),lastChat:0,voice:false,seat:null,moving:false};// Tutti (anche chi giocava già) ripartono da Mergellina la prima volta dopo l'aggiornamento: il Lungomare di fantasia si raggiunge dal bottone 🗺️.
     if(MAPS.mergellina){try{const pr=state(this.db,user.id).progress;const first=!pr.start4;pr.start4=1;pr.start3=1;this.db.prepare('UPDATE player_state SET progress=? WHERE user_id=?').run(JSON.stringify(pr),user.id);if(first||(player.room!=='mergellina'&&player.room!==`villa:${user.id}`)){player.room='mergellina';Object.assign(player,MAPS.mergellina.spawn);player.direction=-Math.PI/2;}}catch(e){console.warn('start3',e.message);}}
    if(this.living&&player.room==='lungomare'){player.vehicle=this.living.lastVehicle(user.id);if(player.vehicle){player.vehicleOwner=user.id;player.vehicleLocked=state(this.db,user.id).progress.vehicleLocked===true;}}
    if(player.room.startsWith('home:')&&!this.living?.homeAllowed(player.room.slice(5),player.id))Object.assign(player,{room:'lungomare',...MAPS.lungomare.spawn});
     this.auth.set(player,{token:m.token,checked:Date.now()});this.players.set(user.id,player);clearTimeout(timer);this.send(ws,{type:'welcome',id:user.id});if(this.mapDoc)this.send(ws,{type:'mapEdits',doc:this.mapDoc});return;
   }
   if(m.type==='ping')this.send(ws,{type:'pong',time:m.time});
   if(m.type==='input'){
    // A terra, in cella, al rifornimento o al bancone non ci si muove (né col joystick né con la posizione prevista).
    if(player.down||player.fueling||player.consuming){player.input={x:0,y:0};player.lastInput=Date.now();return;}
    player.input={x:Math.max(-1,Math.min(1,Number(m.x)||0)),y:Math.max(-1,Math.min(1,Number(m.y)||0)),run:m.run===true,rev:m.rev===true,drive:m.drive===true,steer:Math.max(-1,Math.min(1,Number(m.steer)||0)),throttle:Math.max(0,Math.min(1,Number(m.throttle)||0)),brake:Math.max(0,Math.min(1,Number(m.brake)||0))};player.lastInput=Date.now();
    // Posizione prevista dal client accettata solo se vicina a quella del server e libera: elimina il rimbalzo senza permettere teletrasporti.
    // Le correzioni hanno un "credito" di metri che si ricarica con il tempo alla velocità massima del momento (corsa o mezzo): niente velocità ×8 mandando messaggi a raffica.
    const now=Date.now(),mv=(player.room==='lungomare'||player.room==='mergellina')&&VEHICLE[player.vehicle],rate=(mv?7.5*(mv.speed||1):4.4)*1.25;player.posBudget=Math.min(.75,(player.posBudget??.75)+rate*Math.max(0,now-(player.posAt??now))/1000);player.posAt=now;
    const q=m.position,gap=q?Math.hypot(q.x-player.x,q.y-player.y):Infinity;if(q&&!player.seat&&Number.isFinite(q.x)&&Number.isFinite(q.y)&&gap<=.75&&gap<=player.posBudget&&canStand(player.room,q.x,q.y)){player.x=q.x;player.y=q.y;player.posBudget-=gap;}}
   if(m.type==='interact')this.interact(player,m);
   if(m.type==='horn'&&player.vehicle&&Date.now()-(player.hornAt||0)>450)player.hornAt=Date.now();
   if(m.type==='jump'&&!player.vehicle&&!player.seat&&!player.down&&Date.now()-(player.jumpAt||0)>=850){player.jumpAt=Date.now();player.jumpUntil=player.jumpAt+620;}
   if(m.type==='vehicleLights'&&player.vehicle&&!player.seat&&Date.now()-(player.lightsAt||0)>=180){const kind=VEHICLE[player.vehicle]?.base||player.vehicle;if(['auto','cabrio','furgone','scooter'].includes(kind)){player.lightsOn=!player.lightsOn;player.lightsAt=Date.now();}}
   if(m.type==='travel'&&!player.down&&MAPS.mergellina&&m.to==='mergellina'&&player.room==='mergellina'&&!player.seat){this.send(player.ws,{type:'notification',message:'📍 Sei già a Mergellina'});}
   // Autoradio: chi guida sceglie un video YouTube, lo sentono anche i passeggeri.
   if(m.type==='carMusic'&&player.vehicle){const id=typeof m.id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(m.id)?m.id:null;player.music=id;player.musicAt=Date.now();player.musicTitle=id?String(m.title||'').slice(0,80):'';}
   if(m.type==='call')this.call(player,m);
   if(m.type==='bus'&&!player.down){const from=BUS_STOPS.find(s=>distance(s,player)<2.4),to=BUS_STOPS.find(s=>s.id===m.to);
    if(player.room!=='lungomare'||!from||!to||to===from||player.seat){this.send(ws,{type:'error',message:'Raggiungi una fermata e scegli un’altra destinazione'});return;}
    // Durante il viaggio il giocatore resta fermo alla fermata, poi scende a destinazione.
    // Il giocatore sale e viaggia davvero lungo le strade: la sua posizione segue l'autobus fino alla fermata.
    const s0=routeDistance(from.at),dist=((routeDistance(to.at)-s0)%ROUTE_LENGTH+ROUTE_LENGTH)%ROUTE_LENGTH;
    Object.assign(player,{seat:'bus',input:{x:0,y:0},ride:{s0,dist,t0:Date.now(),duration:dist/12*1000+800,to}},routePoint(s0));this.send(ws,{type:'notification',message:`🚌 In viaggio verso ${to.name}…`});}
   if(m.type==='chat'&&Date.now()-player.lastChat>600){
    const text=String(m.text||'').trim().slice(0,300);if(!text)return;player.lastChat=Date.now();
    this.db.prepare('INSERT INTO messages(sender,room,text,created) VALUES(?,?,?,?)').run(player.id,player.room,text,Date.now());
    for(const p of this.players.values())if(p.room===player.room&&!this.blocked(p.id,player.id))this.send(p.ws,{type:'chat',id:player.id,username:player.username,text});
   }
   if(m.type==='emote'&&['👋','❤️','🎉','💃','😂','👏'].includes(m.value)){player.emote=m.value;player.emoteUntil=Date.now()+4000;player.action=({'👋':'WAVE','💃':'DANCE','😂':'LAUGH','👏':'CLAP'})[m.value]||'IDLE';}
   if(m.type==='voice'){player.voice=m.enabled===true;player.talking=m.talking===true&&player.voice;}
   if(m.type==='signal'){
    const to=this.players.get(m.to);if(!to||!player.voice||!to.voice||to.room!==player.room||distance(to,player)>15||this.blocked(to.id,player.id))return;
    if(m.description&&['offer','answer'].includes(m.description.type)&&typeof m.description.sdp==='string'&&m.description.sdp.length<16000)this.send(to.ws,{type:'signal',from:player.id,description:m.description});
    if(m.candidate&&JSON.stringify(m.candidate).length<3000)this.send(to.ws,{type:'signal',from:player.id,candidate:m.candidate});
   }
  }catch{this.send(ws,{type:'error',message:'Richiesta non valida'});}});
  ws.on('close',()=>{clearTimeout(timer);if(player&&this.players.get(player.id)===player){this.releaseStreetVehicle(player);/* chi si scollega in taxi paga la corsa; la benzina già pagata si completa */this.rp?.endTaxi(player);if(player.fueling){player.fueling.until=0;this.fuel?.tick(player,0);}if(!this.stopping)savePlayer(this.db,player);this.hangup(player,'offline');this.players.delete(player.id);}});
 }
 // Chiamate dirette tra amici: il server inoltra solo segnalazione WebRTC, l'audio va da telefono a telefono.
 call(p,m){const peer=p.call&&this.players.get(p.call.peer);
  if(m.action==='invite'){const to=this.players.get(String(m.to||''));
   if(!to||to===p)return this.send(p.ws,{type:'call',action:'end',reason:'offline'});
   if(this.blocked(to.id,p.id)||!(this.living?.friends(p.id,to.id)||this.phone?.allows(to.id,m.number)))return this.send(p.ws,{type:'call',action:'end',reason:'not-friend'});
   const number=this.phone?.numberOf(p.id);
   if(p.call||to.call)return this.send(p.ws,{type:'call',action:'end',reason:'busy'});
   p.call={peer:to.id,state:'ringing',caller:true};to.call={peer:p.id,state:'ringing',caller:false};
   this.send(to.ws,{type:'call',action:'invite',from:p.id,username:p.username,...(number?{number}:{})});
   const ring=p.call;setTimeout(()=>{if(p.call===ring&&ring.state==='ringing')this.hangup(p,'no-answer');},30000);return;}
  if(!peer||peer.call?.peer!==p.id)return;
  if(m.action==='accept'&&!p.call.caller&&p.call.state==='ringing'){p.call.state=peer.call.state='active';this.send(peer.ws,{type:'call',action:'accept',from:p.id});return;}
  if(m.action==='signal'&&p.call.state==='active'){
   if(m.description&&['offer','answer'].includes(m.description.type)&&typeof m.description.sdp==='string'&&m.description.sdp.length<16000)this.send(peer.ws,{type:'call',action:'signal',from:p.id,description:m.description});
   if(m.candidate&&JSON.stringify(m.candidate).length<3000)this.send(peer.ws,{type:'call',action:'signal',from:p.id,candidate:m.candidate});return;}
  if(m.action==='reject'||m.action==='end')this.hangup(p,m.action==='reject'?'rejected':'ended');}
 hangup(p,reason){const peer=p.call&&this.players.get(p.call.peer);p.call=null;if(peer&&peer.call?.peer===p.id){peer.call=null;this.send(peer.ws,{type:'call',action:'end',reason});}}
 interact(p,request={}){
  if(Date.now()-(p.interactedAt||0)<180)return;p.interactedAt=Date.now();if(p.down)return;
  if(p.vehicle&&p.vehicleSource==='street'&&!p.seat){const h=Number.isFinite(p.heading)?p.heading:p.direction||0;this.parkStreetVehicle(p,false);for(const side of [-1,1]){const x=p.x+Math.cos(h+side*Math.PI/2)*1.3,y=p.y+Math.sin(h+side*Math.PI/2)*1.3;if(canStand(p.room,x,y)){p.x=x;p.y=y;break;}}p.vehicle=null;p.vehicleSource=null;p.streetVehicleId=null;p.vehicleOwner=null;p.vehicleLocked=false;p.vel=0;p.input={x:0,y:0,run:false};this.send(p.ws,{type:'notification',message:'Sei sceso dal veicolo'});return;}
  if(p.ride)return;if(p.seat==='car'){const d=this.players.get(p.passenger);p.seat=null;p.passenger=null;p.passengerIndex=null;p.x+=.9;if(!canStand(p.room,p.x,p.y))p.x-=.9;if(d)this.send(d.ws,{type:'notification',message:'🚪 '+p.username+' è sceso'});return;}if(p.seat){p.seat=null;return;}
  const requestedVehicle=typeof request.vehicleId==='string'?request.vehicleId.slice(0,100):null,passengerIntent=request.intent==='passenger',doorIntent=request.intent==='door';
  // Un'interazione mirata deve salire sul mezzo scelto, senza sostituzioni automatiche.
  // Dopo essere scesi, il veicolo personale resta parcheggiato: se il giocatore torna vicino può risalire.
  if(!p.vehicle&&!requestedVehicle&&!passengerIntent&&!doorIntent){const v=this.living?.enterNearbyParked(p);if(v){this.send(p.ws,{type:'notification',message:'🚗 Sei risalito sul tuo veicolo'});return;}}
  // Tutti i mezzi fermi sulla strada sono utilizzabili: auto, scooter e moto.
  if(!p.vehicle&&!passengerIntent&&!doorIntent){
   // I veicoli possono arrivare sia dagli oggetti della mappa 2D sia dalla
   // lista di mezzi generata dalla scena reale di Mergellina.
   const props=MAPS[p.room]?.props||[],generated=p.room==='mergellina'?napoliParkedVehicles().map(o=>({...o,...(this.streetVehicleState(o.id)||{})})):[];
   const occupied=new Set([...this.players.values()].filter(player=>player!==p&&player.vehicle&&player.vehicleSource==='street'&&player.streetVehicleId).map(player=>player.streetVehicleId));
   const candidates=[...props,...generated],q=requestedVehicle?candidates.find(o=>o.id===requestedVehicle):candidates.find(o=>!occupied.has(o.id)&&!this.streetVehicleState(o.id)?.occupied&&parkedVehicleOf(o)&&distance(o,p)<VEHICLE_INTERACTION_RANGE),v=q&&parkedVehicleOf(q);
   // Il client mostra la posizione locale interpolata, mentre questa verifica
   // usa quella autorevole del server. Un piccolo margine evita che l'HUD mostri
   // «Sali» e che il server rifiuti lo stesso tocco per il ritardo di rete.
   const requestedVehicleRange=VEHICLE_INTERACTION_RANGE+1.5;
   if(requestedVehicle&&(!q||occupied.has(q.id)||this.streetVehicleState(q.id)?.occupied||!v||!VEHICLE[v]||distance(q,p)>=requestedVehicleRange)){this.send(p.ws,{type:'notification',message:'Avvicinati al veicolo scelto: non è più disponibile o è troppo lontano'});return;}
    if(v&&VEHICLE[v]){p.vehicle=v;p.vehicleSource='street';p.streetVehicleId=q.id;p.vehicleOwner=null;p.vehicleLocked=false;p.x=Number.isFinite(q.x)?q.x:p.x;p.y=Number.isFinite(q.y)?q.y:p.y;p.heading=Number.isFinite(q.rot)?q.rot:p.direction||0;p.direction=p.heading;p.vel=0;p.input={x:0,y:0,run:false,drive:true,steer:0,throttle:0,brake:0};if(p.room==='mergellina')this.parkStreetVehicle(p,true);this.send(p.ws,{type:'notification',message:'🏍️ Hai preso il veicolo fermo'});return;}
  }
  // Passeggero: sali sul veicolo di un altro giocatore vicino (se c'è posto).
  if(!p.vehicle&&!doorIntent){const SEATS={auto:3,furgone:2,cabrio:1,scooter:1},wantedDriver=typeof request.playerId==='string'?request.playerId:null;const d=[...this.players.values()].find(d=>d!==p&&(!wantedDriver||d.id===wantedDriver)&&d.room===p.room&&d.vehicle&&SEATS[VEHICLE[d.vehicle]?.base||d.vehicle]&&distance(d,p)<2.6&&!this.blocked(d.id,p.id));
   if(passengerIntent&&!d){this.send(p.ws,{type:'notification',message:'Avvicinati al giocatore e al suo veicolo per salire come passeggero'});return;}
   if(d){if(d.vehicleOwner===d.id&&d.vehicleLocked&&p.id!==d.id){this.send(p.ws,{type:'notification',message:'🔒 Veicolo chiuso: puoi salire solo come passeggero'});}const aboard=[...this.players.values()].filter(q=>q.passenger===d.id),used=aboard.length;if(used>=SEATS[VEHICLE[d.vehicle]?.base||d.vehicle]){this.send(p.ws,{type:'notification',message:'Il veicolo è pieno'});return;}/* primo sedile libero, non il numero di passeggeri */const taken=new Set(aboard.map(q=>q.passengerIndex));let seatIndex=0;while(taken.has(seatIndex))seatIndex++;Object.assign(p,{seat:'car',passenger:d.id,passengerIndex:seatIndex,input:{x:0,y:0}});this.send(p.ws,{type:'notification',message:'🚗 Sei passeggero di '+d.username+' · premi di nuovo per scendere'});this.send(d.ws,{type:'notification',message:'🚗 '+p.username+' è salito con te'});return;}}
  let door=doors(p.room).find(d=>distance(d,p)<1.65);
  if(door){
   if(door.to.startsWith('villa')&&!this.living?.villaAccess(p.id,door.to)){this.send(p.ws,{type:'villa',id:door.to,...this.living?.villaInfo(door.to,p.id)});return;}
   // Uscendo si torna davanti alla porta da cui si è entrati (Lungomare o Mergellina).
   if(door.to==='lungomare'){const back=p.from;p.from=null;if(back&&MAPS[back.room]){p.room=back.room;p.x=back.x;p.y=back.y;}else{const outside=doors('lungomare').find(d=>d.id===p.room)||MAPS.lungomare.spawn;p.room='lungomare';p.x=outside.exitX??outside.x;p.y=outside.exitY??outside.y+1;}}
   else if(door.to==='mergellina'&&p.room===`villa:${p.id}`){const back=p.villaExterior;p.room='mergellina';if(back&&Number.isFinite(back.x)&&Number.isFinite(back.y)){p.x=back.x;p.y=back.y;}else Object.assign(p,MAPS.mergellina.spawn);delete p.villaExterior;}
   else{if(p.room==='mergellina'&&door.to==='ospiti-villa'){p.villaExterior={x:door.exitX??door.x,y:door.exitY??door.y};registerPersonalVilla(p.id);door={...door,to:`villa:${p.id}`};}else p.from=p.room==='mergellina'?{room:'mergellina',x:door.exitX,y:door.exitY}:p.room!=='lungomare'?p.from:null;p.room=door.to;Object.assign(p,door.spawn||MAPS[p.room].spawn);this.jobs?.visit(p,p.room);}
   p.input={x:0,y:0};p.voice=false;p.talking=false;savePlayer(this.db,p);return;
  }
  const seat=MAPS[p.room].props.find(s=>s.kind==='seat'&&distance(s,p)<1.35);
  if(seat){if([...this.players.values()].some(q=>q.room===p.room&&q.seat===seat.id)){this.send(p.ws,{type:'error',message:'Posto occupato'});return;}p.seat=seat.id;p.x=seat.x;p.y=seat.y;p.moving=false;return;}
  this.send(p.ws,{type:'error',message:'Avvicinati a una porta o a una sedia'});
 }
  tick(){
  // Su Windows setInterval(50) scatta ogni ~62 ms: il passo usa il tempo reale, non quello nominale.
  const now=performance.now(),dt=Math.min(.1,Math.max(.01,(now-(this.lastTick??now-50))/1000));this.lastTick=now;
  for(const p of this.players.values()){
   const auth=this.auth.get(p);
   if(auth&&Date.now()-auth.checked>10000){auth.checked=Date.now();if(!resolve(this.db,auth.token)){p.ws.close(4001,'Sessione scaduta');continue;}}
   if(this.frames%200===0&&p.room.startsWith('home:')&&!this.living?.homeAllowed(p.room.slice(5),p.id))this.living.leaveHome(p);
   if(this.frames%400===399){if(!p.ws.alive){p.ws.terminate();continue;}p.ws.alive=false;p.ws.ping();}
   if(p.ride&&p.ride.pts&&p.ride.uniform){const R=p.ride,k=Math.min(1,(Date.now()-R.t0)/R.duration),n=R.pts.length-1,f=k*n,i=Math.min(n-1,Math.floor(f)),t=f-i,a=R.pts[i],b=R.pts[i+1];p.x=a.x+(b.x-a.x)*t;p.y=a.y+(b.y-a.y)*t;p.rideA=R.a0+R.da*k;p.direction=Math.atan2(b.y-a.y,b.x-a.x);if(k>=1){const to=R.to;Object.assign(p,{x:to.x,y:to.y,seat:null,ride:null,rideArt:null,rideA:null});this.send(p.ws,{type:'notification',message:R.msg||'Giro finito'});}}
   else if(p.ride&&p.ride.pts){const R=p.ride,k=Math.min(1,(Date.now()-R.t0)/R.duration);let tot=0;const L=[];for(let i=1;i<R.pts.length;i++){L.push(Math.hypot(R.pts[i].x-R.pts[i-1].x,R.pts[i].y-R.pts[i-1].y));tot+=L[i-1];}let d=tot*k,i=0;while(i<L.length-1&&d>L[i]){d-=L[i];i++;}const a=R.pts[i],b=R.pts[i+1],t=L[i]?Math.min(1,d/L[i]):0;p.x=a.x+(b.x-a.x)*t;p.y=a.y+(b.y-a.y)*t;p.direction=Math.atan2(b.y-a.y,b.x-a.x);if(k>=1){const to=R.to;Object.assign(p,{x:to.x,y:to.y,seat:null,ride:null});this.send(p.ws,{type:'notification',message:'⛵ Giro finito: sei di nuovo sul molo'});}}
   else if(p.ride){const k=Math.min(1,(Date.now()-p.ride.t0)/p.ride.duration);Object.assign(p,routePoint(p.ride.s0+p.ride.dist*k));if(k>=1){const to=p.ride.to;Object.assign(p,{x:to.x,y:to.y,seat:null,ride:null});this.send(p.ws,{type:'notification',message:`🚌 Sei arrivato: ${to.name}`});}}
   if(p.passenger){const d=this.players.get(p.passenger);if(!d||!d.vehicle||d.room!==p.room){p.seat=null;p.passenger=null;p.passengerIndex=null;}else{p.x=d.x;p.y=d.y;p.direction=d.direction;}}
   if(Date.now()-p.lastInput>300)p.input=p.vehicle&&!p.seat?{x:0,y:0,run:false,drive:true,steer:0,throttle:0,brake:0}:{x:0,y:0,run:false};if(p.vehicle&&(p.room==='lungomare'||p.room==='mergellina')&&!p.seat)p.lastOut={x:p.x,y:p.y,h:Number.isFinite(p.heading)?p.heading:p.direction||0,room:p.room,v:p.vehicle};if(p.vehicle&&((p.room!=='lungomare'&&p.room!=='mergellina')||p.seat||(this.frames%50===0&&this.living&&p.vehicleSource!=='street'&&!this.living.canUse(p.id,p.vehicle)))){if(p.vehicleSource==='street')this.releaseStreetVehicle(p);else if(p.lastOut&&p.lastOut.v===p.vehicle)this.living?.parkCar(p,p.lastOut.x,p.lastOut.y,p.lastOut.h,p.vehicle,p.lastOut.room);p.vehicle=null;p.vehicleSource=null;p.streetVehicleId=null;p.vehicleOwner=null;p.vehicleLocked=false;}if(!p.vehicle&&p.music)p.music=null;const old={x:p.x,y:p.y};step(p,p.input,dt);if(p.vehicleSource==='street'&&p.streetVehicleId)this.parkStreetVehicle(p,true);this.needs?.tick(p,dt);if(this.jobs&&p.job&&this.frames%5===0)this.jobs.tick(p);const moved=distance(old,p);/* esperienza e missioni contano solo i metri a piedi */if(!p.vehicle)p.travel=(p.travel||0)+moved;this.fuel?.tick(p,moved);this.service?.tick(p,dt);this.rp?.tick(p);this.jobs?.service(p,dt);this.biz?.tick(p);if(this.frames%100===0){if(this.jobs)this.jobs.level(p);savePlayer(this.db,p);}
   if(Date.now()>p.emoteUntil){p.emote='';p.action='IDLE';}if(!p.vehicle||p.seat)p.lightsOn=false;p.animation=p.jumpUntil>Date.now()?'JUMP':p.seat?'SIT':p.moving?(p.running?'RUN':'WALK'):p.action||'IDLE';
  }
  if(++this.frames%2)return;
  for(const viewer of this.players.values()){
   const sameRoom=[...this.players.values()].filter(p=>p.room===viewer.room&&!this.blocked(viewer.id,p.id));
   const publicMapPlayers=sameRoom.map(({id,username,room,x,y,direction,vehicle,seat})=>({id,username,room,x,y,direction:Number.isFinite(direction)?direction:0,vehicle:vehicle||null,seat:seat||null}));
   const nearby=sameRoom.filter(p=>distance(p,viewer)<55).map(({ws,input,lastInput,lastChat,emoteUntil,interactedAt,travel,call,slide,ride,...p})=>p);
   this.send(viewer.ws,{type:'state',now:Date.now(),jukebox:(j=>j&&j.until>Date.now()?{id:j.id,title:j.title,at:j.at,by:j.by}:null)(this.jukebox.get(viewer.room)),roomDefinition:viewer.room.startsWith('home:')||viewer.room.startsWith('villa:')?MAPS[viewer.room]:undefined,streetVehicles:this.streetVehiclesFor(viewer),online:this.players.size,players:nearby,mapPlayers:publicMapPlayers});
  }
 }
 close(){this.stopping=true;clearInterval(this.clock);for(const p of this.players.values()){savePlayer(this.db,p);p.ws.close();}}
}
