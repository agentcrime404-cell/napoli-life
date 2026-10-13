
import {STREETS,LANDMARKS,surface,GROUND,TRACK_OUT,TRACK_IN,POOLS,busPosition,CITY_SIZE,VILLA_LOTS,FENCE_GATES} from '/shared/district.js';
import {Traffic} from '/shared/traffic.js';import {cityEdge,MODE,F,isStair,ROWS,artName,VEHICLE,MAPS,doors,CHUNK_SIZE,SHORE,BEACH,STAIRS,spriteRect} from '/shared/world.js';
const SEA_DEPTH=190;
import {crowd,LOOKS} from './crowd.js';
// Proiezione: isometrica (originale) o frontale (città vista di facciata, solo all'aperto).
let FRONT_NOW=false;
export const iso=(x,y)=>FRONT_NOW?{x:x*F.T,y:y*F.K}:{x:(x-y)*38,y:(x+y)*19};
export const ANCHOR=.66;
const screenToIso=(X,Y)=>({x:(X/38+Y/19)/2,y:(Y/19-X/38)/2});
const palettes=['#d7c5a1','#cfbc98','#e2cfad','#c8b794','#d8c9b1'];
const MINI_BAKE=.18,CHUNK_CACHE=36;
const SHOP_ICONS={bar:'☕',pizzeria:'🍕',shop:'👕',club:'🎵',bank:'🏦',burger:'🍔',osteria:'🍝',vesuvio:'🍷',trattoria:'🍝',panorama:'🍽',mall:'🛍',fashion:'👗',barber:'✂',casino:'🎰'};
function hexHsl(hex){const n=parseInt(hex.slice(1),16),r=(n>>16)/255,g=(n>>8&255)/255,b=(n&255)/255,max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2,d=max-min;if(!d)return [0,0,l];const s=l>.5?d/(2-max-min):d/(max+min),h=60*(max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4);return [h,s,l];}
const specOf=hex=>{const [h,s,l]=hexHsl(hex);return [Math.round(h),+s.toFixed(2),+Math.max(.02,l-.16).toFixed(2),1.15];};
// Ricolorazione del giocatore: giacca, pantaloni, scarpe, capelli dai capi indossati e dal barbiere.
function playerSpec(a){const w=a.wear||{};if(!w.top&&!w.pants&&!w.shoes&&!a.hair)return null;return {jacket:w.top?specOf(w.top.color):null,pants:w.pants?specOf(w.pants.color):null,shoes:w.shoes?specOf(w.shoes.color):null,hair:a.hair?specOf(a.hair.color):null};}
function shade(hex,k){const n=parseInt(hex.slice(1),16),f=v=>Math.max(0,Math.min(255,Math.round(v+(k<0?v*k:(255-v)*k))));return '#'+[f(n>>16),f(n>>8&255),f(n&255)].map(v=>v.toString(16).padStart(2,'0')).join('');}
function channel(p,q,t){t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p;}
export class Renderer{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas.getContext('2d');this.chunks=new Map();this.looks=new Map();this.camera={x:0,y:0};this.zoom=1;this.images={};this.hitPlayers=[];this.time=0;this.clockOffset=null;this.imgP={};this.imgLoad=name=>this.imgP[name]??=new Promise((resolve,reject)=>{const i=new Image();i.onload=()=>{this.images[name]=i;resolve(i);};i.onerror=()=>{delete this.imgP[name];reject(new Error('Asset non caricato: '+name));};i.src=`/assets/${name}.png`;});this.loadImages=()=>this.allImg??=Promise.all(['buildings','avatar','gulf','props','paving','residences','living','social-poses'].map(n=>this.imgLoad(n))).then(r=>{this.imagesOk=true;this.miniCache=null;return r;},e=>{this.allImg=null;throw e;});/* Napoli life 3D: le 8 immagini del vecchio 2D (16 MB) non bloccano più l'avvio: si scaricano solo quando servono (minimappa del Lungomare e dei locali, profilo, personaggi in stile 2D) */this.ready=window.HUMANA_3D?Promise.resolve():this.loadImages();this.resize();}
 resize(){this.w=innerWidth;this.h=innerHeight;const dpr=Math.min(devicePixelRatio||1,2);this.canvas.width=this.w*dpr;this.canvas.height=this.h*dpr;this.dpr=dpr;this.ctx.imageSmoothingEnabled=true;this.ctx.imageSmoothingQuality='high';this.chunks.clear();}
 seconds(){const now=Date.now();if(this.worldTime){const offset=this.worldTime-now;this.clockOffset=this.clockOffset===null||Math.abs(offset-this.clockOffset)>2000?offset:this.clockOffset+(offset-this.clockOffset)*.05;}return (now+(this.clockOffset||0))/1000;}
 // Varianti dei passanti: capelli, giacca e pantaloni ricolorati una volta sola; la pelle resta invariata.
 look(name,index){const custom=typeof index==='object',key=name+(custom?JSON.stringify(index):index);if(this.looks.has(key))return this.looks.get(key);const src=this.images[name],L=custom?index:LOOKS[index];if(!src||!L)return src;
  if(this.lookBudget===0)return src;if(this.lookBudget>0)this.lookBudget--;
  const cv=document.createElement('canvas');cv.width=480;cv.height=Math.round(480*src.height/src.width);const g=cv.getContext('2d');g.drawImage(src,0,0,cv.width,cv.height);
  const data=g.getImageData(0,0,cv.width,cv.height),px=new Uint8ClampedArray(data.data),cell=cv.height/4,n=px.length;
  for(let i=0;i<n;i+=4){if(px[i+3]<20)continue;const r=px[i]/255,gg=px[i+1]/255,b=px[i+2]/255,max=r>gg?(r>b?r:b):(gg>b?gg:b),min=r<gg?(r<b?r:b):(gg<b?gg:b),l=(max+min)/2,d=max-min;
   const s=d===0?0:l>.5?d/(2-max-min):d/(max+min),h=d===0?0:60*(max===r?(gg-b)/d+(gg<b?6:0):max===gg?(b-r)/d+2:(r-gg)/d+4);
   if(h>=8&&h<=50&&s>.25&&l>.32)continue;
   let spec=null;const relY=((i>>2)/cv.width%cell)/cell;if(L.shoes&&relY>.86&&(l<.3||l>.75)&&s<.3)spec=L.shoes;else if(s<.35&&l<.32)spec=((i>>2)/cv.width%cell)/cell<.43?L.hair:L.jacket;else if(h>=195&&h<=250&&s>.22)spec=L.pants;if(!spec)continue;
   const ll=Math.min(.97,spec[2]+l*spec[3]),ss=spec[1];if(!ss){px[i]=px[i+1]=px[i+2]=ll*255;continue;}
   const q=ll<.5?ll*(1+ss):ll+ss-ll*ss,p=2*ll-q,hh=spec[0]/360;px[i]=255*channel(p,q,hh+1/3);px[i+1]=255*channel(p,q,hh);px[i+2]=255*channel(p,q,hh-1/3);}
  data.data.set(px);g.putImageData(data,0,0);this.looks.set(key,cv);return cv;}
 polygon(ctx,points,fill,stroke){ctx.beginPath();points.forEach((p,i)=>i?ctx.lineTo(p.x,p.y):ctx.moveTo(p.x,p.y));ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=1;ctx.stroke();}}
 tile(ctx,x,y,color,paving=false,material){const p=iso(x,y);
 if(['grass','track','playground','pool','parking'].includes(material)){this.polygon(ctx,[{x:p.x,y:p.y},{x:p.x+38,y:p.y+19},{x:p.x,y:p.y+38},{x:p.x-38,y:p.y+19}],color);let seed=(x+11)*7919+(y+29)*104729;const dot=material==='grass'?['#5e8e3e66','#a6cf7a66']:material==='pool'?['#ffffff55','#2a9fc655']:['#00000014','#ffffff22'];for(let i=0;i<(material==='grass'?26:10);i++){seed=(seed*1664525+1013904223)>>>0;const u=(seed%1000)/1000;seed=(seed*1664525+1013904223)>>>0;const v=(seed%1000)/1000;ctx.fillStyle=dot[i%2];ctx.fillRect(p.x+(u-v)*36,p.y+(u+v)*18,material==='grass'?1.6:2.5,material==='grass'?2.4:1);}return;}
 if(paving&&this.images.paving){const im=this.images.paving;ctx.save();ctx.translate(p.x,p.y);ctx.transform(38/256,19/256,-38/256,19/256,0,0);ctx.drawImage(im,(x%4)*im.width/4,(y%4)*im.height/4,im.width/4,im.height/4,0,0,256,256);ctx.restore();return;}
 this.polygon(ctx,[{x:p.x,y:p.y},{x:p.x+38,y:p.y+19},{x:p.x,y:p.y+38},{x:p.x-38,y:p.y+19}],color,color==='#62616b'?'#64636d':'#b8a789');ctx.strokeStyle=color==='#62616b'?'#696873':'#e7d8bc';ctx.beginPath();ctx.moveTo(p.x-19,p.y+9.5);ctx.lineTo(p.x+19,p.y+28.5);ctx.moveTo(p.x+19,p.y+9.5);ctx.lineTo(p.x-19,p.y+28.5);ctx.stroke();let seed=(x+37)*7919+(y+53)*104729;for(let i=0;i<32;i++){seed=(seed*1664525+1013904223)>>>0;const u=(seed%1000)/1000;seed=(seed*1664525+1013904223)>>>0;const v=(seed%1000)/1000;ctx.fillStyle=i%3?'#8c755318':'#fff5df55';ctx.fillRect(p.x+(u-v)*36,p.y+(u+v)*18,1.6,.8);}}
 groundColor(room,wx,wy){const odd=(wx+wy)%2,color=room==='club'?['#3f405b','#494258'][odd]:room==='mall'?['#e9eef2','#dfe6ec'][odd]:room==='bank'?['#e6e0d4','#d8d0c0'][odd]:room==='burger'?['#f4f1ea','#c8432f'][odd]:room==='lungomare'?palettes[(wx*13+wy*7)%5]:['#b78760','#c79a72'][odd];const material=room==='lungomare'?surface(wx,wy):'inside';
  const natural={grass:['#7fae5a','#78a654','#86b45f'][(wx*7+wy*3)%3],garden:'#7c9959',track:'#c0573f',playground:['#e58a4e','#4fa3d1','#f2c14e'][(Math.floor(wx/2)+Math.floor(wy/2))%3],parking:'#5f5e68',pool:'#4fc3e0',roadline:'#5d5c66',crosswalk:(wx%2?'#f4f4f4':'#5d5c66'),curb:'#bfb7aa',cobble:['#6f6a64','#7d7770','#66615b'][(wx*5+wy*3)%3],dirt:['#a7845c','#9c7a52'][(wx*3+wy)%2],rock:['#8b8a86','#7e7d79'][(wx+wy*2)%2],snow:['#f7f9fb','#eef3f7'][odd],water:['#3d9bd0','#3793c8'][(wx+wy)%2],tiles:['#e3ddd3','#d3ccc0'][odd],marble:['#f1eee8','#e4dfd6'][(wx*3+wy*5)%2],sand:['#ead39f','#e2c991'][(wx+wy*3)%2],wood:['#a8774f','#9a6b45'][wx%2]}[material];
  return {material,color:material==='road'?'#62616b':material==='sidewalk'?'#e7d8bf':natural||color};}
 chunk(room,cx,cy){const key=`${room}:${cx}:${cy}`;const hit=this.chunks.get(key);if(hit){this.chunks.delete(key);this.chunks.set(key,hit);return hit;}const c=document.createElement('canvas');const resolution=(this.viewZoom||1)<.6?.75:this.dpr>1?1.5:1;c.width=(CHUNK_SIZE*76+4)*resolution;c.height=(CHUNK_SIZE*38+42)*resolution;const g=c.getContext('2d');g.scale(resolution,resolution);g.imageSmoothingQuality='high';g.translate(CHUNK_SIZE*38+2,1);const m=MAPS[room];for(let x=0;x<CHUNK_SIZE;x++)for(let y=0;y<CHUNK_SIZE;y++){const wx=cx*CHUNK_SIZE+x,wy=cy*CHUNK_SIZE+y,b=m.bounds;if(wx<b.x||wy<b.y||wx>=b.x+b.w||wy>=b.y+b.h||(room==='lungomare'&&wx+wy+2<SHORE))continue;const {material,color}=this.groundColor(room,wx,wy);this.tile(g,x,y,color,room==='lungomare'&&material==='stone',material);}this.chunks.set(key,c);while(this.chunks.size>((this.viewZoom||1)<.6?Math.ceil(44/this.viewZoom**2):CHUNK_CACHE))this.chunks.delete(this.chunks.keys().next().value);return c;}
 // Solo i chunk che intersecano davvero lo schermo: test sugli assi dello schermo e su quelli isometrici.
 visibleChunks(m,zoom){const pad=60,l=this.camera.x-this.w/zoom/2-pad,r=this.camera.x+this.w/zoom/2+pad,t=this.camera.y-this.h*ANCHOR/zoom-pad,b=this.camera.y+this.h*(1-ANCHOR)/zoom+pad;
  const corners=[[l,t],[r,t],[l,b],[r,b]].map(([x,y])=>({u:(x/38+y/19)/2,v:(y/19-x/38)/2}));
  const u0=Math.max(Math.floor(m.bounds.x/CHUNK_SIZE),Math.floor(Math.min(...corners.map(c=>c.u))/CHUNK_SIZE)),u1=Math.min(Math.floor((m.bounds.x+m.bounds.w-1)/CHUNK_SIZE),Math.floor(Math.max(...corners.map(c=>c.u))/CHUNK_SIZE));
  const v0=Math.max(Math.floor(m.bounds.y/CHUNK_SIZE),Math.floor(Math.min(...corners.map(c=>c.v))/CHUNK_SIZE)),v1=Math.min(Math.floor((m.bounds.y+m.bounds.h-1)/CHUNK_SIZE),Math.floor(Math.max(...corners.map(c=>c.v))/CHUNK_SIZE));
  const list=[];for(let cx=u0;cx<=u1;cx++)for(let cy=v0;cy<=v1;cy++){const p=iso(cx*CHUNK_SIZE,cy*CHUNK_SIZE);if(p.x+CHUNK_SIZE*38<l||p.x-CHUNK_SIZE*38>r||p.y+CHUNK_SIZE*38+42<t||p.y>b)continue;list.push({cx,cy,p});}
  return list;}
 // Modalità ispezione (?ispeziona=1 o tasto F2): riquadri DOM selezionabili sopra edifici, oggetti e giocatori.
 inspect(layer){if(!this.seen||!this.camera)return;const z=this.viewZoom||1,toS=(x,y)=>{const p=iso(x,y);return {x:(p.x-this.camera.x)*z+this.w*.5,y:(p.y-this.camera.y)*z+this.h*ANCHOR};};const items=[];
  for(const b of this.seen.m.buildings||[]){if(!b.base)continue;const pts=b.base.map(q=>toS(q.x,q.y)),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y),art=b.proc&&this.art?.[artName(b.id)],H=(art?art.h*((Math.max(...xs)-Math.min(...xs))/art.w):(b.height||100)*z);const r={x:Math.min(...xs),y:Math.min(...ys)-H,w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys)+H};if(r.x+r.w<0||r.y+r.h<0||r.x>this.w||r.y>this.h)continue;items.push({...r,label:'Edificio: '+(b.name||b.id)+' ['+b.id+']'+(art?' · immagine '+artName(b.id):' · disegnato dal codice'),kind:'building'});}
  for(const e of this.seen.others){if(e.kind==='building')continue;const p=toS(e.x,e.y),sz=e.kind==='player'?{w:44,h:80}:{w:40,h:50};items.push({x:p.x-sz.w/2,y:p.y-sz.h,w:sz.w,h:sz.h,label:(e.kind==='player'?'Giocatore: '+e.username+(e.vehicle?' su '+e.vehicle:''):'Oggetto: '+e.kind+(e.name?' '+e.name:''))+' · x '+e.x.toFixed(1)+' y '+e.y.toFixed(1),kind:e.kind});}
  // Riquadri riusati (stesso nodo per lo stesso elemento): restano selezionabili mentre il gioco si aggiorna.
  const old=new Map([...layer.children].map(d=>[d.dataset.key,d])),keep=new Set();
  for(const it of items){const key=it.kind+'|'+it.label.split(' · x ')[0];let d=old.get(key);if(!d||keep.has(key)){d=document.createElement('div');d.dataset.key=key;layer.append(d);}keep.add(key);
   d.className='insp insp-'+(it.kind==='building'?'b':it.kind==='player'?'p':'o');Object.assign(d.style,{left:Math.round(it.x)+'px',top:Math.round(it.y)+'px',width:Math.round(it.w)+'px',height:Math.round(it.h)+'px'});if(d.dataset.label!==it.label){d.title=it.label;d.setAttribute('aria-label',it.label);d.dataset.label=it.label;}}
  for(const [k,d] of old)if(!keep.has(k))d.remove();}
 draw(players,me,dt){if(!me)return;if(!this.imagesOk&&me.id)this.loadImages().catch(()=>{});/* 3D: disegno 2D solo quando le sue immagini sono arrivate */FRONT_NOW=MODE.front&&me.room==='lungomare';this.time+=dt;this.hitPlayers=[];const c=this.ctx;c.setTransform(this.dpr,0,0,this.dpr,0,0);const sky=c.createLinearGradient(0,0,0,this.h);sky.addColorStop(0,'#6dbad7');sky.addColorStop(.36,'#129fb8');sky.addColorStop(1,'#075b82');c.fillStyle=sky;c.fillRect(0,0,this.w,this.h);
  const target=this.freeCam?{...this.freeCam}:iso(me.x,me.y);if(Math.hypot(target.x-this.camera.x,target.y-this.camera.y)>900)this.camera={...target};const smooth=1-Math.exp(-8*dt);this.camera.x+=(target.x-this.camera.x)*smooth;this.camera.y+=(target.y-this.camera.y)*smooth;const zoom=(this.freeCam?this.freeZoom||1:this.zoom)*Math.min(1.10,Math.max(.62,Math.min(this.h/775,this.w/400)));this.viewZoom=zoom;
  const shoreline=FRONT_NOW?F.SEA*F.K:(SHORE-BEACH)*19,screenY=wy=>(wy-this.camera.y)*zoom+this.h*ANCHOR;
  // Panorama agganciato all'orizzonte del mare disegnato: scorre con la telecamera, non resta incollato allo schermo.
  if(me.room==='lungomare'&&this.images.gulf){
   // Solo cielo, Vesuvio, castello e mare lontano (58% alto dell'immagine): il mare vicino è quello disegnato davanti alla spiaggia.
   const im=this.images.gulf,CROP=.58;const width=Math.max(this.w*1.15,1150),height=width*.48,spare=(width-this.w)/2,left=(this.w-width)/2-Math.max(-spare,Math.min(spare,this.camera.x*zoom*.1)),top=screenY(shoreline-SEA_DEPTH*.55)-height*CROP;
   c.drawImage(im,0,0,im.width,im.height*CROP,left,top,width,height*CROP);
   const t=this.time;for(let i=0;i<3;i++){const bx=((t*(7+i*4)+i*width*.31)%(width+120))-60;this.sprite(c,'boat',bx,top+height*(.60+i*.06)+Math.sin(t+i)*2,58+i*12);}
   for(let i=0;i<3;i++){c.save();c.globalAlpha=.52;this.sprite(c,'cloud',((t*(2+i)+i*width*.4)%(width+220))-110,top+height*(.10+i*.045),130+i*25);c.restore();}
   const castle=left+width*.36;if(castle-80>Math.min(330,this.w*.42)&&top+height*.29>20)this.label(c,'Castel dell’Ovo',castle,top+height*.29,'#ffffff','pin');
  }
  c.save();c.translate(this.w*.5,this.h*ANCHOR);c.scale(zoom,zoom);c.translate(-this.camera.x,-this.camera.y);const m=MAPS[me.room];const visible=(p,margin=400)=>Math.abs(p.x-this.camera.x)<this.w/zoom/2+margin&&Math.abs(p.y-this.camera.y)<this.h/zoom/2+margin;
  if(FRONT_NOW)this.frontGround(c,zoom);
  else if(me.room==='lungomare'){this.seaAndBeach(c,zoom);
   // Campagna oltre i confini: niente vuoto dopo il muro.
   const S=CITY_SIZE,far=1100,land=[iso(SHORE+40,-40),iso(far,-40),iso(far,far),iso(-40,far),iso(-40,SHORE+40)];this.polygon(c,land,'#8db368');
   for(let k=0;k<3;k++){c.fillStyle=['#7ea65c','#9bbf73','#86ad62'][k];const off=k*7+4;c.beginPath();for(let t=0;t<=S+off;t+=2){const a=iso(S+off,t),hill=Math.sin(t*.3+k)*6;t?c.lineTo(a.x,a.y-hill):c.moveTo(a.x,a.y-hill);}for(let t=S+off;t>=0;t-=2){const a=iso(t,S+off),hill=Math.sin(t*.27+k)*6;c.lineTo(a.x,a.y-hill);}c.lineTo(iso(S+off+3,S+off+3).x,iso(S+off+3,S+off+3).y);c.closePath();c.globalAlpha=.55;c.fill();c.globalAlpha=1;}}
  if(!FRONT_NOW){c.save();if(me.room==='lungomare'){c.beginPath();c.rect(-10000,SHORE*19,20000,20000);c.clip();}
  for(const {cx,cy,p} of this.visibleChunks(m,zoom))c.drawImage(this.chunk(me.room,cx,cy),p.x-CHUNK_SIZE*38-2,p.y-1,CHUNK_SIZE*76+4,CHUNK_SIZE*38+42);
  c.restore();}
  if(me.room==='lungomare'&&!FRONT_NOW){
   for(const street of STREETS){const a=iso(street.x,street.y),b=iso(street.x+street.w,street.y),d=iso(street.x,street.y+street.h),e=iso(street.x+street.w,street.y+street.h);c.strokeStyle='#f5e9d0';c.lineWidth=3;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(b.x,b.y);c.lineTo(e.x,e.y);c.lineTo(d.x,d.y);c.closePath();c.stroke();}
   const [walk,avenue]=STREETS;for(let k=0;k<6;k++){const x=avenue.x+k*avenue.w/6,y=walk.y;this.polygon(c,[iso(x,y),iso(x+.45,y),iso(x+.45,y+walk.h),iso(x,y+walk.h)],'#f7ecd7');}
   const line=(a,b,color,w)=>{const A=iso(a.x,a.y),B=iso(b.x,b.y);c.strokeStyle=color;c.lineWidth=w;c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.stroke();};
   const ring=(r,color,w)=>{const pts=[{x:r.x,y:r.y},{x:r.x+r.w,y:r.y},{x:r.x+r.w,y:r.y+r.h},{x:r.x,y:r.y+r.h}];for(let i=0;i<4;i++)line(pts[i],pts[(i+1)%4],color,w);};
   for(const g of GROUND)if(g.material==='parking'){for(let x=g.x+.6;x<g.x+g.w;x+=2.6){line({x,y:g.y+.3},{x,y:g.y+4.6},'#ffffffb0',2);if(g.h>12)line({x,y:g.y+g.h-4.6},{x,y:g.y+g.h-.3},'#ffffffb0',2);}}
   ring(TRACK_OUT,'#ffffffcc',2);ring(TRACK_IN,'#ffffffcc',2);ring({x:TRACK_OUT.x+1.5,y:TRACK_OUT.y+1.5,w:TRACK_OUT.w-3,h:TRACK_OUT.h-3},'#ffffff70',1.5);
   // Piscine incassate: pareti interne in ombra sui lati di fondo, bordo in pietra.
   for(const pool of POOLS){const A=iso(pool.x,pool.y+pool.h),B=iso(pool.x,pool.y),C=iso(pool.x+pool.w,pool.y),d=12;this.polygon(c,[A,B,C,{x:C.x,y:C.y+d},{x:B.x,y:B.y+d},{x:A.x,y:A.y+d}],'#1f7f9dcc');ring(pool,'#f4f1ea',5);}
  }else if(this.interiorArt(me.room)){this.drawArt(c,{base:[{x:0,y:14},{x:16,y:14},{x:16,y:0}]},this.interiorArt(me.room));}else{const a=iso(0,0),b=iso(16,0),d=iso(0,14),[w1,w2]={club:['#372852','#251c38'],mall:['#f2f5f7','#d5dee4'],bank:['#e4dccb','#c9bfaa'],burger:['#ffc928','#d2412f']}[me.room]||['#d5aa79','#ae805e'];this.polygon(c,[a,b,{x:b.x,y:b.y-105},{x:a.x,y:a.y-105}],w1);this.polygon(c,[a,d,{x:d.x,y:d.y-105},{x:a.x,y:a.y-105}],w2);}
  if(this.moveTarget){const q=iso(this.moveTarget.x,this.moveTarget.y),k=1+.15*Math.sin(this.time*6);c.save();c.strokeStyle='#5fe0ff';c.lineWidth=3;c.shadowColor='#2ab8ff';c.shadowBlur=8;c.beginPath();c.ellipse(q.x,q.y,16*k,8*k,0,0,7);c.stroke();c.fillStyle='#5fe0ff55';c.beginPath();c.ellipse(q.x,q.y,7,3.5,0,0,7);c.fill();c.restore();}
  for(const d of doors(me.room)){const p=iso(d.x,d.y);const glow=.35+.2*Math.sin(this.time*3);c.strokeStyle=`rgba(255,228,157,${glow})`;c.lineWidth=2;c.beginPath();c.ellipse(p.x,p.y,22,11,0,0,Math.PI*2);c.stroke();}
  const people=[...(this.noNpc?[]:crowd(me.room,this.seconds())),...players];
  this.dt=dt;this.lookBudget=1;
  const builds=m.buildings.map(b=>({...b,kind:'building',depth:FRONT_NOW?b.fy+b.fh:b.cx!==undefined?b.cx+b.cy:b.x+b.y+b.w/2+b.h/2})).filter(b=>visible(iso(b.cx??b.x,b.cy??b.y),700));
  const phaseNow=((this.worldTime||Date.now())%2400000)/2400000;this.night=Math.max(0,Math.cos(phaseNow*Math.PI*2))*.36;
  // Traffico: le auto della città si muovono sulle corsie e rispettano autobus, mezzi e persone.
  let busNow=null,traffic=[];if(me.room==='lungomare'&&!FRONT_NOW){busNow=busPosition(this.seconds());(this.traffic??=new Traffic()).update(dt,[{...busNow,bus:true},...players.filter(p=>p.room==='lungomare'&&!p.seat)]);traffic=this.traffic.entities();}
  const extra=me.room==='lungomare'?(FRONT_NOW?this.edgeFence():[{kind:'bus',...busNow},...traffic,...this.borderWalls(),...this.fences(),...this.edgeFence()]):[];
  const keep=['slot','atm','barberchair','rack','mirror','seat'],artRoom=me.room!=='lungomare'&&this.interiorArt(me.room);const others=[...m.props.filter(p=>!artRoom||keep.includes(p.kind)).map(p=>({...p,depth:p.x+p.y})),...extra.map(e=>({...e,depth:e.depth??e.x+e.y})),...people.map(p=>({...p,kind:'player',depth:p.x+p.y+.03}))].filter(e=>visible(iso(e.x,e.y)));this.seen={m,others};
  // Davanti/dietro rispetto al bordo frontale reale della base del palazzo, non al centro del rettangolo.
  if(FRONT_NOW)for(const e of others)e.depth=e.y+(e.kind==='player'?.03:0);
  else for(const e of others)for(const b of builds){const order=this.frontOrder(b,e);if(order<0)e.depth=Math.min(e.depth,b.depth-.01);else if(order>0)e.depth=Math.max(e.depth,b.depth+.01);}
  if(this.ghost&&me.room==='lungomare'){const g=this.ghost;if(g.building)builds.push({...g.building,kind:'building',ghost:true,depth:g.building.x+g.building.y+g.building.w/2+g.building.h/2});else others.push({...g,ghost:true,depth:g.x+g.y});}
  const entities=[...builds,...others,...(me.room==='lungomare'&&!FRONT_NOW?[{kind:'railing',depth:SHORE-.001,x:0,y:0}]:[])].sort((a,b)=>a.depth-b.depth);
  for(const e of entities){if(e.kind==='railing'){this.railing(c);continue;}const p=e.kind==='building'?iso(e.cx??e.x+e.w/2,e.cy??e.y+e.h/2):iso(e.x,e.y);if(e.kind!=='player'){c.save();c.fillStyle='#183c3925';c.shadowColor='#10262835';c.shadowBlur=12;c.beginPath();c.ellipse(p.x,p.y+7,e.kind==='building'?(e.w+e.h)*15:({palm:24,table:35,statue:32,flowerbed:42}[e.kind]||17),e.kind==='building'?28:9,0,0,7);c.fill();c.restore();}if(e.ghost){c.save();c.globalAlpha=.6;}if(e.kind==='building')this.building(c,e,me,!e.ghost);else if(e.kind==='player')this.avatar(c,e,me);else this.prop(c,e);if(e.ghost){c.restore();this.outline(c,e,this.ghost.valid===false?'#ff3b30':'#34c759');}else if(this.selectedId&&e.id===this.selectedId)this.outline(c,e,'#ffd35a');}
  // Punto di consegna: colonna di luce pulsante e cerchio a terra.
  if(me.room==='lungomare'&&this.jobTarget){const j=this.jobTarget,q=iso(j.x,j.y),t=this.time||0,a=.55+.25*Math.sin(t*4);c.save();const g=c.createLinearGradient(0,q.y-260,0,q.y);g.addColorStop(0,'rgba(255,211,90,0)');g.addColorStop(1,'rgba(255,211,90,'+a+')');c.fillStyle=g;c.fillRect(q.x-14,q.y-260,28,260);c.strokeStyle='rgba(255,211,90,'+(a+.2)+')';c.lineWidth=4;c.beginPath();c.ellipse(q.x,q.y,40+6*Math.sin(t*4),20+3*Math.sin(t*4),0,0,7);c.stroke();c.restore();this.label(c,'📦 '+j.name,q.x,q.y-270,'#ffd35a','pin');}
  if(me.room==='lungomare'&&!FRONT_NOW)for(const point of LANDMARKS){const p=iso(point.x,point.y);if(visible(p,100))this.label(c,point.name,p.x,p.y+50,'#ffffff','pin');}
  // Notte graduale: ciclo condiviso di 40 minuti, solo visivo.
  const phase=((this.worldTime||Date.now())%2400000)/2400000,night=Math.max(0,Math.cos(phase*Math.PI*2))*.36;
  c.save();c.fillStyle=`rgba(12,18,53,${night})`;c.fillRect(this.camera.x-this.w/zoom,this.camera.y-this.h/zoom,2*this.w/zoom,2*this.h/zoom);c.restore();
  if(night>.02)for(const lamp of m.props.filter(p=>p.kind==='lamp')){const q=iso(lamp.x,lamp.y);const glow=c.createRadialGradient(q.x,q.y-94,1,q.x,q.y-94,65);glow.addColorStop(0,'#ffeaa899');glow.addColorStop(1,'#ffcf6400');c.fillStyle=glow;c.fillRect(q.x-65,q.y-159,130,130);}
  if(me.room==='club'){for(let i=0;i<4;i++){const q=iso(3+i*3,7+Math.sin(this.time+i)*3);c.fillStyle=['#de42ce30','#3fffe230','#566dff30','#ffd35230'][i];c.beginPath();c.ellipse(q.x,q.y,65,30,0,0,7);c.fill();}}
  // Etichette dei giocatori sopra a tutto, come nell'HUD di riferimento.
  for(const p of players){const pos=iso(p.x,p.y);if(visible(pos))this.overlay(c,p,me,pos);}
  c.restore();
 }
 // Bordo frontale (sinistro→frontale→destro) della base in coordinate schermo: -1 dietro, 1 davanti, 0 lontano.
 frontOrder(b,e){if(!b.base)return 0;const s=iso(e.x,e.y),[L,F,R]=b.base.slice(0,3).map(q=>iso(q.x,q.y));if(s.x<L.x||s.x>R.x)return 0;const r=spriteRect(b);if(s.y<r.y-40||s.y>F.y+160)return 0;const front=s.x<=F.x?L.y+(F.y-L.y)*(s.x-L.x)/(F.x-L.x||1):F.y+(R.y-F.y)*(s.x-F.x)/(R.x-F.x||1);return s.y<front?-1:1;}
 mask(name){if(this.masks?.[name])return this.masks[name];const im=this.images[name];if(!im)return null;const cv=document.createElement('canvas');cv.width=im.width;cv.height=im.height;const g=cv.getContext('2d');g.drawImage(im,0,0);const data=g.getImageData(0,0,im.width,im.height).data,alpha=new Uint8Array(im.width*im.height);for(let i=0;i<alpha.length;i++)alpha[i]=data[i*4+3];(this.masks??={})[name]={alpha,w:im.width,h:im.height};return this.masks[name];}
 // Confini del quartiere: muro con cornicione alto sul retro, muretto basso sui lati verso chi guarda.
 borderWalls(){return [];if(this.walls)return this.walls;const S=CITY_SIZE,list=[],seg=(ax,ay,bx,by,h,front)=>list.push({ax,ay,bx,by,h,x:(ax+bx)/2,y:(ay+by)/2,depth:(ax+bx+ay+by)/2+(front?.6:-.6),kind:'wall'});
  for(let t=SHORE;t<S;t+=3){const e=Math.min(S,t+3);seg(t,0,e,0,46,false);seg(0,t,0,e,46,false);}
  for(let t=0;t<S;t+=3){const e=Math.min(S,t+3);seg(S,t,S,e,30,true);seg(t,S,e,S,30,true);}
  return this.walls=list;}
 project(x,y){return MODE.front?{x:x*F.T,y:y*F.K}:{x:(x-y)*38,y:(x+y)*19};}
 screenToWorld(sx,sy){const z=this.viewZoom||1,X=(sx-this.w*.5)/z+this.camera.x,Y=(sy-this.h*ANCHOR)/z+this.camera.y;if(FRONT_NOW)return {x:X/F.T,y:Y/F.K};return {x:(X/38+Y/19)/2,y:(Y/19-X/38)/2};}
 // Staccionata sul bordo della zona giocabile (si ricalcola quando cambia la vista).
 edgeFence(){const E=cityEdge(),k=JSON.stringify(E)+FRONT_NOW;if(this.edgeKey===k)return this.edgeList;const list=[],run=(ax,ay,bx,by)=>{const n=Math.max(1,Math.round(Math.hypot(bx-ax,by-ay)/1.5));for(let i=0;i<n;i++){const a1=ax+(bx-ax)*i/n,b1=ay+(by-ay)*i/n,a2=ax+(bx-ax)*(i+1)/n,b2=ay+(by-ay)*(i+1)/n;list.push({kind:'fence',ax:a1,ay:b1,bx:a2,by:b2,x:(a1+a2)/2,y:(b1+b2)/2,depth:FRONT_NOW?(b1+b2)/2:(a1+a2+b1+b2)/2});}};
  const top=FRONT_NOW?F.BEACH:E.y0;run(E.x1,top,E.x1,E.y1);run(E.x0,E.y1,E.x1,E.y1);run(E.x0,top,E.x0,E.y1);if(!FRONT_NOW)run(E.x0,E.y0,E.x1,E.y0);this.edgeKey=k;return this.edgeList=FRONT_NOW?list:list.filter(f=>f.x+f.y>SHORE+1);}
 fences(){if(this.fenceList)return this.fenceList;const list=[],seg=(ax,ay,bx,by)=>list.push({kind:'fence',ax,ay,bx,by,x:(ax+bx)/2,y:(ay+by)/2,depth:(ax+bx+ay+by)/2});
  const run=(ax,ay,bx,by)=>{const n=Math.max(1,Math.round(Math.hypot(bx-ax,by-ay)/1.5));for(let i=0;i<n;i++)seg(ax+(bx-ax)*i/n,ay+(by-ay)*i/n,ax+(bx-ax)*(i+1)/n,ay+(by-ay)*(i+1)/n);};
  for(const l of VILLA_LOTS){run(l.x,l.y,l.x+l.w,l.y);run(l.x,l.y,l.x,l.y+l.h);run(l.x+l.w,l.y,l.x+l.w,l.y+l.h);let x=l.x;for(const [a,b] of FENCE_GATES(l)){run(x,l.y+l.h,a,l.y+l.h);x=b;}run(x,l.y+l.h,l.x+l.w,l.y+l.h);}
  return this.fenceList=list;}
 coversBox(b,me){if(this.frontOrder(b,me)>=0)return false;const s=iso(me.x,me.y),pts=b.base.map(q=>iso(q.x,q.y)),hull=[pts[0],pts[1],pts[2],{x:pts[2].x,y:pts[2].y-b.height},{x:pts[3].x,y:pts[3].y-b.height},{x:pts[0].x,y:pts[0].y-b.height}];
  return [30,70].some(dy=>{const x=s.x,y=s.y-dy;let inside=false;for(let i=0,j=hull.length-1;i<hull.length;j=i++){const a=hull[i],q=hull[j];if((a.y>y)!==(q.y>y)&&x<(q.x-a.x)*(y-a.y)/(q.y-a.y)+a.x)inside=!inside;}return inside;});}
 // Il palazzo si schiarisce solo se i suoi pixel coprono davvero il personaggio che gli sta dietro.
 covers(b,r,me){if(this.frontOrder(b,me)>=0)return false;const m=this.mask(b.atlas||'buildings');if(!m)return false;const s=iso(me.x,me.y);for(const dy of [25,55,85]){const u=Math.floor(r.sx+(s.x-r.x)/r.width*r.sw),v=Math.floor(r.sy+(s.y-dy-r.y)/r.height*r.sh);if(u<r.sx||u>=r.sx+r.sw||v<r.sy||v>=r.sy+r.sh)continue;const k=m.w/1254;if(m.alpha[Math.floor(v*k)*m.w+Math.floor(u*k)]>120)return true;}return false;}
 // Scatola isometrica generica: facce visibili (normale verso chi guarda), poi il tetto. corners in senso orario, coordinate mondo.
 box(c,corners,height,colors,decorate){const n=corners.length,cx=corners.reduce((a,q)=>a+q.x,0)/n,cy=corners.reduce((a,q)=>a+q.y,0)/n;const faces=[];
  for(let i=0;i<n;i++){const a=corners[i],b=corners[(i+1)%n],mx=(a.x+b.x)/2,my=(a.y+b.y)/2;if((mx-cx)+(my-cy)<=0)continue;faces.push({a,b,depth:mx+my,side:(mx-cx)>(my-cy)?'right':'left'});}
  faces.sort((p,q)=>p.depth-q.depth);
  for(const f of faces){const A=iso(f.a.x,f.a.y),B=iso(f.b.x,f.b.y);this.polygon(c,[A,B,{x:B.x,y:B.y-height},{x:A.x,y:A.y-height}],colors[f.side]||colors.left);decorate?.(f,A,B);}
  const top=corners.map(q=>{const p=iso(q.x,q.y);return {x:p.x,y:p.y-height};});this.polygon(c,top,colors.top,colors.edge);return top;}
 // Punto su una faccia: u lungo il lato (0..1), v altezza in pixel.
 facePoint(A,B,u,v){return {x:A.x+(B.x-A.x)*u,y:A.y+(B.y-A.y)*u-v};}
 faceRect(c,A,B,u0,u1,v0,v1,fill){this.polygon(c,[this.facePoint(A,B,u0,v0),this.facePoint(A,B,u1,v0),this.facePoint(A,B,u1,v1),this.facePoint(A,B,u0,v1)],fill);}
 faceText(c,A,B,u,v,text,font,color,board){if(B.x<A.x){[A,B]=[B,A];u=1-u;}const P=this.facePoint(A,B,u,v),dx=B.x-A.x,dy=B.y-A.y,len=Math.hypot(dx,dy);c.save();c.translate(P.x,P.y);c.transform(dx/len,dy/len,0,1,0,0);c.font=font;c.textAlign='center';c.textBaseline='middle';const w=c.measureText(text).width+16;if(board){c.fillStyle=board;c.fillRect(-w/2,-11,w,22);}c.fillStyle=color;c.fillText(text,0,1);c.restore();}
 windows(c,A,B,height,cols,floors,fill,from=18){for(let f=0;f<floors;f++)for(let k=0;k<cols;k++){const u0=(k+.3)/cols,u1=(k+.7)/cols,v0=from+f*(height-from)/floors+6,v1=v0+(height-from)/floors*.5;this.faceRect(c,A,B,u0,u1,v0,v1,fill);}}
 // Edifici moderni: facciate pulite, vetrate con riflessi, balconi in vetro, vetrine al piano terra, tetti tecnici.
 glass(c,A,B,u0,u1,v0,v1,lit){const P=(u,v)=>this.facePoint(A,B,u,v);const g=c.createLinearGradient(P(u0,v1).x,P(u0,v1).y,P(u1,v0).x,P(u1,v0).y);if(lit){g.addColorStop(0,'#ffe2a8');g.addColorStop(1,'#f3b765');}else{g.addColorStop(0,'#9ecbe3');g.addColorStop(.45,'#5d8fb0');g.addColorStop(.55,'#d8eef8');g.addColorStop(1,'#46799b');}
  this.polygon(c,[P(u0,v0),P(u1,v0),P(u1,v1),P(u0,v1)],g,'#2f3b44');}
 floorsOf(H,ground){return Math.max(1,Math.round((H-ground)/34));}
 facade(c,A,B,H,o){const {ground=40,cols=4,balcony=false,lit=false,frame='#3a4650'}=o,floors=this.floorsOf(H,ground),fh=(H-ground)/floors;
  for(let f=0;f<floors;f++){const v0=ground+f*fh;this.faceRect(c,A,B,0,1,v0,v0+2,'#00000014');
   for(let k=0;k<cols;k++){const u0=(k+.18)/cols,u1=(k+.82)/cols;this.faceRect(c,A,B,u0-.012,u1+.012,v0+5,v0+fh-5,frame);this.glass(c,A,B,u0,u1,v0+7,v0+fh-7,lit&&((f*7+k*3)%5<2));}
   if(balcony&&f<floors-1){this.faceRect(c,A,B,.04,.96,v0+fh-3,v0+fh+1,'#d9dde0');this.faceRect(c,A,B,.04,.96,v0+fh-14,v0+fh-3,'#cfe8f3aa');this.faceRect(c,A,B,.04,.96,v0+fh-15,v0+fh-14,'#ffffff');}}}
 shopfront(c,A,B,o){const {awning,sign,signColor='#ffffff',board='#1f2a33',lit,door='#2d3a44',font='bold 13px system-ui'}=o;
  this.faceRect(c,A,B,0,1,0,40,'#2b3238');this.glass(c,A,B,.05,.42,4,34,lit);this.glass(c,A,B,.58,.95,4,34,lit);this.faceRect(c,A,B,.44,.56,0,36,door);this.glass(c,A,B,.46,.54,2,32,lit);
  if(awning){for(let k=0;k<12;k++)this.faceRect(c,A,B,k/12,(k+1)/12,36,46,k%2?'#ffffff':awning);}
  if(sign)this.faceText(c,A,B,.5,awning?56:48,sign,font,signColor,board);}
 roof(c,b,top,o={}){const [L,F,R,B]=top;this.polygon(c,top,o.color||'#cfd3d6',o.edge||'#9aa3a9');
  const inset=(t)=>[L,F,R,B].map(p=>({x:p.x+(((L.x+R.x)/2)-p.x)*t,y:p.y+(((F.y+B.y)/2)-p.y)*t}));this.polygon(c,inset(.12),o.inner||'#b9bfc3');
  if(o.solar){const s=inset(.45);this.polygon(c,s.map(p=>({x:p.x,y:p.y-3})),'#2c4a6e','#9fb7cf');}
  if(o.units)for(let i=0;i<2;i++){const q=iso(b.fx+b.fw*(.3+i*.35),b.fy+b.fh*.35),y=q.y-b.height;c.fillStyle='#e9ecee';c.fillRect(q.x-9,y-12,18,12);c.fillStyle='#b4bbc0';c.fillRect(q.x-9,y-12,18,3);c.strokeStyle='#8a9399';c.beginPath();c.arc(q.x,y-5,4,0,7);c.stroke();}}
 // Villetta mediterranea: due piani, tetto a padiglione in cotto, persiane, balcone, portoncino con gradini.
 villa(c,b){const [L,F,R,Bk]=b.base,H=b.height,lit=this.night>.08,wall=b.color,shut=['#2f6b4a','#3b6e8f','#7a4b2e','#2f6b4a'][b.id.length%4];
  this.box(c,[L,F,R,Bk],H,{left:wall,right:shade(wall,-.13),top:wall},(f,A,B)=>{const front=f.side==='left';
   this.faceRect(c,A,B,0,1,0,9,'#c9bda8');this.faceRect(c,A,B,0,1,H/2-3,H/2+2,'#e2d7c3');this.faceRect(c,A,B,0,1,H-6,H,'#e2d7c3');
   const cols=front?3:2;for(const fl of [0,1])for(let k=0;k<cols;k++){const u=(k+.5)/cols,v0=fl?H/2+12:16,v1=fl?H-16:H/2-12;if(front&&fl===0&&k===1)continue;
    this.faceRect(c,A,B,u-.075,u-.04,v0,v1,shut);this.faceRect(c,A,B,u+.04,u+.075,v0,v1,shut);this.glass(c,A,B,u-.04,u+.04,v0,v1,lit);this.faceRect(c,A,B,u-.08,u+.08,v0-3,v0,'#d8cdb9');}
   if(front){this.faceRect(c,A,B,.43,.57,0,40,'#5a3a26');this.faceRect(c,A,B,.45,.55,2,38,'#7a5236');this.faceRect(c,A,B,.38,.62,-2,2,'#bdb3a2');this.faceRect(c,A,B,.36,.64,-5,-2,'#a89e8d');
    for(const u of [.39,.61]){const q=this.facePoint(A,B,u,30);c.fillStyle=lit?'#ffd98a':'#f3e3b0';c.beginPath();c.arc(q.x,q.y,3,0,7);c.fill();}
    this.faceRect(c,A,B,.3,.7,H/2+2,H/2+5,'#d9d2c5');for(let k=0;k<=10;k++)this.faceRect(c,A,B,.3+k*.04,.3+k*.04+.006,H/2+5,H/2+18,'#3a3f44');this.faceRect(c,A,B,.3,.7,H/2+17,H/2+19,'#3a3f44');}});
  // Tetto a padiglione: colmo lungo il lato maggiore, falde in cotto con file di coppi.
  const up=q=>{const p=iso(q.x,q.y);return {x:p.x,y:p.y-H};},T=[L,F,R,Bk].map(up),rise=34,cx=(b.fx+b.fw/2),cy=(b.fy+b.fh/2),half=Math.max(0,(b.fw-b.fh)/2);
  const r1=iso(cx-half,cy),r2=iso(cx+half,cy),R1={x:r1.x,y:r1.y-H-rise},R2={x:r2.x,y:r2.y-H-rise};
  const tiles=(poly,a,b2,col)=>{this.polygon(c,poly,col,'#7a3a22');c.save();c.beginPath();poly.forEach((p,i)=>i?c.lineTo(p.x,p.y):c.moveTo(p.x,p.y));c.closePath();c.clip();c.strokeStyle='#00000026';c.lineWidth=1.2;for(let t=.12;t<1;t+=.12){c.beginPath();c.moveTo(a.x+(R1.x-a.x)*t,a.y+(R1.y-a.y)*t);c.lineTo(b2.x+(R2.x-b2.x)*t,b2.y+(R2.y-b2.y)*t);c.stroke();}c.restore();};
  this.polygon(c,[T[3],T[0],R1],'#a8502f');this.polygon(c,[T[2],T[3],R1,R2],'#a8502f');
  tiles([T[0],T[1],R2,R1],T[0],T[1],'#c4643c');this.polygon(c,[T[1],T[2],R2],'#b3582f','#7a3a22');
  c.strokeStyle='#e8d9c2';c.lineWidth=3;c.beginPath();c.moveTo(R1.x,R1.y);c.lineTo(R2.x,R2.y);c.stroke();
  const ch=iso(b.fx+b.fw*.75,b.fy+b.fh*.3);c.fillStyle='#d9cdb8';c.fillRect(ch.x-5,ch.y-H-rise-6,10,22);c.fillStyle='#8a4a2c';c.fillRect(ch.x-6,ch.y-H-rise-9,12,4);}
 procBuilding(c,b){if(b.style==='villa')return this.villa(c,b);const [L,F,R,Bk]=b.base,H=b.height,s=b.style,lit=this.night>.08;const col=b.color||'#eceff1';
  const pal={apartment:{left:col,right:shade(col,-.12),top:'#d6d9dc'},cafe:{left:col,right:shade(col,-.12),top:'#d6d9dc'},restaurant:{left:col,right:shade(col,-.12),top:'#d0c9bf'},store:{left:'#eef1f4',right:'#cfd5db',top:'#dfe3e6'},club:{left:'#2b2440',right:'#1d1830',top:'#3a3152'},
   fashion:{left:'#f6f3ee',right:'#dcd6cc',top:'#e8e3da'},barber:{left:'#f4f1ea',right:'#d8d2c6',top:'#dedad2'},casino:{left:'#1b1426',right:'#120d1b',top:'#2a2038'},bank:{left:'#eceae4',right:'#cfccc3',top:'#d8d6cf'},burger:{left:'#d2412f',right:'#a93325',top:'#2b2b2b'},mall:{left:'#b8d6e6',right:'#93bad0',top:'#eef3f6'},villa:{left:col,right:shade(col,-.1),top:'#e3e3e0'}}[s];
  const top=this.box(c,[L,F,R,Bk],H,pal,(f,A,B)=>{const front=f.side==='left';
   if(s==='apartment'){this.facade(c,A,B,H,{ground:front?44:12,cols:front?4:3,balcony:front,lit});if(front)this.shopfront(c,A,B,{awning:['#2a6fd6','#e5484d','#2f9e5b','#f2a33a'][b.id.length%4],lit});else this.faceRect(c,A,B,0,1,0,12,'#c9cdd0');}
   else if(s==='cafe'){this.facade(c,A,B,H,{ground:front?50:12,cols:front?4:3,balcony:front,lit});if(front)this.shopfront(c,A,B,{awning:'#c8432f',sign:'BAR VESPRO',board:'#c8432f',lit,font:'bold 15px Georgia'});}
   else if(s==='restaurant'){this.facade(c,A,B,H,{ground:front?50:12,cols:front?4:3,lit});if(front)this.shopfront(c,A,B,{awning:'#2f7d4a',sign:b.name.toUpperCase(),board:'#3b2a20',signColor:'#ffe7b0',lit,font:'bold 12px Georgia'});}
   else if(s==='store'){this.facade(c,A,B,H,{ground:front?60:12,cols:4,lit});if(front){this.faceRect(c,A,B,0,1,0,60,'#1f3b4d');this.glass(c,A,B,.04,.96,6,46,true);this.faceText(c,A,B,.5,53,'BOTTEGA MARINA','bold 13px system-ui','#ffffff');}}
   else if(s==='club'){this.facade(c,A,B,H,{ground:front?54:12,cols:3,lit:true,frame:'#120e1f'});if(front){this.faceRect(c,A,B,0,1,0,54,'#120e1f');this.faceRect(c,A,B,.35,.65,0,40,'#7b2cbf');this.faceText(c,A,B,.5,47,'LUNA CLUB','bold 15px system-ui','#ff7bf2');this.faceRect(c,A,B,0,1,52,55,'#ff4fd8');}}
   else if(s==='fashion'){this.faceRect(c,A,B,0,1,H-34,H,'#111');this.faceText(c,A,B,.5,H-17,front?'MODA MARKET · ABITI · BORSE · SCARPE':'MODA MARKET','bold 15px Georgia','#f4d58d');
     for(let k=0;k<6;k++){this.glass(c,A,B,k/6+.02,(k+1)/6-.02,6,H-44,true);}if(front){this.faceRect(c,A,B,.44,.56,0,46,'#111');this.glass(c,A,B,.46,.54,2,44,true);
      for(const u of [.12,.28,.72,.88]){const q=this.facePoint(A,B,u,30);c.fillStyle='#f2e6d8';c.beginPath();c.arc(q.x,q.y-8,4,0,7);c.fill();c.fillStyle=['#d93a3a','#1f3a6b','#2f9e5b','#ff7ab6'][Math.round(u*10)%4];c.fillRect(q.x-6,q.y-4,12,16);}}}
   else if(s==='barber'){this.facade(c,A,B,H,{ground:front?52:12,cols:3,lit});if(front){this.shopfront(c,A,B,{sign:'✂ BARBIERE TOTÒ',board:'#1f2a33',signColor:'#ffffff',lit});
     const q=this.facePoint(A,B,.08,10);for(let k=0;k<5;k++){c.fillStyle=k%2?'#ffffff':(k%4?'#2a6fd6':'#d93a3a');c.fillRect(q.x-3,q.y-k*7-7,6,7);}}}
   else if(s==='casino'){this.faceRect(c,A,B,0,1,H-30,H,'#d4a73a');this.faceRect(c,A,B,0,1,H-27,H-3,'#1b1426');for(let k=0;k<=24;k++){const q=this.facePoint(A,B,k/24,H-15);c.fillStyle=(k+Math.floor(this.time*4))%3?'#ffe9a0':'#ff5a8a';c.beginPath();c.arc(q.x,q.y,2.2,0,7);c.fill();}
     if(front){this.faceText(c,A,B,.5,H-15,'🎰 SALA SLOT VESUVIO','bold 15px system-ui','#ffd35a');this.faceRect(c,A,B,.35,.65,0,52,'#d4a73a');this.glass(c,A,B,.38,.62,2,48,true);this.faceRect(c,A,B,.4,.6,-4,0,'#b3122f');}
     for(let k=0;k<3;k++)if(!front||k!==1)this.glass(c,A,B,k/3+.06,k/3+.27,64,H-40,true);}
   else if(s==='bank'){this.facade(c,A,B,H,{ground:front?62:14,cols:front?5:3,lit});if(front){this.faceRect(c,A,B,0,1,0,62,'#1c2f45');this.glass(c,A,B,.3,.7,4,50,lit);this.faceRect(c,A,B,.48,.52,0,50,'#1c2f45');
     this.faceText(c,A,B,.5,57,'🏦 BANCA DEL GOLFO','bold 13px system-ui','#f5d27a');this.faceRect(c,A,B,.08,.2,16,44,'#0f1a26');this.faceRect(c,A,B,.1,.18,30,40,'#5fd0ff');this.faceText(c,A,B,.14,22,'ATM','bold 8px system-ui','#f5d27a');this.faceRect(c,A,B,.8,.92,16,44,'#0f1a26');this.faceRect(c,A,B,.82,.9,30,40,'#5fd0ff');}}
   else if(s==='burger'){this.faceRect(c,A,B,0,1,H-26,H,'#ffc928');this.glass(c,A,B,.06,.94,10,56,true);if(front)this.faceText(c,A,B,.5,H-13,'🍔 BURGER DRIVE','bold 15px system-ui','#c8432f');else{this.faceRect(c,A,B,.3,.7,22,50,'#2b2b2b');this.faceText(c,A,B,.5,36,'DRIVE ➜','bold 11px system-ui','#ffc928');}}
   else if(s==='mall'){for(let k=0;k<14;k++)this.glass(c,A,B,k/14+.004,(k+1)/14-.004,8,H-44,lit&&k%3===0);this.faceRect(c,A,B,0,1,H-42,H-4,'#ffffff');if(front){this.faceText(c,A,B,.5,H-23,'🛍 CENTRO COMMERCIALE GOLFO','bold 18px system-ui','#1d5f86');this.faceRect(c,A,B,.42,.58,0,44,'#1d5f86');this.glass(c,A,B,.44,.56,2,40,true);}}
   else if(s==='villa'){this.faceRect(c,A,B,0,front?.42:.3,0,H,'#9b6b45');for(let k=0;k<8;k++)this.faceRect(c,A,B,k*(front?.42:.3)/8,k*(front?.42:.3)/8+.004,0,H,'#7d5536');this.glass(c,A,B,front?.5:.38,.94,8,H/2-6,lit);this.glass(c,A,B,front?.5:.38,.94,H/2+6,H-10,lit);this.faceRect(c,A,B,0,1,H/2-2,H/2+3,'#e9e9e6');}
  });
  this.roof(c,b,top,{solar:['apartment','villa','mall','store'].includes(s),units:['apartment','cafe','restaurant','bank','store','club'].includes(s),color:pal.top,edge:shade(pal.top,-.25),inner:shade(pal.top,-.08)});}
 // Immagini illustrate degli edifici (client/assets/edifici): caricate in background, se mancano resta il disegno a codice.
 loadArt(){if(this.artLoading||globalThis.HUMANA_3D)return; // il 3D costruisce gli interni da solo: non scarica i ~55 MB di disegni 2D
  this.artLoading=true;this.art={};fetch((this.assetBase||'')+'/assets/edifici/basi.json').then(r=>r.ok?r.json():{}).then(bases=>{for(const [name,base] of Object.entries(bases)){const im=new Image();im.onload=()=>{this.art[name]={im,...base};};im.src=(this.assetBase||'')+'/assets/edifici/'+name+'.png';}}).catch(()=>{});}
 interiorArt(room){this.loadArt();const n=room.startsWith('villa')?'int-villa':['osteria','vesuvio','trattoria','panorama'].includes(room)?'int-ristorante':'int-'+({shop:'negozio',club:'discoteca',bank:'banca',fashion:'moda',barber:'barbiere',casino:'slot',mall:'centro-commerciale'}[room]||room);return this.art?.[n];}
 artFor(b){this.loadArt();if(b.art)return this.art?.[b.art];const id=b.id,n=id.startsWith('residence')?'palazzo-'+(Number(id.slice(9))%4+1):id.startsWith('villa')?'villa-'+(Number(id.slice(5))%4+1):{shop:'negozio',club:'discoteca',bank:'banca',fashion:'moda',barber:'barbiere',casino:'slot',mall:'centro-commerciale'}[id]||id;return this.art?.[n];}
 // Trasformazione affine che porta gli angoli sinistro, frontale e destro della base dell'immagine sugli angoli della base reale.
 // Scala uniforme (immagine sempre dritta): larghezza della base adattata, angolo frontale appoggiato sul suo punto.
 drawArt(c,b,a,ground=false){if(b.flip&&!b._f){const [L,,R]=b.base.slice(0,3).map(q=>iso(q.x,q.y)),mx=(L.x+R.x)/2,mb=b.base.map(q=>{const p=iso(q.x,q.y),w=screenToIso(2*mx-p.x,p.y);return w;});const [l,f,r,k]=mb;c.save();c.translate(mx,0);c.scale(-1,1);c.translate(-mx,0);const res=this.drawArt(c,{...b,_f:1,base:[r,f,l,k]},a,ground);c.restore();return res;}const P=b.base.map(q=>iso(q.x,q.y)),[L,F,R]=P;
 if(ground){// Ombra portata (luce da sinistra in alto) e occlusione di contatto lungo le fondamenta.
  const Bk=P[3],sh=(p,k)=>({x:p.x+k*1.6,y:p.y+k*.35}),k=Math.min(60,(a.h/a.w)*(R.x-L.x)*.35);c.save();this.polygon(c,[F,R,sh(R,k),sh(F,k)],'rgba(15,20,28,.30)');this.polygon(c,[R,Bk,sh(Bk,k),sh(R,k)],'rgba(15,20,28,.22)');c.restore();
  for(const [A,B] of [[L,F],[F,R]]){const nx=0,g=c.createLinearGradient(0,(A.y+B.y)/2,0,(A.y+B.y)/2+12);g.addColorStop(0,'rgba(10,12,16,.45)');g.addColorStop(1,'rgba(10,12,16,0)');c.fillStyle=g;c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.lineTo(B.x,B.y+12);c.lineTo(A.x,A.y+12);c.closePath();c.fill();}}
 // Mappatura sulla griglia 2:1: i due lati della base dell'immagine combaciano con i lati del lotto.
 const sx=(R.x-L.x)/a.w,sy=a.sl&&a.clean?((F.y-L.y)/(a.F[0]*sx))/a.sl:1,s=sx,x0=F.x-a.F[0]*s,y0=F.y-a.F[1]*s*sy;
 c.save();if(!a.clean){c.beginPath();c.moveTo(L.x-2,L.y);c.lineTo(F.x,F.y+1);c.lineTo(R.x+2,R.y);c.lineTo(R.x+2,y0-10);c.lineTo(L.x-2,y0-10);c.closePath();c.clip();}c.drawImage(a.im,x0,y0,a.im.width*s,a.im.height*s*sy);c.restore();return true;}
 building(c,b,me,fade=false){if(b.front&&FRONT_NOW)return this.frontBuilding(c,b,me,fade);let art=b.proc&&this.artFor(b);if(art&&b.tint)art={...art,im:this.tinted(art.im,'b:'+(b.art||b.id),b.tint)};if(art){c.save();if(fade){const sc=(iso(b.base[2].x,b.base[2].y).x-iso(b.base[0].x,b.base[0].y).x)/art.w,target=this.coversBox({...b,height:art.h*sc*.9},me)?.5:1,now=this.fades?.get(b.id)??1,alpha=now+(target-now)*Math.min(1,(this.dt||.016)*7);(this.fades??=new Map()).set(b.id,alpha);c.globalAlpha=alpha;}this.drawArt(c,b,art,true);c.restore();return;}
  if(b.proc){c.save();if(fade){const target=this.coversBox(b,me)?.42:1,now=this.fades?.get(b.id)??1,alpha=now+(target-now)*Math.min(1,(this.dt||.016)*7);(this.fades??=new Map()).set(b.id,alpha);c.globalAlpha=alpha;}this.procBuilding(c,b);c.restore();return;}
  const image=this.images[b.atlas||'buildings'];if(!image)return;const r=spriteRect(b);c.save();
  if(fade){const target=this.covers(b,r,me)?.42:1,now=this.fades?.get(b.id)??1,alpha=now+(target-now)*Math.min(1,(this.dt||.016)*7);(this.fades??=new Map()).set(b.id,alpha);c.globalAlpha=alpha;}
  const k=image.width/1254;c.drawImage(image,r.sx*k,r.sy*k,r.sw*k,r.sh*k,r.x,r.y,r.width,r.height);c.restore();}
 // In sella o al volante: due ruote sotto i piedi, le auto coprono il corpo dal busto in giù.
 avatar(c,p,me){const v=p.vehicle&&!p.seat&&VEHICLE[p.vehicle];if(!v)return this.avatarBase(c,p,me);const ride={kind:'ride',v:v.id,x:p.x,y:p.y,direction:p.direction||0},car=['auto','furgone','cabrio'].includes(v.id);const closed=v.id==='auto'||v.id==='furgone';if(closed){this.prop(c,ride);return;}if(!car)this.prop(c,ride);c.save();c.translate(0,car?-6:v.id==='scooter'?-24:v.id==='bici'?-26:-18);this.avatarBase(c,p,me);c.restore();this.prop(c,car?ride:{...ride,front:true});}
 avatarBase(c,p,me){if(p.seat==='car')return;if(p.seat==='bus'){this.prop(c,{kind:'bus',x:p.x,y:p.y,direction:p.direction||0,rider:true});return;}const pos=iso(p.x,p.y);const shape=({slim:.88,regular:1,broad:1.12})[p.avatar.body]||1;c.save();c.translate(pos.x,pos.y);c.scale(shape*1.12,1.12);c.translate(-pos.x,-pos.y);c.fillStyle='#16393755';c.beginPath();c.ellipse(pos.x,pos.y+3,15,7,0,0,Math.PI*2);c.fill();
  if(p.id===me.id){c.save();c.shadowColor='#2ab8ff';c.shadowBlur=12;c.fillStyle='#4fd8ff26';c.strokeStyle='#5fe0ff';c.lineWidth=3;c.beginPath();c.ellipse(pos.x,pos.y+2,22,11,0,0,Math.PI*2);c.fill();c.stroke();c.restore();}
  const action=p.seat?'SIT':(!p.moving?p.animation:null),poseRow={SIT:0,WAVE:1,CLAP:2,DANCE:3,LAUGH:2}[action];const name=poseRow!==undefined?'social-poses':'avatar';const spec=!p.npc&&playerSpec(p.avatar),im=p.npc?this.look(name,p.look):spec?this.look(name,spec):this.images[name];
  if(im){const screenX=Math.cos(p.direction)-Math.sin(p.direction),screenY=Math.cos(p.direction)+Math.sin(p.direction);const row=poseRow!==undefined?poseRow:screenY>=0?(screenX>=0?0:1):(screenX>=0?2:3);const frame=poseRow!==undefined?Math.floor(this.time*(action==='SIT'?2:5))%4:p.moving?Math.floor(this.time*(p.running?11:7))%4:0;const s=im.width/4;const h=im.height/4;const bob=p.seat?0:p.animation==='DANCE'?Math.sin(this.time*9)*4:p.animation==='LAUGH'?Math.sin(this.time*15)*2:0;c.save();if(!p.npc&&p.avatar.outfit==='sea')c.filter='hue-rotate(140deg)';if(!p.npc&&p.avatar.outfit==='jade')c.filter='hue-rotate(70deg)';if(!p.npc&&p.avatar.outfit==='sunset')c.filter='hue-rotate(-35deg) saturate(1.3)';if(!p.npc&&p.avatar.outfit==='night')c.filter='hue-rotate(200deg) brightness(.85)';if(p.animation==='DANCE'){c.translate(pos.x,pos.y);c.rotate(Math.sin(this.time*6)*.07);c.translate(-pos.x,-pos.y);}{const sx2=Math.cos(p.direction)-Math.sin(p.direction),sy2=Math.cos(p.direction)+Math.sin(p.direction);c.save();c.filter='none';this.outfit(c,p,pos,sy2>=0||p.seat,sx2,bob,'back');c.restore();}c.drawImage(im,frame*s,row*h,s,h,pos.x-51,pos.y-99+bob,102,110);c.restore();}
  {const sx=Math.cos(p.direction)-Math.sin(p.direction),sy=Math.cos(p.direction)+Math.sin(p.direction);this.outfit(c,p,pos,sy>=0||p.seat,sx,p.animation==='DANCE'&&!p.moving?Math.sin(this.time*9)*4:0);}
  if(!p.avatar.wear?.hat&&p.avatar.accessory==='cap'){c.fillStyle=p.avatar.color;c.beginPath();c.ellipse(pos.x,pos.y-87,12,4,0,0,Math.PI*2);c.fill();}if(p.avatar.accessory==='flower'){c.font='17px sans-serif';c.fillText('🌺',pos.x+3,pos.y-85);}
  if(p.avatar.glasses){c.strokeStyle='#182732';c.lineWidth=2;c.beginPath();c.roundRect(pos.x-9,pos.y-79,8,6,2);c.roundRect(pos.x+1,pos.y-79,8,6,2);c.moveTo(pos.x-1,pos.y-77);c.lineTo(pos.x+1,pos.y-77);c.stroke();}c.restore();
  if(!p.npc)this.hitPlayers.push({id:p.id,x:(pos.x-this.camera.x)*this.viewZoom+this.w*.5,y:(pos.y-this.camera.y)*this.viewZoom+this.h*ANCHOR-45*this.viewZoom});
 }
 // Capelli, barba e accessori disegnati sopra lo sprite. front: personaggio visto di faccia; sx: verso destra/sinistra.
 outfit(c,p,P,front,sx,bob,layer='front'){const a=p.avatar||{},w=a.wear||{},x=P.x,y0=P.y+bob;let y=y0+7;const skin='#e5a377',hc=a.hair?.color||'#1c1a1a';
  const E=(cx,cy,rx,ry,col,al=1)=>{c.globalAlpha=al;c.fillStyle=col;c.beginPath();c.ellipse(cx,cy,rx,ry,0,0,7);c.fill();c.globalAlpha=1;},Rr=(x0,y0,w0,h0,col,r=2)=>{c.fillStyle=col;c.beginPath();c.roundRect(x0,y0,w0,h0,r);c.fill();};
  const hs=a.hair?.style||0;
  // Strato dietro lo sprite: volumi di capelli che non devono coprire il viso.
  if(layer==='back'){if(hs===6)E(x,y-80,23,19,hc);if(hs===8){Rr(x-18,y-84,36,40,hc,8);}if(hs===9)E(x-(sx>=0?15:-15),y-68,6,13,hc);if(hs===11){c.strokeStyle=hc;c.lineWidth=5;for(const s of [-1,1]){c.beginPath();c.moveTo(x+s*12,y-78);c.lineTo(x+s*15,y-46);c.stroke();}}if(hs===12)Rr(x-17,y-86,34,28,hc,8);if(hs===15)Rr(x-12,y-76,24,24,hc,5);if(hs===16){E(x-18,y-72,5,9,hc);E(x+18,y-72,5,9,hc);}if(w.bag?.style===0&&front)Rr(x-12,y0-50,24,26,w.bag.color,5);return;}
  if(hs===1)E(x,y-82,13,7,skin,.55);else if(hs===17)E(x,y-82,14,9,skin);else if(hs===2)E(x,y-84,14,7,hc);else if(hs===3){E(x,y-84,14,7,hc);c.fillStyle=hc;c.beginPath();c.moveTo(x-10,y-84);c.lineTo(x+12*Math.sign(sx||1),y-78);c.lineTo(x+2,y-88);c.fill();}
  else if(hs===4||hs===5){if(hs===5){E(x-10,y-80,5,7,skin,.7);E(x+10,y-80,5,7,skin,.7);}c.fillStyle=hc;for(let k=-2;k<=2;k++){c.beginPath();c.moveTo(x+k*4-3,y-86);c.lineTo(x+k*4,y-(hs===5?100:95));c.lineTo(x+k*4+3,y-86);c.fill();}}
  else if(hs===7)for(const [dx,dy] of [[-12,-84],[-6,-90],[2,-91],[10,-88],[14,-80],[-15,-76]])E(x+dx,y+dy,6,6,hc);
  else if(hs===10)E(x,y-94,8,7,hc);
  else if(hs===12)E(x,y-85,15,6,hc);
  else if(hs===13)E(x,y-88,13,6,hc);else if(hs===14)E(x+3*Math.sign(sx||1),y-91,12,8,hc);
  y=y0+12;const bd=a.beard||0;if(bd&&front){const bc=hc;c.globalAlpha=bd===11?.55:.9;c.fillStyle=bc;
   if([1,7,9,10].includes(bd)){c.beginPath();c.moveTo(x-10,y-66);c.quadraticCurveTo(x,y-(bd===7?46:bd===9?50:54),x+10,y-66);c.lineTo(x+8,y-61);c.quadraticCurveTo(x,y-57,x-8,y-61);c.fill();}
   if(bd===2){c.beginPath();c.moveTo(x-10,y-66);c.quadraticCurveTo(x,y-40,x+10,y-66);c.fill();}
   if([3,8,10].includes(bd))Rr(x-3,y-(bd===8?58:57),6,bd===8?3:6,bc,2);if([4,5,9].includes(bd))Rr(x-6,y-63,12,3,bc,1);if(bd===5){E(x-8,y-61,2,2,bc);E(x+8,y-61,2,2,bc);}
   if(bd===6){Rr(x-12,y-72,3,10,bc,1);Rr(x+9,y-72,3,10,bc,1);}if(bd===11){c.beginPath();c.moveTo(x-10,y-66);c.quadraticCurveTo(x,y-56,x+10,y-66);c.fill();}c.globalAlpha=1;}
  y=y0+8;if(w.hat){const k=w.hat.color,st=w.hat.style;
   if(st===0){E(x,y-86,14,8,k);E(x+(front?0:0)+9*Math.sign(sx||1),y-82,9,3,shade(k,-.2));}else if(st===1){Rr(x-14,y-96,28,14,k,6);}else if(st===2){E(x,y-84,20,5,shade(k,-.15));Rr(x-11,y-98,22,14,k,3);Rr(x-11,y-88,22,3,'#1f2226',1);}
   else if(st===3){E(x,y-84,18,5,k);Rr(x-11,y-96,22,12,k,5);}else if(st===4){E(x+2*Math.sign(sx||1),y-88,15,6,k);}else if(st===5){E(x,y-85,24,5,shade(k,-.15));Rr(x-10,y-100,20,16,k,6);}
   else if(st===6){Rr(x-14,y-90,28,7,k,3);}else if(st===7){Rr(x-14,y-84,28,4,k,2);}else{E(x+10*Math.sign(sx||1),y-83,11,3,k);Rr(x-14,y-86,28,3,k,1);}}
  y=y0+14;if(w.glasses&&front){const k=w.glasses.color,st=w.glasses.style,dark=[0,2,4].includes(st);c.strokeStyle=k;c.lineWidth=1.8;c.fillStyle=dark?'#141618e0':'#cfe8f355';
   for(const s of [-1,1]){c.beginPath();if(st===1)c.arc(x+s*5,y-74,4,0,7);else if(st===5){c.moveTo(x+s*1,y-76);c.lineTo(x+s*10,y-77);c.lineTo(x+s*9,y-71);c.lineTo(x+s*2,y-71);c.closePath();}else c.roundRect(x+(s<0?-10:1),y-77,9,st===4?5:6,st===2?3:1.5);c.fill();c.stroke();}c.beginPath();c.moveTo(x-1,y-75);c.lineTo(x+1,y-75);c.stroke();}
  y=y0+15;if(w.neck){const k=w.neck.color,st=w.neck.style;if(st===3){Rr(x-10,y-60,20,6,k,3);if(front)Rr(x+2,y-56,5,12,k,2);}else if(st===4){c.fillStyle=k;c.beginPath();c.moveTo(x-9,y-59);c.lineTo(x+9,y-59);c.lineTo(x,y-50);c.fill();}
   else if(front){c.strokeStyle=st===1?'#f4f1ea':k;c.lineWidth=st===1?2.5:1.5;c.setLineDash(st===1?[2,2]:[]);c.beginPath();c.arc(x,y-62,8,.2*Math.PI,.8*Math.PI);c.stroke();c.setLineDash([]);if(st===2)E(x,y-53,2.5,2.5,k);}}
  if(w.bag){const k=w.bag.color,st=w.bag.style,side=sx>=0?1:-1;if(st===0){if(front){c.strokeStyle=shade(k,-.2);c.lineWidth=2.5;c.beginPath();c.moveTo(x-7,y-62);c.lineTo(x-8,y-40);c.moveTo(x+7,y-62);c.lineTo(x+8,y-40);c.stroke();}else Rr(x-11,y-64,22,24,k,5);}
   else{c.strokeStyle=shade(k,-.25);c.lineWidth=2;if(st!==2&&st!==4){c.beginPath();c.moveTo(x-side*8,y-62);c.lineTo(x+side*12,y-38);c.stroke();}const sz={1:[11,9],2:[14,6],3:[13,14],4:[10,7],5:[14,10],6:[20,12]}[st]||[11,9];Rr(x+side*12-sz[0]/2,y-(st===2?44:38),sz[0],sz[1],k,3);}}
  if(w.watch&&front)Rr(x+(sx>=0?13:-17),y-42,4,3,w.watch.color,1);}
 overlay(c,p,me,pos){
  const top=pos.y-112;const box=this.label(c,p.username,pos.x,top,p.id===me.id?'#baf3ff':'#ffffff','flag');
  if(this.friendIds?.has(p.id)){c.font='bold 13px system-ui';c.fillStyle='#ffd35a';c.textAlign='center';c.fillText('★',box.right+9,top);}
  let above=top-26;
  if(p.talking){c.save();c.shadowColor='#2fd47a';c.shadowBlur=8;c.fillStyle='#2fbf6c';c.beginPath();c.arc(pos.x,above,13,0,7);c.fill();c.restore();c.strokeStyle='#ffffff';c.lineWidth=2;c.lineCap='round';c.beginPath();c.roundRect(pos.x-3,above-8,6,10,3);c.moveTo(pos.x-6,above);c.arc(pos.x,above,6,Math.PI,0,true);c.moveTo(pos.x,above+6);c.lineTo(pos.x,above+9);c.stroke();above-=32;}
  if(p.emote){c.font='28px sans-serif';c.textAlign='center';c.fillText(p.emote,pos.x,above+8);above-=34;}
  const bubble=this.bubbles?.get(p.id);if(bubble&&bubble.until>performance.now())this.bubble(c,bubble.text,pos.x,above);else this.bubbles?.delete(p.id);
 }
 bubble(c,text,x,y){c.font='600 13px system-ui';c.textAlign='center';const width=Math.min(240,c.measureText(text).width+22);c.save();c.shadowColor='#0005';c.shadowBlur=6;c.fillStyle='#ffffff';c.beginPath();c.roundRect(x-width/2,y-24,width,28,14);c.moveTo(x-6,y+3);c.lineTo(x,y+10);c.lineTo(x+6,y+3);c.fill();c.restore();c.fillStyle='#1b2433';c.fillText(text.length>34?text.slice(0,33)+'…':text,x,y-5);}
 label(c,text,x,y,color,icon){c.font='600 13px system-ui';c.textAlign='center';const extra=icon?20:0,width=c.measureText(text).width+16+extra,left=x-width/2;c.fillStyle='#0c1726d9';c.beginPath();c.roundRect(left,y-15,width,22,7);c.fill();
  if(icon==='flag'){const fx=left+8,fy=y-9;c.fillStyle='#1f9d55';c.fillRect(fx,fy,5,10);c.fillStyle='#ffffff';c.fillRect(fx+5,fy,5,10);c.fillStyle='#d8343f';c.fillRect(fx+10,fy,5,10);}
  if(icon==='pin'){const px=left+14,py=y-6;c.fillStyle='#38b6ff';c.beginPath();c.arc(px,py-1,5,Math.PI,0);c.lineTo(px,py+8);c.closePath();c.fill();c.fillStyle='#0c1726';c.beginPath();c.arc(px,py-1,2,0,7);c.fill();}
  c.fillStyle=color;c.fillText(text,x+extra/2,y);return {left,right:left+width};}
 // Mare e spiaggia: le rette x+y=costante sono orizzontali sullo schermo, quindi battigia e balaustra sono fasce orizzontali.
 seaAndBeach(c,zoom){const L=this.camera.x-this.w/zoom/2-60,W=this.w/zoom+120,shore=(SHORE-BEACH)*19,top=shore-SEA_DEPTH,rail=SHORE*19,t=this.time;
  const sea=c.createLinearGradient(0,top,0,shore);sea.addColorStop(0,'rgba(24,120,178,0)');sea.addColorStop(.6,'rgba(24,124,182,0)');sea.addColorStop(.78,'rgba(36,150,198,.9)');sea.addColorStop(.88,'#2a9fc6');sea.addColorStop(1,'#5bcfd5');c.fillStyle=sea;c.fillRect(L,top,W,shore-top);
  c.lineWidth=2;for(let k=1;k<9;k++){const band=(shore-top)/9,y=top+k*band+(t*5%band);c.strokeStyle=`rgba(255,255,255,${.05+.12*k/9})`;c.beginPath();for(let x=L;x<=L+W;x+=24){const yy=y+Math.sin(x*.018+k*1.7+t*.9)*2.5;x===L?c.moveTo(x,yy):c.lineTo(x,yy);}c.stroke();}
  const sand=c.createLinearGradient(0,shore,0,rail);sand.addColorStop(0,'#c9ad7c');sand.addColorStop(.18,'#e2cb98');sand.addColorStop(1,'#f0dfb4');c.fillStyle=sand;c.fillRect(L,shore,W,rail+6-shore);
  for(let gx=Math.floor(L/26);gx<(L+W)/26;gx++)for(let gy=Math.floor(shore/14);gy<rail/14;gy++){let s=(gx*73856093^gy*19349663)>>>0;s=(s*1664525+1013904223)>>>0;c.fillStyle=s%3?'#b8996a40':'#fff6dc70';c.fillRect(gx*26+(s>>>8)%26,gy*14+(s>>>16)%14,2,1.2);}
  for(const [w,a,o] of [[6,.9,0],[3,.5,7]]){c.strokeStyle=`rgba(255,255,255,${a})`;c.lineWidth=w;c.beginPath();for(let x=L;x<=L+W;x+=12){const y=shore-2+o+Math.sin(x*.022+t*1.6)*3+Math.sin(x*.007-t*.7)*2;x===L?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();}}
 railing(c){for(let x=0;x<SHORE;x+=.5){if(STAIRS.some(s=>Math.abs(2*x+.5-SHORE-s)<1.3))continue;const p=iso(x,SHORE-x),q=iso(x+.5,SHORE-x-.5);
   c.strokeStyle='#746b60';c.lineWidth=3;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-35);c.stroke();
   c.strokeStyle='#eee0c6';c.lineWidth=8;c.beginPath();c.moveTo(p.x,p.y-38);c.lineTo(q.x,q.y-38);c.stroke();
   if(x%2===0){c.fillStyle='#cdb995';c.fillRect(p.x-6,p.y-43,12,47);c.fillStyle='#f7e5bd';c.fillRect(p.x-9,p.y-47,18,6);}}
  for(const s of STAIRS){const p=iso((SHORE+s)/2,(SHORE-s)/2);for(let k=0;k<4;k++){c.fillStyle=k%2?'#d6c39b':'#ebdcb9';c.fillRect(p.x-50,p.y-4-k*8,100,8);c.fillStyle='#00000018';c.fillRect(p.x-50,p.y+3-k*8,100,1.5);}
   for(const side of [-1,1]){c.fillStyle='#cdb995';c.fillRect(p.x+side*54-7,p.y-46,14,50);c.fillStyle='#f7e5bd';c.fillRect(p.x+side*54-10,p.y-50,20,7);}}}
 sprite(c,kind,x,y,width){const im=this.images.living;if(!im)return;const rect={bed:[0,50,470,545],sofa:[470,160,470,435],picture:[940,50,314,550],fountain:[0,615,430,535],boat:[430,710,435,395],cloud:[875,760,379,355]}[kind];if(!rect)return;const [sx,sy,sw,sh]=rect,k=im.width/1254;c.drawImage(im,sx*k,sy*k,sw*k,sh*k,x-width/2,y-width*sh/sw,width,width*sh/sw);}
 cabin(c,e,l,w,a,H,h,col){const pts=[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([u,v])=>({x:e.x+u*Math.cos(a)-v*Math.sin(a),y:e.y+u*Math.sin(a)+v*Math.cos(a)}));c.save();c.translate(0,-H);this.box(c,pts,h,{left:'#9fc3d9',right:'#7fa9c4',top:col});c.restore();}
 vehicleArt(id,view){if(typeof Image==='undefined')return null;const k=id+'-'+view;(this.vehicles??={});if(!(k in this.vehicles)){this.vehicles[k]=null;const im=new Image();im.onload=()=>{this.vehicles[k]=im;};im.src=(this.assetBase||'')+'/assets/veicoli/'+k+'.png';}return this.vehicles[k];}
 outline(c,e,col){c.save();c.strokeStyle=col;c.lineWidth=3;c.setLineDash([8,6]);c.beginPath();if(e.kind==='building'&&e.base){e.base.map(q=>iso(q.x,q.y)).forEach((q,i)=>i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y));c.closePath();}else{const p=iso(e.x,e.y),r=Math.max(.5,e.r||.5)*38;c.ellipse(p.x,p.y,r*1.2,r*.6,0,0,7);}c.stroke();c.restore();}
 decoArt(art){(this.decos??={});if(!(art in this.decos)){this.decos[art]=null;const im=new Image();im.onload=()=>{this.decos[art]=im;};im.src=(this.assetBase||'')+'/assets/oggetti/'+art+'.png';}return this.decos[art];}
 // Ricolora mantenendo luci e ombre (fusione "color"), risultato in cache per immagine+colore.
 tinted(im,key,color){if(!color)return im;(this.tints??=new Map());const k=key+'|'+color;let t=this.tints.get(k);if(!t){t=document.createElement('canvas');t.width=im.width;t.height=im.height;const g=t.getContext('2d');g.drawImage(im,0,0);g.globalCompositeOperation='color';g.globalAlpha=.75;g.fillStyle=color;g.fillRect(0,0,t.width,t.height);g.globalAlpha=1;g.globalCompositeOperation='destination-in';g.drawImage(im,0,0);this.tints.set(k,t);}return t;}
 frontBuilding(c,b,me,fade){let im=this.decoArt?null:null;const k=b.fart;(this.fronts??={});if(!(k in this.fronts)){this.fronts[k]=null;const i=new Image();i.onload=()=>{this.fronts[k]=i;};i.onerror=()=>{this.fronts[k]=false;};i.src=(this.assetBase||'')+'/assets/edifici/'+k+'.png';}
  im=this.fronts[k];const L=iso(b.fx,b.fy+b.fh),Rr=iso(b.fx+b.fw,b.fy+b.fh),W=Rr.x-L.x;c.save();
  if(fade){const behind=me.room==='lungomare'&&me.y<b.fy+b.fh&&me.y>b.fy-b.height/F.K&&me.x>b.fx-.5&&me.x<b.fx+b.fw+.5;const now=this.fades?.get(b.id)??1,target=behind?.45:1,a=now+(target-now)*Math.min(1,(this.dt||.016)*7);(this.fades??=new Map()).set(b.id,a);c.globalAlpha=a;}
  // Ombra di contatto sotto la facciata.
  c.fillStyle='rgba(15,20,28,.28)';c.beginPath();c.ellipse((L.x+Rr.x)/2,L.y,W*.55,10,0,0,7);c.fill();
  if(im){const src=b.tint?this.tinted(im,'f:'+k,b.tint):im,H=W*im.height/im.width;if(b.flip){c.translate((L.x+Rr.x)/2,0);c.scale(-1,1);c.translate(-(L.x+Rr.x)/2,0);}c.drawImage(src,L.x,L.y-H+4,W,H);}
  else{const a=b.art&&this.art?.[b.art];if(a){const H=W*a.im.height/a.im.width;c.drawImage(a.im,L.x,L.y-H+4,W,H);}else{this.polygon(c,[L,Rr,{x:Rr.x,y:Rr.y-b.height},{x:L.x,y:L.y-b.height}],'#e8e2d6','#0003');}}
  c.restore();}
 // Terreno della città frontale: mare in alto, spiaggia, ringhiera con scalinate, lungomare, viale e strade con mezzeria.
 frontGround(c,zoom){const x0=Math.floor((this.camera.x-this.w/zoom/2)/F.T)-1,x1=Math.ceil((this.camera.x+this.w/zoom/2)/F.T)+1,y0=Math.floor((this.camera.y-this.h*ANCHOR/zoom)/F.K)-1,y1=Math.ceil((this.camera.y+this.h*(1-ANCHOR)/zoom)/F.K)+1,t=this.time;
  const top=Math.min(y0,F.SEA-60)*F.K,sea=c.createLinearGradient(0,F.SEA*F.K-260,0,F.SEA*F.K);sea.addColorStop(0,'rgba(24,120,178,0)');sea.addColorStop(.5,'#1f87bd');sea.addColorStop(1,'#4cc3d6');c.fillStyle=sea;c.fillRect(x0*F.T,F.SEA*F.K-260,(x1-x0)*F.T,260);
  c.lineWidth=2;for(let k=1;k<7;k++){const y=F.SEA*F.K-k*34+(t*6%34);c.strokeStyle='rgba(255,255,255,'+(.08+.03*k)+')';c.beginPath();for(let x=x0*F.T;x<=x1*F.T;x+=24){const yy=y+Math.sin(x*.02+k+t)*2.5;x===x0*F.T?c.moveTo(x,yy):c.lineTo(x,yy);}c.stroke();}
  for(let y=Math.max(y0,F.SEA);y<=y1;y++)for(let x=Math.max(x0,0);x<=x1;x++){const g=this.groundColor('lungomare',x,y);c.fillStyle=g.color;c.fillRect(x*F.T,y*F.K,F.T+.6,F.K+.6);
   if(g.material==='cobble'||g.material==='stone'){c.fillStyle='rgba(0,0,0,.07)';c.fillRect(x*F.T,y*F.K+F.K-1.5,F.T,1.5);c.fillRect(x*F.T+((y%2)?F.T/2:0),y*F.K,1.5,F.K);}
   else if(g.material==='grass'){c.fillStyle='rgba(40,80,30,.18)';for(let i=0;i<3;i++){const s=(x*73856093^y*19349663^i*83492791)>>>0;c.fillRect(x*F.T+s%F.T,y*F.K+(s>>>8)%F.K,2,3);}}}
  // Onde sulla battigia.
  c.strokeStyle='rgba(255,255,255,.85)';c.lineWidth=5;c.beginPath();for(let x=x0*F.T;x<=x1*F.T;x+=12){const y=F.SEA*F.K+Math.sin(x*.022+t*1.6)*3;x===x0*F.T?c.moveTo(x,y):c.lineTo(x,y);}c.stroke();
  // Mezzeria tratteggiata sul viale e sulle strade delle file.
  c.fillStyle='#f3d34a';for(const ym of [(F.PROM+F.AVE)/2,...ROWS.map(r=>r+5)])for(let x=Math.max(x0,0);x<=x1;x+=2)c.fillRect(x*F.T,ym*F.K-1.5,F.T*.9,3);
  // Ringhiera del lungomare con scalinate verso la spiaggia.
  const ry=F.BEACH*F.K;for(let x=Math.max(x0,0);x<=x1;x+=1){if(isStair(x+.5)){c.fillStyle=x%2?'#d6c39b':'#ebdcb9';for(let k=0;k<3;k++)c.fillRect(x*F.T,ry-4-k*7,F.T,7);continue;}c.fillStyle='#cdb995';c.fillRect(x*F.T,ry-34,6,34);c.fillStyle='#eee0c6';c.fillRect(x*F.T,ry-36,F.T,6);}}
 prop(c,e){
  if(e.kind==='deco'){const im=this.decoArt(e.art);if(!im)return;const src=this.tinted(im,e.art,e.tint),W=e.w*76*.92,H=W*im.height/im.width,q=iso(e.x,e.y);c.drawImage(src,q.x-W/2,(FRONT_NOW?q.y+e.w*F.K*.12:q.y+e.w*19*.92)-H,W,H);return;}
  // Oggetti specchiati dall'editor e veicoli parcheggiati.
  if(e.kind==='parked')return this.prop(c,{kind:'ride',v:e.v,x:e.x,y:e.y,direction:e.rot||0,scale:e.scale||1});
  if(e.scale&&e.scale!==1&&!e._s&&e.kind!=='deco'&&e.kind!=='ride'&&e.kind!=='parked'){const q=iso(e.x,e.y);c.save();c.translate(q.x,q.y);c.scale(e.scale,e.scale);c.translate(-q.x,-q.y);this.prop(c,{...e,_s:1});c.restore();return;}
  if(e.flip&&!e._f){const q=iso(e.x,e.y);c.save();c.translate(q.x,0);c.scale(-1,1);c.translate(-q.x,0);this.prop(c,{...e,_f:1});c.restore();return;}
  const p=iso(e.x,e.y),im=this.images.props;
  const rect=(x,y,w,h)=>[{x:x-w/2,y:y-h/2},{x:x+w/2,y:y-h/2},{x:x+w/2,y:y+h/2},{x:x-w/2,y:y+h/2}].map(q=>({x:q.x,y:q.y}));
  const rot=(x,y,l,w,a)=>[[-l/2,-w/2],[l/2,-w/2],[l/2,w/2],[-l/2,w/2]].map(([u,v])=>({x:x+u*Math.cos(a)-v*Math.sin(a),y:y+u*Math.sin(a)+v*Math.cos(a)}));
  if(e.kind==='ride'){// Mezzi: monopattino, bici, scooter, auto, furgone, cabrio orientati sulla direzione di marcia.
   const v=VEHICLE[e.v],a=e.direction||0,col=v.color,dark='#1c1f24',fx=Math.cos(a),fy=Math.sin(a),at=(k,h=0)=>{const q=iso(e.x+fx*k,e.y+fy*k);return {x:q.x,y:q.y-h};};
   // Sprite realistici (se presenti): vista frontale o posteriore secondo la direzione a schermo, specchiata per gli altri due versi.
   {const sx=FRONT_NOW?fx:fx-fy,sy=FRONT_NOW?fy:(fx+fy)/2,view=sy>=0?'front':'back',flip=view==='front'?sx>0:sx<0,im=this.vehicleArt(e.v,view);if(im){if(e.front)return;const W={monopattino:72,bici:92,scooter:96,auto:170,furgone:190,cabrio:172}[e.v]*(e.scale||1),H=W*im.height/im.width,q=iso(e.x,e.y);c.save();c.fillStyle='rgba(15,20,28,.28)';c.beginPath();c.ellipse(q.x+3,q.y+2,W*.42,W*.15,0,0,7);c.fill();c.restore();const tilt=FRONT_NOW?0:(()=>{const th=Math.atan2(sy,sx),base=Math.atan2(Math.sign(sy||1)*.5,Math.sign(sx||1));let d=th-base;d=Math.atan2(Math.sin(d),Math.cos(d));return Math.max(-.5,Math.min(.5,d))*.85;})();c.save();c.translate(q.x,q.y+W*.12-H*.3);c.rotate(tilt);c.translate(0,H*.3);if(flip)c.scale(-1,1);c.drawImage(im,-W/2,-H,W,H);c.restore();return;}}
   const wheel=(k,r=6)=>{const q=at(k);c.fillStyle=dark;c.beginPath();c.ellipse(q.x,q.y-r*.6,r*.55,r,0,0,7);c.fill();c.fillStyle='#9aa3ad';c.beginPath();c.ellipse(q.x,q.y-r*.6,r*.2,r*.35,0,0,7);c.fill();};
   const line=(A,B,w,s)=>{c.strokeStyle=s;c.lineWidth=w;c.lineCap='round';c.beginPath();c.moveTo(A.x,A.y);c.lineTo(B.x,B.y);c.stroke();c.lineCap='butt';};
   // Due ruote: pedana e ruote sotto i piedi, manubrio (e.front) disegnato davanti al personaggio.
   const bar=(k,h,w=9)=>{const t=at(k,h);line(at(k,e.v==='bici'?10:5),t,3,e.v==='scooter'?col:'#3a3f47');line({x:t.x-w,y:t.y+1},{x:t.x+w,y:t.y-1},3,'#111');c.fillStyle='#111';c.beginPath();c.arc(t.x-w,t.y+1,2.5,0,7);c.arc(t.x+w,t.y-1,2.5,0,7);c.fill();};
   if(e.front){bar(.55,e.v==='bici'?36:e.v==='scooter'?42:50);return;}
   c.save();c.fillStyle='rgba(15,20,28,.3)';const sp=iso(e.x,e.y);c.beginPath();c.ellipse(sp.x,sp.y+2,26,9,0,0,7);c.fill();c.restore();
   if(e.v==='monopattino'){wheel(-.6,5);wheel(.6,5);this.box(c,rot(e.x,e.y,1.25,.28,a),5,{left:'#2b2f36',right:'#1d2026',top:'#4b5563'});return;}
   if(e.v==='bici'){wheel(-.6,11);wheel(.6,11);line(at(-.6,7),at(0,20),3.5,col);line(at(0,20),at(.6,7),3.5,col);line(at(-.6,7),at(-.05,30),3.5,col);line(at(0,20),at(.5,30),3.5,col);const sd=at(-.08,31);c.fillStyle='#111';c.beginPath();c.ellipse(sd.x,sd.y,6,3,0,0,7);c.fill();return;}
   if(e.v==='scooter'){wheel(-.6,7);wheel(.6,7);this.box(c,rot(e.x,e.y,1.3,.45,a),16,{left:col,right:col,top:'#f4f4f5',edge:'#00000040'});const sd=at(-.25,22);c.fillStyle='#18181b';c.beginPath();c.ellipse(sd.x,sd.y,12,5,0,0,7);c.fill();return;}
   const L=e.v==='furgone'?4.2:3.7,W=e.v==='furgone'?1.9:1.75,H=e.v==='furgone'?58:e.v==='cabrio'?24:28;
   c.save();c.fillStyle='rgba(15,20,28,.3)';c.beginPath();const cp=iso(e.x,e.y);c.ellipse(cp.x+4,cp.y+3,L*22,L*9,0,0,7);c.fill();c.restore();
   for(const [k,s] of [[-.65,1],[.65,1],[-.65,-1],[.65,-1]]){const q=iso(e.x+fx*k*L/2-fy*s*W*.5,e.y+fy*k*L/2+fx*s*W*.5);c.fillStyle=dark;c.beginPath();c.ellipse(q.x,q.y-8,7,9,0,0,7);c.fill();c.fillStyle='#9aa3ad';c.beginPath();c.ellipse(q.x,q.y-8,3,4,0,0,7);c.fill();}
   this.box(c,rot(e.x,e.y,L,W,a),H,{left:col,right:col,top:col,edge:'#00000033'});c.fillStyle='rgba(0,0,0,.18)';c.beginPath();rot(e.x,e.y,L,W,a).map(q=>iso(q.x,q.y)).forEach((q,i)=>i?c.lineTo(q.x,q.y-H*.45):c.moveTo(q.x,q.y-H*.45));c.closePath();c.fill();
   if(e.v==='auto')this.cabin(c,{x:e.x-fx*.2,y:e.y-fy*.2},L*.5,W*.84,a,H,22,col);if(e.v==='cabrio'){this.cabin(c,{x:e.x+fx*.55,y:e.y+fy*.55},.25,W*.8,a,H,10,'#9fc3d9');}
   if(e.v==='furgone'){for(const k of [-.3,.1,.42]){const f=at(L*k,H*.72);c.fillStyle='#1e3a5f';c.beginPath();c.ellipse(f.x,f.y,10,7,0,0,7);c.fill();}}
   for(const s of [1,-1]){const q=iso(e.x+fx*L*.5-fy*s*W*.32,e.y+fy*L*.5+fx*s*W*.32);c.fillStyle=this.night>.08?'#fff7c2':'#e5e7eb';c.beginPath();c.arc(q.x,q.y-H*.55,2.6,0,7);c.fill();}
   return;}
  // Punto di contatto col terreno: ombra morbida alla base e ombra portata per gli oggetti alti (luce dall'alto a sinistra).
  {const tall={tree:80,palm:110,lamp:90,statue:60,umbrella:55,atm:50,slot:50,plant:30,scooter:24,fountain:30}[e.kind];if(tall){c.save();c.fillStyle='rgba(15,20,28,.28)';c.beginPath();c.ellipse(p.x,p.y+1,tall*.16+4,tall*.08+2,0,0,7);c.fill();if(tall>=50&&!e.room){c.globalAlpha=.55;c.beginPath();c.ellipse(p.x+tall*.45,p.y+tall*.12,tall*.42,tall*.13,.22,0,7);c.fill();}c.restore();}}
  if(e.kind==='tree'){c.fillStyle='#6b4a32';c.fillRect(p.x-4,p.y-34,8,36);for(const [dx,dy,r,col] of [[0,-62,30,'#3f7d3a'],[-16,-48,22,'#4c8f42'],[16,-46,22,'#468a3f'],[2,-74,20,'#5aa24c']]){c.fillStyle=col;c.beginPath();c.arc(p.x+dx,p.y+dy,r,0,7);c.fill();}c.fillStyle='#ffffff18';c.beginPath();c.arc(p.x-8,p.y-74,10,0,7);c.fill();return;}
  if(e.kind==='sandbox'){this.box(c,rect(e.x,e.y,2.2,2.2),10,{left:'#c79a5c',right:'#a87e47',top:'#f1d99a',edge:'#c79a5c'});return;}
  if(e.kind==='slide'){this.box(c,rect(e.x-.6,e.y,.9,.9),46,{left:'#4fa3d1',right:'#3a86b0',top:'#e5484d'});const a=iso(e.x-.15,e.y),b=iso(e.x+1.2,e.y);c.strokeStyle='#ffc928';c.lineWidth=10;c.lineCap='round';c.beginPath();c.moveTo(a.x,a.y-46);c.lineTo(b.x,b.y-4);c.stroke();c.lineCap='butt';return;}
  if(e.kind==='swing'){const a=iso(e.x-.9,e.y),b=iso(e.x+.9,e.y);c.strokeStyle='#d24b3b';c.lineWidth=4;c.beginPath();for(const q of [a,b]){c.moveTo(q.x-10,q.y);c.lineTo(q.x,q.y-60);c.lineTo(q.x+10,q.y);}c.moveTo(a.x,a.y-60);c.lineTo(b.x,b.y-60);c.stroke();c.strokeStyle='#555';c.lineWidth=1.5;for(const u of [.3,.7]){const q={x:a.x+(b.x-a.x)*u,y:a.y+(b.y-a.y)*u};const sw=Math.sin(this.time*2+u*5)*5;c.beginPath();c.moveTo(q.x,q.y-60);c.lineTo(q.x+sw,q.y-18);c.stroke();c.fillStyle='#ffc928';c.fillRect(q.x+sw-8,q.y-19,16,4);}return;}
  if(e.kind==='slot'){this.box(c,rect(e.x,e.y,.8,.6),70,{left:'#3b1d5c',right:'#2a1342',top:'#ffd35a'},(f,A,B)=>{if(f.side==='left'){this.faceRect(c,A,B,.12,.88,34,56,'#111');for(let k=0;k<3;k++)this.faceText(c,A,B,.24+k*.26,45,['7️⃣','🍒','💎'][(k+Math.floor(this.time*2+e.x))%3],'11px sans-serif','#fff');this.faceRect(c,A,B,.1,.9,60,68,(Math.floor(this.time*3+e.x)%2)?'#ff5a8a':'#ffe9a0');this.faceRect(c,A,B,.3,.7,20,26,'#d4a73a');}});return;}
  if(e.kind==='rack'){const A=iso(e.x-.8,e.y),B=iso(e.x+.8,e.y);c.strokeStyle='#9aa3a9';c.lineWidth=2;c.beginPath();c.moveTo(A.x,A.y);c.lineTo(A.x,A.y-50);c.lineTo(B.x,B.y-50);c.lineTo(B.x,B.y);c.stroke();
   for(let k=0;k<6;k++){const t=(k+.5)/6,X=A.x+(B.x-A.x)*t,Y=A.y+(B.y-A.y)*t-48;c.fillStyle=['#d93a3a','#1f3a6b','#f2f2f2','#2f9e5b','#ffc928','#8a5cff'][(k+Math.round(e.x*3+e.y))%6];c.beginPath();c.moveTo(X-6,Y);c.lineTo(X+6,Y);c.lineTo(X+7,Y+26);c.lineTo(X-7,Y+26);c.fill();}return;}
  if(e.kind==='mirror'){c.fillStyle='#c9a24a';c.fillRect(p.x-14,p.y-74,28,74);c.fillStyle='#cfe8f3';c.fillRect(p.x-11,p.y-71,22,66);c.fillStyle='#ffffff66';c.fillRect(p.x-9,p.y-69,5,60);return;}
  if(e.kind==='barberchair'){this.box(c,rect(e.x,e.y,.9,.9),12,{left:'#6b6b72',right:'#4b4b52',top:'#8a8a92'});c.save();c.translate(0,-12);this.box(c,rect(e.x,e.y,.8,.8),14,{left:'#7a1f2b',right:'#5c1520',top:'#a0303f'});c.restore();c.fillStyle='#5c1520';c.fillRect(p.x-12,p.y-48,24,20);
   c.fillStyle='#c9a24a';c.fillRect(p.x-20,p.y-110,40,46);c.fillStyle='#cfe8f3';c.fillRect(p.x-17,p.y-107,34,40);return;}
  if(e.kind==='fence'){const A=iso(e.ax,e.ay),B=iso(e.bx,e.by);this.polygon(c,[A,B,{x:B.x,y:B.y-12},{x:A.x,y:A.y-12}],'#f1ece2','#cfc6b6');this.polygon(c,[{x:A.x,y:A.y-12},{x:B.x,y:B.y-12},{x:B.x,y:B.y-15},{x:A.x,y:A.y-15}],'#d8cfbe');
   c.strokeStyle='#2f3437';c.lineWidth=1.6;c.beginPath();c.moveTo(A.x,A.y-27);c.lineTo(B.x,B.y-27);for(let t=0;t<=1;t+=.25){const x=A.x+(B.x-A.x)*t,y=A.y+(B.y-A.y)*t;c.moveTo(x,y-15);c.lineTo(x,y-27);}c.stroke();return;}
  if(e.kind==='hedge'){this.box(c,rot(e.x,e.y,e.l,.6,e.a||0),20,{left:'#4f8a3c',right:'#3f7330',top:'#64a24c'});return;}
  if(e.kind==='forsale'){const st=this.villaStatus?.[e.villa];if(st&&st.status!=='free')return;c.strokeStyle='#6b4a32';c.lineWidth=3;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-34);c.stroke();c.fillStyle='#ffffff';c.fillRect(p.x-24,p.y-52,48,20);c.strokeStyle='#c8432f';c.lineWidth=2;c.strokeRect(p.x-24,p.y-52,48,20);c.fillStyle='#c8432f';c.font='bold 8px system-ui';c.textAlign='center';c.fillText('VENDESI',p.x,p.y-43);c.fillText('AFFITTASI',p.x,p.y-35);return;}
  if(e.kind==='atm'){this.box(c,rect(e.x,e.y,.7,.5),58,{left:'#3b4a55',right:'#2b3740',top:'#56656f'},(f,A,B)=>{if(f.side==='left'){this.faceRect(c,A,B,.15,.85,30,48,'#5fd0ff');this.faceText(c,A,B,.5,53,'ATM','bold 9px system-ui','#f5d27a');this.faceRect(c,A,B,.25,.75,18,22,'#111');}});return;}
  if(e.kind==='car'){const dir=(Math.round(e.x*7+e.y)%2)?0:Math.PI/2;this.box(c,rot(e.x,e.y,2.3,1.15,dir),16,{left:e.color,right:shade(e.color,-.2),top:shade(e.color,.1)});const top=rot(e.x,e.y,1.3,1.0,dir);c.save();c.translate(0,-16);this.box(c,top,13,{left:'#9fd3ee',right:'#7ab4d3',top:shade(e.color,.15)});c.restore();return;}
  if(e.kind==='busstop'){this.box(c,rect(e.x,e.y,2.2,.25),2,{left:'#7a8a95',top:'#9aa9b3'});const a=iso(e.x-1.1,e.y),b=iso(e.x+1.1,e.y);c.strokeStyle='#4a5862';c.lineWidth=3;c.beginPath();c.moveTo(a.x,a.y);c.lineTo(a.x,a.y-56);c.moveTo(b.x,b.y);c.lineTo(b.x,b.y-56);c.stroke();this.polygon(c,[{x:a.x-6,y:a.y-56},{x:b.x+6,y:b.y-56},{x:b.x+6,y:b.y-62},{x:a.x-6,y:a.y-62}],'#2a6fd6');this.faceRect(c,a,b,.05,.95,6,46,'#bfe3f566');this.label(c,'🚌 '+e.name,(a.x+b.x)/2,(a.y+b.y)/2-70,'#ffffff');return;}
  if(e.kind==='bus'){const pts=rot(e.x,e.y,5.6,2.2,e.direction);this.box(c,pts,50,{left:'#f28c28',right:'#d9741a',top:'#f6f2ea'},(f,A,B)=>{this.faceRect(c,A,B,.04,.96,26,42,this.night>.08?'#ffe3a0':'#bfe3f5');this.faceRect(c,A,B,0,1,6,10,'#ffffff');if(f.side==='left')this.faceText(c,A,B,.5,17,'HUMANA BUS','bold 9px system-ui','#ffffff');});return;}
  if(e.kind==='wall'){const A=iso(e.ax,e.ay),B=iso(e.bx,e.by),h=e.h;this.polygon(c,[A,B,{x:B.x,y:B.y-h},{x:A.x,y:A.y-h}],'#d8c7a5');this.polygon(c,[{x:A.x,y:A.y-h},{x:B.x,y:B.y-h},{x:B.x,y:B.y-h-7},{x:A.x,y:A.y-h-7}],'#f2e6c8');c.strokeStyle='#00000018';c.lineWidth=1;c.beginPath();for(let k=1;k<4;k++){const y=k*h/4;c.moveTo(A.x,A.y-y);c.lineTo(B.x,B.y-y);}c.stroke();return;}
  if(e.kind==='umbrella'){c.strokeStyle='#e9e4da';c.lineWidth=3;c.beginPath();c.moveTo(p.x,p.y);c.lineTo(p.x,p.y-64);c.stroke();c.fillStyle=e.color;c.beginPath();c.ellipse(p.x,p.y-64,36,14,0,Math.PI,0);c.lineTo(p.x+36,p.y-62);c.quadraticCurveTo(p.x,p.y-52,p.x-36,p.y-62);c.fill();c.fillStyle='#ffffff55';c.beginPath();c.ellipse(p.x,p.y-66,14,6,0,Math.PI,0);c.fill();return;}
  if(e.kind==='lounger'){const q=[iso(e.x-.75,e.y-.3),iso(e.x+.75,e.y-.3),iso(e.x+.75,e.y+.3),iso(e.x-.75,e.y+.3)].map(v=>({x:v.x,y:v.y-8}));this.polygon(c,q,'#fbfaf6','#c7b38a');this.polygon(c,[q[0],{x:(q[0].x+q[1].x)/2,y:(q[0].y+q[1].y)/2},{x:(q[3].x+q[2].x)/2,y:(q[3].y+q[2].y)/2},q[3]],'#5bb5e0');return;}
  if(['bed','sofa','picture','fountain'].includes(e.kind)){this.sprite(c,e.kind,p.x,p.y+5,{bed:155,sofa:145,picture:95,fountain:155}[e.kind]);return;}
  const style={palm:[0,205],lamp:[1,150],plant:[2,92],table:[3,100],seat:[4,61],bench:[5,112],scooter:[6,115],statue:[7,270],flowerbed:[8,140]}[e.kind];
  if(im&&style){
   // Rettangoli misurati nell'atlas: evita che testa/statua e sedie vengano tagliate.
   const frames=[[0,0,430,440],[440,0,350,440],[825,0,429,440],[0,450,440,365],[475,442,315,353],[815,445,439,350],[0,825,440,429],[475,795,320,459],[820,805,434,449]];
   const [cell,size]=style,[sx,sy,sw,sh]=frames[cell],scale=im.width/1254;
   const tall=['palm','lamp','statue'].includes(e.kind),w=tall?size*sw/sh:size,h=tall?size:size*sh/sw;
   c.save();if(['palm','plant','flowerbed'].includes(e.kind)){c.translate(p.x,p.y);c.rotate(Math.sin(this.time*1.2+e.x)*.009);c.translate(-p.x,-p.y);}c.drawImage(im,sx*scale,sy*scale,sw*scale,sh*scale,p.x-w/2,p.y-h+5,w,h);c.restore();return;
  }
  if(e.kind==='counter'){c.save();c.translate(p.x,p.y);this.polygon(c,[{x:-75,y:-13},{x:30,y:-47},{x:80,y:-22},{x:-25,y:12}],'#745345','#422f28');for(let i=0;i<5;i++){c.fillStyle=['#9c5945','#427756','#c6a162'][i%3];c.fillRect(-30+i*15,-43,6,15);}c.restore();}
 }
 // Minimappa illustrata: terreno, edifici e arredi del quartiere disegnati una volta in isometrico.
 miniBake(room){if(this.miniCache?.room===room)return this.miniCache;const m=MAPS[room],b=m.miniBounds||m.bounds;
  const minX=iso(b.x,b.y+b.h).x-60,maxX=iso(b.x+b.w,b.y).x+60,minY=iso(b.x,b.y).y-720,maxY=iso(b.x+b.w,b.y+b.h).y+80;
  const cv=document.createElement('canvas');cv.width=Math.ceil((maxX-minX)*MINI_BAKE);cv.height=Math.ceil((maxY-minY)*MINI_BAKE);const g=cv.getContext('2d');
  g.fillStyle=room==='lungomare'?'#1a8fc4':'#20283a';g.fillRect(0,0,cv.width,cv.height);g.scale(MINI_BAKE,MINI_BAKE);g.translate(-minX,-minY);
  for(let x=b.x;x<b.x+b.w;x++)for(let y=b.y;y<b.y+b.h;y++){if(room==='lungomare'&&x+y+1<SHORE-BEACH)continue;const p=iso(x,y);this.polygon(g,[{x:p.x,y:p.y},{x:p.x+38,y:p.y+19},{x:p.x,y:p.y+38},{x:p.x-38,y:p.y+19}],room==='lungomare'&&x+y+1<SHORE?'#ead39f':this.groundColor(room,x,y).color);}
  const far={x:-1e4,y:-1e4};const items=[...m.buildings.map(e=>({...e,kind:'building',depth:e.x+e.y+e.w/2+e.h/2})),...m.props.filter(p=>['palm','flowerbed','statue','fountain','plant'].includes(p.kind)).map(p=>({...p,depth:p.x+p.y}))].sort((a,c)=>a.depth-c.depth);
  for(const e of items)e.kind==='building'?this.building(g,e,far):this.prop(g,e);
  this.miniCache={room,canvas:cv,minX,minY};return this.miniCache;}
 minimap(canvas,players,me,width=240){
  const large=width>240,w=width,h=large?width*170/240:window.HUMANA_3D?width:width*150/240,dpr=Math.min(this.dpr||1,2);if(canvas.width!==w*dpr||canvas.height!==h*dpr){canvas.width=w*dpr;canvas.height=h*dpr;}
  const c=canvas.getContext('2d');c.setTransform(dpr,0,0,dpr,0,0);c.clearRect(0,0,w,h);
  if(large)return this.topMap(c,w,h,players,me);
  const bake=this.miniBake(me.room),k=.13*(this.miniZoom||1),centre=iso(me.x,me.y);
  c.fillStyle=me.room==='lungomare'?'#1a8fc4':'#20283a';c.fillRect(0,0,w,h);
  c.save();c.translate(w/2,h/2);c.scale(k,k);c.translate(-centre.x,-centre.y);c.imageSmoothingQuality='high';c.drawImage(bake.canvas,bake.minX,bake.minY,bake.canvas.width/MINI_BAKE,bake.canvas.height/MINI_BAKE);c.restore();
  const screen=(x,y)=>{const p=iso(x,y);return {x:w/2+(p.x-centre.x)*k,y:h/2+(p.y-centre.y)*k};};
  for(const b of MAPS[me.room].buildings){const icon=SHOP_ICONS[b.id];if(!icon)continue;const q=screen(b.x+b.w/2,b.y+b.h/2);q.y-=260*k;if(q.x<-10||q.x>w+10||q.y<-10||q.y>h+10)continue;c.fillStyle='#ffffffee';c.strokeStyle='#0c1726';c.lineWidth=1.5;c.beginPath();c.roundRect(q.x-10,q.y-10,20,20,6);c.fill();c.stroke();c.font='12px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText(icon,q.x,q.y+1);c.textBaseline='alphabetic';}
  for(const p of players){if(p.id===me.id)continue;const q=screen(p.x,p.y);c.fillStyle=this.friendIds?.has(p.id)?'#ffd35a':'#4be08a';c.strokeStyle='#0c1726';c.lineWidth=1.5;c.beginPath();c.arc(q.x,q.y,3.5,0,7);c.fill();c.stroke();}
  const q=screen(me.x,me.y);c.save();c.shadowColor='#2ab8ff';c.shadowBlur=8;c.fillStyle='#38b6ff';c.strokeStyle='#ffffff';c.lineWidth=2;c.beginPath();c.arc(q.x,q.y,5,0,7);c.fill();c.stroke();c.restore();
 }
 topMap(c,w,h,players,me){
  c.fillStyle='#087baf';c.fillRect(0,0,w,h);
  const m=MAPS[me.room],b=m.miniBounds||m.bounds,s=Math.min((w-20)/b.w,(h-20)/b.h),ox=(w-b.w*s)/2,oy=10;
  const point=p=>({x:ox+(p.x-b.x)*s,y:oy+(p.y-b.y)*s});
  c.fillStyle='#e7d5ac';c.beginPath();if(me.room==='lungomare'){for(const [i,p] of [[0,{x:0,y:SHORE}],[1,{x:SHORE,y:0}],[2,{x:b.w,y:0}],[3,{x:b.w,y:b.h}],[4,{x:0,y:b.h}]]){const q=point(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);}c.closePath();c.fill();}else c.fillRect(ox,oy,b.w*s,b.h*s);
  if(me.room==='lungomare')for(const road of STREETS){const p=point(road);c.fillStyle='#747b89';c.fillRect(p.x,p.y,road.w*s,road.h*s);}
  for(const building of m.buildings){const p=point(building);c.fillStyle=building.enterable===false?'#b38465':'#dc7d4f';c.fillRect(p.x,p.y,building.w*s,building.h*s);if(building.enterable!==false){c.fillStyle='white';c.font='bold 9px sans-serif';c.textAlign='center';c.font='13px sans-serif';c.fillText(SHOP_ICONS[building.id]||'',p.x+building.w*s/2,p.y+building.h*s/2+4);if(SHOP_ICONS[building.id]&&w>300){c.font='bold 9px system-ui';c.fillStyle='#0c1726';c.fillText(building.name,p.x+building.w*s/2,p.y+building.h*s/2+16);}}}
  if(me.room==='lungomare')for(const landmark of LANDMARKS){const q=point(landmark);c.fillStyle='#98600e';c.beginPath();c.arc(q.x,q.y,2,0,7);c.fill();}for(const p of players){const q=point(p);c.fillStyle=p.id===me.id?'#ffffff':this.friendIds?.has(p.id)?'#ffe188':'#32e6a8';c.strokeStyle='#133243';c.lineWidth=1.5;c.beginPath();c.arc(q.x,q.y,p.id===me.id?4:3,0,7);c.fill();c.stroke();}
  c.fillStyle='white';c.font='bold 10px sans-serif';c.textAlign='left';c.fillText('N ↑',8,15);
 }
}
