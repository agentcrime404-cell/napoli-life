// Zona "Mergellina" di HUMANA life 3D: mappa vera da OpenStreetMap (© OpenStreetMap contributors, ODbL).
// La griglia (1 cella = 1 m) dice dove si cammina: niente palazzi né mare; i pontili sono calpestabili.
export const NAPOLI={data:null,grid:null,x0:0,y0:0,w:0,h:0};
const BUILDING_CELL=48;
const decode=b64=>typeof Buffer!=='undefined'?new Uint8Array(Buffer.from(b64,'base64')):Uint8Array.from(atob(b64),c=>c.charCodeAt(0));
export function setNapoli(data){const g=data.grid;Object.assign(NAPOLI,{data,grid:decode(g.bits),x0:g.x0,y0:g.y0,w:g.w,h:g.h,tunnels:[],buildingIndex:new Map(),places:null,parkedVehicles:null,services:null,villas:null});carveTunnels();indexBuildings();}
// Gallerie vere (Galleria della Vittoria, delle Quattro Giornate, di Posillipo...): il corridoio si può percorrere a piedi e in auto,
// gli edifici sopra il tracciato non si disegnano (la collina è il tubo) e ogni carreggiata larga al massimo 7 m.
const NOT_CAR=new Set(['footway','steps','path','cycleway','pedestrian']);
function carveTunnels(){const D=NAPOLI.data,T=NAPOLI.tunnels,cand=[];
 for(const r of D.roads||[]){if(!r.tn||NOT_CAR.has(r.k)||(r.w||5)<5)continue;let len=0;for(let i=1;i<r.p.length;i++)len+=Math.hypot(r.p[i][0]-r.p[i-1][0],r.p[i][1]-r.p[i-1][1]);if(len<60)continue;
  r.len=len;cand.push(r);}
 // Coppie di carreggiate a senso unico con lo stesso nome (Galleria della Vittoria): diventano UNA galleria a due corsie, senza muro in mezzo.
 const LANE=5,byName=new Map();for(const r of cand)(byName.get(r.name||'?')||byName.set(r.name||'?',[]).get(r.name||'?')).push(r);
 for(const list of byName.values()){
  if(list.length===2&&list[0].ow&&list[1].ow){const [A,B]=list;const near=(x,y,P)=>{let best=null,bd=1e9;for(let i=1;i<P.length;i++){const a=P[i-1],b=P[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l)),qx=a[0]+dx*t,qy=a[1]+dy*t,d=Math.hypot(x-qx,y-qy);if(d<bd){bd=d;best=[qx,qy];}}return best;};
   const PA=[];let acc=0;PA.push(A.p[0]);for(let i=1;i<A.p.length;i++){const a=A.p[i-1],b=A.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=25-acc%25;d<L;d+=25)PA.push([a[0]+(b[0]-a[0])*d/L,a[1]+(b[1]-a[1])*d/L]);acc+=L;}PA.push(A.p.at(-1));
   const M=PA.map(p=>{const q=near(p[0],p[1],B.p);return [(p[0]+q[0])/2,(p[1]+q[1])/2,p,q];});
   const nA=[],nB=[];M.forEach((m,i)=>{const a=M[Math.max(0,i-1)],b=M[Math.min(M.length-1,i+1)];let tx=b[0]-a[0],ty=b[1]-a[1];const l=Math.hypot(tx,ty)||1;tx/=l;ty/=l;const nx=-ty,ny=tx;let sg=(m[2][0]-m[3][0])*nx+(m[2][1]-m[3][1])*ny>=0?1:-1;
    nA.push([m[0]+nx*sg*LANE/2,m[1]+ny*sg*LANE/2]);nB.push([m[0]-nx*sg*LANE/2,m[1]-ny*sg*LANE/2]);});
   nA[0]=A.p[0].slice();nA[nA.length-1]=A.p.at(-1).slice();nB.reverse();nB[0]=B.p[0].slice();nB[nB.length-1]=B.p.at(-1).slice();
   A.p=nA;B.p=nB;A.w=B.w=LANE;T.push({p:M.map(m=>[m[0],m[1]]),w:LANE*2,len:A.len,name:A.name||'Galleria',ow:0});continue;}
  for(const r of list){if(r.w>7)r.w=7;T.push({p:r.p,w:r.w,len:r.len,name:r.name||'Galleria',ow:r.ow});}}
 const set=(x,y)=>{const cx=Math.floor(x)-NAPOLI.x0,cy=Math.floor(y)-NAPOLI.y0;if(cx<0||cy<0||cx>=NAPOLI.w||cy>=NAPOLI.h)return;const i=cy*NAPOLI.w+cx;NAPOLI.grid[i>>3]|=1<<(i&7);};
 const segD=(x,y,a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l));return Math.hypot(x-a[0]-dx*t,y-a[1]-dy*t);};
 for(const t of T){const R=t.w/2+.4;for(let i=1;i<t.p.length;i++){const a=t.p[i-1],b=t.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=0;d<=L;d+=.75){const x=a[0]+(b[0]-a[0])*d/L,y=a[1]+(b[1]-a[1])*d/L;for(let ox=-Math.ceil(R);ox<=Math.ceil(R);ox++)for(let oy=-Math.ceil(R);oy<=Math.ceil(R);oy++)if(Math.hypot(ox,oy)<=R)set(x+ox,y+oy);}}}
 const inPoly=(x,y,P)=>{let c=false;for(let i=0,j=P.length-1;i<P.length;j=i++)if((P[i][1]>y)!==(P[j][1]>y)&&x<(P[j][0]-P[i][0])*(y-P[i][1])/(P[j][1]-P[i][1])+P[i][0])c=!c;return c;};
 for(const b of D.buildings||[]){const P=b.p;if(!P||P.length<3)continue;let hit=false;
  for(const t of T){const R=t.w/2+1.8;for(let i=1;i<t.p.length&&!hit;i++){const a=t.p[i-1],c=t.p[i];if(P.some(q=>segD(q[0],q[1],a,c)<R))hit=true;else{const L=Math.hypot(c[0]-a[0],c[1]-a[1]);for(let d=0;d<=L&&!hit;d+=3)if(inPoly(a[0]+(c[0]-a[0])*d/L,a[1]+(c[1]-a[1])*d/L,P))hit=true;}}if(hit)break;}
  if(hit)b.tn=1;}}
export function napoliInTunnel(x,y,pad=.5){for(const t of NAPOLI.tunnels||[])for(let i=1;i<t.p.length;i++){const a=t.p[i-1],b=t.p[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,k=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l));if(Math.hypot(x-a[0]-dx*k,y-a[1]-dy*k)<t.w/2+pad)return true;}return false;}
function indexBuildings(){const index=NAPOLI.buildingIndex;for(const b of NAPOLI.data?.buildings||[]){if(b.tn||!Array.isArray(b.p)||b.p.length<3)continue;const xs=b.p.map(q=>q[0]),ys=b.p.map(q=>q[1]),item={p:b.p,x0:Math.min(...xs),x1:Math.max(...xs),y0:Math.min(...ys),y1:Math.max(...ys)};for(let x=Math.floor(item.x0/BUILDING_CELL);x<=Math.floor(item.x1/BUILDING_CELL);x++)for(let y=Math.floor(item.y0/BUILDING_CELL);y<=Math.floor(item.y1/BUILDING_CELL);y++){const k=x+','+y;let list=index.get(k);if(!list)index.set(k,list=[]);list.push(item);}}}
function buildingAt(x,y){for(const b of NAPOLI.buildingIndex?.get(Math.floor(x/BUILDING_CELL)+','+Math.floor(y/BUILDING_CELL))||[]){if(x<b.x0||x>b.x1||y<b.y0||y>b.y1)continue;let inside=false;for(let i=0,j=b.p.length-1;i<b.p.length;j=i++){const a=b.p[i],q=b.p[j];if(((a[1]>y)!==(q[1]>y))&&x<(q[0]-a[0])*(y-a[1])/(q[1]-a[1])+a[0])inside=!inside;}if(inside)return true;}return false;}
export function napoliCell(x,y){if(!NAPOLI.grid)return false;const cx=Math.floor(x)-NAPOLI.x0,cy=Math.floor(y)-NAPOLI.y0;if(cx<0||cy<0||cx>=NAPOLI.w||cy>=NAPOLI.h)return false;const i=cy*NAPOLI.w+cx;return !!(NAPOLI.grid[i>>3]&(1<<(i&7)));}
// La griglia è l'autorità per strade e marciapiedi; i poligoni OSM chiudono le celle
// che in alcuni isolati risultano erroneamente calpestabili dentro un edificio.
export function napoliStand(x,y,r=.25){if(!Number.isFinite(x)||!Number.isFinite(y)||r<0)return false;const points=[[0,0],[r,0],[-r,0],[0,r],[0,-r]];if(r)for(const dx of [-1,1])for(const dy of [-1,1])points.push([dx*r*.70710678,dy*r*.70710678]);for(const [dx,dy] of points){const px=x+dx,py=y+dy;if(!napoliCell(px,py)||buildingAt(px,py))return false;}return true;}
// Punto di partenza: Piazza Sannazaro (o la cella libera più vicina).
export function napoliSpawn(){const want={x:230.2,y:399};if(!NAPOLI.grid)return want;for(let d=0;d<200;d++)for(let a=0;a<16;a++){const x=want.x+Math.cos(a/16*Math.PI*2)*d,y=want.y+Math.sin(a/16*Math.PI*2)*d;if(napoliStand(x,y,.4))return {x:Math.round(x*10)/10,y:Math.round(y*10)/10};}return want;}
// Locali di Mergellina: ogni bar, ristorante, banca… della mappa vera porta all'interno corrispondente del gioco
// (stessi interni del Lungomare). Se il locale esiste su OpenStreetMap ne tiene il nome (real:true), altrimenti ha un nome di fantasia (real:false).
const KIND={bar:'bar',cafe:'bar',ice_cream:'bar',pastry:'bar',restaurant:['trattoria','osteria','vesuvio','panorama'],fast_food:['pizzeria','pizzeria','burger'],pub:'club',bank:'bank',
 supermarket:'shop',convenience:'shop',greengrocer:'shop',deli:'shop',dairy:'shop',bakery:'shop',seafood:'shop',butcher:'shop',clothes:'fashion',tailor:'fashion',hairdresser:'barber',beauty:'barber',bookmaker:'casino'};
const NAMES={bar:['Bar Vele','Caffè del Porto','Bar Onda','Caffè del Borgo','Caffè Levante','Bar Tramonto','Caffè Marina','Gelateria Brezza'],trattoria:['Trattoria Vele','Trattoria del Faro','Da Mimmo'],osteria:['Osteria Blu','Osteria del Vicolo'],vesuvio:['Ristorante Cratere','Ristorante Brezza'],panorama:['Ristorante Belvedere','Terrazza Marina'],
 pizzeria:['Pizzeria Vesuviana','Pizza al Taglio 21','Pizzeria del Faro'],burger:['Friggitoria Onda'],club:['Discoteca Orbita'],bank:['Banca Partenopea'],shop:['Bottega del Porto','Alimentari Vela','Emporio Marina'],fashion:['Moda Vela','Sartoria Levante'],barber:['Barbiere Raffa','Salone Brezza'],casino:['Sala Fortuna']};
const H=s=>{let h=0;for(const c of String(s))h=(h*31+c.charCodeAt(0))|0;return Math.abs(h);};
// Porta = cella libera più vicina al punto del locale (davanti all'ingresso).
const near=(x,y)=>{for(let d=0;d<12;d+=.5)for(let a=0;a<12;a++){const px=x+Math.cos(a/12*Math.PI*2)*d,py=y+Math.sin(a/12*Math.PI*2)*d;if(napoliStand(px,py,.35))return {x:px,y:py};}return null;};
// Distanza minima fra due porte: i locali troppo vicini si separano (restano solo i più importanti vicino al posto vero, gli altri vanno nelle zone vuote).
const MIN_GAP=20;
// Mix dei locali di fantasia aggiunti nelle zone senza attività: nome inventato (real:false), mai spacciati per veri.
const EXTRA_MIX=['bar','trattoria','shop','pizzeria','bar','fashion','osteria','shop','barber','vesuvio','bar','burger','panorama','trattoria','bank'];
const SKIP_KIND=new Set(['church','chapel','school','kindergarten','university','hospital','roof','garage','garages','shed','industrial','warehouse','service','carport','construction','ruins','public','government','civic','train_station','transportation']);
const polyArea=p=>{let a=0;for(let i=0;i<p.length;i++){const q=p[(i+1)%p.length];a+=p[i][0]*q[1]-q[0]*p[i][1];}return a/2;};
// Un possibile ingresso per ogni palazzo: sul lato più lungo, un metro e venti fuori dal muro, dove si può camminare.
function frontages(){const out=[];for(const b of NAPOLI.data.buildings||[]){if(b.part||b.tn||SKIP_KIND.has(b.kind))continue;const P=b.p,ar=polyArea(P),A=Math.abs(ar);if(A<45||A>4000)continue;const sg=ar>0?1:-1;let best=null;
  for(let i=0;i<P.length;i++){const p=P[i],q=P[(i+1)%P.length],dx=q[0]-p[0],dy=q[1]-p[1],L=Math.hypot(dx,dy);if(L<4)continue;const nx=dy/L*sg,ny=-dx/L*sg;for(const t of [.5,.35,.65]){const mx=p[0]+dx*t,my=p[1]+dy*t,x=mx+nx*1.3,y=my+ny*1.3;if(napoliStand(x,y,.4)&&(!best||L>best.L)){best={x,y,L,nx,ny};break;}}}
  if(best)out.push({x:best.x,y:best.y,b});}return out;}
// Semafori: due gruppi (A = strade più est-ovest, B = nord-sud), ciclo 44 s; 'g' verde, 'y' giallo, 'r' rosso. Dipende solo dall'orologio: uguale per tutti.
export function signalPhase(T,axis){const t=((T+(axis==='B'?22:0))%44+44)%44;return t<18?'g':t<21?'y':'r';}
export function signalWait(T,axis){const t=((T+(axis==='B'?22:0))%44+44)%44;return t<21?0:44-t;}
// Distributori, caserme/commissariati e ambulatori: quelli veri di OpenStreetMap (posizione e nome veri), con un punto calpestabile davanti e la direzione verso la strada.
export function napoliServices(){if(NAPOLI.services)return NAPOLI.services;const out={fuel:[],police:[],hospital:[]};if(!NAPOLI.data)return out;const R=NAPOLI.data.roads.filter(r=>!['footway','steps','path','cycleway','pedestrian'].includes(r.k)&&!r.tn);
 const road=(x,y)=>{let best=null,bd=40;for(const r of R)for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l)),qx=a[0]+dx*t,qy=a[1]+dy*t,d=Math.hypot(x-qx,y-qy);if(d<bd){bd=d;best=[qx,qy];}}return best;};
 NAPOLI.data.pois.forEach((p,i)=>{const a=p.amenity,k=a==='fuel'?'fuel':a==='police'?'police':(a==='hospital'||a==='clinic')?'hospital':null;if(!k)return;const q=near(p.x,p.y);if(!q)return;const r=road(q.x,q.y);
  out[k].push({id:k[0]+i,name:p.name||({fuel:'Distributore',police:'Forze dell’ordine',hospital:'Ambulatorio'})[k],x:q.x,y:q.y,h:r?Math.atan2(r[0]-q.x,r[1]-q.y):0,real:true,osm:p.osm});});
 return NAPOLI.services=out;}
// Ville: palazzine isolate scelte sempre allo stesso modo (client e server); ognuna ha una porta che porta a una villa per gli ospiti.
const VSK=new Set(['church','chapel','school','kindergarten','university','hospital','roof','garage','garages','shed','industrial','warehouse','service','carport','construction','ruins','public','hotel','retail','commercial']);
const VN=['Esposito','Russo','Romano','Ferrara','Gallo','De Luca','Marino','Greco','Bianchi','Conte','Caruso','Rizzo','Lombardi','Moretti','Barone','Fontana'];
export function napoliVillas(){if(NAPOLI.villas)return NAPOLI.villas;if(!NAPOLI.data)return [];const all=NAPOLI.data.buildings.filter(b=>!b.part&&!b.tn&&!VSK.has(b.kind)&&!b.historic),
  C=all.map(b=>{let x=0,y=0,a=0;const P=b.p;for(let i=0;i<P.length;i++){const q=P[(i+1)%P.length];a+=P[i][0]*q[1]-q[0]*P[i][1];x+=P[i][0];y+=P[i][1];}return {b,x:x/P.length,y:y/P.length,A:Math.abs(a/2)};}),g=new Map(),key=(x,y)=>Math.floor(x/16)+','+Math.floor(y/16);
 for(const c of C){const k=key(c.x,c.y);(g.get(k)||g.set(k,[]).get(k)).push(c);}
 const cand=C.filter(c=>{if(c.A<90||c.A>420)return false;const cx=Math.floor(c.x/16),cy=Math.floor(c.y/16);for(let a=-1;a<=1;a++)for(let b=-1;b<=1;b++)for(const o of g.get((cx+a)+','+(cy+b))||[])if(o!==c&&Math.hypot(o.x-c.x,o.y-c.y)<14+Math.sqrt(o.A)/2)return false;return napoliStand(c.x+2.5,c.y,.5)||napoliStand(c.x-2.5,c.y,.5)||napoliStand(c.x,c.y+2.5,.5)||napoliStand(c.x,c.y-2.5,.5);}).sort((p,q)=>H(p.x.toFixed(1)+','+p.y.toFixed(1))-H(q.x.toFixed(1)+','+q.y.toFixed(1))),out=[];
 for(const c of cand){if(out.length>=40)break;if(out.some(o=>Math.hypot(o.x-c.x,o.y-c.y)<110))continue;const q=near(c.x,c.y);out.push({b:c.b,x:c.x,y:c.y,A:c.A,name:'Villa '+VN[H(c.b.p[0][0]+':'+c.b.p[0][1])%VN.length],door:q});}
 return NAPOLI.villas=out;}
export function napoliPlaces(){if(NAPOLI.places)return NAPOLI.places;const out={doors:[],props:[]};if(!NAPOLI.data)return out;
 const raw=[];
 NAPOLI.data.pois.forEach((p,i)=>{const t=p.amenity||p.shop;if(t==='atm'){const q=near(p.x,p.y);if(q)out.props.push({id:'matm'+i,kind:'atm',x:q.x,y:q.y,r:.35});return;}
  if(t==='bench'){const q=near(p.x,p.y);if(q)out.props.push({id:'mbench'+i,kind:'bench',x:q.x,y:q.y,r:.5});return;}
  let to=KIND[t];if(!to)return;if(Array.isArray(to))to=to[H(p.x+','+p.y)%to.length];const q=near(p.x,p.y);if(!q)return;
  // Attività presente su OpenStreetMap (nome e posizione veri, non verificati sul posto) oppure inventata dal gioco (nome di fantasia).
  raw.push({i,p,q,to,t,real:!!(p.real&&p.name)});});
 // 1) separazione: prima le attività vere con nome, poi le altre; chi è troppo vicino a una già scelta va nel mucchio da rimettere altrove
 raw.sort((x,y)=>(y.real-x.real)||(x.i-y.i));const kept=[],pool=[],cell=new Map(),key=(x,y)=>Math.floor(x/MIN_GAP)+','+Math.floor(y/MIN_GAP);
 const tooClose=(x,y,gap)=>{const cx=Math.floor(x/MIN_GAP),cy=Math.floor(y/MIN_GAP),r=Math.ceil(gap/MIN_GAP);for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++)for(const d of cell.get((cx+a)+','+(cy+b))||[])if(Math.hypot(d.x-x,d.y-y)<gap)return true;return false;};
 const put=d=>{kept.push(d);const k=key(d.x,d.y);(cell.get(k)||cell.set(k,[]).get(k)).push(d);};
 for(const r of raw){if(tooClose(r.q.x,r.q.y,MIN_GAP))pool.push(r);else put({x:r.q.x,y:r.q.y,to:r.to,t:r.t,real:r.real,p:r.p,i:r.i});}
 // 2) zone vuote: nuovi ingressi sui palazzi lontani da ogni locale (scelta del punto più isolato, ripetuta), con i locali messi da parte e poi un mix di fantasia
 const cand=frontages().filter(c=>!tooClose(c.x,c.y,MIN_GAP*1.5)),MAX_EXTRA=150,GAP_STOP=75,extras=[];
 const nearest=(x,y)=>{let best=1e9;const cx=Math.floor(x/MIN_GAP),cy=Math.floor(y/MIN_GAP);for(let r=0;r<=6;r++){for(let a=-r;a<=r;a++)for(let b=-r;b<=r;b++){if(Math.max(Math.abs(a),Math.abs(b))!==r)continue;for(const d of cell.get((cx+a)+','+(cy+b))||[])best=Math.min(best,Math.hypot(d.x-x,d.y-y));}if(best<r*MIN_GAP)break;}return best;};
 const dist=cand.map(c=>nearest(c.x,c.y));
 while(extras.length<MAX_EXTRA){let bi=-1,bd=GAP_STOP;for(let i=0;i<cand.length;i++)if(dist[i]>bd){bd=dist[i];bi=i;}if(bi<0)break;const c=cand[bi];const k=extras.length,fromPool=pool[k];const to=fromPool?fromPool.to:EXTRA_MIX[H('extra'+k)%EXTRA_MIX.length];const d={x:c.x,y:c.y,to,t:fromPool?.t||to,real:false,i:100000+k,extra:true};extras.push(d);put(d);
  for(let i=0;i<cand.length;i++){const dd=Math.hypot(cand[i].x-c.x,cand[i].y-c.y);if(dd<dist[i])dist[i]=dd;}dist[bi]=-1;}
 // 3) porte definitive (id stabili: gli stessi sul server e sul client)
 kept.sort((x,y)=>x.i-y.i).forEach((d,n)=>{const names=NAMES[d.to];const id=d.extra?'mx'+(d.i-100000):'m'+d.i,nm=d.real?d.p.name:names[H(id+':'+d.t)%names.length];
  out.doors.push({id,name:nm,x:d.x,y:d.y,exitX:d.x,exitY:d.y,to:d.to,kind:d.t,real:!!d.real,osm:d.real?d.p.osm:undefined,fantasy:!d.real});
  if(d.t==='bank'){const a=near(d.x+1.4,d.y);if(a)out.props.push({id:'matmb'+n,kind:'atm',x:a.x,y:a.y,r:.35});}});
 {const vs=napoliVillas();vs.forEach((v,i)=>{if(v.door&&!out.doors.some(d=>Math.hypot(d.x-v.door.x,d.y-v.door.y)<MIN_GAP))out.doors.push({id:'mv'+i+'v',name:v.name,x:v.door.x,y:v.door.y,exitX:v.door.x,exitY:v.door.y,to:'ospiti-villa',kind:'villa',real:false,fantasy:true});});}
 return NAPOLI.places=out;}

// Mezzi fermi visibili nella scena 3D di Mergellina. La scena li genera dal
// dataset stradale, quindi il server deve usare la stessa lista per rendere
// interagibili anche le auto e le moto che non sono POI della mappa 2D.
export function napoliParkedVehicles(){
 if(NAPOLI.parkedVehicles)return NAPOLI.parkedVehicles;
 const D=NAPOLI.data;if(!D)return [];
 const walkOnly=new Set(['footway','steps','path','cycleway','pedestrian']);
 const roads=(D.roads||[]).filter(r=>!walkOnly.has(r.k));
 const roadAt=(x,y)=>roads.some(r=>{const w=Number(r.w)||5,rr=w/2+.35;for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((x-a[0])*dx+(y-a[1])*dy)/l));if(Math.hypot(x-(a[0]+dx*t),y-(a[1]+dy*t))<=rr)return true;}return false;});
 const main=r=>['primary','secondary','tertiary','trunk'].includes(r.k),out=[];let k=0;
 // Stesse berline parcheggiate che world3d costruisce lungo le strade secondarie.
 for(const r of roads){if(main(r)||(Number(r.w)||5)<5.5)continue;let acc=12;
  for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;const tx=(b[0]-a[0])/L,ty=(b[1]-a[1])/L;
   for(;acc<L;acc+=28){const sd=k%2?1:-1,x=a[0]+tx*acc-ty*((Number(r.w)||5)/2-1.15)*sd,y=a[1]+ty*acc+tx*((Number(r.w)||5)/2-1.15)*sd;if(k<160&&roadAt(x,y))out.push({id:'merg-car-'+out.length,kind:'parked',v:'auto',x,y,rot:Math.atan2(tx,ty)+(sd>0?0:Math.PI),r:.95});k++;}
   acc-=L;
  }
 }
 // Le due Africa Twin davanti allo Chalet del Golfo sono create da merg-extra.js.
 const b=D.buildings?.find(q=>q.name==='Chalet del Golfo');if(b){const xs=b.p.map(q=>q[0]),ys=b.p.map(q=>q[1]),cx=(Math.min(...xs)+Math.max(...xs))/2,cy=(Math.min(...ys)+Math.max(...ys))/2,Wd=Math.max(...ys)-Math.min(...ys)+.6,Dp=Math.max(...xs)-Math.min(...xs)+.4;let i=0;for(let y=cy-Wd/2+1;y<cy+Wd/2-.5;y+=1.15){const x=cx+Dp/2+4.4;if(napoliCell(x,y)&&(i===4||i===9))out.push({id:'ciro-africa-'+i,kind:'parked',v:'m-enduro',x,y,rot:Math.PI+(i%3-1)*.06,r:.55});i++;}}
 // Anche i motorini accanto ai lampioni sono mezzi reali della scena, non
 // semplice arredo: riproduciamo la stessa selezione deterministica del 3D.
 let n=0,lamps=[];const named=/Caracciolo|Mergellina|Sannazaro|Posillipo|Partenope|Eldorado/;
 for(const r of roads){if(!named.test(r.name||''))continue;for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1)continue;for(let s=0;s<L;s+=22){const t=s/L,x=a[0]+(b[0]-a[0])*t,y=a[1]+(b[1]-a[1])*t,nx=-(b[1]-a[1])/L,ny=(b[0]-a[0])/L,off=(Number(r.w)||5)/2+2.5;for(const sg of [-1,1]){const qx=x+nx*off*sg,qy=y+ny*off*sg;if(!napoliCell(qx,qy)||[[0,0],[1.6,0],[-1.6,0],[0,1.6],[0,-1.6]].some(([ox,oy])=>roadAt(qx+ox,qy+oy)))continue;n++;if(n%2===0)lamps.push([qx,qy,n]);}}}}
 lamps.forEach(([x,y],i)=>{if(i%9!==4)return;for(const [ox,oy] of [[1.8,0],[-1.8,0],[0,1.8],[0,-1.8]]){const qx=x+ox,qy=y+oy;if(napoliCell(qx,qy)&&!roadAt(qx,qy)&&!roadAt(qx+ox*.6,qy+oy*.6)&&napoliStand(qx,qy,.7)){out.push({id:'merg-scooter-'+i,kind:'parked',v:'scooter',x:qx,y:qy,rot:(i%4)*Math.PI/2,r:.5});break;}}});
 return NAPOLI.parkedVehicles=out;
}
