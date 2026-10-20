// Importazione di OpenStreetMap per Napoli life 3D: converte l'estratto (.osm) in una mappa compatta in METRI (1 m del gioco = 1 m reale).
//   node scripts/osm-scarica.mjs                                   (scarica una volta i dati)
//   node scripts/osm-napoli.mjs [file.osm] [uscita.json]           (importa; default: data/osm/napoli-esteso.osm → client/assets/world/napoli/map/mergellina.json)
// x verso est, y verso sud (come il resto del gioco). Origine fissa lat 40.83025, lon 14.2175 (non cambia mai, così le coordinate restano stabili).
// Dati © OpenStreetMap contributors, licenza ODbL. Le attività portano il marchio «real» (nome preso da OSM) per distinguerle da quelle inventate dal gioco.
import {readFile,writeFile,mkdir} from 'node:fs/promises';import {dirname} from 'node:path';
const SRC=process.argv[2]||'data/osm/napoli-esteso.osm',OUT=process.argv[3]||'client/assets/world/napoli/map/mergellina.json';
const xml=await readFile(SRC,'utf8');let bbox;try{bbox=JSON.parse(await readFile(SRC.replace(/\.osm$/,'.bbox.json'),'utf8'));}catch{const b=xml.match(/<bounds ([^>]*)\/>/);if(b){const g=k=>+(b[1].match(new RegExp(k+'="([^"]*)"'))||[])[1];bbox={s:g('minlat'),w:g('minlon'),n:g('maxlat'),e:g('maxlon')};}}
if(!bbox){console.error('Manca il riquadro (file .bbox.json o <bounds>)');process.exit(1);}
const lat0=40.83025,lon0=14.2175,kx=Math.cos(lat0*Math.PI/180)*111320,ky=110540;
const P=(lat,lon)=>[Math.round((lon-lon0)*kx*10)/10,Math.round(-(lat-lat0)*ky*10)/10];
const attr=(s,k)=>{const m=s.match(new RegExp(' '+k+'="([^"]*)"'));return m?m[1]:undefined;};
const unesc=s=>s?.replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
const tags=body=>{const t={};for(const m of body.matchAll(/<tag k="([^"]*)" v="([^"]*)"\/>/g))t[m[1]]=unesc(m[2]);return t;};
// ---- lettura ----
const nodes=new Map(),npois=[],trees=[],signals=[],bus=[];
for(const m of xml.matchAll(/<node ([^>]*?)(\/>|>([\s\S]*?)<\/node>)/g)){const a=' '+m[1],id=attr(a,'id'),lat=+attr(a,'lat'),lon=+attr(a,'lon');nodes.set(id,[lat,lon]);if(!m[3])continue;const t=tags(m[3]);
 if(t.natural==='tree')trees.push(P(lat,lon));else if(t.highway==='traffic_signals')signals.push(P(lat,lon));else if(t.highway==='bus_stop')bus.push({p:P(lat,lon),name:t.name});else if(t.amenity||t.shop||t.tourism||t.historic||t.leisure||t.place)npois.push({id:'node/'+id,lat,lon,t});}
const ways=new Map();for(const m of xml.matchAll(/<way ([^>]*)>([\s\S]*?)<\/way>/g)){const id=attr(' '+m[1],'id'),body=m[2];ways.set(id,{id,t:tags(body),n:[...body.matchAll(/<nd ref="(\d+)"\/>/g)].map(r=>r[1])});}
const pts=w=>w.n.map(r=>nodes.get(r)).filter(Boolean).map(q=>P(q[0],q[1]));
const closed=p=>p.length>=4&&p[0][0]===p.at(-1)[0]&&p[0][1]===p.at(-1)[1];
const rels=[];for(const m of xml.matchAll(/<relation ([^>]*)>([\s\S]*?)<\/relation>/g)){const t=tags(m[2]);if(t.type!=='multipolygon')continue;const mem=[...m[2].matchAll(/<member type="way" ref="(\d+)" role="([^"]*)"\/>/g)].map(r=>({ref:r[1],role:r[2]}));rels.push({id:attr(' '+m[1],'id'),t,mem});}
// unisce i pezzi di un anello (i multipoligoni arrivano a segmenti)
const rings=ids=>{const segs=ids.map(i=>ways.get(i)).filter(Boolean).map(w=>w.n.slice()),out=[];while(segs.length){let r=segs.pop();let grew=true;while(grew&&r[0]!==r.at(-1)){grew=false;for(let i=0;i<segs.length;i++){const s=segs[i];if(s[0]===r.at(-1)){r=r.concat(s.slice(1));segs.splice(i,1);grew=true;break;}if(s.at(-1)===r.at(-1)){r=r.concat(s.slice(0,-1).reverse());segs.splice(i,1);grew=true;break;}if(s.at(-1)===r[0]){r=s.slice(0,-1).concat(r);segs.splice(i,1);grew=true;break;}if(s[0]===r[0]){r=s.slice().reverse().slice(0,-1).concat(r);segs.splice(i,1);grew=true;break;}}}
  if(r[0]===r.at(-1)&&r.length>=4)out.push(r.map(x=>nodes.get(x)).filter(Boolean).map(q=>P(q[0],q[1])));}return out;};
const centroid=p=>[p.reduce((s,q)=>s+q[0],0)/p.length,p.reduce((s,q)=>s+q[1],0)/p.length];
const num=v=>{const n=parseFloat(String(v||'').replace(',','.'));return Number.isFinite(n)?n:undefined;};
// ---- uscita ----
const map={origin:{lat:lat0,lon:lon0},bbox,scale:'1:1 (1 m del gioco = 1 m reale)',attribution:'© OpenStreetMap contributors (ODbL) · https://www.openstreetmap.org/copyright',source:bbox.fonte||'OpenStreetMap via Overpass API',downloaded:bbox.scaricato,
 buildings:[],roads:[],coast:[],piers:[],harbour:[],water:[],squares:[],parks:[],beaches:[],pois:[],trees,signals,bus,landmarks:[]};
const bld=(p,t,extra={})=>{if(p.length<3)return;const lv=num(t['building:levels']),h=num(t.height);map.buildings.push({p,lv:lv||(h?Math.max(1,Math.round(h/3.2)):undefined),h:h||undefined,name:t.name,kind:t.building&&t.building!=='yes'?t.building:undefined,amenity:t.amenity,shop:t.shop,tourism:t.tourism,historic:t.historic,col:t['building:colour']||t.colour,roof:t['roof:shape'],rcol:t['roof:colour'],mat:t['building:material'],part:t['building:part']?1:undefined,...extra});};
const ROADW={motorway:14,trunk:13,primary:12,secondary:10,tertiary:8,residential:6,unclassified:6,service:4,living_street:5,pedestrian:6,footway:2.5,steps:2.5,path:2,cycleway:2.5,track:3};
const coastWays=[];
for(const w of ways.values()){const t=w.t,p=pts(w);if(p.length<2)continue;
 if((t.building||t['building:part'])&&closed(p))bld(p.slice(0,-1),t,{osm:'way/'+w.id});
 else if(t.highway){if(t.highway==='corridor'||t.highway==='elevator'||(t.indoor&&t.indoor!=='no'))continue;const area=t.area==='yes'&&closed(p);if(area&&(t.highway==='pedestrian'||t.highway==='footway'))map.squares.push({p:p.slice(0,-1),name:t.name,osm:'way/'+w.id});else map.roads.push({p,k:t.highway,name:t.name,w:num(t.width)||ROADW[t.highway]||5,sur:t.surface,br:t.bridge?1:undefined,tn:t.tunnel?1:undefined,ow:t.oneway==='yes'?1:undefined,lanes:num(t.lanes),osm:'way/'+w.id});}
 else if(t.natural==='coastline')coastWays.push(w);
 else if(['pier','breakwater','groyne','quay'].includes(t.man_made))map.piers.push({p,k:t.man_made,area:closed(p),name:t.name});
 else if(t.leisure==='marina'||t.landuse==='harbour')map.harbour.push({p,name:t.name});
 else if(t.natural==='water'||t.natural==='bay')map.water.push({p,name:t.name});
 else if(t.place==='square'&&closed(p))map.squares.push({p:p.slice(0,-1),name:t.name,osm:'way/'+w.id});
 else if(t.natural==='beach'&&closed(p))map.beaches.push({p:p.slice(0,-1),name:t.name});
 else if((t.leisure==='park'||t.leisure==='garden'||t.leisure==='pitch'||['grass','forest','recreation_ground'].includes(t.landuse))&&closed(p))map.parks.push(p.slice(0,-1));
 // attività su un'area (edificio, negozio, ristorante…) → punto al centro
 if((t.amenity||t.shop||t.tourism||t.historic)&&closed(p)&&!['parking','bench','shelter','fountain'].includes(t.amenity)){const [x,y]=centroid(p);npois.push({id:'way/'+w.id,x,y,t});}}
// La costa arriva a pezzi (way): si uniscono in catene continue seguendo i nodi (il mare resta a destra della direzione, come in OSM).
{const byStart=new Map(),used=new Set();for(const w of coastWays)byStart.set(w.n[0],w);const chains=[];const hasPrev=new Set(coastWays.map(w=>w.n.at(-1)));for(const w of coastWays){if(used.has(w.id))continue;if(hasPrev.has(w.n[0])&&coastWays.some(q=>q!==w&&q.n.at(-1)===w.n[0]&&!used.has(q.id)))continue;let ch=w.n.slice();used.add(w.id);let nx=byStart.get(ch.at(-1));while(nx&&!used.has(nx.id)){used.add(nx.id);ch=ch.concat(nx.n.slice(1));nx=byStart.get(ch.at(-1));}chains.push(ch);}
 for(const w of coastWays)if(!used.has(w.id)){used.add(w.id);chains.push(w.n.slice());}
 const X0=P(bbox.s,bbox.w)[0]-500,X1=P(bbox.s,bbox.e)[0]+500,Y0=P(bbox.n,bbox.w)[1]-500,Y1=P(bbox.s,bbox.w)[1]+500;
  chains.sort((a,b)=>b.length-a.length).forEach((ch,ci)=>{let pl=ch.map(r=>nodes.get(r)).filter(Boolean).map(q=>P(q[0],q[1]));if(ci===0){// la costa principale serve anche per il panorama: si tiene solo il tratto da Posillipo a oltre Castel dell'Ovo
   let i0=pl.findIndex(q=>q[0]>=-4700);i0=Math.max(0,i0-1);let i1=pl.findIndex((q,i)=>i>i0&&q[0]>3100);i1=i1<0?pl.length:i1+1;pl=pl.slice(i0,i1);}
   else if(!pl.some(q=>q[0]>X0&&q[0]<X1&&q[1]>Y0&&q[1]<Y1))return;map.coast.push(pl);});}
for(const r of rels){const outer=rings(r.mem.filter(m=>m.role==='outer'||m.role==='').map(m=>m.ref));for(const ring of outer){const p=ring.slice(0,-1);if(r.t.building)bld(p,r.t,{rel:1,osm:'relation/'+r.id});else if(r.t.natural==='water')map.water.push({p,name:r.t.name});else if(r.t.leisure==='park'||r.t.leisure==='garden')map.parks.push(p);}}
for(const n of npois){const t=n.t,[x,y]=n.x!==undefined?[n.x,n.y]:P(n.lat,n.lon);map.pois.push({x:Math.round(x*10)/10,y:Math.round(y*10)/10,name:t.name,amenity:t.amenity,shop:t.shop,tourism:t.tourism,historic:t.historic,leisure:t.leisure,place:t.place,cuisine:t.cuisine,osm:n.id,real:t.name?1:undefined});}
// Etichette locali del gioco restano separate dal nome OSM, che rimane intatto per tracciabilità e attribuzione.
for(const [osm,label] of [['way/1365095986','Chalet del Golfo'],['node/2508856019','Chalet del Golfo']]){const b=map.buildings.find(q=>q.osm===osm),p=map.pois.find(q=>q.osm===osm);if(b)b.displayName=label;if(p)p.displayName=label;}
// ---- punti di riferimento da verificare sulla mappa vera ----
const L=[['Fontana del Sebeto',/^Fontana del Sebeto$/],['Largo Sermoneta',/^Largo Sermoneta$/],['Castel dell\'Ovo',/^Castel dell'Ovo$/],['Borgo Marinari',/^Borgo Marinari$/],['Piazzetta Marinari',/^Piazzetta Marinari$/],['Piazza Sannazaro',/^Piazza Jacopo Sannazaro$/],['Piazzetta del Leone (Mergellina)',/^Piazzetta (?:del )?Leone(?: a Mergellina)?$/i],['Villa Comunale',/^Villa Comunale$/],['Pontile di Castel dell\'Ovo',/^Pontile di Castel dell'Ovo$/]];
const named=[];for(const w of ways.values())if(w.t.name){const p=pts(w);if(p.length)named.push({name:w.t.name,p:centroid(p),osm:'way/'+w.id,t:w.t});}for(const n of npois)if(n.t.name)named.push({name:n.t.name,p:n.x!==undefined?[n.x,n.y]:P(n.lat,n.lon),osm:n.id,t:n.t});
for(const [label,re] of L){const area=map.squares.find(q=>re.test(q.name||'')),f=area?{p:centroid(area.p),osm:area.osm}:named.find(q=>re.test(q.name));if(f)map.landmarks.push({name:label,x:Math.round(f.p[0]),y:Math.round(f.p[1]),osm:f.osm});else map.landmarks.push({name:label,missing:true});}
for(const street of ['Via Francesco Caracciolo','Via Partenope','Via Mergellina','Riviera di Chiaia','Via Eldorado']){const rs=map.roads.filter(r=>r.name===street);if(rs.length){const all=rs.flatMap(r=>r.p),c=centroid(all);map.landmarks.push({name:street,x:Math.round(c[0]),y:Math.round(c[1]),osm:'strada ('+rs.length+' tratti)',lunghezza:Math.round(rs.reduce((s,r)=>s+r.p.slice(1).reduce((a,q,i)=>a+Math.hypot(q[0]-r.p[i][0],q[1]-r.p[i][1]),0),0))});}}
console.log('palazzi',map.buildings.length,'(con piani/altezza:',map.buildings.filter(b=>b.lv||b.h).length+')','strade',map.roads.length,'costa',map.coast.length,'moli',map.piers.length,'porto',map.harbour.length,'piazze',map.squares.length,'parchi',map.parks.length,'spiagge',map.beaches.length,'alberi',map.trees.length,'attività',map.pois.length,'con nome',map.pois.filter(p=>p.name).length);
// ---- griglia di calpestabilità (1 cella = 1 m): 0 = mare o palazzo, 1 = si cammina ----
{const x0=Math.floor(P(bbox.s,bbox.w)[0]),x1=Math.ceil(P(bbox.s,bbox.e)[0]),y0=Math.floor(P(bbox.n,bbox.w)[1]),y1=Math.ceil(P(bbox.s,bbox.w)[1]),W=x1-x0,H=y1-y0;
 const g=new Uint8Array(W*H).fill(1),segs=map.coast.flatMap(c=>c.slice(1).map((q,i)=>[c[i],q]));
 const side=(px,py)=>{let best=1e18,sd=0;for(const [a,b] of segs){const dx=b[0]-a[0],dy=b[1]-a[1],l=dx*dx+dy*dy||1,t=Math.max(0,Math.min(1,((px-a[0])*dx+(py-a[1])*dy)/l)),qx=a[0]+dx*t-px,qy=a[1]+dy*t-py,d=qx*qx+qy*qy;if(d<best){best=d;sd=dx*(py-a[1])-dy*(px-a[0]);}}return sd;};
 const wall=new Uint8Array(W*H);for(const [a,b] of segs){const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1])*2)+1;for(let k=0;k<=n;k++){const cx=Math.floor(a[0]+(b[0]-a[0])*k/n)-x0,cy=Math.floor(a[1]+(b[1]-a[1])*k/n)-y0;if(cx>=0&&cy>=0&&cx<W&&cy<H)wall[cy*W+cx]=1;}}
 const zone=new Int32Array(W*H).fill(-1);let zones=0;const stack=[];
 for(let i=0;i<W*H;i++){if(wall[i]||zone[i]>=0)continue;const z=zones++;zone[i]=z;stack.length=0;stack.push(i);let count=0,sx=0,sy=0;const members=[];
  while(stack.length){const q=stack.pop(),x=q%W,y=(q-x)/W;count++;members.push(q);if(count===1){sx=x;sy=y;}for(const [nx,ny] of [[x+1,y],[x-1,y],[x,y+1],[x,y-1]]){if(nx<0||ny<0||nx>=W||ny>=H)continue;const j=ny*W+nx;if(!wall[j]&&zone[j]<0){zone[j]=z;stack.push(j);}}}
  if(segs.length&&side(sx+x0+.5,sy+y0+.5)>0)for(const j of members)g[j]=0;}
 for(let i=0;i<W*H;i++)if(wall[i])g[i]=0;
 // moli, pontili, frangiflutti e banchine si calpestano anche sul mare (area piena o fascia attorno alla linea)
 const stamp=(a,b,r)=>{const n=Math.ceil(Math.hypot(b[0]-a[0],b[1]-a[1]))+1;for(let k=0;k<=n;k++){const cx=Math.floor(a[0]+(b[0]-a[0])*k/n)-x0,cy=Math.floor(a[1]+(b[1]-a[1])*k/n)-y0;for(let oy=-r;oy<=r;oy++)for(let ox=-r;ox<=r;ox++){const q=(cy+oy)*W+cx+ox;if(cx+ox>=0&&cx+ox<W&&cy+oy>=0&&cy+oy<H)g[q]=1;}}};
 for(const pr of map.piers){const r=pr.k==='pier'||pr.k==='quay'?1:0;for(let i=1;i<pr.p.length;i++)stamp(pr.p[i-1],pr.p[i],r);}
 // strade su ponti/terrapieni (es. via Eldorado verso Castel dell'Ovo) restano percorribili
 for(const r of map.roads)if(r.br||['pedestrian','footway'].includes(r.k)){for(let i=1;i<r.p.length;i++){const a=r.p[i-1],b=r.p[i],mx=(a[0]+b[0])/2,my=(a[1]+b[1])/2;const cx=Math.floor(mx)-x0,cy=Math.floor(my)-y0;if(cx>=0&&cy>=0&&cx<W&&cy<H&&!g[cy*W+cx]&&(r.br||r.k==='pedestrian'))stamp(a,b,Math.max(1,Math.round(r.w/2)-1));}}
 // palazzi pieni
 const inside=(P_,px,py)=>{let ins=false;for(let i=0,j=P_.length-1;i<P_.length;j=i++){const [xi,yi]=P_[i],[xj,yj]=P_[j];if((yi>py)!==(yj>py)&&px<(xj-xi)*(py-yi)/(yj-yi)+xi)ins=!ins;}return ins;};
 for(const b of map.buildings){if(b.part)continue;const Q=b.p,bx0=Math.floor(Math.min(...Q.map(q=>q[0]))),bx1=Math.ceil(Math.max(...Q.map(q=>q[0]))),by0=Math.floor(Math.min(...Q.map(q=>q[1]))),by1=Math.ceil(Math.max(...Q.map(q=>q[1])));
  for(let y=by0;y<by1;y++)for(let x=bx0;x<bx1;x++){if(x<x0||x>=x1||y<y0||y>=y1)continue;if(inside(Q,x+.5,y+.5))g[(y-y0)*W+(x-x0)]=0;}}
 // vasca della Fontana del Sebeto (cerchio di 4,5 m): ostacolo vero
 {const fo=map.landmarks.find(l=>l.name==='Fontana del Sebeto'&&!l.missing);if(fo){for(let y=Math.floor(fo.y-5);y<=Math.ceil(fo.y+5);y++)for(let x=Math.floor(fo.x-5);x<=Math.ceil(fo.x+5);x++){if(x<x0||x>=x1||y<y0||y>=y1)continue;if(Math.hypot(x+.5-fo.x,y+.5-fo.y)<=4.5)g[(y-y0)*W+(x-x0)]=0;}}}
 // solo la regione calpestabile più grande resta: cortili chiusi e isolotti irraggiungibili diventano non calpestabili (nessuna porta o oggetto finisce lì)
 {const lab=new Int32Array(W*H).fill(-1),szs=[],st=[];for(let i0=0;i0<W*H;i0++){if(!g[i0]||lab[i0]>=0)continue;const id=szs.length;let n=0;st.length=0;st.push(i0);lab[i0]=id;while(st.length){const q=st.pop();n++;const x=q%W,y=(q-x)/W;if(x+1<W&&g[q+1]&&lab[q+1]<0){lab[q+1]=id;st.push(q+1);}if(x>0&&g[q-1]&&lab[q-1]<0){lab[q-1]=id;st.push(q-1);}if(y+1<H&&g[q+W]&&lab[q+W]<0){lab[q+W]=id;st.push(q+W);}if(y>0&&g[q-W]&&lab[q-W]<0){lab[q-W]=id;st.push(q-W);}}szs.push(n);}let big=0;szs.forEach((n,i)=>{if(n>szs[big])big=i;});let cut=0;for(let i=0;i<W*H;i++)if(g[i]&&lab[i]!==big){g[i]=0;cut++;}console.log('regioni',szs.length,'celle isolate rimosse',cut);}
 const bits=new Uint8Array(Math.ceil(W*H/8));let walk=0;for(let i=0;i<g.length;i++)if(g[i]){bits[i>>3]|=1<<(i&7);walk++;}
 map.grid={x0,y0,w:W,h:H,bits:Buffer.from(bits).toString('base64')};console.log('griglia',W+'x'+H,'celle calpestabili',walk,'('+Math.round(walk/W/H*100)+'%)');}
map.stats={buildings:map.buildings.length,withLevels:map.buildings.filter(b=>b.lv||b.h).length,roads:map.roads.length,pois:map.pois.length,realNamedPois:map.pois.filter(p=>p.name).length,trees:map.trees.length};
await mkdir(dirname(OUT),{recursive:true});await writeFile(OUT,JSON.stringify(map));console.log('scritto',OUT,Math.round(JSON.stringify(map).length/1024),'kB');
for(const l of map.landmarks)console.log(' ',l.name.padEnd(34),l.missing?'NON TROVATO':'x='+l.x+' y='+l.y+'  '+l.osm);
