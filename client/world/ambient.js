// Ambiente e imprevisti della città (solo HUMANA life 3D, Lungomare): gabbiani, barche lontane, alberi che ondeggiano, rumori della città
// (mare, voci lontane, clacson, sirene) ed eventi occasionali: ambulanza, pattuglia, piccolo incidente, traffico, musicista di strada, fuochi sul mare, temporale.
// Un solo evento alla volta, distanziati di qualche minuto; tutto è leggero (pochi oggetti, suoni sintetizzati senza file).
import * as THREE from '../vendor/three/three.module.min.js';
import {SHORE} from '/shared/world.js';import {MARKET,VEHICLE} from '/shared/catalog.js';
import {hash,prng} from './syncwalk.js';
let RNG=Math.random;
const rnd=(a,b)=>a+RNG()*(b-a),pick=a=>a[Math.floor(RNG()*a.length)];
const hourNow=w=>((w.r2d.seconds()%2400)/2400*24);
// ---- suoni sintetizzati (nessun file): partono dopo il primo tocco, volume basso, spenti da localStorage humana-ambient=off ----
class Sound{
 constructor(){this.ctx=null;this.on=true;try{this.on=localStorage.getItem('humana-ambient')!=='off';}catch{}
  this.ensureContext=()=>{if(this.ctx||!this.on)return this.ctx;try{const C=window.AudioContext||window.webkitAudioContext;this.ctx=new C();this.master=this.ctx.createGain();this.master.gain.value=.5;this.master.connect(this.ctx.destination);}catch{}return this.ctx;};
  const start=()=>{const ctx=this.ensureContext();if(!ctx)return;if(ctx.state==='suspended')ctx.resume().catch(()=>{});if(this.seaG||this.seaScheduled)return;this.seaScheduled=true;setTimeout(()=>{this.seaScheduled=false;if(this.ctx===ctx&&this.ok()&&!this.seaG)this.sea();},0);};
  if(this.on)setTimeout(()=>this.ensureContext(),0);
  addEventListener('pointerdown',start,{once:false,passive:true});addEventListener('keydown',start,{passive:true});}
 noise(sec=2){const c=this.ctx,b=c.createBuffer(1,c.sampleRate*sec,c.sampleRate),d=b.getChannelData(0);let l=0;for(let i=0;i<d.length;i++){l=(l+.02*(RNG()*2-1))/1.02;d[i]=l*3.5;}return b;}
 noiseAsync(sec,ready){const c=this.ctx;if(!c||!this.on||c.state==='closed')return;const b=c.createBuffer(1,c.sampleRate*sec,c.sampleRate),d=b.getChannelData(0);let i=0,l=0;const fill=()=>{if(this.ctx!==c||!this.on||c.state==='closed')return;const end=Math.min(d.length,i+4096);for(;i<end;i++){l=(l+.02*(RNG()*2-1))/1.02;d[i]=l*3.5;}if(i<d.length){setTimeout(fill,0);return;}ready(b);};setTimeout(fill,0);}
 // mare: rumore morbido con onde lente
 sea(){const c=this.ctx;this.noiseAsync(4,buffer=>{if(this.ctx!==c||!this.on||c.state==='closed')return;const src=c.createBufferSource();src.buffer=buffer;src.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=700;const g=c.createGain();g.gain.value=.05;const lfo=c.createOscillator(),lg=c.createGain();lfo.frequency.value=.11;lg.gain.value=.035;lfo.connect(lg);lg.connect(g.gain);src.connect(f);f.connect(g);g.connect(this.master);src.start();lfo.start();this.seaG=g;});}
 ok(){return this.ctx&&this.ctx.state!=='closed'&&this.on;}
 tone(freq,dur,vol=.05,type='square',when=0,to=null){if(!this.ok())return;const c=this.ctx,t=c.currentTime+when,o=c.createOscillator(),g=c.createGain();o.type=type;o.frequency.setValueAtTime(freq,t);if(to)o.frequency.linearRampToValueAtTime(to,t+dur);g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.02);g.gain.linearRampToValueAtTime(0,t+dur);o.connect(g);g.connect(this.master);o.start(t);o.stop(t+dur+.05);return g;}
 // clacson da auto: due note (circa 400 e 500 Hz) con onde dense filtrate, attacco secco e leggera stonatura; a volte doppio colpetto
 horn(vol=.05){if(!this.ok())return;const c=this.ctx,t=c.currentTime+.02,len=.3+RNG()*.14,hits=RNG()<.4?2:1,det=1+(RNG()-.5)*.03;
  for(let k=0;k<hits;k++){const t0=t+k*(len*.62+.1),dur=k?len*.6:len;for(const [f,m] of [[405,1],[505,.9],[810,.25]]){for(const [type,dt2] of [['sawtooth',1],['square',1.006]]){const o=c.createOscillator(),g=c.createGain(),lp=c.createBiquadFilter();o.type=type;o.frequency.value=f*det*dt2;lp.type='lowpass';lp.frequency.value=2100;lp.Q.value=.9;
    const a=vol*m*.42;g.gain.setValueAtTime(0,t0);g.gain.linearRampToValueAtTime(a,t0+.012);g.gain.setValueAtTime(a*.85,t0+dur-.06);g.gain.linearRampToValueAtTime(0,t0+dur);o.connect(lp);lp.connect(g);g.connect(this.master);o.start(t0);o.stop(t0+dur+.03);}}}}
 gull(vol=.03){for(let i=0;i<3;i++)this.tone(1500+i*180,.16,vol,'sine',i*.22,1000+i*100);}
 voices(vol=.035){if(!this.ok())return;const c=this.ctx,src=c.createBufferSource();src.buffer=this.noise(1.5);const f=c.createBiquadFilter();f.type='bandpass';f.frequency.value=rnd(300,600);f.Q.value=2;const g=c.createGain();const t=c.currentTime;g.gain.setValueAtTime(0,t);for(let i=0;i<5;i++)g.gain.linearRampToValueAtTime(vol*rnd(.4,1),t+.2+i*.25);g.gain.linearRampToValueAtTime(0,t+1.6);src.connect(f);f.connect(g);g.connect(this.master);src.start(t);}
 // sirena con intensità legata alla distanza (0…1); ritorna un oggetto da aggiornare e fermare
 siren(){if(!this.ok())return null;const c=this.ctx,o=c.createOscillator(),g=c.createGain(),l=c.createOscillator(),lg=c.createGain();o.type='sawtooth';o.frequency.value=850;l.frequency.value=.7;lg.gain.value=220;l.connect(lg);lg.connect(o.frequency);g.gain.value=0;o.connect(g);g.connect(this.master);o.start();l.start();return {set(v){g.gain.value=Math.max(0,Math.min(.06,v*.06));},stop(){try{g.gain.value=0;o.stop();l.stop();}catch{}}};}
 thunder(){if(!this.ok())return;const c=this.ctx,src=c.createBufferSource();src.buffer=this.noise(3);const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=260;const g=c.createGain(),t=c.currentTime;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(.25,t+.15);g.gain.exponentialRampToValueAtTime(.001,t+2.8);src.connect(f);f.connect(g);g.connect(this.master);src.start(t);}
 pop(vol=.05){if(!this.ok())return;const c=this.ctx,src=c.createBufferSource();src.buffer=this.noise(.4);const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=900;const g=c.createGain(),t=c.currentTime;g.gain.setValueAtTime(vol*4,t);g.gain.exponentialRampToValueAtTime(.001,t+.35);src.connect(f);f.connect(g);g.connect(this.master);src.start(t);}
 // motore: due onde filtrate, tono e volume seguono velocità e accelerazione (si spegne a piedi); scooter e moto più acuti
 engine(speed,thr,kind){if(!this.ok())return;const c=this.ctx;if(!this.eng){const o1=c.createOscillator(),o2=c.createOscillator(),f=c.createBiquadFilter(),g=c.createGain();o1.type='sawtooth';o2.type='square';f.type='lowpass';f.frequency.value=380;g.gain.value=0;o1.connect(f);o2.connect(f);f.connect(g);g.connect(this.master);o1.start();o2.start();this.eng={o1,o2,f,g};}
  const E=this.eng,t=c.currentTime,hi=kind==='moto',base=hi?78:52,fr=base+Math.min(1,speed)*(hi?190:130)+thr*14;E.o1.frequency.setTargetAtTime(fr,t,.08);E.o2.frequency.setTargetAtTime(fr*.5,t,.08);E.f.frequency.setTargetAtTime(300+speed*900+thr*500,t,.1);E.g.gain.setTargetAtTime(kind===null?0:.012+.03*Math.min(1,speed)+.03*thr,t,.12);}
 engineOff(){if(this.eng)this.eng.g.gain.setTargetAtTime(0,this.ctx.currentTime,.15);}
 // portiera che si chiude: colpo sordo breve
 door(v=1){if(!this.ok()||v<=0)return;const c=this.ctx,src=c.createBufferSource();src.buffer=this.noise(.3);const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=420;const g=c.createGain(),t=c.currentTime;g.gain.setValueAtTime(.5*v,t);g.gain.exponentialRampToValueAtTime(.001,t+.22);src.connect(f);f.connect(g);g.connect(this.master);src.start(t);this.tone(95,.14,.09*v,'sine');}
 // rombo del traffico lontano, più forte quando ci sono tante auto vicine
 rumble(level){if(!this.ok())return;const c=this.ctx;if(!this.rum&&!this.rumPending){this.rumPending=true;this.noiseAsync(4,buffer=>{this.rumPending=false;if(this.ctx!==c||!this.on||c.state==='closed')return;const src=c.createBufferSource();src.buffer=buffer;src.loop=true;const f=c.createBiquadFilter();f.type='lowpass';f.frequency.value=220;const g=c.createGain();g.gain.value=0;src.connect(f);f.connect(g);g.connect(this.master);src.start();this.rum=g;});}if(this.rum)this.rum.gain.setTargetAtTime(Math.max(0,Math.min(1,level))*.07,c.currentTime,.8);}
 note(f,vol=.04){this.tone(f,.5,vol,'triangle');}
 rain(on){if(!this.ok())return;if(on&&!this.rainG){const c=this.ctx,src=c.createBufferSource();src.buffer=this.noise(2);src.loop=true;const f=c.createBiquadFilter();f.type='highpass';f.frequency.value=1500;const g=c.createGain();g.gain.value=0;g.gain.linearRampToValueAtTime(.05,c.currentTime+4);src.connect(f);f.connect(g);g.connect(this.master);src.start();this.rainG=g;this.rainS=src;}
  else if(!on&&this.rainG){const g=this.rainG,s=this.rainS;g.gain.linearRampToValueAtTime(0,this.ctx.currentTime+4);setTimeout(()=>{try{s.stop();}catch{}},4500);this.rainG=null;}}
}
export class Ambient{
 constructor(w){this.w=w;this.snd=new Sound();this.hornAction=()=>this.snd.horn(.08);if(window.humanaHorn!==this.hornAction)window.humanaHorn=this.hornAction;this.t=0;this.next=rnd(40,90);this.ev=null;this.gulls=[];this.boats=[];this.fx=new THREE.Group();w.scene.add(this.fx);this.fx.visible=false;this.sk=0;this.cool={horn:rnd(10,30),gull:rnd(6,16),voice:rnd(8,20)};this.weather=1;}
 // ---- gabbiani e barche ----
 build(){const w=this.w,m=new THREE.MeshBasicMaterial({color:'#f8f8f4',side:THREE.DoubleSide}),n=w.mobile?3:6;
  for(let i=0;i<n;i++){const g=new THREE.Group(),wing=()=>{const q=new THREE.Mesh(new THREE.PlaneGeometry(.55,.14),m);q.geometry.translate(.28,0,0);return q;};const a=wing(),b=wing();b.rotation.y=Math.PI;g.add(a,b,new THREE.Mesh(new THREE.SphereGeometry(.09,6,5),m));g.scale.setScalar(1.3);this.fx.add(g);this.gulls.push({g,a,b,r:rnd(9,24),h:rnd(7,15),sp:rnd(.25,.45)*(i%2?1:-1),ph:rnd(0,6.28),w:rnd(6,9)});}
  for(let i=0;i<(w.mobile?2:3);i++){const b=w.boat?w.boat(i+1):null;if(!b)continue;b.scale.setScalar(.9);this.fx.add(b);this.boats.push({o:b,k:i,t:rnd(0,1)});}
  this.ready=true;}
 sway(dt){const w=this.w,L=w.sway;if(!L||!L.length)return;const t=w.clock,px=w.target.x,pz=w.target.z;for(let i=L.length-1;i>=0;i--){const s=L[i];if(!s.o.parent){L.splice(i,1);continue;}if(Math.abs(s.o.position.x-px)+Math.abs(s.o.position.z-pz)>70)continue;const a=.018+.008*Math.sin(s.ph);s.o.rotation.z=Math.sin(t*.9+s.ph)*a;s.o.rotation.x=Math.cos(t*.7+s.ph*1.3)*a*.7;}}
 // ---- ciclo principale ----
 update(dt,list){const w=this.w;if(!this.ready){try{this.build();}catch(e){console.warn('ambiente',e);this.ready=true;}}
  this.fx.visible=true;const px=w.target.x,pz=w.target.z,h=hourNow(w);this.t+=dt;this.sway(dt);
  // gabbiani: girano sopra il lungomare vicino a chi guarda; barche: scorrono piano al largo
  for(const q of this.gulls){q.ph+=q.sp*dt;const cx=px-q.w*.9,cz=pz-q.w*.9;q.g.position.set(cx+Math.cos(q.ph)*q.r,q.h+Math.sin(q.ph*2.3)*.8,cz+Math.sin(q.ph)*q.r);q.g.rotation.y=-q.ph+(q.sp>0?0:Math.PI);const f=Math.sin(w.clock*9+q.w)*.6;q.a.rotation.z=f;q.b.rotation.z=f;q.g.visible=h>5.5&&h<21;}
  for(const b of this.boats){if(w.room!=='lungomare'){b.o.visible=false;continue;}b.t=(b.t+dt*.0035)%1;const c=SHORE-34-b.k*26,x=-20+b.t*210,y=c-x;b.o.position.set(x,0,y);b.o.rotation.y=Math.PI/4+(b.k%2?Math.PI:0)*0;b.o.visible=Math.abs(x-px)+Math.abs(y-pz)<190;b.o.rotation.z=Math.sin(w.clock*.8+b.k)*.03;}
  // rumori
  const c=this.cool;c.horn-=dt;c.gull-=dt;c.voice-=dt;
  if(c.gull<=0){c.gull=rnd(12,30);if(h>5.5&&h<21)this.snd.gull();}
  if(c.voice<=0){c.voice=rnd(14,40);if(h>8&&h<24)this.snd.voices();}
  if(c.horn<=0){c.horn=rnd(18,50)*(h>7&&h<20?1:2.5);this.snd.horn();}
  if(this.snd.seaG)this.snd.seaG.gain.value=.05;
  this.mix(dt,list,h);
  // eventi
  if(!this.ev){const sc=this.sched(w.r2d.seconds());if(sc&&sc.T>=sc.start&&sc.T<sc.start+sc.dur&&this.lastSlot!==sc.slot){this.lastSlot=sc.slot;this.start(sc.h,sc);}}else{try{this.runEv(dt,h,list);}catch(e){console.warn('evento',e);this.stop();}}
  this.life(h);}
 // suoni legati a ciò che succede: motore del giocatore, clacson degli altri, rombo del traffico
 mix(dt,list,h){const w=this.w,sn=this.snd,me=w._me,tr=w.r2d.traffic;if(!sn.ok())return;
  const v=me&&me.vehicle?me.vehicle:null,base=v?(VEHICLE[v]?.base||v):null,motor=base&&['auto','cabrio','furgone','scooter','moto'].includes(base);
  if(motor&&!me.seat){const sp=Math.abs(me.vel||0)/14,acc=((me.vel||0)-(this.pv||0))/Math.max(dt,.001);this.pv=me.vel||0;sn.engine(sp,Math.max(0,Math.min(1,acc/4))*(me.fuel===0?0:1),base==='scooter'||base==='moto'?'moto':'auto');if(me.fuel===0)sn.engineOff();}else{sn.engineOff();this.pv=0;}
  let n=0;if(w.room==='mergellina'&&w.mlife){for(const c of w.mlife.cars)if(c.on&&Math.abs(c.x-w.target.x)+Math.abs(c.y-w.target.z)<45)n++;}else if(tr)for(const c of tr.cars){if(c.off)continue;const q=c.path.pointAt(c.s);if(Math.abs(q.x-w.target.x)+Math.abs(q.y-w.target.z)<45)n++;}sn.rumble(Math.min(1,n/5)*(h>6&&h<24?1:.5)*(this.weather<1?1.2:1));
  this.seenH??={};for(const p of list){if(!p.hornAt||this.seenH[p.id]===p.hornAt)continue;this.seenH[p.id]=p.hornAt;if(me&&p.id===me.id)continue;const d=Math.hypot(p.x-w.target.x,p.y-w.target.z);if(d<70&&Date.now()-p.hornAt<1500)sn.horn(.07*Math.max(0,1-d/70));}}
 life(h){const city=this.w.life,merg=this.w.mlife;if(city)city.weather=this.weather;if(merg)merg.weather=this.weather;}
 hide(){this.fx.visible=false;if(this.ev){this.stop();this.next=Math.max(this.next,60);}try{this.snd.engineOff();this.snd.rumble(0);if(this.snd.seaG)this.snd.seaG.gain.value=.012;}catch{}}
 // ---- eventi ----
 // Gli eventi (pioggia, fuochi, ambulanze...) seguono un calendario deciso dall'orologio del server: tutti i giocatori li vedono insieme.
 sched(T){const SLOT=150,slot=Math.floor(T/SLOT),rg=prng(hash(slot,909));if(rg()>.38)return null;const start=slot*SLOT+rg()*40,hh=((start%2400)/2400*24),room=this.w.room;
  const kinds=['ambulanza','pattuglia','incidente','traffico','musicista','temporale','temporale'];if(hh>=8&&hh<14)kinds.push('mercato','mercato');if(hh>=21||hh<1)kinds.push('fuochi','fuochi');if(hh>=9&&hh<20)kinds.push('musicista');
  const list=room==='mergellina'?['temporale','temporale','fuochi'].filter(x=>x!=='fuochi'||hh>=21||hh<1):kinds;const k=list[Math.floor(rg()*list.length)]||'temporale';
  const dur={ambulanza:22,pattuglia:20,incidente:40,traffico:35,musicista:70,temporale:80,fuochi:28,mercato:120}[k];return {slot,start,dur,k,T,h:hh};}
 start(h,sc){const k=sc.k,old=RNG;RNG=prng(hash(sc.slot,7));try{this.ev={k,t:0,dur:sc.dur};this.begin(this.ev);if(this.ev)this.ev.t=Math.max(0,sc.T-sc.start);}finally{RNG=old;}}
 stop(){const e=this.ev;if(!e)return;try{this.end(e);}catch{}this.ev=null;}
 runEv(dt,h,list){const e=this.ev;e.t+=dt;if(e.t>=e.dur){this.stop();return;}const f=this['f_'+e.k];if(f)f.call(this,e,dt);}
 begin(e){const w=this.w,tr=w.r2d.traffic;switch(e.k){
  case 'ambulanza':case 'pattuglia':{const paths=(tr?.cars||[]).filter(c=>!c.work).map(c=>c.path);if(!paths.length){this.ev=null;return;}e.path=pick(paths);e.s=rnd(0,e.path.length);e.v=0;e.o=e.k==='ambulanza'?this.ambulance():this.patrol();e.o.visible=true;w.scene.add(e.o);e.sir=this.snd.siren();e.red=e.o.userData.red;e.blue=e.o.userData.blue;break;}
  case 'incidente':{const cars=(tr?.cars||[]).filter(c=>!c.off&&!c.work&&c.model!=='scooter');const px=w.target.x,pz=w.target.z;cars.sort((a,b)=>{const p=a.path.pointAt(a.s),q=b.path.pointAt(b.s);return Math.hypot(p.x-px,p.y-pz)-Math.hypot(q.x-px,q.y-pz);});const c=cars.find(x=>{const p=x.path.pointAt(x.s);return Math.hypot(p.x-px,p.y-pz)>22&&Math.hypot(p.x-px,p.y-pz)<80;})||cars[2];if(!c){this.ev=null;return;}
   e.car=c;e.prev={canPark:c.canPark,park:c.park,parkAt:c.parkAt};c.canPark=true;c.park={t:e.dur+5};const q=c.path.pointAt(c.s);e.o=w.car('sedan','#7a1f2b');e.o.position.set(q.x+Math.cos(q.direction)*5.4+Math.cos(q.direction+Math.PI/2)*.5,0,q.y+Math.sin(q.direction)*5.4+Math.sin(q.direction+Math.PI/2)*.5);e.o.rotation.y=w.hd(q.direction)+.7;w.scene.add(e.o);e.obs={x:e.o.position.x,y:e.o.position.z,vehicle:true};this.snd.horn(.06);break;}
  case 'traffico':{if(tr)tr.speedK=.35;this.snd.horn(.05);break;}
  case 'musicista':{const L=w.life;if(!L||!L.ready){this.ev=null;return;}const R=L.rings[Math.floor(RNG()*L.rings.length)],p=R.pts[Math.floor(RNG()*R.n)];e.pos=p;const ag=L.agents.filter(a=>a.kind==='busker');ag.forEach((a,i)=>{a.manual=true;a.on=true;a.state='party';a.dance=false;a.x=p[0]+(i?Math.cos(i*2.1)*2.1:0);a.z=p[1]+(i?Math.sin(i*2.1)*2.1+.4:0);a.yaw=i?Math.atan2(p[0]-a.x,p[1]-a.z):Math.PI;a.t=i*3;a.act=i?'Idle':'Wave';a.busk=i===0;});e.ag=ag;e.notes=0;break;}
  case 'mercato':{const L=w.life;e.g=this.market();e.g.visible=true;const M=MARKET,ag=L&&L.ready?L.agents.filter(a=>a.kind==='busker'):[];ag.forEach((a,i)=>{a.manual=true;a.on=true;a.state='party';a.dance=false;a.busk=false;const col=i%2,sx=M.x+2.5+col*5;a.x=sx+(i<2?0:(i%2?1.3:-1.3));a.z=i<2?M.y+1.6:M.y+M.h+1.5;a.yaw=i<2?0:Math.PI;a.t=i*4;});e.ag=ag;window.__mapExtra=[{x:M.x+M.w/2,y:M.y+M.h+2.5,name:M.name,cat:'negozi',icon:'🧺'}];break;}
  case 'temporale':{this.weather=.3;this.rainOn(true);this.snd.rain(true);e.flash=rnd(6,14);break;}
  case 'fuochi':{e.bursts=[];e.nb=rnd(1,3);break;}}}
 end(e){const w=this.w,tr=w.r2d.traffic;switch(e.k){
  case 'ambulanza':case 'pattuglia':e.sir?.stop();if(e.o)w.scene.remove(e.o);break;
  case 'incidente':if(e.car){e.car.canPark=e.prev.canPark;e.car.park=e.car.park&&e.prev.park?e.car.park:null;e.car.parkAt=e.prev.parkAt;if(e.car.canPark&&e.car.parkAt===undefined){const g=e.car.parkGap||[e.car.path.length*.25,e.car.path.length*.65];e.car.parkAt=(e.car.s+g[0]+RNG()*(g[1]-g[0]))%e.car.path.length;}}if(e.o)w.scene.remove(e.o);break;
  case 'traffico':if(tr)tr.speedK=1;break;
  case 'musicista':for(const a of e.ag||[]){a.manual=false;a.on=false;}break;
  case 'mercato':if(e.g)e.g.visible=false;for(const a of e.ag||[]){a.manual=false;a.on=false;}window.__mapExtra=[];break;
  case 'temporale':this.weather=1;this.rainOn(false);this.snd.rain(false);break;
  case 'fuochi':for(const b of e.bursts||[]){this.fx.remove(b.p);b.p.geometry.dispose();}break;}}
 // veicoli d'emergenza
 ambulance(){const g=this.w.car('suv','#f4f4f4'),B=(a,b,c,x,y,z,col)=>this.w.bx(g,a,b,c,x,y,z,col);B(2.05,.28,2.6,0,1.05,-.2,'#d62828');const r=new THREE.Mesh(new THREE.BoxGeometry(.5,.16,.3),new THREE.MeshBasicMaterial({color:'#ff2a2a'})),b=new THREE.Mesh(new THREE.BoxGeometry(.5,.16,.3),new THREE.MeshBasicMaterial({color:'#2a5cff'}));r.position.set(-.28,1.78,.2);b.position.set(.28,1.78,.2);g.add(r,b);g.userData.red=r;g.userData.blue=b;return g;}
 patrol(){const g=this.w.car('sedan','#f4f7fb');for(const sx of [-1,1])this.w.bx(g,.05,.28,2.6,sx*.93,.8,0,'#1e40af');const r=new THREE.Mesh(new THREE.BoxGeometry(.45,.14,.28),new THREE.MeshBasicMaterial({color:'#ff2a2a'})),b=new THREE.Mesh(new THREE.BoxGeometry(.45,.14,.28),new THREE.MeshBasicMaterial({color:'#2a5cff'}));r.position.set(-.24,1.52,0);b.position.set(.24,1.52,0);g.add(r,b);g.userData.red=r;g.userData.blue=b;return g;}
 f_ambulanza(e,dt){this.drive(e,dt,11);}
 f_pattuglia(e,dt){this.drive(e,dt,10);}
 drive(e,dt,v){const w=this.w;e.v+=(v-e.v)*Math.min(1,dt);e.s=e.path.wrap(e.s+e.v*dt);const q=e.path.pointAt(e.s),r=q.direction+Math.PI/2,x=q.x-Math.cos(r)*1.35,z=q.y-Math.sin(r)*1.35;e.o.position.set(x,0,z);e.o.rotation.y=w.hd(q.direction);
  const flash=Math.floor(w.clock*6)%2===0;e.red.visible=flash;e.blue.visible=!flash;const d=Math.hypot(x-w.target.x,z-w.target.z);e.sir?.set(Math.max(0,1-d/90));}
 f_incidente(e,dt){const w=this.w;if(e.car&&e.car.park)e.car.park.t=Math.max(e.car.park.t,3);if(Math.floor(w.clock*3)%2===0&&e.o)e.o.visible=true;}
 f_musicista(e,dt){const w=this.w,d=Math.hypot(e.pos[0]-w.target.x,e.pos[1]-w.target.z);e.notes-=dt;if(e.notes<=0&&d<45){e.notes=.45;const sc=[261.6,329.6,392,440,523.3,392,329.6];this.snd.note(sc[Math.floor(w.clock*2.2)%sc.length],Math.max(.006,.045*(1-d/45)));}}
 f_temporale(e,dt){this.rain(dt,e);e.flash-=dt;if(e.flash<=0){e.flash=rnd(7,16);this.lightning();setTimeout(()=>this.snd.thunder(),rnd(300,1400));}}
 f_traffico(e,dt){}
 f_mercato(e,dt){}
 // Bancarelle del mercato: tavoli con tende a righe e casse di frutta, create una volta e riusate.
 market(){if(this.mk)return this.mk;const M=MARKET,g=new THREE.Group(),w=this.w,cols=['#d62828','#2f9e5b','#f2b705','#2f7fc1'];
  for(let i=0;i<4;i++){const x=M.x+2.5+(i%2)*5,z=i<2?M.y+1.2:M.y+M.h-1.2;w.bx(g,2.6,.9,1,x,.45,z,'#a9774a');for(let k=0;k<4;k++)w.bx(g,.65,.13,1.7,x-1.0+k*.65,2.2+(k%2?0:0),z,k%2?'#ffffff':cols[i]);for(const dx of [-1.25,1.25])w.bx(g,.07,2.2,.07,x+dx,1.1,z-.55,'#4a5862');for(let k=0;k<3;k++)w.bx(g,.5,.28,.5,x-.8+k*.8,1.04,z,['#e5484d','#ffb02e','#6bb04a'][k]);}
  g.position.y=w.lev(M.x,M.y);g.visible=false;w.scene.add(g);this.mk=g;return g;}
 f_fuochi(e,dt){const w=this.w;if(e.nb>0)e.nb-=dt;else if(e.bursts.length<9){e.nb=rnd(1.2,2.8);const dx=-1,dz=-1,k=rnd(55,85),cx=w.target.x+dx*k*.7+rnd(-20,20),cz=w.target.z+dz*k*.7+rnd(-20,20),cy=rnd(24,38),n=w.mobile?60:110,pos=new Float32Array(n*3),vel=[];for(let i=0;i<n;i++){const a=RNG()*6.283,b=Math.acos(2*RNG()-1),s=rnd(5,11);vel.push([Math.sin(b)*Math.cos(a)*s,Math.cos(b)*s,Math.sin(b)*Math.sin(a)*s]);}
   const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.BufferAttribute(pos,3));const col=pick(['#ffd23f','#ff5a5a','#5ad7ff','#9cff6e','#ff8bd6']);const p=new THREE.Points(geo,new THREE.PointsMaterial({color:col,size:1.1,transparent:true,opacity:1,depthWrite:false,blending:THREE.AdditiveBlending,sizeAttenuation:true}));p.position.set(cx,cy,cz);p.frustumCulled=false;this.fx.add(p);e.bursts.push({p,vel,t:0});this.snd.pop(.04);}
  for(const b of e.bursts){b.t+=dt;if(b.t>3.2){b.p.visible=false;continue;}const a=b.p.geometry.attributes.position;for(let i=0;i<b.vel.length;i++){const v=b.vel[i];a.array[i*3]=v[0]*b.t;a.array[i*3+1]=v[1]*b.t-2.6*b.t*b.t;a.array[i*3+2]=v[2]*b.t;}a.needsUpdate=true;b.p.material.opacity=Math.max(0,1-b.t/3.2);}}
 // ---- pioggia (un velo 2D sopra il gioco: leggero) ----
 rainOn(on){if(on&&!this.cv){const c=document.createElement('canvas');c.id='rain-fx';c.style.cssText='position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:3;background:linear-gradient(rgba(12,22,40,.28),rgba(12,22,40,.1))';c.width=Math.min(innerWidth,900);c.height=Math.min(innerHeight,900);document.body.append(c);this.cv=c;this.drops=Array.from({length:this.w.mobile?90:160},()=>({x:RNG(),y:RNG(),s:rnd(.9,1.6)}));}
  else if(!on&&this.cv){this.cv.remove();this.cv=null;if(this.flashEl){this.flashEl.remove();this.flashEl=null;}}}
 rain(dt,e){const c=this.cv;if(!c)return;const W=c.width,H=c.height,g=c.getContext('2d');g.clearRect(0,0,W,H);g.strokeStyle='rgba(200,215,235,.45)';g.lineWidth=1;g.beginPath();for(const d of this.drops){d.y+=dt*d.s*1.4;d.x-=dt*.12;if(d.y>1){d.y=-.05;d.x=RNG()*1.2;}if(d.x<0)d.x+=1.1;const x=d.x*W,y=d.y*H;g.moveTo(x,y);g.lineTo(x-4,y+16);}g.stroke();const fade=Math.min(1,e.t/5,(e.dur-e.t)/6);c.style.opacity=String(Math.max(0,fade));}
 lightning(){if(!this.cv)return;if(!this.flashEl){const f=document.createElement('div');f.style.cssText='position:fixed;inset:0;background:#fff;opacity:0;pointer-events:none;z-index:4;transition:opacity .08s';document.body.append(f);this.flashEl=f;}const f=this.flashEl;f.style.opacity='.55';setTimeout(()=>{f.style.opacity='0';},90);setTimeout(()=>{f.style.opacity='.35';setTimeout(()=>{f.style.opacity='0';},70);},220);}
 obstacles(){return this.ev&&this.ev.k==='incidente'&&this.ev.obs?[this.ev.obs]:[];}
}
