// Traffico della città: auto che percorrono gli anelli di corsie attorno agli isolati (guida a destra).
// Posizione e direzione vengono dal percorso (punto e tangente), la velocità dal profilo delle curve;
// ogni auto frena se davanti ha un'altra auto, l'autobus o una persona, e accosta per far passare l'autobus.
import {makePath,laneLoop} from './lanes.js';
export const BLOCKS=[[57,50.6,80,81.5],[80,50.6,98.5,81.5],[98.5,50.6,132,81.5],[57,81.5,98.5,116.5],[98.5,81.5,132,116.5]];
const MODELS=['auto','furgone','cabrio','auto','auto'];
// Semafori (solo HUMANA life 3D: il 2D non li disegna e quindi non li fa rispettare): uno a ogni incrocio delle strade grandi.
// Ciclo di 24 s: 9 s verde est-ovest, 2 giallo, 1 tutto rosso, 9 s verde nord-sud, 2 giallo, 1 tutto rosso. Ogni incrocio parte sfasato.
export const INTERSECTIONS=[];for(const x of [57,80,98.5,132])for(const y of [50.6,81.5,116.5])INTERSECTIONS.push({x,y,off:(INTERSECTIONS.length*5)%24});
export const LIGHT_CYCLE=24;
// axis: 'ew' (si viaggia lungo x) oppure 'ns'. Ritorna 'green' | 'yellow' | 'red'.
export function lightState(I,axis,t){const k=(((t+I.off)%LIGHT_CYCLE)+LIGHT_CYCLE)%LIGHT_CYCLE,u=axis==='ew'?k:(k+12)%LIGHT_CYCLE;return u<9?'green':u<11?'yellow':'red';}
export class Traffic{
 constructor(){this.cars=[];let n=0;
  for(const [x0,y0,x1,y1] of BLOCKS){const path=makePath(laneLoop(x0,y0,x1,y1,1.05),{radius:4.5}),speed=path.speedProfile(6.2,{brake:8,slow:.6});
   for(let k=0;k<2;k++)this.cars.push({path,speed,s:path.length*(k/2+.13*n),v:0,side:0,model:MODELS[n++%MODELS.length]});}}
 // Solo HUMANA life 3D: più mezzi (scooter, furgoni), traffico che cambia con l'ora e qualche auto che si ferma a parcheggiare e riparte.
 // Chi non è «in strada» a quell'ora sparisce quando è lontano dal giocatore (this.viewer) e ricompare solo dove c'è spazio.
 enrich(){if(this.rich)return;this.rich=true;let n=0;
  for(const [x0,y0,x1,y1] of BLOCKS){const path=makePath(laneLoop(x0,y0,x1,y1,1.05),{radius:4.5});
   this.cars.push({path,speed:path.speedProfile(8.2,{brake:9,slow:.6}),s:path.length*(.55+.07*n),v:0,side:0,model:'scooter'});
   if(n%2===0)this.cars.push({path,speed:path.speedProfile(5.6,{brake:7,slow:.6}),s:path.length*(.8+.05*n),v:0,side:0,model:'furgone'});n++;}
  // camion ESI: giro lento di mattina (6-13), si fermano ogni tanto lungo il marciapiede a svuotare i bidoni
  [1,3].forEach((bi,k)=>{const [x0,y0,x1,y1]=BLOCKS[bi],path=makePath(laneLoop(x0,y0,x1,y1,1.05),{radius:4.5});this.cars.push({path,speed:path.speedProfile(4.2,{brake:6,slow:.6}),s:path.length*(.15+.4*k),v:0,side:0,model:'rifiuti',canPark:true,work:true,hours:[6,13],parkAt:path.length*(.3+.3*k),parkDur:[6,10],parkGap:[22,48]});});
  this.cars.forEach((c,i)=>{if(c.hours)return;c.u=((i*0.61803)%1);if(c.model==='auto'&&i%3===0){c.canPark=true;c.parkAt=path0(c)*(0.2+((i*.37)%.6));}});}
 density(h){const b=(a,z)=>a<=z?h>=a&&h<z:h>=a||h<z;return b(7,9.5)?1:b(17,20)?1:b(9.5,17)?.72:b(20,23)?.55:.28;}
 update(dt,others){dt=Math.min(dt,.1);this.time=(this.time||0)+dt;
  if(this.rich&&this.viewer){this.within=r=>{const h=this.hour??12;return r[0]<=r[1]?h>=r[0]&&h<r[1]:h>=r[0]||h<r[1];};const dens=this.density(this.hour??12);for(const c of this.cars){if(c.u===undefined&&!c.hours)continue;const want=c.hours?this.within(c.hours):c.u<dens;if(want===!c.off)continue;const q=c.path.pointAt(c.s);if(Math.hypot(q.x-this.viewer.x,q.y-this.viewer.y)<55)continue;
    if(want){let free=true;for(const o of this.cars){if(o===c||o.off)continue;const p=o.path.pointAt(o.s);if(Math.hypot(p.x-q.x,p.y-q.y)<9){free=false;break;}}if(!free)continue;c.v=0;c.park=null;if(c.canPark&&c.parkAt===undefined){const g=c.parkGap||[c.path.length*.25,c.path.length*.65];c.parkAt=(c.s+g[0]+Math.random()*(g[1]-g[0]))%c.path.length;}}c.off=!want;}}
  const list=this.cars.filter(c=>!c.off).map(c=>{const q=c.path.pointAt(c.s);return {c,q};});
  for(const {c,q} of list){const h=q.direction,fx=Math.cos(h),fy=Math.sin(h);let limit=c.speed(c.s)*(this.speedK||1),pull=0;
   const check=(x,y,size,isBus)=>{const dx=x-q.x,dy=y-q.y,fwd=dx*fx+dy*fy,lat=Math.abs(-dx*fy+dy*fx);if(lat>1.7+size)return;
    if(fwd>0&&fwd<9+size)limit=Math.min(limit,Math.max(0,(fwd-3.2-size)*1.6));
    else if(isBus&&fwd<0&&fwd>-11)pull=1;};
   // The signal owns right-of-way between crossing approaches. Treating a
   // perpendicular car as a following obstacle makes both approaches brake
   // at the same junction and can lock the whole ring permanently.
   const sameApproach=this.lights?.5:-.35;
   for(const o of list)if(o.c!==c&&Math.cos(o.q.direction-h)>sameApproach)check(o.q.x+Math.cos(o.q.direction+Math.PI/2)*o.c.side,o.q.y+Math.sin(o.q.direction+Math.PI/2)*o.c.side,.8,false);
   if(this.lights)for(const I of INTERSECTIONS){const dx=I.x-q.x,dy=I.y-q.y,fwd=dx*fx+dy*fy;if(fwd<2||fwd>17||Math.abs(-dx*fy+dy*fx)>6)continue;const st=lightState(I,Math.abs(fx)>Math.abs(fy)?'ew':'ns',this.time);
    // linea di arresto a 6 m dal centro: col rosso ci si ferma lì, col giallo ci si ferma solo se si fa in tempo; chi è già nell'incrocio lo libera
    if(fwd>5.5&&(st==='red'||st==='yellow'&&fwd>9))limit=Math.min(limit,Math.max(0,(fwd-6)*1.5));}
   for(const o of others)check(o.x,o.y,o.bus?2.2:o.vehicle?.8:0,!!o.bus);
   if(pull)limit=Math.min(limit,2.5);
   // parcheggio: ogni tanto un'auto si accosta, resta ferma qualche secondo e riparte
   if(c.canPark){if(c.park){limit=0;pull=1;c.park.t-=dt;if(c.park.t<=0){c.park=null;const g=c.parkGap||[c.path.length*.25,c.path.length*.65];c.parkAt=(c.s+g[0]+Math.random()*(g[1]-g[0]))%c.path.length;}}
    else if(c.parkAt!==undefined&&Math.abs(c.s-c.parkAt)<2.2&&c.v<(c.work?5:4.5)&&(c.work||Math.random()<.5)){const d=c.parkDur||[8,18];c.park={t:d[0]+Math.random()*(d[1]-d[0])};c.parkAt=undefined;}}
   c.side+=((pull?1.25:0)-c.side)*Math.min(1,2.5*dt);
   c.v+=Math.max(-8*dt,Math.min(3*dt,limit-c.v));c.s=c.path.wrap(c.s+c.v*dt);}}
 // Entità da disegnare (stesso formato dei mezzi dei giocatori).
 entities(){return this.cars.map(c=>{const q=c.path.pointAt(c.s),r=q.direction+Math.PI/2;return {kind:'ride',traffic:true,off:!!c.off,parked:!!c.park,v:c.model,x:q.x+Math.cos(r)*c.side,y:q.y+Math.sin(r)*c.side,direction:q.direction,depth:q.x+q.y};});}
}
const path0=c=>c.path.length;
