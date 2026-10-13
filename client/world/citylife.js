// Vita della città (solo HUMANA life 3D, Lungomare): passanti con routine legate all'orario, ferme, panchine, chiacchiere, locali, jogging, movida di notte.
// Leggero per lo smartphone: gli «abitanti» sono punti simulati sempre (costo minimo, aggiornati più di rado se lontani) e solo i più vicini al giocatore
// ricevono un modello 3D da un gruppo di personaggi riutilizzati (pooling): quando uno si allontana il suo modello passa a un altro che si avvicina.
// Nessun calcolo di percorso: si cammina su anelli di marciapiede attorno agli isolati, si attraversa solo agli incroci quando il semaforo lo permette.
import * as THREE from '../vendor/three/three.module.min.js';
import {BLOCKS,INTERSECTIONS,lightState} from '/shared/traffic.js';
import {MAPS,canStand,doors} from '/shared/world.js';
const SHOP=['bar','shop','mall','fashion','barber'],FOOD=['pizzeria','osteria','vesuvio','trattoria','panorama','burger'];
const rnd=(a,b)=>a+Math.random()*(b-a),pick=a=>a[Math.floor(Math.random()*a.length)];
const between=(h,a,b)=>a<=b?h>=a&&h<b:h>=a||h<b;
// Quanti abitanti di ogni tipo sono in giro (0…1) a una certa ora del giorno.
const DENS={
 walker:h=>between(h,6.5,9.5)?1:between(h,16,19.5)?.9:between(h,9.5,16)?.45:between(h,19.5,22.5)?.45:.08,
 shopper:h=>between(h,9,13)?.9:between(h,16,20)?.9:between(h,13,16)?.5:between(h,20,22)?.25:0,
 diner:h=>between(h,19,23.5)?1:between(h,12,14.5)?.9:between(h,23.5,1)?.35:.05,
 stroll:h=>between(h,15,20)?1:between(h,10,15)?.5:between(h,20,23)?.6:.08,
 jogger:h=>between(h,6,9)?1:between(h,17.5,20)?.7:0,
 sitter:h=>between(h,13,19)?1:between(h,9,13)?.6:between(h,19,22)?.45:.05,
 chat:h=>between(h,9,24)?.8:.25,
 wait:h=>between(h,6.5,9)||between(h,16,19)?1:between(h,9,16)?.4:.1,
 movida:h=>between(h,21,3)?1:between(h,18,21)?.3:0,
 busker:()=>0,sweeper:h=>between(h,6,12)?1:between(h,16,18)?.5:0,crew:h=>between(h,6,13)?1:0};
const COUNT={walker:[6,10],shopper:[3,5],diner:[3,5],stroll:[4,6],jogger:[2,3],sitter:[4,6],chat:[6,9],wait:[3,4],movida:[4,6],sweeper:[2,3],crew:[4,4],busker:[4,4]};
const hourNow=w=>((w.r2d.seconds()%2400)/2400*24);
export class CityLife{
 constructor(w){this.w=w;this.ready=false;this.agents=[];this.rigs=[];this.acc=0;this.pending=0;this.group=new THREE.Group();this.group.visible=false;w.scene.add(this.group);this.rings=[];this.gates=[];
  this.max=this.cap=w.mobile?8:14;this.radius=this.rcap=w.mobile?44:56;this.n=0;}
 // ---- costruzione dei percorsi ----
 init(){const step=1.2;
  BLOCKS.forEach((r,i)=>{let best=null;for(let ins=2.6;ins<=7;ins+=.4){const x0=r[0]+ins,y0=r[1]+ins,x1=r[2]-ins,y1=r[3]-ins;if(x1-x0<3||y1-y0<3)break;const pts=[];for(let x=x0;x<x1;x+=step)pts.push([x,y0]);for(let y=y0;y<y1;y+=step)pts.push([x1,y]);for(let x=x1;x>x0;x-=step)pts.push([x,y1]);for(let y=y1;y>y0;y-=step)pts.push([x0,y]);
    if(pts.filter(q=>canStand('lungomare',q[0],q[1],.35)).length/pts.length>=.985){best=pts;break;}}
   if(best)this.rings.push({pts:best,n:best.length,step});});
  // attraversamenti: per ogni incrocio e coppia di anelli vicini si tiene il tratto più corto, in linea retta e dritto
  for(const I of INTERSECTIONS){const cand=[];this.rings.forEach((A,a)=>{A.pts.forEach((p,i)=>{if(Math.hypot(p[0]-I.x,p[1]-I.y)>12)return;this.rings.forEach((B,b)=>{if(b<=a)return;B.pts.forEach((q,j)=>{const dx=q[0]-p[0],dy=q[1]-p[1],d=Math.hypot(dx,dy);if(d<4||d>17||Math.min(Math.abs(dx),Math.abs(dy))>1.4)return;
     const key=a+'-'+b;const c=cand.find(z=>z.key===key);if(!c||d<c.d){if(c)cand.splice(cand.indexOf(c),1);cand.push({key,a,i,b,j,d,I,axis:Math.abs(dx)>Math.abs(dy)?'x':'y'});}});});});});
   for(const c of cand){this.gates.push(c);}}
  // lungomare: tratto di marciapiede lungo la riva, sulla linea delle panchine
  const benches=MAPS.lungomare.props.filter(p=>p.kind==='bench');this.benches=benches;
  if(benches.length){const c=benches.reduce((s,b)=>s+b.x+b.y,0)/benches.length+2.2;let run=[],bestRun=[];for(let x=-2;x<170;x+=1.2){const y=c-x;if(canStand('lungomare',x,y,.35)&&y>=0)run.push([x,y]);else{if(run.length>bestRun.length)bestRun=run;run=[];}}if(run.length>bestRun.length)bestRun=run;this.prom=bestRun.length>6?bestRun:null;}
  // locali: punto sull'anello da cui la porta si raggiunge in linea retta
  this.visit={shop:[],food:[]};
  for(const d of doors('lungomare')){const kind=SHOP.includes(d.to)?'shop':FOOD.includes(d.to)?'food':null;if(!kind)continue;const dx=d.exitX??d.x,dy=d.exitY??d.y;let best=null;
   this.rings.forEach((R,a)=>R.pts.forEach((p,i)=>{const dist=Math.hypot(p[0]-dx,p[1]-dy);if(dist>16||(best&&dist>=best.dist))return;let ok=true;for(let t=0;t<=1&&ok;t+=.125)ok=canStand('lungomare',p[0]+(dx-p[0])*t,p[1]+(dy-p[1])*t,.3);if(ok)best={a,i,dist,x:dx,y:dy,to:d.to,name:d.name};}));
   if(best)this.visit[kind].push(best);}
  this.club=doors('lungomare').find(d=>d.to==='club');
  this.stops=MAPS.lungomare.props.filter(p=>p.kind==='busstop');
  // abitanti
  const m=this.w.mobile?0:1;for(const [kind,cnt] of Object.entries(COUNT)){const n=cnt[m];for(let k=0;k<n;k++)this.agents.push(this.make(kind,k,n));}
  this.ready=this.rings.length>0;}
 make(kind,k,n){const a={kind,k,id:this.n++,u:(k+.5)/n,on:false,state:'walk',x:0,z:0,yaw:0,t:0,speed:rnd(1.05,1.45),dir:Math.random()<.5?1:-1,ring:0,s:0,rig:null,acc:0,vis:null,pw:0};
  if(kind==='sweeper')a.speed=rnd(.55,.7);if(kind==='jogger')a.speed=rnd(2.8,3.6);if(kind==='stroll')a.speed=rnd(.8,1.1);return a;}
 // ---- attivazione / posizionamento in base al tipo ----
 spawn(a,px=0,pz=0){a.on=true;a.t=0;a.state='walk';a.pw=0;const R=this.rings;
  switch(a.kind){
   case 'crew':{a.state='crew';a.hide=true;a.truck=this.trucks()[Math.floor(a.k/2)]||null;if(!a.truck){a.on=false;}break;}
   case 'walker':case 'shopper':case 'diner':case 'jogger':case 'sweeper':{for(let t=0;t<5;t++){a.ring=Math.floor(Math.random()*R.length);a.s=Math.random()*R[a.ring].n;const q=R[a.ring].pts[Math.floor(a.s)];if(Math.abs(q[0]-px)+Math.abs(q[1]-pz)>30)break;}a.dir=Math.random()<.5?1:-1;a.next=rnd(8,40);a.goal=null;break;}
   case 'stroll':if(this.prom){a.s=Math.random()*(this.prom.length-1);a.dir=Math.random()<.5?1:-1;}else a.on=false;break;
   case 'sitter':{const b=this.benches[(a.k*3+a.id)%this.benches.length];if(!b){a.on=false;break;}a.state='sit';a.x=b.x+(a.k%2?.35:-.35);a.z=b.y;a.yaw=-2.35;break;}
   case 'wait':{const s=this.stops[a.k%Math.max(1,this.stops.length)];if(!s){a.on=false;break;}a.state='wait';a.x=s.x+rnd(-1,1);a.z=s.y+(s.y<80?1.4:-1.4)+rnd(-.4,.4);a.yaw=s.y<80?Math.PI:0;break;}
   case 'chat':{const r=R[a.k%R.length];this.anchor(a,r);break;}
   case 'movida':{if(!this.club){a.on=false;break;}const g=Math.floor(a.k/2);a.state='party';const ang=g*2.1+(a.k%2)*Math.PI;a.x=(this.club.exitX??this.club.x)+Math.cos(ang)*(1.1+g*.5)+(g?1.5*(g%2?1:-1):0);a.z=(this.club.exitY??this.club.y)+1.4+Math.abs(Math.sin(ang))*1.6+g*.6;a.yaw=Math.atan2(this.club.x-a.x,this.club.y-a.z);a.dance=Math.random()<.5;break;}}
  if(a.state!=='walk'&&a.kind!=='stroll'&&!canStand('lungomare',a.x,a.z,.3)&&a.kind!=='sitter'&&a.kind!=='crew'){a.on=false;return;}this.place(a);}
 anchor(a,r){const g=Math.floor(a.k/2),i=Math.floor((g*37+11)%r.n),p=r.pts[i];a.state='chat';a.x=p[0]+(a.k%2?.7:-.7);a.z=p[1];a.yaw=a.k%2?-Math.PI/2:Math.PI/2;a.wave=Math.random()<.35;a.cx=p[0];a.cz=p[1];}
 place(a){if(a.kind==='stroll'){if(this.prom){const L=this.prom.length-1,i=Math.max(0,Math.min(L-.001,a.s)),i0=Math.floor(i),f=i-i0;a.x=this.prom[i0][0]+(this.prom[i0+1][0]-this.prom[i0][0])*f;a.z=this.prom[i0][1]+(this.prom[i0+1][1]-this.prom[i0][1])*f;}return;}
  if(a.state==='walk'){const R=this.rings[a.ring],i=((a.s%R.n)+R.n)%R.n,i0=Math.floor(i),i1=(i0+1)%R.n,f=i-i0;a.x=R.pts[i0][0]+(R.pts[i1][0]-R.pts[i0][0])*f;a.z=R.pts[i0][1]+(R.pts[i1][1]-R.pts[i0][1])*f;}
  else if(a.kind==='stroll'&&this.prom){const L=this.prom.length-1,i=Math.max(0,Math.min(L-.001,a.s)),i0=Math.floor(i),f=i-i0;a.x=this.prom[i0][0]+(this.prom[i0+1][0]-this.prom[i0][0])*f;a.z=this.prom[i0][1]+(this.prom[i0+1][1]-this.prom[i0][1])*f;}}
 // ---- un passo di simulazione ----
 step(a,dt){const w=this.w;
  if(a.kind==='stroll'){const L=this.prom.length-1;a.s+=a.dir*a.speed*dt/1.2;if(a.s>=L){a.s=L;a.dir=-1;}if(a.s<=0){a.s=0;a.dir=1;}this.place(a);const j=Math.max(0,Math.min(L-1,Math.floor(a.s))),d=this.prom;a.yaw=Math.atan2((d[j+1][0]-d[j][0])*a.dir,(d[j+1][1]-d[j][1])*a.dir);a.act='Stroll';return;}
  if(a.state==='crew'){const T=a.truck;if(!T||T.off||!T.park){a.hide=true;if(T){const q=T.path.pointAt(T.s);a.x=q.x;a.z=q.y;}return;}
   const q=T.path.pointAt(T.s),r=q.direction+Math.PI/2,sd=T.side+2.5,fx=Math.cos(q.direction),fy=Math.sin(q.direction),sgn=a.k%2?1:-1,tx=q.x+Math.cos(r)*sd+fx*sgn*1.6,tz=q.y+Math.sin(r)*sd+fy*sgn*1.6;
   if(a.hide){a.hide=false;a.x=q.x+Math.cos(r)*(T.side+1.2);a.z=q.y+Math.sin(r)*(T.side+1.2);}const dx=tx-a.x,dz=tz-a.z,d=Math.hypot(dx,dz);if(d>.12){const v=Math.min(d,1.4*dt);a.x+=dx/d*v;a.z+=dz/d*v;a.yaw=Math.atan2(dx,dz);a.act='Walk';}else{a.yaw=Math.atan2(q.x-a.x,q.y-a.z);a.act=((a.t=(a.t||0)+dt)%2.4)<1.2?'Wave':'Idle';}return;}
  if(a.state==='party'&&a.busk){a.act='Wave';return;}
  if(a.state==='sit'||a.state==='wait'||a.state==='party'){a.act=a.state==='party'&&a.dance?'Dance':a.state==='wait'&&(a.t=(a.t||0)+dt)%14<2?'Wave':'Idle';if(a.state==='party'&&!a.dance){a.t+=dt;a.act=(a.t%16)<3?'Wave':'Idle';}return;}
  if(a.state==='chat'){a.t+=dt;a.act=a.wave?((a.t%12)<3.5?'Wave':'Idle'):'Idle';return;}
  if(a.state==='knock'){a.t-=dt;a.act=(Math.floor((a.t||0)*3)%2?'Wave':'Idle');if(a.t<=0){a.state='in';a.t=a.kind==='diner'?rnd(35,110):rnd(15,50);this.release(a);}return;}
  if(a.state==='in'){a.t-=dt;if(a.t<=0){a.state='out';a.x=a.door.x;a.z=a.door.y;a.on=true;}return;}
  const R=this.rings[a.ring];
  if(a.state==='toDoor'||a.state==='out'){const tx=a.state==='toDoor'?a.door.x:a.back.x,tz=a.state==='toDoor'?a.door.y:a.back.y,dx=tx-a.x,dz=tz-a.z,d=Math.hypot(dx,dz),v=Math.min(d,1.25*dt);a.act='Walk';if(d>.05){a.x+=dx/d*v;a.z+=dz/d*v;a.yaw=Math.atan2(dx,dz);}
   if(d<.1){if(a.state==='toDoor'){a.state='knock';a.t=2.8;a.act='Wave';}else{a.state='walk';a.s=a.door.i;a.dir=Math.random()<.5?1:-1;a.next=rnd(25,80);a.door=null;a.cool=4;}}return;}
  if(a.state==='waitCross'){a.act='Idle';a.t+=dt;const g=a.gate,ok=lightState(g.I,g.axis==='x'?'ns':'ew',this.time())==='red'||a.t>26;if(ok){a.state='cross';a.t=0;a.x=a.cross.fx;a.z=a.cross.fz;}return;}
  if(a.state==='cross'){const c=a.cross,dx=c.tx-a.x,dz=c.tz-a.z,d=Math.hypot(dx,dz),v=Math.min(d,1.5*dt);a.act='Walk';if(d>1e-6){a.x+=dx/d*v;a.z+=dz/d*v;a.yaw=Math.atan2(dx,dz);}if(d<.15){a.ring=c.b;a.s=c.j;a.state='walk';a.dir=Math.random()<.5?1:-1;a.next=rnd(20,60);}return;}
  // camminata sull'anello
  const prev=a.s;a.s+=a.dir*a.speed*dt/R.step;if(a.s>=R.n)a.s-=R.n;if(a.s<0)a.s+=R.n;this.place(a);
  const i1=((Math.floor(a.s)+a.dir)%R.n+R.n)%R.n,i0=Math.floor(a.s)%R.n;a.yaw=Math.atan2(R.pts[i1][0]-R.pts[i0][0],R.pts[i1][1]-R.pts[i0][1]);a.act=a.kind==='jogger'?'Run':a.kind==='walker'&&a.speed>1.3?'Walk':'Stroll';
  a.next-=dt;a.cool=(a.cool||0)-dt;
  if(a.goal){const g=a.goal;let diff=g.i-a.s;if(diff>R.n/2)diff-=R.n;if(diff<-R.n/2)diff+=R.n;a.dir=diff>=0?1:-1;if(Math.abs(diff)<.9){a.state='toDoor';a.door={x:g.x,y:g.y,i:g.i};a.back={x:R.pts[g.i][0],y:R.pts[g.i][1]};a.goal=null;a.x=a.back.x;a.z=a.back.y;}return;}
  if(a.next<=0&&(a.kind==='shopper'||a.kind==='diner')){const list=this.visit[a.kind==='shopper'?'shop':'food'].filter(v=>v.a===a.ring);a.next=rnd(30,80);if(list.length){a.goal=pick(list);a.next=rnd(4,10);}else a.next=rnd(6,16);return;}
  // ogni tanto, a un incrocio, si attraversa la strada (solo i pedoni «normali»)
  if((a.kind==='walker'||a.kind==='shopper'||a.kind==='diner')&&a.cool<=0){const idx=Math.floor(a.s);for(const g of this.gates){const fromA=g.a===a.ring&&Math.abs(idx-g.i)<1,fromB=g.b===a.ring&&Math.abs(idx-g.j)<1;if(!(fromA||fromB))continue;a.cool=7;if(Math.random()>.45)break;
    const fa=this.rings[g.a].pts[g.i],fb=this.rings[g.b].pts[g.j];a.gate=g;a.cross=fromA?{fx:fa[0],fz:fa[1],tx:fb[0],tz:fb[1],b:g.b,j:g.j}:{fx:fb[0],fz:fb[1],tx:fa[0],tz:fa[1],b:g.a,j:g.i};a.state='waitCross';a.t=0;a.x=a.cross.fx;a.z=a.cross.fz;break;}}}
 trucks(){return (this.w.r2d.traffic?.cars||[]).filter(c=>c.model==='rifiuti');}
 time(){return this.w.r2d.traffic?.time||0;}
 // Punti dove si sta attraversando la strada: le auto frenano per queste persone.
 crossers(){const out=[];for(const a of this.agents)if(a.on&&a.state==='cross')out.push({x:a.x,y:a.z});return out;}
 // Persona vicina al giocatore con cui si può parlare.
 nearest(px,pz,maxD=2.6){let best=null,bd=maxD;for(const a of this.agents){if(!a.on||!a.rig||a.state==='in')continue;const d=Math.hypot(a.x-px,a.z-pz);if(d<bd){bd=d;best=a;}}return best;}
 talk(a,px,pz){a.talk=2.5;a.yaw=Math.atan2(px-a.x,pz-a.z);}
 // ---- ciclo principale ----
 update(dt,list){const w=this.w;if(!this.ready){if(!this.init2){this.init2=1;try{this.init();}catch(e){console.warn('citylife',e);}}if(!this.ready)return;}
  this.group.visible=true;const h=hourNow(w),px=w.target.x,pz=w.target.z;
  this.ema=(this.ema??dt)*.96+Math.min(dt,.2)*.04;this.qt=(this.qt||0)+dt;if(this.qt>2.5){this.qt=0;if(this.ema>.046&&this.max>4){this.max--;this.radius=Math.max(30,this.radius-3);}else if(this.ema<.03&&this.max<this.cap){this.max++;this.radius=Math.min(this.rcap,this.radius+3);}}
  // quante persone attive a quest'ora (cambiano solo quando non si vedono)
  for(const a of this.agents){if(a.manual)continue;const want=a.u<DENS[a.kind](h)*(a.kind==='crew'?1:this.weather??1);if(want&&!a.on&&a.state!=='in'){this.spawn(a,px,pz);}else if(!want&&a.on&&a.state!=='in'){const far=Math.abs(a.x-px)+Math.abs(a.z-pz)>this.radius*1.3;if(far||!a.rig){a.on=false;this.release(a);}}}
  // simulazione: vicini ogni fotogramma, lontani una volta al secondo circa
  for(const a of this.agents){if(!a.on&&a.state!=='in')continue;const near=a.rig||Math.abs(a.x-px)+Math.abs(a.z-pz)<this.radius*1.6;if(near){if(a.talk>0){a.talk-=dt;a.act='Wave';}else this.step(a,dt);}else{a.acc+=dt;if(a.acc>=1){this.step(a,a.acc);a.acc=0;}}}
  this.bins();this.assign(px,pz,dt);}
 release(a){if(a.rig){a.rig.busy=null;a.rig.o.root.visible=false;a.rig=null;}}
 assign(px,pz,dt){this.acc+=dt;
  if(this.acc>=.25){this.acc=0;const cand=[];for(const a of this.agents){if(!a.on||a.state==='in'||a.hide){this.release(a);continue;}const d=Math.abs(a.x-px)+Math.abs(a.z-pz);if(d<this.radius)cand.push([d,a]);else this.release(a);}
   cand.sort((p,q)=>p[0]-q[0]);const want=cand.slice(0,this.max).map(c=>c[1]);for(const a of this.agents)if(a.rig&&!want.includes(a))this.release(a);
   for(const a of want){if(a.rig)continue;const esi=a.kind==='sweeper'||a.kind==='crew',type=esi?'esi':'gen';let r=this.rigs.find(q=>!q.busy&&q.o&&q.type===type);const have=this.rigs.filter(q=>q.type===type).length,cap=esi?(this.w.mobile?3:5):this.max;if(!r&&have<cap&&this.pending<2){this.pending++;const rig={o:null,busy:null,cur:'',actions:null,type};this.rigs.push(rig);this.w.realPerson(null,'cl'+this.rigs.length*5+7).then(o=>{this.pending--;if(!o){this.rigs.splice(this.rigs.indexOf(rig),1);return;}rig.o=o;rig.actions=o.actions;o.root.visible=false;if(esi){this.w.uniform(o.root,'esi');rig.broom=this.broom(o.root);}this.group.add(o.root);}).catch(()=>{this.pending--;this.rigs.splice(this.rigs.indexOf(rig),1);});}
    if(r){r.busy=a;a.rig=r;for(const k in r.o.actions)r.o.actions[k].stop();r.cur='';r.o.root.visible=true;if(r.broom)r.broom.visible=a.kind==='sweeper';}}}
  // aggiorna i modelli assegnati
  for(const a of this.agents){const r=a.rig;if(!r||!r.o)continue;const o=r.o,root=o.root,d=Math.abs(a.x-px)+Math.abs(a.z-pz);
   if(a.act&&r.cur!==a.act&&o.actions[a.act]){this.w.swapAct(r,a.act);const act=o.actions[a.act];if(act&&(a.act==='Walk'||a.act==='Stroll'||a.act==='Run')){const base=o.real?.meta?.velocita?.[a.act]||1.4;act.timeScale=Math.max(.6,Math.min(2.2,(a.kind==='jogger'?3.2:a.speed)/base));}else if(act)act.timeScale=1;}
   root.position.set(a.x,this.w.lev(a.x,a.z)-(a.state==='sit'?.36:0),a.z);let dy=a.yaw-root.rotation.y;dy=Math.atan2(Math.sin(dy),Math.cos(dy));root.rotation.y+=dy*Math.min(1,10*dt);
   this.fc=(this.fc||0)+1;if(d<26||((a.id+this.fc)&1)===0){o.mixer.update(d<26?dt:dt*2);}
   if(a.state==='sit'&&o.legs)this.w.sitPose({legs:o.legs,body:o.root},'chair',1);}}
 // Scopa in mano agli spazzini: manico e setole attaccati alla mano destra (misure in cm sull'osso).
 broom(root){const hand=root.getObjectByName('Bip01_R_Hand');if(!hand)return null;const g=new THREE.Group(),h=new THREE.Mesh(new THREE.CylinderGeometry(1.1,1.1,95,6).rotateZ(Math.PI/2),new THREE.MeshStandardMaterial({color:'#8a5a32',roughness:.8})),b=new THREE.Mesh(new THREE.BoxGeometry(14,5,22),new THREE.MeshStandardMaterial({color:'#c9a24a',roughness:.9}));h.position.set(25,0,0);b.position.set(74,0,0);g.add(h,b);g.userData.real=true;g.visible=false;hand.add(g);return g;}
 // Bidoni che i camion ESI svuotano quando si fermano.
 bins(){const T=this.trucks();this.binM??=new Map();for(const c of T){let m=this.binM.get(c);if(!m){m=new THREE.Mesh(new THREE.CylinderGeometry(.32,.28,.95,10),new THREE.MeshStandardMaterial({color:'#1f9d55',roughness:.7}));this.group.add(m);this.binM.set(c,m);}const on=c.park&&!c.off;m.visible=!!on;if(on){const q=c.path.pointAt(c.s),r=q.direction+Math.PI/2,sd=c.side+2.7;m.position.set(q.x+Math.cos(r)*sd,this.w.lev(q.x,q.y)+.48,q.y+Math.sin(r)*sd);}}}
 hide(){this.group.visible=false;}
}
const R0=(R,i)=>R.pts[((Math.round(i)%R.n)+R.n)%R.n];
