// Genera client/sito/img/mappa-mergellina.svg dai dati veri della mappa del gioco (OpenStreetMap, metri 1:1).
// Uso: node scripts/sito-mappa.mjs
import {readFileSync,writeFileSync} from 'node:fs';
const D=JSON.parse(readFileSync(new URL('../client/assets/world/napoli/map/mergellina.json',import.meta.url),'utf8'));
const X0=-560,Y0=-470,X1=2900,Y1=900,W=X1-X0,H=Y1-Y0,r=v=>Math.round(v);
const inBox=p=>p[0]>X0-200&&p[0]<X1+200&&p[1]>Y0-200&&p[1]<Y1+200;
const path=(pts,close)=>'M'+pts.map(p=>r(p[0]-X0)+' '+r(p[1]-Y0)).join('L')+(close?'Z':'');
const simplify=(pts,tol)=>{if(pts.length<3)return pts;const out=[pts[0]];for(const p of pts.slice(1)){const q=out[out.length-1];if(Math.hypot(p[0]-q[0],p[1]-q[1])>=tol)out.push(p);}return out;};
const area=P=>Math.abs(P.reduce((a,q,i)=>{const n=P[(i+1)%P.length];return a+q[0]*n[1]-n[0]*q[1];},0)/2);
// D.coast è il poligono del MARE: non si filtrano i punti (spezzerebbe la forma), lo ritaglia il viewBox.
// Il poligono si chiudeva con una retta di 7,7 km attraverso il golfo: lo si chiude invece lontano, a sud, così il mare resta pieno.
const coast=D.coast.map(c=>{const q=simplify(c,4),a=q[q.length-1],b=q[0];return [...q,[a[0]+6000,a[1]],[a[0]+6000,9000],[b[0]-6000,9000],[b[0]-6000,b[1]]];}).filter(c=>c.length>2);
const parks=(D.parks||[]).map(q=>Array.isArray(q)?q:q.p).filter(p=>p.some(inBox)&&area(p)>200).map(p=>path(simplify(p,3),true));
const squares=(D.squares||[]).filter(q=>q.p.some(inBox)).map(q=>path(simplify(q.p,2),true));
const beaches=(D.beaches||[]).filter(q=>q.p.some(inBox)).map(q=>path(simplify(q.p,3),true));
const bld=D.buildings.filter(b=>b.p.some(inBox)&&area(b.p)>60).map(b=>path(simplify(b.p,2.5),true));
const R={primary:[],secondary:[],tertiary:[],minor:[],foot:[]};
for(const q of D.roads){if(!q.p.some(inBox)||q.tn)continue;const k=q.k;const g=k==='primary'||k==='trunk'?'primary':k==='secondary'?'secondary':k==='tertiary'?'tertiary':['footway','pedestrian','steps','path'].includes(k)?'foot':['residential','unclassified','service','living_street'].includes(k)?'minor':null;if(g)R[g].push(path(simplify(q.p,2),false));}
const piers=(D.piers||[]).filter(q=>q.p.some(inBox)).map(q=>({d:path(q.p,q.area),a:q.area}));
const svg=`<svg xmlns="http://www.w3.org/2000/svg" overflow="hidden" viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice" role="img" aria-label="Mappa di Mergellina dal gioco Napoli life">
<defs><linearGradient id="sea" gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="${H}"><stop offset="0" stop-color="#123a5c"/><stop offset="1" stop-color="#0a2238"/></linearGradient>
<pattern id="wave" width="40" height="40" patternUnits="userSpaceOnUse"><path d="M0 20q10-6 20 0t20 0" fill="none" stroke="#ffffff" stroke-opacity=".05" stroke-width="2"/></pattern></defs>
<rect width="${W}" height="${H}" fill="#1d2f3f"/>
<g stroke="#7fe8d1" stroke-opacity=".4" stroke-width="3">${coast.map(c=>`<path fill="url(#sea)" d="${path(c,true)}"/><path fill="url(#wave)" stroke="none" d="${path(c,true)}"/>`).join('')}</g>
<g fill="#24453a">${parks.map(d=>`<path d="${d}"/>`).join('')}</g>
<g fill="#4a4030" opacity=".8">${beaches.map(d=>`<path d="${d}"/>`).join('')}</g>
<g fill="#2b3b4b">${squares.map(d=>`<path d="${d}"/>`).join('')}</g>
<g fill="none" stroke-linecap="round" stroke-linejoin="round">
<g stroke="#33475a" stroke-width="2">${R.foot.map(d=>`<path d="${d}"/>`).join('')}</g>
<g stroke="#3d5468" stroke-width="5">${R.minor.map(d=>`<path d="${d}"/>`).join('')}</g>
<g stroke="#5b7086" stroke-width="8">${R.tertiary.map(d=>`<path d="${d}"/>`).join('')}</g>
<g stroke="#8a7a55" stroke-width="10">${R.secondary.map(d=>`<path d="${d}"/>`).join('')}</g>
<g stroke="#e2b56a" stroke-width="12">${R.primary.map(d=>`<path d="${d}"/>`).join('')}</g></g>
<g fill="#41556a" stroke="#0b1622" stroke-width="1">${bld.map(d=>`<path d="${d}"/>`).join('')}</g>
<g fill="#6b7f93" stroke="#6b7f93" stroke-width="4">${piers.map(p=>p.a?`<path d="${p.d}"/>`:`<path d="${p.d}" fill="none"/>`).join('')}</g>
</svg>`;
writeFileSync(new URL('../client/sito/img/mappa-mergellina.svg',import.meta.url),svg);
const pins=(D.landmarks||[]).filter(l=>!l.missing).map(l=>({name:l.name,x:+((l.x-X0)/W*100).toFixed(2),y:+((l.y-Y0)/H*100).toFixed(2)}));
console.log('svg',Math.round(svg.length/1024)+' KB','edifici',bld.length,'strade',Object.values(R).reduce((a,b)=>a+b.length,0));console.log(JSON.stringify(pins));
