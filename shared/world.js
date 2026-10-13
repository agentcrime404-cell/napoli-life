import {turnToward} from './lanes.js';import {NAPOLI,napoliStand,napoliSpawn,napoliPlaces} from './napoli.js';import {STREETS,surface,PAINT,WORLD_SIZE,RESIDENCES,stretch,CITY_SIZE,VILLA_LOTS,VILLA_PARK,TRACK_IN,BUS_STOPS,inPool,fenceBlocked} from './district.js';
import {ART_K,artName} from './art.js';import {MODE,F,frontBuildings,frontProps,FRONT_SPAWN,isRail,isStair,ROWS} from './front.js';export {MODE,F,isStair,ROWS};import {VEHICLE} from './catalog.js';export {VEHICLE,artName};
// Coordinate logiche in metri; rendering isometrico indipendente dalla fisica.
export const CHUNK_SIZE=8;
const iso=(x,y)=>({x:(x-y)*38,y:(x+y)*19}),world=(sx,sy)=>({x:(sx/38+sy/19)/2,y:(sy/19-sx/38)/2});
// Base al suolo di ogni sprite (pixel della cella dell'atlas): angolo sinistro, frontale, destro, posteriore.
// Misurata sul profilo inferiore degli sprite: collisioni e disegno coincidono.
const CELL=627;
const BASES={
 buildings:[[[70,567],[402,626],[600,537],[268,478]],[[40,560],[405,630],[578,548],[213,478]],[[80,481],[395,562],[595,466],[280,385]],[[60,478],[377,566],[578,460],[261,372]]],
 residences:[[[118,581],[349,634],[525,551],[294,498]],[[95,560],[389,680],[515,632],[221,512]],[[75,385],[446,537],[598,447],[227,295]],[[65,393],[396,542],[560,471],[229,322]]]
};
export function spriteRect(b){if(b.proc){const pts=b.base.map(q=>iso(q.x,q.y)),xs=pts.map(p=>p.x),ys=pts.map(p=>p.y);return {x:Math.min(...xs),y:Math.min(...ys)-b.height,width:Math.max(...xs)-Math.min(...xs),height:Math.max(...ys)-Math.min(...ys)+b.height};}const width=b.artWidth,height=b.artHeight,p=iso(b.cx,b.cy);const atlas=b.atlas||'buildings',low=b.sprite>=2;
 const sy=atlas==='residences'?(low?680:0):(low?660:0),sh=atlas==='residences'?(low?574:675):(low?594:627);
 return {x:p.x-width/2,y:p.y-height+52,width,height,sx:(b.sprite%2)*CELL,sy,sw:CELL,sh};}
// Con l'immagine realistica la base segue le proporzioni del disegno (stesso centro, stessa larghezza a schermo).
const fitArt=b=>{if(b.front)return b;const K=b.proc&&ART_K[b.art||artName(b.id)];if(!K)return b;const k=b.flip?1-K:K;const t=b.fw+b.fh,fw=t*k,fh=t-fw;return {...b,fx:b.fx+(b.fw-fw)/2,fy:b.fy+(b.fh-fh)/2,fw,fh};};
function withBase(b){b=fitArt(b);const base=b.proc?[{x:b.fx,y:b.fy+b.fh},{x:b.fx+b.fw,y:b.fy+b.fh},{x:b.fx+b.fw,y:b.fy},{x:b.fx,y:b.fy}]:(r=>BASES[b.atlas||'buildings'][b.sprite].map(([u,v])=>world(r.x+u*r.width/r.sw,r.y+v*r.height/r.sh)))(spriteRect(b));
 if(b.proc){b.cx=b.fx+b.fw/2;b.cy=b.fy+b.fh/2;}
 const xs=base.map(p=>p.x),ys=base.map(p=>p.y);
 // Ingresso al centro del lato sinistro-frontale (insegna e porta negli sprite), spinto fuori dalla base.
 const [L,F]=base,mid={x:(L.x+F.x)/2,y:(L.y+F.y)/2},c={x:(base[0].x+base[2].x)/2,y:(base[0].y+base[2].y)/2};let nx=-(F.y-L.y),ny=F.x-L.x;const n=Math.hypot(nx,ny);nx/=n;ny/=n;if(nx*(mid.x-c.x)+ny*(mid.y-c.y)<0){nx=-nx;ny=-ny;}
 return {...b,base,x:Math.min(...xs),y:Math.min(...ys),w:Math.max(...xs)-Math.min(...xs),h:Math.max(...ys)-Math.min(...ys),door:{x:mid.x+nx*1.1,y:mid.y+ny*1.1,exitX:mid.x+nx*1.9,exitY:mid.y+ny*1.9}};}
// Stile moderno: ogni palazzo illustrato diventa un edificio disegnato dal codice, allineato alla griglia, nello stesso ingombro.
const MODERN={bar:{style:'cafe',color:'#f3efe7',height:150},pizzeria:{style:'restaurant',color:'#f1e2c6',height:120},shop:{style:'store',color:'#e9edf1',height:160},club:{style:'club',color:'#2b2440',height:170}};
const APARTMENT_COLORS=['#f2f0ec','#e6e9ec','#efe6da','#dfe5e1'];
function modernize(b){const m=MODERN[b.id]||{style:'apartment',color:APARTMENT_COLORS[b.sprite%4],height:150+(b.artHeight-380)*.6+(b.w>5.5?30:0)};
 const fw=5,fh=MODERN[b.id]?4:4.5;return {id:b.id,name:b.name,enterable:b.enterable,proc:true,...m,fx:Math.round((b.cx-fw/2)*2)/2,fy:Math.round((b.cy-fh/2)*2)/2,fw,fh};}
export const BUILDINGS=[
 {id:'bar',name:'Bar Vele',cx:19.5,cy:11,sprite:0,artWidth:490,artHeight:590},
 {id:'pizzeria',name:'Pizzeria Vesuviana',cx:11.5,cy:28,sprite:1,artWidth:440,artHeight:430},
 {id:'shop',name:'Bottega Marina',cx:34.5,cy:23,sprite:2,artWidth:500,artHeight:480},
 {id:'club',name:'Orbita · Discoteca',cx:29.5,cy:10,sprite:3,artWidth:490,artHeight:650}
].map(b=>({...b,cx:stretch(b.cx),cy:stretch(b.cy)})).concat(RESIDENCES).map(withBase).map(modernize).map(withBase).concat([
 // Edifici disegnati dal codice: footprint allineato alla griglia, base = rettangolo esatto.
 {id:'bank',name:'Banca Partenopea',proc:true,style:'bank',fx:104,fy:56,fw:8,fh:5.5,height:150,interior:'bank'},
 {id:'burger',name:'Molo Burger',proc:true,style:'burger',fx:138,fy:56.2,fw:6,fh:4.6,height:95,interior:'burger'},
 {id:'osteria',name:'Osteria del Borgo',proc:true,style:'restaurant',color:'#e8b25c',fx:116,fy:67,fw:8,fh:7.5,height:140},
 {id:'vesuvio',name:'Ristorante Vesuvio',proc:true,style:'restaurant',color:'#d9775a',fx:137,fy:67,fw:8,fh:7.5,height:130},
 {id:'mall',name:'Galleria Levante',proc:true,style:'mall',fx:103,fy:88,fw:24,fh:21,height:230,interior:'mall'},
 {id:'trattoria',name:'Trattoria del Borgo',proc:true,style:'restaurant',color:'#f0d48a',fx:38,fy:95,fw:8,fh:7,height:130},
 {id:'panorama',name:'Ristorante Panorama',proc:true,style:'restaurant',color:'#9fc7d8',fx:84,fy:95,fw:8,fh:7,height:150},
 ...VILLA_LOTS.map((l,i)=>({id:`villa${i}`,name:'Villa',proc:true,style:'villa',color:['#f7f6f2','#ecebe7','#f3efe6','#e9eef0'][i%4],fx:l.x+1,fy:l.y+5,fw:6,fh:5,height:105,interior:'villa',private:true})),
 {id:'fashion',name:'Moda Market',proc:true,style:'fashion',fx:136,fy:26,fw:12,fh:14,height:170,interior:'fashion'},
 {id:'barber',name:'Barbiere Raffa',proc:true,style:'barber',fx:119,fy:56,fw:6,fh:5,height:120,interior:'barber'},
 {id:'casino',name:'Sala Slot Vesuvio',proc:true,style:'casino',fx:103.5,fy:67,fw:9,fh:8.5,height:150,interior:'casino'}
].map(withBase));
// Il bordo marino segue x+y=SHORE: un fronte continuo visibile dalla piazza.
const RAW_SHORE=24;
export const SHORE=stretch(RAW_SHORE);
// Spiaggia tra la balaustra (x+y=SHORE) e la battigia (x+y=SHORE-BEACH); scale nella balaustra a queste posizioni lungo la riva (x-y).
export const BEACH=6,STAIRS=[-15,3,19];
const nearStairs=(x,y,w=1.25)=>STAIRS.some(t=>Math.abs(x-y-t)<w);
const RAW=[];
for(let x=1;x<25;x+=4){const y=RAW_SHORE-x+1.2;
 RAW.push({id:`palm${x}`,kind:'palm',x,y,r:.4});
 if(x<20)RAW.push({id:`lamp${x}`,kind:'lamp',x:x+1.5,y:y-1,r:.2});
 if(x<17)RAW.push({id:`bench${x}`,kind:'bench',x:x+.4,y:y+1.3,r:.65});
}
for(const [i,x,y] of [[0,18,16],[1,21,17],[2,12,25],[3,14,27],[4,25,20],[5,27,18],[6,10,19],[7,23,14]]){
 RAW.push({id:`table${i}`,kind:'table',x,y,r:.55});
 RAW.push({id:`seat${i}`,kind:'seat',x:x+.95,y,r:.2});
 RAW.push({id:`seatBack${i}`,kind:'seat',x:x-.95,y,r:.2});
}
for(const [x,y] of [[24,15],[31,18],[14,22],[25,27]])RAW.push({id:`scooter${x}`,kind:'scooter',x,y,r:.5});
for(const [x,y] of [[23,16],[29,28],[8,18]])RAW.push({id:`pot${x}-${y}`,kind:'plant',x,y,r:.35});
for(const [x,y] of [[18,28]])RAW.push({id:`bed${x}`,kind:'flowerbed',x,y,r:.7});
RAW.push({id:'statue',kind:'statue',x:18,y:23,r:.8},{id:'piazza-lamp',kind:'lamp',x:15.7,y:23,r:.2});
// Arredo del quartiere ampliato: nessun personaggio fittizio.
for(let x=4;x<63;x+=7){RAW.push({id:`avenue-lamp${x}`,kind:'lamp',x,y:33,r:.2});if(x%14===4)RAW.push({id:`avenue-pot${x}`,kind:'plant',x,y:40.7,r:.35});}
for(let y=5;y<63;y+=8)RAW.push({id:`viale-lamp${y}`,kind:'lamp',x:46.8,y,r:.2});
for(const [x,y] of [[31,43],[34,46],[50,56],[52,61],[48,61],[61,20]])RAW.push({id:`art-bed${x}-${y}`,kind:'flowerbed',x,y,r:.7});
RAW.push({id:'art-statue',kind:'statue',x:32,y:44,r:.8},{id:'garden-palm',kind:'palm',x:51,y:58,r:.4});
for(const [x,y] of [[30,46],[34,43],[48,58],[53,58],[60,20]]){const id=`rest${x}-${y}`;RAW.push({id,kind:'bench',x,y,r:.65},{id:id+'-seat',kind:'seat',x:x+1.2,y,r:.2});}
for(let y=5;y<79;y+=7)RAW.push({id:`port-lamp${y}`,kind:'lamp',x:69,y,r:.2},{id:`port-pot${y}`,kind:'plant',x:78,y,r:.35});
for(let x=5;x<79;x+=7)RAW.push({id:`south-lamp${x}`,kind:'lamp',x,y:70.8,r:.2});
RAW.push({id:'main-fountain',kind:'fountain',x:73,y:57,r:.8},{id:'port-palm',kind:'palm',x:74,y:20,r:.4},{id:'square-bench',kind:'bench',x:70,y:60,r:.65},{id:'square-seat',kind:'seat',x:71.2,y:60,r:.2});
for(const [x,y] of [[35,28]])RAW.push({id:`v2-flower${x}-${y}`,kind:'flowerbed',x,y,r:.65});
for(const [x,y] of [[20,31],[29,26],[36,29],[10,32]])RAW.push({id:`v2-lamp${x}-${y}`,kind:'lamp',x,y,r:.2});
// Le sedie restano attaccate al proprio tavolo: si sposta il gruppo, non la distanza fra sedia e tavolo.
const tables=new Map(RAW.filter(p=>p.kind==='table').map(t=>[t.id.slice(5),t]));
// Dehors ordinati: 4 tavoli davanti al Bar Lungomare (corridoio libero sulla porta) e 4 davanti alla pizzeria, in file regolari.
const TERRACE=[[24,20.6],[24,23.6],[30.4,20.6],[30.4,23.6],[12.4,43.6],[12.4,46.6],[19.6,43.6],[19.6,46.6]];
export const PROPS=RAW.map(p=>{const m=p.id.match(/^seat(?:Back)?(\d+)$/);if(m){const t=tables.get(m[1]);return {id:p.id,kind:p.kind,r:p.r,x:stretch(t.x)+(p.x-t.x),y:stretch(t.y)};}const rest=p.id.match(/^(rest.*)-seat$/);if(rest){const b=RAW.find(q=>q.id===rest[1]);return {id:p.id,kind:p.kind,r:p.r,x:stretch(b.x)+1.2,y:stretch(b.y)};}if(p.id==='square-seat')return {id:p.id,kind:p.kind,r:p.r,x:stretch(70)+1.2,y:stretch(60)};return {id:p.id,kind:p.kind,r:p.r,x:stretch(p.x),y:stretch(p.y)};});
for(let t=-26,i=0;t<=28;t+=6.5,i++){if(STAIRS.some(s=>Math.abs(s-t)<2.6))continue;const s=SHORE-BEACH*.5,x=(s+t)/2,y=(s-t)/2;if(x<1||y<1)continue;
 PROPS.push({id:`umbrella${i}`,kind:'umbrella',x,y,r:.3,beach:true,color:['#e5484d','#2a6fd6','#ffc928','#2fbf6c'][i%4]},{id:`lounger${i}`,kind:'lounger',x:x-.8,y:y-.8,r:.45,beach:true});}
{const add=(kind,x,y,r,extra={})=>PROPS.push({id:`${kind}-${x}-${y}`,kind,x,y,r,...extra});
 // Villa comunale: alberi e fontana dentro la pista, panchine e lampioni sul bordo.
 for(let x=TRACK_IN.x+2.5;x<TRACK_IN.x+TRACK_IN.w-1;x+=4.5)for(let y=TRACK_IN.y+3;y<TRACK_IN.y+TRACK_IN.h-1;y+=6)if(Math.hypot(x-115.5,y-24)>4)add('tree',x,y,.55);
 add('fountain',115.5,24,.9);
 for(let y=6;y<44;y+=8){add('bench',VILLA_PARK.x+.6,y,.65);add('lamp',VILLA_PARK.x+VILLA_PARK.w-.6,y+3,.2);}
 for(let y=6;y<44;y+=6)add('tree',142.5,y,.55);
 // Parchi giochi: scivoli, altalene, sabbiera, panchine.
 for(const [x,y] of [[12,98],[24,103]])add('slide',x,y,.9);
 for(const [x,y] of [[18,97],[13,106]])add('swing',x,y,.9);
 add('sandbox',24,97,1.1);add('slide',142,14,.9);add('swing',142,19,.9);
 for(const x of [11,17,23])add('bench',x,110.4,.65);
 for(const [x,y] of [[6,96],[31,96],[6,110],[31,110]])add('tree',x,y,.55);
 // Bancomat davanti alla banca, auto parcheggiate, fermate dell'autobus.
 for(const x of [113.3,114.6])add('atm',x,59.5,.35);
 for(const [x,y] of [[137,89],[140,89],[146,89],[137,96],[143,96],[146,103],[140,108]])add('car',x,y,.95,{color:['#e5484d','#2a6fd6','#f2f2f2','#3b4250','#ffc928'][Math.round(x+y)%5]});
 add('car',136.4,59.2,.95,{color:'#ffc928'});
 for(const s of BUS_STOPS){const away={x:Math.sign(s.x-s.at.x)*1.3,y:Math.sign(s.y-s.at.y)*1.3};add('busstop',s.x+away.x,s.y+away.y,.5,{name:s.name});}
 // Ville: alberi nel giardino.
 VILLA_LOTS.forEach((l,i)=>{add('palm',l.x+1.4,l.y+1.6,.4);add('forsale',l.x+7.6,l.y+10.6,.15,{villa:`villa${i}`});add('car',l.x+9.3,l.y+8,.95,{color:['#f2f2f2','#3b4250','#2a6fd6','#e5484d'][i%4]});
  if(i%2===0)add('lounger',l.x+6.6,l.y+2.2,.45);});
 for(const x of [62,76,90,104,118,140])add('bench',x,112.4,.65);
 // Alberi oltre il muro di confine (decorativi, fuori dall'area percorribile).

}
// Ogni mezzo parcheggiato, compresi quelli aggiunti dall'editor o disegnati
// come arredo stradale, deve avere lo stesso identificativo usato dal catalogo.
const PROP_VEHICLE={car:'auto',scooter:'scooter',moto:'scooter',bike:'bici',bici:'bici',bicycle:'bici',monopattino:'monopattino'};
export const parkedVehicleOf=o=>o?.v||PROP_VEHICLE[o?.kind]||null;
export const distance=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function inside(poly,x,y){let c=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a.y>y)!==(b.y>y)&&x<(b.x-a.x)*(y-a.y)/(b.y-a.y)+a.x)c=!c;}return c;}
function edgeDistance(poly,x,y){let d=Infinity;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[j],b=poly[i],dx=b.x-a.x,dy=b.y-a.y,t=Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/(dx*dx+dy*dy)));d=Math.min(d,Math.hypot(x-a.x-t*dx,y-a.y-t*dy));}return d;}
export const blockedByBuilding=(b,x,y,r=0)=>x>b.x-r&&x<b.x+b.w+r&&y>b.y-r&&y<b.y+b.h+r&&(inside(b.base,x,y)||edgeDistance(b.base,x,y)<r);
// Mantieni liberi gli ingombri dei palazzi e i corridoi d'ingresso dopo ogni modifica alla composizione.
for(let i=PROPS.length-1;i>=0;i--){const p=PROPS[i];if(BUILDINGS.some(b=>blockedByBuilding(b,p.x,p.y,p.r+.1)||(b.enterable!==false&&distance(p,b.door)<p.r+1.2))||(p.x+p.y<SHORE+p.r&&!p.beach)||nearStairs(p.x,p.y,2)&&Math.abs(p.x+p.y-SHORE)<2.5)PROPS.splice(i,1);}
const SPAWN={x:stretch(18),y:stretch(19)};
for(const p of PROPS){const m=p.id.match(/^(table|seat|seatBack)(\d+)$/);if(!m)continue;const [tx,ty]=TERRACE[m[2]];p.x=tx+(m[1]==='seat'?.95:m[1]==='seatBack'?-.95:0);p.y=ty;}
export const MAPS={lungomare:{id:'lungomare',name:'Napoli Centro',bounds:{x:0,y:0,w:WORLD_SIZE,h:WORLD_SIZE},miniBounds:{x:0,y:0,w:CITY_SIZE+10,h:CITY_SIZE+10},spawn:SPAWN,buildings:BUILDINGS,props:PROPS}};
for(const b of BUILDINGS.filter(b=>b.enterable!==false)){
 const props=[{id:'counter',kind:'counter',x:8,y:3,r:1.4}];
 if(b.interior==='bank')props.push({id:'atm1',kind:'atm',x:3,y:5,r:.35},{id:'atm2',kind:'atm',x:3,y:7,r:.35},{id:'atm3',kind:'atm',x:3,y:9,r:.35},{id:'bank-bench',kind:'bench',x:11,y:8,r:.65});
 else if(b.interior==='casino'){props.length=0;for(let i=0;i<6;i++)props.push({id:'slot'+i,kind:'slot',x:3+i*2,y:3,r:.45});for(let i=0;i<4;i++)props.push({id:'slotb'+i,kind:'slot',x:4+i*2.6,y:8,r:.45});props.push({id:'cassa',kind:'counter',x:13,y:10,r:1.2});}
 else if(b.interior==='fashion'){props.length=0;for(let i=0;i<4;i++)for(let j=0;j<2;j++)props.push({id:`rack${i}-${j}`,kind:'rack',x:3+i*3.3,y:4+j*4,r:.6});props.push({id:'mirror1',kind:'mirror',x:14,y:3,r:.4},{id:'mirror2',kind:'mirror',x:2,y:11,r:.4},{id:'cassa',kind:'counter',x:13,y:11,r:1.2});}
 else if(b.interior==='barber'){props.length=0;for(let i=0;i<3;i++)props.push({id:'chair'+i,kind:'barberchair',x:4+i*4,y:4,r:.5});props.push({id:'wait',kind:'bench',x:5,y:10,r:.65},{id:'plant',kind:'plant',x:13,y:10,r:.35});}
 else if(b.interior==='villa'){props.length=0;props.push({id:'sofa',kind:'sofa',x:4,y:5,r:.8},{id:'bed',kind:'bed',x:12,y:4,r:.8},{id:'picture',kind:'picture',x:8,y:2,r:.3},{id:'table',kind:'table',x:8,y:8,r:.6},{id:'seat',kind:'seat',x:9.1,y:8,r:.2},{id:'seat2',kind:'seat',x:6.9,y:8,r:.2},{id:'plant',kind:'plant',x:2,y:10,r:.35},{id:'plant2',kind:'plant',x:14,y:10,r:.35},{id:'lamp',kind:'lamp',x:2,y:2,r:.2});}
 else if(b.interior==='mall')props.push({id:'counter2',kind:'counter',x:3,y:7,r:1.4},{id:'counter3',kind:'counter',x:13,y:7,r:1.4},{id:'mall-plant',kind:'plant',x:8,y:8,r:.35},{id:'mall-bench',kind:'bench',x:8,y:10,r:.65});
 else for(let i=0;i<4;i++){
  const x=4+(i%2)*7,y=6+Math.floor(i/2)*4;
  props.push({id:`table${i}`,kind:'table',x,y,r:.6},{id:`seat${i}`,kind:'seat',x:x+1.1,y,r:.2});
 }
 MAPS[b.id]={id:b.id,name:b.name,bounds:{x:0,y:0,w:16,h:14},spawn:{x:8,y:12},buildings:[],props};
}
MAPS['ospiti-villa']={id:'ospiti-villa',name:'Villa (ospiti)',bounds:{x:0,y:0,w:16,h:14},spawn:{x:8,y:12},buildings:[],props:[{id:'sofa',kind:'sofa',x:4,y:5,r:.8},{id:'bed',kind:'bed',x:12,y:4,r:.8},{id:'picture',kind:'picture',x:8,y:2,r:.3},{id:'table',kind:'table',x:8,y:8,r:.6},{id:'seat',kind:'seat',x:9.1,y:8,r:.2},{id:'seat2',kind:'seat',x:6.9,y:8,r:.2},{id:'plant',kind:'plant',x:2,y:10,r:.35},{id:'plant2',kind:'plant',x:14,y:10,r:.35},{id:'lamp',kind:'lamp',x:2,y:2,r:.2}]};
// Primo piano del centro commerciale: esiste solo dove viene registrato (server e client del 3D). Si sale e si scende con la scala mobile.
let mallUp=false;export function registerMallFloor(){if(mallUp)return;mallUp=true;MAPS.mall2={id:'mall2',name:'Centro Commerciale Golfo · primo piano',bounds:{x:0,y:0,w:16,h:14},spawn:{x:13,y:10},buildings:[],props:[{id:'c1',kind:'counter',x:8,y:3,r:1.4},{id:'c2',kind:'counter',x:3,y:7,r:1.4},{id:'c3',kind:'counter',x:13,y:6,r:1.4},{id:'p1',kind:'plant',x:2,y:11,r:.35},{id:'b1',kind:'bench',x:7,y:10,r:.65}]};}
const STAIR={x:14,y:11.2};
export function doors(room){if(room==='mergellina')return napoliPlaces().doors;if(room==='mall2')return [{id:'down',name:'Scendi al piano terra',x:STAIR.x,y:STAIR.y,to:'mall',spawn:{x:12.6,y:10.4}}];if(room==='mall'&&mallUp)return [{id:'exit',name:'Esci sul Lungomare',x:8,y:13,to:'lungomare'},{id:'up',name:'Sali al primo piano',x:STAIR.x,y:STAIR.y,to:'mall2',spawn:{x:12.6,y:10.4}}];return room==='lungomare'?BUILDINGS.filter(b=>b.enterable!==false).map(b=>({id:b.id,name:b.name,x:b.door.x,y:b.door.y,exitX:b.door.exitX,exitY:b.door.exitY,to:b.id})):[{id:'exit',name:'Esci sul Lungomare',x:8,y:13,to:'lungomare'}];}
// Rettangoli [x0,y0,x1,y1] in più che bloccano il passo sul Lungomare: li riempie solo HUMANA life 3D (arena paintball). Nel 2D resta vuoto.
export const EXTRA_BLOCKS=[];
export function canStand(room,x,y,r=.25){if(room==='mergellina')return napoliStand(x,y,r);
 const m=MAPS[room];if(!m||!Number.isFinite(x)||!Number.isFinite(y))return false;
 if(room==='lungomare'&&MODE.front){if(y<F.SEA+r||isRail(x,y))return false;}
 else if(room==='lungomare'){const s=x+y;if(s<SHORE-BEACH+r*1.42)return false;if(Math.abs(s-SHORE)<.35+r*1.42&&!nearStairs(x,y,1.25-r))return false;}
 if(room==='lungomare'){const E=cityEdge();if(x<E.x0+r||y<E.y0+r||x>E.x1-r||y>E.y1-r)return false;}
 const b=m.bounds;if(x<b.x+r||y<b.y+r||x>b.x+b.w-r||y>b.y+b.h-r)return false;if(room==='lungomare'&&EXTRA_BLOCKS.length)for(const q of EXTRA_BLOCKS)if(x>q[0]-r&&x<q[2]+r&&y>q[1]-r&&y<q[3]+r)return false;
 if(room==='lungomare'&&!MODE.front&&(inPool(x,y,r)||fenceBlocked(x,y,r)))return false;
 if(room==='lungomare'&&PAINT.get(Math.floor(x)+','+Math.floor(y))==='water'&&!m.props.some(p=>p.art==='ponte'&&Math.abs(x-p.x)<3.2&&Math.abs(y-p.y)<1.2))return false;
 if(m.buildings.some(b=>b.base?blockedByBuilding(b,x,y,r):x>b.x-r&&x<b.x+b.w+r&&y>b.y-r&&y<b.y+b.h+r))return false;
 for(const p of m.props){if(p.kind==='seat'||p.art==='ponte')continue;const dx=x-p.x,dy=y-p.y,l=p.r+r;if(dx<l&&dx>-l&&dy<l&&dy>-l&&dx*dx+dy*dy<l*l)return false;}
 return true;
}
export function step(p,input,dt){
 if(p.seat)return;
 let x=Number(input.x)||0,y=Number(input.y)||0;const length=Math.max(1,Math.hypot(x,y));x/=length;y/=length;
 let v=(p.room==='lungomare'||p.room==='mergellina')&&VEHICLE[p.vehicle],speed=v?7.5*v.speed:input.run?4.4:2.5;
 // Hunger and thirst are gameplay effects, not just HUD values. Vehicles keep
 // their handling; walking and running slow down gradually when needs are low.
 if(!v&&p.needs){const lowest=Math.min(p.needs.hunger,p.needs.thirst);speed*=lowest<20?.58:lowest<40?.78:1;}
 if(v){const b=v.base||v.id;if(p.fuel!==undefined&&p.fuel<=0&&(b==='auto'||b==='cabrio'||b==='furgone'||b==='scooter'))speed=0; // benzina finita (solo 3D: nel 2D p.fuel non esiste)
  return drive(p,x,y,speed,dt,v,input.rev===true,input);}

 const dx=x*speed*dt,dy=y*speed*dt;const oldX=p.x,oldY=p.y;
 if(canStand(p.room,p.x+dx,p.y+dy)){p.x+=dx;p.y+=dy;}
 else if(dx&&canStand(p.room,p.x+dx,p.y))p.x+=dx;
 else if(dy&&canStand(p.room,p.x,p.y+dy))p.y+=dy;
 else if(dx||dy)slide(p,dx,dy);
 p.moving=Math.hypot(p.x-oldX,p.y-oldY)>.001;p.running=!!input.run&&p.moving;
 if(p.moving)p.direction=Math.atan2(y,x);
}
// Guida dei veicoli: il mezzo ha una sua direzione (heading) che ruota gradualmente verso quella richiesta,
// accelera e frena con dolcezza e si muove sempre lungo la propria direzione (mai di traverso).
// Sulle strade dritte la direzione si allinea all'asse della strada e il mezzo scivola al centro della corsia di destra.
function drive(p,x,y,speed,dt,v,rev,controls){
 // Il client può inviare un intervallo più grande quando la scheda mobile
 // viene sospesa o quando cambia orientamento. Limitarlo evita scatti enormi,
 // attraversamento degli ostacoli e perdita della sincronizzazione multiplayer.
 dt=Math.max(0,Math.min(Number(dt)||0,.12));
 if(!Number.isFinite(speed)||speed<0)speed=0;
 const vb=v.base||v.id,two=vb==='bici'||vb==='monopattino'||vb==='scooter';if(!Number.isFinite(p.heading))p.heading=p.direction||0;p.vel=Number.isFinite(p.vel)?p.vel:0;
 if(controls?.drive===true){
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0)),steer=clamp(controls.steer,-1,1),turn=Math.sign(steer)*Math.pow(Math.abs(steer),1.18),throttle=clamp(controls.throttle,0,1),brake=clamp(controls.brake,0,1),reverseAllowed=['auto','cabrio','furgone','scooter'].includes(vb);
  p.steer=steer;
  const target=brake>.01?(reverseAllowed&&Math.abs(p.vel)<.35?-Math.min(two?1.2:2.2,Math.max(two?.65:1.1,speed*.18))*brake:0):speed*throttle;
  const response=brake>.01?11:throttle>.01?(two?6.4:4.4):3.6;
  p.vel+=Math.max(-response*dt,Math.min(response*dt,target-p.vel));
  const ratio=Math.max(0,Math.min(1,Math.abs(p.vel)/Math.max(1,speed))),yawRate=two?1.9-1.45*ratio:1.55-1.05*ratio;
  if(Math.abs(p.vel)>.12)p.heading+=turn*yawRate*dt*(p.vel<0?-1:1);
  p.heading=Math.atan2(Math.sin(p.heading),Math.cos(p.heading));p.direction=p.heading;
  if(p.room==='lungomare'&&throttle>.01&&Math.abs(steer)<.08)laneAssist(p,dt);p.direction=p.heading;
  const dx=Math.cos(p.heading)*p.vel*dt,dy=Math.sin(p.heading)*p.vel*dt,oldX=p.x,oldY=p.y;
  if(canStand(p.room,p.x+dx,p.y+dy)){p.x+=dx;p.y+=dy;}else p.vel=0;
  p.moving=Math.hypot(p.x-oldX,p.y-oldY)>.001;p.running=false;return;
 }
 p.steer=0;const want=Math.hypot(x,y)>.05;const rate=(two?3.6:2.6)*dt;
 if(rev&&want){if(!Number.isFinite(p.heading))p.heading=p.direction||0;p.vel=(p.vel||0)+Math.max(-9*dt,Math.min(5*dt,-speed*.35-(p.vel||0)));const bx=Math.cos(p.heading)*p.vel*dt,by=Math.sin(p.heading)*p.vel*dt,ox=p.x,oy=p.y;if(canStand(p.room,p.x+bx,p.y+by)){p.x+=bx;p.y+=by;}else p.vel=0;p.moving=Math.hypot(p.x-ox,p.y-oy)>.001;p.running=false;p.direction=p.heading;return;}
 let diff=0;if(want){const d=Math.atan2(y,x);diff=Math.abs(Math.atan2(Math.sin(d-p.heading),Math.cos(d-p.heading)));p.heading=turnToward(p.heading,d,rate);}
 const target=want?speed*(1-.55*Math.min(1,diff/(Math.PI*.6))):0;p.vel+=Math.max(-9*dt,Math.min((two?7:5)*dt,target-p.vel));
 if(p.room==='lungomare'&&want&&diff<.3)laneAssist(p,dt);
 const dx=Math.cos(p.heading)*p.vel*dt,dy=Math.sin(p.heading)*p.vel*dt,oldX=p.x,oldY=p.y;
 if(canStand(p.room,p.x+dx,p.y+dy)){p.x+=dx;p.y+=dy;}
 else if(dx&&canStand(p.room,p.x+dx,p.y)){p.x+=dx;p.vel*=.6;}
 else if(dy&&canStand(p.room,p.x,p.y+dy)){p.y+=dy;p.vel*=.6;}
 else p.vel=0;
 p.moving=Math.hypot(p.x-oldX,p.y-oldY)>.001;p.running=false;p.direction=p.heading;}
// Strade dritte: allinea la direzione all'asse e centra il mezzo nella corsia di destra.
function laneAssist(p,dt){const m=surface(Math.floor(p.x),Math.floor(p.y));if(m!=='road'&&m!=='roadline')return;
 const h=p.heading,axis=Math.round(h/(Math.PI/2))*(Math.PI/2);if(Math.abs(Math.atan2(Math.sin(h-axis),Math.cos(h-axis)))>.26)return;
 p.heading=turnToward(h,axis,1.6*dt);if(MODE.front)return;
 const horiz=Math.abs(Math.cos(axis))>.5,dir=horiz?Math.sign(Math.cos(axis)):Math.sign(Math.sin(axis));
 const st=STREETS.find(s=>horiz?(s.w>s.h&&p.y>=s.y&&p.y<=s.y+s.h&&p.x>=s.x&&p.x<=s.x+s.w):(s.h>s.w&&p.x>=s.x&&p.x<=s.x+s.w&&p.y>=s.y&&p.y<=s.y+s.h));if(!st)return;
 const wdt=horiz?st.h:st.w,c=horiz?st.y+st.h/2:st.x+st.w/2,off=wdt>=4?wdt/4:0;
 // Verso +x la corsia di destra è a y maggiore; verso +y è a x minore.
 const lane=horiz?c+dir*off:c-dir*off,cur=horiz?p.y:p.x,k=Math.min(1,2.2*dt),nx=horiz?p.x:cur+(lane-cur)*k,ny=horiz?cur+(lane-cur)*k:p.y;
 if(canStand(p.room,nx,ny)){p.x=nx;p.y=ny;}}
// Scivola intorno a tavoli, pali e spigoli invece di fermarsi contro l'ostacolo.
function slide(p,dx,dy){const side=p.slide||1;
 for(const a of [.45,.9,1.3])for(const s of [side,-side]){const c=Math.cos(a*s),n=Math.sin(a*s),mx=(dx*c-dy*n)*.85,my=(dx*n+dy*c)*.85;if(canStand(p.room,p.x+mx,p.y+my)){p.x+=mx;p.y+=my;p.slide=s;return;}}
}
export function attenuation(d){return d<=3?1:d>=15?0:Math.pow((15-d)/12,2);}

// ── Editor della mappa (pannello admin, stile The Sims) ──────────────────────────
// Le modifiche sono un documento sovrapposto alla mappa base: {add:[…], mod:{id:{dx,dy,flip,rot}}, del:[id…]}.
const EDIT_PROPS_EXTRA={};
export const EDIT_PROPS={
 bench:{name:'Panchina',cat:'Arredo urbano',icon:'🪑',r:.65},lamp:{name:'Lampione',cat:'Arredo urbano',icon:'💡',r:.2},flowerbed:{name:'Aiuola',cat:'Arredo urbano',icon:'🌺',r:.8},
 fountain:{name:'Fontana',cat:'Arredo urbano',icon:'⛲',r:1.2},statue:{name:'Statua',cat:'Arredo urbano',icon:'🗿',r:.8},atm:{name:'Bancomat',cat:'Arredo urbano',icon:'🏧',r:.4},vending:{name:'Distributore di bevande',cat:'Arredo urbano',icon:'🥤',r:.5},
 palm:{name:'Palma',cat:'Natura',icon:'🌴',r:.4},tree:{name:'Albero',cat:'Natura',icon:'🌳',r:.5},plant:{name:'Pianta in vaso',cat:'Natura',icon:'🪴',r:.35},
 umbrella:{name:'Ombrellone',cat:'Spiaggia e dehors',icon:'⛱️',r:.4},lounger:{name:'Lettino',cat:'Spiaggia e dehors',icon:'🏖️',r:.5},table:{name:'Tavolino',cat:'Spiaggia e dehors',icon:'🍽️',r:.55},seat:{name:'Sedia',cat:'Spiaggia e dehors',icon:'💺',r:.2},
 scooter:{name:'Scooter parcheggiato',cat:'Veicoli',icon:'🛵',r:.5},
 'parked-auto':{name:'Auto parcheggiata',cat:'Veicoli',icon:'🚗',r:1.1,kind:'parked',v:'auto'},'parked-furgone':{name:'Furgone parcheggiato',cat:'Veicoli',icon:'🚐',r:1.2,kind:'parked',v:'furgone'},
 'parked-cabrio':{name:'Cabrio parcheggiata',cat:'Veicoli',icon:'🏎️',r:1.1,kind:'parked',v:'cabrio'},'parked-scooter':{name:'Scooter 125',cat:'Veicoli',icon:'🛵',r:.5,kind:'parked',v:'scooter'},
 'parked-bici':{name:'Bici',cat:'Veicoli',icon:'🚲',r:.4,kind:'parked',v:'bici'},'parked-monopattino':{name:'Monopattino',cat:'Veicoli',icon:'🛴',r:.3,kind:'parked',v:'monopattino'}};
// Oggetti decorativi con immagine realistica (assets/oggetti/<art>.png): w = larghezza in metri della base.
const D=(name,cat,w,r)=>({name,cat,w,r,kind:'deco'});
export const DECO_ITEMS={'ruota-panoramica':D('Ruota panoramica','Giostre',9,3.5),'giostra-cavalli':D('Giostra con cavalli','Giostre',7,3.2),'montagne-russe':D('Montagne russe','Giostre',12,4.5),calcinculo:D('Calcinculo','Giostre',8,3.5),autoscontri:D('Autoscontri','Giostre',10,4.5),tazze:D('Tazze rotanti','Giostre',7,3.2),
 'statua-angelo':D('Statua angelo','Statue e monumenti',2,.8),'statua-cavallo':D('Statua equestre','Statue e monumenti',3,1.2),'statua-pulcinella':D('Statua Pulcinella','Statue e monumenti',2,.8),'statua-moderna':D('Scultura moderna','Statue e monumenti',2.5,1),'statua-sirena':D('Fontana Partenope','Statue e monumenti',4,1.8),obelisco:D('Obelisco','Statue e monumenti',3,1.2),
 'piscina-grande':D('Piscina grande','Piscine e acquapark',10,4.5),'piscina-rotonda':D('Piscina rotonda','Piscine e acquapark',7,3.2),idromassaggio:D('Idromassaggio','Piscine e acquapark',3,1.4),'scivolo-acqua':D('Scivolo acquatico','Piscine e acquapark',8,3.5),'tubo-acqua':D('Tubo acquatico','Piscine e acquapark',8,3.5),
 'scivolo-parco':D('Scivolo bimbi','Parco giochi',3.5,1.5),altalena:D('Altalena','Parco giochi',3.5,1.5),
 'panchina-legno':D('Panchina in legno','Arredo urbano',2,.65),'panchina-moderna':D('Panchina moderna','Arredo urbano',2,.65),'panchina-marmo':D('Panchina in marmo','Arredo urbano',2,.65),gazebo:D('Gazebo','Arredo urbano',4,1.8),chiosco:D('Chiosco gelati','Arredo urbano',3.5,1.5)};
Object.assign(DECO_ITEMS,{
 'staccionata-legno':D('Staccionata in legno','Recinzioni',3,.3),'staccionata-bianca':D('Staccionata bianca','Recinzioni',3,.3),'recinzione-ferro':D('Recinzione in ferro','Recinzioni',3,.3),'recinzione-moderna':D('Recinzione moderna','Recinzioni',3,.3),siepe:D('Siepe','Recinzioni',3,.4),muretto:D('Muretto in pietra','Recinzioni',3,.4),'muro-mattoni':D('Muro di mattoni','Recinzioni',3,.4),'ringhiera-vetro':D('Ringhiera in vetro','Recinzioni',3,.3),cancello:D('Cancello','Recinzioni',3.5,.4),
 semaforo:D('Semaforo','Strada',1.2,.3),'cartello-stop':D('Cartello stop','Strada',1,.2),'pensilina-bus':D('Pensilina bus','Strada',4,1.4),'lampione-moderno':D('Lampione moderno','Strada',1.2,.25),cestino:D('Cestino','Strada',.8,.3),idrante:D('Idrante','Strada',.7,.25),fioriera:D('Fioriera','Strada',2,.8),dissuasori:D('Dissuasori','Strada',2,.4),rastrelliera:D('Rastrelliera bici','Strada',2.5,.8),'cabina-telefonica':D('Cabina telefonica','Strada',1.4,.6),edicola:D('Edicola','Strada',3,1.3),'cassetta-posta':D('Cassetta postale','Strada',.8,.25),parcometro:D('Parcometro','Strada',.7,.2),bandiera:D('Bandiera','Strada',1.5,.3),fontanella:D('Fontanella','Strada',1,.3),
 'albero-viale':D('Platano da viale','Natura e paesaggio',3,.6),cipresso:D('Cipresso','Natura e paesaggio',1.6,.4),ulivo:D('Ulivo','Natura e paesaggio',3,.6),limone:D('Limone in vaso','Natura e paesaggio',1.6,.5),cespuglio:D('Bouganville','Natura e paesaggio',1.8,.6),pino:D('Pino marittimo','Natura e paesaggio',4,.6),bosco:D('Boschetto','Natura e paesaggio',6,2.5),roccia:D('Masso','Natura e paesaggio',2.5,1),rocce:D('Rocce','Natura e paesaggio',2.5,.8),
 montagna:D('Montagna innevata','Natura e paesaggio',24,11),'montagna-verde':D('Montagna boscosa','Natura e paesaggio',22,10),collina:D('Collina','Natura e paesaggio',14,6),'collina-vigneto':D('Collina con vigneto','Natura e paesaggio',14,6),vulcano:D('Vulcano','Natura e paesaggio',26,12),ponte:D('Ponte in pietra','Natura e paesaggio',6,.2),
 cane:D('Cane','Animali',1.2,.4),gatto:D('Gatto','Animali',.7,.25),cavallo:D('Cavallo','Animali',2.6,.8),mucca:D('Mucca','Animali',2.6,.8),pecora:D('Pecora','Animali',1.4,.5),gabbiani:D('Gabbiani','Animali',1,.2),anatre:D('Anatre','Animali',1.2,.3),cervo:D('Cervo','Animali',2,.6),galline:D('Galline','Animali',1.4,.4),asino:D('Asino','Animali',2,.6),maiale:D('Maiale','Animali',1.6,.5),
 'albero-natale':D('Albero di Natale','Eventi e svago',3,1),palco:D('Palco concerti','Eventi e svago',10,4.5),mercatino:D('Bancarella','Eventi e svago',3.5,1.4),'food-truck':D('Food truck','Eventi e svago',5,2),pedalo:D('Pedalò cigno','Eventi e svago',2.5,1),barca:D('Barca (gozzo)','Eventi e svago',4,1.4)});
for(const [art,t] of Object.entries(DECO_ITEMS))EDIT_PROPS_EXTRA['deco-'+art]={...t,art};
Object.assign(EDIT_PROPS,EDIT_PROPS_EXTRA);
const B=(name,style,fw,fh,height)=>({name,style,fw,fh,height,cat:'Edifici'});
export const EDIT_BUILDINGS={'villa-1':B('Villa mediterranea','villa',6,5,105),'villa-2':B('Villa moderna','villa',6,5,105),'villa-3':B('Villa con tetto','villa',6,5,105),'villa-4':B('Villa in pietra','villa',6,5,105),
 'palazzo-1':B('Palazzo Caffè Napoli','residence',5,4.5,170),'palazzo-2':B('Palazzo Alimentari','residence',5,4.5,170),'palazzo-3':B('Residenza in vetro','residence',5,4.5,170),'palazzo-4':B('Palazzo Farmacia','residence',5,4.5,170),
 bar:B('Bar','shop',5,4,110),pizzeria:B('Pizzeria','shop',5,4,110),negozio:B('Boutique','shop',5,4,110),barbiere:B('Barbiere','barber',6,5,120),osteria:B('Osteria','restaurant',8,7.5,140),
 trattoria:B('Trattoria','restaurant',8,7,130),vesuvio:B('Ristorante sul mare','restaurant',8,7.5,130),panorama:B('Ristorante panoramico','restaurant',8,7,150),burger:B('Fast food','burger',6,4.6,95),
 banca:B('Banca','bank',8,5.5,150),discoteca:B('Discoteca','club',5,4,130),slot:B('Sala slot','casino',9,8.5,150),moda:B('Negozio di moda','fashion',12,14,170),'centro-commerciale':B('Centro commerciale','mall',24,21,230)};
export const GROUND_PAINTS={roadline:'Asfalto con mezzeria',crosswalk:'Strisce pedonali',curb:'Cordolo marciapiede',cobble:'Sanpietrini',dirt:'Sterrato',rock:'Roccia',snow:'Neve',water:'Acqua (lago/fiume)',stone:'Mattoni (basolato)',tiles:'Mattonelle',marble:'Marmo',road:'Asfalto',sidewalk:'Marciapiede',grass:'Prato',garden:'Giardino',sand:'Sabbia',wood:'Legno (pedana)',playground:'Gomma parco giochi',parking:'Parcheggio',track:'Pista'};

// Luna park appena fuori città, dentro il recinto.
const LUNA=['ruota-panoramica','montagne-russe','giostra-cavalli','autoscontri','calcinculo','tazze'];
const lunaPark=(x0,y0)=>LUNA.map((art,i)=>{const t=DECO_ITEMS[art];return {id:'luna-'+art,kind:'deco',art,w:t.w,r:t.r,x:x0+(i%2)*14,y:y0+Math.floor(i/2)*14};});
// Bordo della zona giocabile: oltre c'è la staccionata.
export const cityEdge=()=>MODE.front?{x0:1,y0:0,x1:F.CITY_W+34,y1:F.CITY_H}:{x0:1,y0:1,x1:CITY_SIZE+34,y1:CITY_SIZE+8};
const ISO={props:[...PROPS,...lunaPark(CITY_SIZE+12,40)].map(p=>({...p})),buildings:BUILDINGS.map(b=>({...b})),spawn:{...MAPS.lungomare.spawn},mini:{...MAPS.lungomare.miniBounds}};
const FRONT={props:[...frontProps(),...lunaPark(F.CITY_W+10,70)],buildings:frontBuildings().map(withBase),spawn:{...FRONT_SPAWN},mini:{x:0,y:0,w:F.CITY_W,h:F.CITY_H}};
let BASE_PROPS=ISO.props,BASE_BUILDINGS=ISO.buildings;
// Cambia la città tra vista isometrica e vista frontale (stessa stanza "lungomare": interni, ville e lavori restano validi).
export function setWorldMode(front){front=!!front;MODE.front=front;const s=front?FRONT:ISO;BASE_PROPS=s.props;BASE_BUILDINGS=s.buildings;MAPS.lungomare.spawn=s.spawn;MAPS.lungomare.miniBounds=s.mini;MAPS.lungomare.front=front;}
// Le modifiche dell'editor sono separate per le due città: quelle della vista frontale stanno in doc.front.
export const modeDoc=doc=>MODE.front?(doc?.front||{}):(doc||{});
const scaleOf=v=>Math.min(3,Math.max(.4,Number(v)||1));
const scaleBox=(b,k)=>{if(k===1)return b;const cx=b.fx+b.fw/2,cy=b.fy+b.fh/2,fw=b.fw*k,fh=b.fh*k;return {...b,fx:cx-fw/2,fy:cy-fh/2,fw,fh,height:(b.height||100)*k};};
const editBuilding=(b,m)=>{b=scaleBox(b,scaleOf(m.scale));let {fx,fy,fw,fh}=b;fx+=m.dx||0;fy+=m.dy||0;const flip=!!m.flip;if(flip!==!!b.flip&&!ART_K[b.art||artName(b.id)]){const cx=fx+fw/2,cy=fy+fh/2;[fw,fh]=[fh,fw];fx=cx-fw/2;fy=cy-fh/2;}return withBase({...b,fx,fy,fw,fh,flip});};
export function applyMapEdits(full={}){setWorldMode(full?.settings?.view==='front');const doc=modeDoc(full);const del=new Set(doc.del||[]),mod=doc.mod||{},m=MAPS.lungomare;
 const props=BASE_PROPS.filter(p=>!del.has(p.id)).map(p=>{const e=mod[p.id];return e?{...p,x:p.x+(e.dx||0),y:p.y+(e.dy||0),flip:!!e.flip,rot:e.rot||0,tint:e.color||null,scale:scaleOf(e.scale),r:(p.r||.3)*scaleOf(e.scale),w:p.w?p.w*scaleOf(e.scale):p.w}:{...p};});
 PAINT.clear();for(const [k,v] of Object.entries(doc.ground||{}))PAINT.set(k,v);
 const builds=BASE_BUILDINGS.filter(b=>!del.has(b.id)).map(b=>mod[b.id]?{...editBuilding(b,mod[b.id]),tint:mod[b.id].color||null}:b);
 for(const a of doc.add||[]){if(del.has(a.id))continue;const e=mod[a.id]||{},x=a.x+(e.dx||0),y=a.y+(e.dy||0),flip=e.flip??a.flip,rot=e.rot??a.rot??0;
  if(a.type==='building'){const t=EDIT_BUILDINGS[a.art];if(!t)continue;{const k=scaleOf(e.scale);builds.push({...withBase({id:a.id,name:t.name,proc:true,style:t.style,art:a.art,...(MODE.front?{front:true,fart:'f-'+a.art}:{}),flip:!!flip,fx:x-t.fw*k/2,fy:y-t.fh*k/2,fw:t.fw*k,fh:t.fh*k,height:t.height*k,enterable:false,edited:true}),tint:e.color||null,scale:k});}}
  else{const t=EDIT_PROPS[a.kind];if(!t)continue;{const k=scaleOf(e.scale);props.push({id:a.id,kind:t.kind||a.kind,v:t.v,art:t.art,w:t.w?t.w*k:t.w,x,y,r:t.r*k,flip:!!flip,rot,tint:e.color||null,scale:k,edited:true});}}}
 m.props.splice(0,m.props.length,...props);m.buildings.splice(0,m.buildings.length,...builds);MAPS.version=(MAPS.version||0)+1;}
// Validazione lato server di un'operazione dell'editor; restituisce il nuovo documento.
export function editMapDoc(doc,op){doc={add:[...(doc.add||[])],mod:{...(doc.mod||{})},del:[...(doc.del||[])],ground:{...(doc.ground||{})},settings:{...(doc.settings||{})}};const inMap=(x,y)=>Number.isFinite(x)&&Number.isFinite(y)&&x>=0&&y>=0&&x<=WORLD_SIZE&&y<=WORLD_SIZE;
 if(op.op==='settings'){doc.settings={...(doc.settings||{})};if('npc' in op)doc.settings.npc=!!op.npc;return {doc,id:null};}
 if(op.op==='reset')return {doc:{add:[],mod:{},del:[],ground:{},settings:doc.settings||{}},id:null};
 if(op.op==='paint'){const cells=Array.isArray(op.cells)?op.cells.slice(0,900):[];const mat=op.material||null;if(mat&&!GROUND_PAINTS[mat])throw new Error('Materiale sconosciuto');for(const c of cells){const x=Math.floor(Number(c[0])),y=Math.floor(Number(c[1]));if(!inMap(x,y))continue;const k=x+','+y;if(mat)doc.ground[k]=mat;else delete doc.ground[k];}if(Object.keys(doc.ground).length>60000)throw new Error('Troppe caselle dipinte');return {doc,id:null};}
 if(op.op==='add'){const x=Number(op.x),y=Number(op.y);if(!inMap(x,y))throw new Error('Posizione fuori mappa');const isB=op.type==='building';if(isB?!EDIT_BUILDINGS[op.art]:!EDIT_PROPS[op.kind])throw new Error('Oggetto sconosciuto');if(doc.add.length>=2000)throw new Error('Troppi oggetti aggiunti');
  const id='ed-'+Date.now().toString(36)+Math.random().toString(36).slice(2,6);doc.add.push(isB?{id,type:'building',art:op.art,x,y,flip:!!op.flip}:{id,type:'prop',kind:op.kind,x,y,flip:!!op.flip,rot:Number(op.rot)||0});return {doc,id};}
 const exists=BASE_PROPS.some(p=>p.id===op.id)||BASE_BUILDINGS.some(b=>b.id===op.id)||doc.add.some(a=>a.id===op.id);if(!exists)throw new Error('Elemento non trovato');
 if(op.op==='remove'){doc.del.push(op.id);delete doc.mod[op.id];return {doc,id:op.id};}
 if(op.op==='update'){const cur=doc.mod[op.id]||{},dx=Number(op.dx??cur.dx??0),dy=Number(op.dy??cur.dy??0);if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.abs(dx)>WORLD_SIZE||Math.abs(dy)>WORLD_SIZE)throw new Error('Spostamento non valido');const color=op.color===null?null:(op.color??cur.color??null);if(color!==null&&!/^#[0-9a-f]{6}$/i.test(color))throw new Error('Colore non valido');const scale=Math.min(3,Math.max(.4,Number(op.scale??cur.scale??1)||1));doc.mod[op.id]={dx,dy,flip:!!(op.flip??cur.flip),rot:Number(op.rot??cur.rot??0),color,scale};return {doc,id:op.id};}
 throw new Error('Operazione sconosciuta');}
// Anteprima di un edificio dell'inventario (stessa geometria di quelli posati).
export function previewBuilding(art,x,y,flip){const t=EDIT_BUILDINGS[art];return withBase({id:'ghost',name:t.name,proc:true,style:t.style,art,...(MODE.front?{front:true,fart:'f-'+art}:{}),flip:!!flip,fx:x-t.fw/2,fy:y-t.fh/2,fw:t.fw,fh:t.fh,height:t.height,enterable:false});}

// Zona Mergellina (solo HUMANA life 3D): si registra quando la mappa vera è caricata (server all'avvio, client 3D al bisogno).
export function registerMergellina(){const g=NAPOLI;MAPS.mergellina={id:'mergellina',name:'Mergellina',bounds:{x:g.x0,y:g.y0,w:g.w,h:g.h},miniBounds:{x:g.x0,y:g.y0,w:g.w,h:g.h},spawn:napoliSpawn(),buildings:[],props:napoliPlaces().props,outdoor:true};}
