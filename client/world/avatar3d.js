// Avatar 3D modulari di HUMANA life 3D.
// Ogni personaggio è costruito dal codice a partire da una "scheda" (spec): corpo, viso, capelli, vestiti, scarpe, accessori e colori.
// La scheda nasce dai dati dell'avatar che il gioco ha già (barbiere, negozio di moda, profilo) oppure da un personaggio pronto.
// Un avatar = una sola mesh con lo scheletro (11 ossa) + la targhetta del viso: pochissime chiamate di disegno, adatto anche ai telefoni.
// Altezze in "frazioni di statura" (1 = altezza del personaggio); la radice viene poi scalata in metri.
import * as THREE from '../vendor/three/three.module.min.js';
import {mergeGeometries} from '../vendor/three/BufferGeometryUtils.js';

const hash=s=>{let h=0;for(const ch of String(s))h=(h*31+ch.charCodeAt(0))|0;return Math.abs(h);};
const shade=(hex,k)=>'#'+new THREE.Color(hex).multiplyScalar(k).getHexString();

// ---------- Scheda dell'avatar ----------
// Indici uguali a quelli del catalogo del gioco (shared/catalog.js): capi, pantaloni, scarpe, cappelli, borse, occhiali, collane, tagli.
const TOPS=['hoodie','jacket','jacket','coat','jacket','jacket','jacket','puffer','vest','coat','jacket','sweater','tee'];
const BOTTOMS=['jeans','chino','cargo','jogger','chino','shorts','wide'];
const SHOES=['sneakers','loafers','boots','sneakers','sandals','heels','boots','loafers','slippers'];
const HATS=['cap','beanie','fedora','bucket','cap','fedora','band','band','visor'];
const BAGS=['backpack','shoulder','shoulder','shoulder','shoulder','shoulder','backpack'];
const HAIR=['short','buzz','short','quiff','crest','crest','afro','curly','long','ponytail','bun','braids','bob','undercut','quiff','mullet','pigtails','bald'];
const SKINS=['#f1c7a8','#e3a983','#d9a27c','#c58a62','#a86d48','#7c4a2e'];

export function avatarSpec(avatar={},id='',look=null){
 const a=avatar||{},w=a.wear||{},L=look?.spec||{},h=hash(id);
 const s={female:!!(look?.female),skin:L.skin||SKINS[h%3],eyes:L.eyes||['#5a3a22','#3f2a1a','#4a6a3a','#3d5f8f'][h%4],h:look?.h||1.74,build:({slim:.93,regular:1,broad:1.08})[a.body]||1,
  hair:{kind:'short',color:'#1c1512',...L.hair},beard:L.beard||0,
  top:{kind:'jacket',color:'#1c1c20',inner:a.color||'#f2f2f0',...L.top},bottom:{kind:'jeans',color:'#31445e',...L.bottom},shoes:{kind:'sneakers',color:'#f4f4f4',...L.shoes},
  hat:L.hat||null,glasses:L.glasses||null,neck:L.neck||null,bag:L.bag||null,watch:L.watch||null,earrings:L.earrings||null};
 // Le scelte fatte nel gioco (barbiere, negozio, profilo) hanno la precedenza sul personaggio pronto.
 if(a.hair&&Number.isInteger(a.hair.style)){if(a.hair.style>0||!look)s.hair={kind:HAIR[a.hair.style]||'short',color:a.hair.color||s.hair.color};else if(a.hair.color)s.hair={...s.hair,color:a.hair.color};}
 if(Number.isInteger(a.beard))s.beard=a.beard;
 if(w.top)s.top={kind:TOPS[w.top.style]||'jacket',color:w.top.color,inner:s.top.inner};
 if(w.pants)s.bottom={kind:BOTTOMS[w.pants.style]||'jeans',color:w.pants.color};
 if(w.shoes)s.shoes={kind:SHOES[w.shoes.style]||'sneakers',color:w.shoes.color};
 if(w.hat)s.hat={kind:HATS[w.hat.style]||'cap',color:w.hat.color};else if(a.accessory==='cap')s.hat={kind:'cap',color:a.color||'#41d9cf'};else if(a.accessory==='flower')s.hat={kind:'flower',color:'#e5484d'};
 if(w.glasses)s.glasses={dark:[0,2,4].includes(w.glasses.style),color:w.glasses.color};else if(a.glasses)s.glasses={dark:false,color:'#22272d'};
 if(w.neck)s.neck={kind:w.neck.style>=3?'scarf':'chain',color:w.neck.color};
 if(w.bag)s.bag={kind:BAGS[w.bag.style]||'shoulder',color:w.bag.color};
 if(w.watch)s.watch={color:w.watch.color};
 if(w.gloves)s.gloves={kind:w.gloves.style===1?'padded':'street',color:w.gloves.color};
 if(w.mask)s.mask={kind:['mask','gaiter','balaclava'][w.mask.style]||'mask',color:w.mask.color};
 return s;}

// ---------- Viso: quattro espressioni disegnate (normale, occhi chiusi, bocca aperta, sorriso largo) ----------
function faceTexture(s){const F=160,c=document.createElement('canvas');c.width=F*4;c.height=F;const g=c.getContext('2d'),brow=shade(s.hair.kind==='bald'?'#3a2a1e':s.hair.color,.75),lip=s.female?'#c9525e':shade(s.skin,.62);
 for(let f=0;f<4;f++){g.save();g.translate(f*F,0);const blink=f===1,talk=f===2,happy=f===3;
  // guance
  for(const x of [36,124]){const gr=g.createRadialGradient(x,108,2,x,108,22);gr.addColorStop(0,s.female?'rgba(240,120,130,.36)':'rgba(230,130,110,.2)');gr.addColorStop(1,'rgba(240,120,130,0)');g.fillStyle=gr;g.fillRect(x-24,84,48,48);}
  // barba dipinta: ombra sulla mascella, baffi, pizzetto
  if(s.beard){g.fillStyle=shade(s.hair.color,.9);g.globalAlpha=s.beard===2||s.beard===7||s.beard===9?.92:.6;
   if([1,2,7,9,11].includes(s.beard)){g.beginPath();g.moveTo(14,92);g.quadraticCurveTo(22,150,80,158);g.quadraticCurveTo(138,150,146,92);g.quadraticCurveTo(130,128,104,126);g.quadraticCurveTo(80,112,56,126);g.quadraticCurveTo(30,128,14,92);g.fill();}
   if([3,8,10].includes(s.beard)){g.beginPath();g.ellipse(80,140,17,13,0,0,7);g.fill();}
   if([1,2,3,4,5,7,9,10].includes(s.beard)){g.beginPath();g.moveTo(54,113);g.quadraticCurveTo(80,100,106,113);g.quadraticCurveTo(80,110,54,113);g.lineWidth=7;g.strokeStyle=g.fillStyle;g.stroke();}
   g.globalAlpha=1;}
  for(const sx of [-1,1]){const x=80+sx*36,y=66;
   // sopracciglia
   g.strokeStyle=brow;g.lineCap='round';g.lineWidth=s.female?5.5:8;g.beginPath();g.moveTo(x-sx*19,y-32+(happy?-3:0));g.quadraticCurveTo(x,y-41+(happy?-3:0),x+sx*21,y-30);g.stroke();
   if(blink||happy){g.strokeStyle='#2a1c14';g.lineWidth=5;g.beginPath();g.moveTo(x-20,y+2);g.quadraticCurveTo(x,y+(happy?-13:11),x+20,y+2);g.stroke();continue;}
   // occhio: bianco, iride colorata, pupilla, riflessi, palpebra con ciglia
   g.fillStyle='#fbfbff';g.beginPath();g.ellipse(x,y,21,s.female?24:21,0,0,7);g.fill();g.strokeStyle='rgba(60,35,25,.55)';g.lineWidth=2;g.stroke();
   const gr=g.createRadialGradient(x,y+3,2,x,y+3,15);gr.addColorStop(0,shade(s.eyes,1.6));gr.addColorStop(.75,shade(s.eyes,.8));gr.addColorStop(1,shade(s.eyes,.45));g.fillStyle=gr;g.beginPath();g.arc(x,y+3,15,0,7);g.fill();
   g.fillStyle='#0c0907';g.beginPath();g.arc(x,y+3,7.4,0,7);g.fill();g.fillStyle='#ffffff';g.beginPath();g.arc(x-5,y-4,4.6,0,7);g.fill();g.beginPath();g.arc(x+5,y+8,2.2,0,7);g.fill();
   g.strokeStyle='#22160f';g.lineWidth=s.female?6:4.5;g.beginPath();g.moveTo(x-21,y-4);g.quadraticCurveTo(x,y-(s.female?30:25),x+21,y-4);g.stroke();
   if(s.female){g.lineWidth=3.5;for(const k of [0,1]){g.beginPath();g.moveTo(x+sx*(17+k*3),y-12+k*5);g.lineTo(x+sx*(27+k*2),y-19+k*6);g.stroke();}}}
  // naso
  g.strokeStyle=shade(s.skin,.7);g.lineWidth=3;g.lineCap='round';g.beginPath();g.moveTo(74,103);g.quadraticCurveTo(80,109,87,103);g.stroke();
  // bocca
  if(talk){g.fillStyle='#5a1f24';g.beginPath();g.ellipse(80,130,13,10,0,0,7);g.fill();g.fillStyle='#e8a0a0';g.beginPath();g.ellipse(80,135,7,3.5,0,0,7);g.fill();}
  else if(happy){g.fillStyle='#5a1f24';g.beginPath();g.moveTo(55,122);g.quadraticCurveTo(80,154,105,122);g.closePath();g.fill();g.fillStyle='#ffffff';g.fillRect(62,122,36,6);}
  else{g.strokeStyle=lip;g.lineWidth=s.female?6.5:4.2;g.beginPath();g.moveTo(60,124);g.quadraticCurveTo(80,141,100,124);g.stroke();if(s.female){g.strokeStyle='rgba(255,255,255,.35)';g.lineWidth=1.8;g.beginPath();g.moveTo(71,130);g.quadraticCurveTo(80,134,89,130);g.stroke();}}
  g.restore();}
 const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.repeat.set(.25,1);t.anisotropy=4;return t;}

// ---------- Costruzione ----------
const B={hips:0,spine:1,head:2,armL:3,foreL:4,armR:5,foreR:6,legL:7,shinL:8,legR:9,shinR:10};
const Y={hip:.5,waist:.6,sh:.795,neck:.835,head:.924,elbow:.63,knee:.275};

export function buildAvatar(s,material,gradientMap){
 const parts=[],M=new THREE.Matrix4(),Q=new THREE.Quaternion(),E=new THREE.Euler();
 const mat=(x,y,z,sx=1,sy=1,sz=1,rx=0,ry=0,rz=0)=>new THREE.Matrix4().compose(new THREE.Vector3(x,y,z),Q.setFromEuler(E.set(rx,ry,rz)).clone(),new THREE.Vector3(sx,sy,sz));
 // Aggiunge un pezzo: geometria, osso a cui è attaccato, colore (fisso oppure scelto vertice per vertice), posizione.
 const add=(geo,bone,col,m,wf)=>{let g=geo.index?geo.toNonIndexed():geo;if(m)g.applyMatrix4(m);g.deleteAttribute('uv');const p=g.attributes.position,n=p.count,ca=new Float32Array(n*3),si=new Uint16Array(n*4),sw=new Float32Array(n*4),c=new THREE.Color();
  for(let i=0;i<n;i++){c.set(typeof col==='function'?col(p.getX(i),p.getY(i),p.getZ(i)):col);ca[i*3]=c.r;ca[i*3+1]=c.g;ca[i*3+2]=c.b;si[i*4]=bone;sw[i*4]=1;if(wf){const t=wf(p.getX(i),p.getY(i),p.getZ(i));si[i*4+1]=t[0];sw[i*4+1]=t[1];sw[i*4]=1-t[1];}}
  g.setAttribute('color',new THREE.BufferAttribute(ca,3));g.setAttribute('skinIndex',new THREE.BufferAttribute(si,4));g.setAttribute('skinWeight',new THREE.BufferAttribute(sw,4));parts.push(g);};
 // Pochi triangoli per pezzo (un avatar intero sta sui 3-4 mila): conta per i telefoni e quando in piazza c'è tanta gente.
 const sph=(d=1)=>new THREE.IcosahedronGeometry(1,Math.min(d,1)),ball=(w=16,h=12)=>new THREE.SphereGeometry(1,Math.min(w,16),Math.min(h,12)),cap=(r,l)=>new THREE.CapsuleGeometry(r,l,3,10),box=(w,h,d)=>new THREE.BoxGeometry(w,h,d);
 const lathe=(pts,n=18)=>new THREE.LatheGeometry(pts.map(q=>new THREE.Vector2(q[0],q[1])),n);
 // Sfumatura tra l'osso del pezzo (sopra la giuntura) e un altro osso (sotto): 0 sopra, 1 sotto, morbida entro "w".
 const blend=(other,yj,w)=>(_,y)=>[other,Math.max(0,Math.min(1,(yj+w-y)/(2*w)))];
 const f=s.female,b=s.build,skin=s.skin,top=s.top,bot=s.bottom,TK=top.kind,BK=bot.kind;
 const sleeveless=['crop','dress','vest','tank'].includes(TK),shortSl=TK==='tee',open=['jacket','puffer','coat','cropjacket'].includes(TK),cropped=['crop','cropjacket'].includes(TK),bulky=TK==='puffer'?1.14:TK==='hoodie'||TK==='sweater'?1.07:1;
 const shW=(f?.1:.118)*b,legX=(f?.05:.053)*b,armX=shW+(f?.012:.016)*bulky;
 // Bacino e torso (profili "al tornio", poi schiacciati davanti-dietro).
 const legCol=['skirt','dress'].includes(BK)||TK==='dress'&&BK==='none'?skin:bot.color,pelvisCol=TK==='dress'?top.color:bot.color;
 add(lathe(f?[[.001,.435],[.07,.45],[.108,.5],[.1,.56],[.082,.605]]:[[.001,.435],[.068,.45],[.1,.5],[.098,.56],[.092,.605]]),B.hips,pelvisCol,mat(0,0,0,b,1,.74));
 const hem=cropped?.655:TK==='dress'?.6:.545,tc=(x,y,z)=>cropped&&y<hem+.012?skin:open&&z>0&&Math.abs(x)<.02*(1+(y-.6)*2.2)?top.inner:TK==='crop'&&y>.79?skin:top.color;
 add(lathe(f?[[.084*bulky,hem],[.08*bulky,.61],[.092*bulky,.66],[.107*bulky,.715],[.1*bulky,.765],[shW*1.02,.795],[shW*.8,.822],[.05,.836],[.034,.848]]:[[.096*bulky,hem],[.093*bulky,.61],[.106*bulky,.68],[.116*bulky,.735],[shW*1.03,.79],[shW*.82,.822],[.056,.836],[.038,.848]]),B.spine,tc,mat(0,0,0,b,1,f?.76:.68),blend(B.hips,Y.waist-.02,.04));
 add(new THREE.CylinderGeometry(.033,.037,.06,12),B.spine,skin,mat(0,.845,0));
 // Testa: ovale con orecchie e naso; il viso è una targhetta a parte, con le espressioni.
 const hx=.08,hy=.096,hz=.086;{const hg=ball(22,18),hp=hg.attributes.position;for(let i=0;i<hp.count;i++){const y=hp.getY(i),t=Math.max(0,-y);hp.setX(i,hp.getX(i)*(1-(f?.36:.28)*Math.pow(t,1.5)));hp.setZ(i,hp.getZ(i)*(1-.16*Math.pow(t,1.5))+.06*t*t);}hg.computeVertexNormals();add(hg,B.head,skin,mat(0,Y.head,0,hx,hy,hz));}add(ball(10,8),B.head,skin,mat(0,Y.head-.045,.004,hx*.8,hy*.6,hz*.8));
 for(const sx of [-1,1])add(sph(1),B.head,skin,mat(sx*hx*.98,Y.head-.008,-.004,.012,.022,.016));add(sph(1),B.head,skin,mat(0,Y.head-.016,hz*.985,.011,.012,.012));
 // Braccia: manica lunga, corta o senza; mani.
 const armR=(f?.028:.034)*bulky,foreR=(f?.024:.029)*(sleeveless||shortSl?1:bulky),slv=sleeveless?skin:top.color;
 for(const [sx,up,lo] of [[1,B.armL,B.foreL],[-1,B.armR,B.foreR]]){const x=sx*armX;
  add(lathe([[.001,.478],[foreR*.8,.484],[foreR*.92,.52],[foreR*1.1,.6],[armR*.92,.632],[armR,.7],[armR*1.12,.765],[armR*.95,.797],[.001,.808]],10),up,(_,y)=>sleeveless?skin:shortSl?(y>.705?top.color:skin):top.color,mat(x,0,0),blend(lo,Y.elbow,.022));
  if(!sleeveless&&!shortSl)add(new THREE.CylinderGeometry(foreR*1.1,foreR*1.1,.02,10),lo,shade(top.color,.8),mat(x,.493,0));
  add(sph(2),lo,skin,mat(x,.462,.004,.024,.034,.028));if(s.gloves)add(ball(10,8),lo,s.gloves.color,mat(x,.462,.013,s.gloves.kind==='padded'?.031:.027,.038,.034));}
 // Gambe: pantaloni lunghi, larghi, corti, oppure gamba nuda sotto gonna e vestito; scarpe.
 const thR=f?.057:.056,shR=BK==='wide'?.052:BK==='cargo'?.048:BK==='jogger'?.043:f?.038:.042,longP=['jeans','chino','cargo','jogger','wide'].includes(BK);
 for(const [sx,up,lo] of [[1,B.legL,B.shinL],[-1,B.legR,B.shinR]]){const x=sx*legX;
  {const sr=(longP?shR:f?.034:.037)*b,tr=thR*b;add(lathe([[.001,.05],[sr*.72,.056],[sr*.8,.1],[sr*1.06,.19],[sr*.98,.262],[tr*.8,.3],[tr*.98,.41],[tr,.48],[tr*.72,.525],[.001,.532]],12),up,(_,y)=>longP?bot.color:BK==='shorts'&&y>.37?bot.color:skin,mat(x,0,0),blend(lo,Y.knee,.025));}
  if(BK==='cargo')add(box(.03,.07,.06),up,shade(bot.color,.88),mat(x+sx*thR*b*.95,.37,0));
  if(bot.ripped)add(sph(1),lo,skin,mat(x,.262,.03,.026,.022,.018));
  if(BK==='jogger')add(new THREE.CylinderGeometry(.036,.036,.022,10),lo,shade(bot.color,.8),mat(x,.07,0));
  const sk=s.shoes.kind,sc=s.shoes.color;
  if(sk==='heels'){add(sph(2),lo,sc,mat(x,.04,.035,.036,.03,.075));add(new THREE.CylinderGeometry(.008,.006,.06,6),lo,sc,mat(x,.03,-.03));add(sph(1),lo,skin,mat(x,.062,.01,.03,.03,.04));}
  else if(sk==='sandals'){add(box(.075,.014,.2),lo,sc,mat(x,.012,.035));add(sph(2),lo,skin,mat(x,.04,.04,.034,.026,.08));}
  else if(sk==='slippers'){add(box(.078,.018,.19),lo,shade(sc,.62),mat(x,.014,.035));add(box(.073,.025,.1),lo,sc,mat(x,.037,.004));}
  else{const tall=sk==='boots';add(sph(2),lo,sc,mat(x,.042,.035,.043,tall?.05:.038,.09));add(box(.084,.022,.2),lo,sk==='sneakers'?'#f4f4f4':shade(sc,.6),mat(x,.011,.035));if(tall)add(new THREE.CylinderGeometry(.043,.04,.07,10),lo,sc,mat(x,.1,0));
   if(sk==='sneakers')add(box(.05,.012,.07),lo,'#f4f4f4',mat(x,.074,.06,1,1,1,-.5));}}
 // Gonna, vestito, cappotto: una campana attaccata al bacino.
 if(BK==='skirt')add(new THREE.CylinderGeometry(.088,.132,.2,18,1,true),B.hips,bot.color,mat(0,.5,0,b,1,.82));
 if(TK==='dress')add(new THREE.CylinderGeometry(.086,.112,.24,18,1,true),B.hips,top.color,mat(0,.485,0,b,1,.8));
 if(TK==='coat')add(new THREE.CylinderGeometry(.1,.118,.24,18,1,true),B.hips,(x,y,z)=>z>0&&Math.abs(x)<.03?bot.color:top.color,mat(0,.44,0,b,1,.8));
 if(BK==='skirt'||TK==='dress')add(new THREE.CylinderGeometry(.09,.09,.018,18),B.hips,shade(BK==='skirt'?bot.color:top.color,.75),mat(0,.6,0,b,1,.8));
 else add(new THREE.CylinderGeometry(.094*(f?.9:1),.094*(f?.9:1),.02,18),B.hips,'#22272d',mat(0,cropped?.598:.56,0,b,1,.76));
 // Dettagli dei capi: cappuccio e lacci, colletto, bordo della felpa.
 if(TK==='hoodie'){add(ball(12,10),B.spine,top.color,mat(0,.835,-.052,.082,.05,.062));for(const sx of [-1,1])add(box(.006,.07,.006),B.spine,'#f2f2f0',mat(sx*.022,.77,.078*b));add(new THREE.CylinderGeometry(.1*bulky,.1*bulky,.03,18),B.spine,shade(top.color,.85),mat(0,.56,0,b,1,.74));}
 if(['shirt','jacket','coat','cropjacket','puffer'].includes(TK))for(const sx of [-1,1])add(box(.05,.012,.045),B.spine,TK==='shirt'?top.color:shade(top.color,.9),mat(sx*.036,.838,.03,1,1,1,.5,sx*.5,sx*-.5));
 if(TK==='puffer')for(const y of [.62,.68,.74])add(new THREE.TorusGeometry(.108*bulky,.006,5,18),B.spine,shade(top.color,.8),mat(0,y,0,b,.72,1,Math.PI/2));
 if(TK==='shirt')for(const y of [.64,.69,.74,.79])add(sph(0),B.spine,'#e9e4da',mat(0,y,(f?.083:.086)*b,.006,.006,.004));
 // Capelli: una calotta più i pezzi del taglio scelto (ciuffo, cresta, ricci, coda, chignon, trecce, lunghi…).
 const hc=s.hair.color,HK=s.hair.kind,C=Y.head,hair=(g,m,col=hc)=>add(g,B.head,col,m),dome=(k,th,tilt,dy=0)=>hair(new THREE.SphereGeometry(1,20,12,0,Math.PI*2,0,th),mat(0,C+dy,-.004,hx*k,hy*k,hz*k,tilt));
 if(HK!=='bald'){
  if(HK==='buzz')dome(1.035,1.55,-.5);
  else if(HK==='afro'){dome(1.5,1.7,-.8,.02);}
  else if(HK==='crest'){dome(1.03,1.5,-.5);hair(sph(2),mat(0,C+.085,-.01,.018,.05,.085));}
  else if(HK==='undercut'){dome(1.03,1.45,-.5);hair(ball(14,10),mat(0,C+.07,.004,hx*.86,.04,hz*.98));hair(sph(2),mat(0,C+.085,.045,.05,.03,.04));}
  else{dome(f?1.1:1.07,1.62,f?-.5:-.42);
   if(HK==='quiff'||HK==='short'){hair(sph(2),mat(0,C+.078,.05,.058,HK==='quiff'?.042:.028,.04,-.3));if(HK==='quiff')hair(sph(2),mat(.012,C+.1,.035,.045,.03,.04));}
   if(HK==='curly')for(let i=0;i<22;i++){const a=i*2.4,r=.35+((i*37)%60)/100,y=Math.cos(r*1.3);hair(sph(1),mat(Math.sin(a)*Math.sin(r*1.3)*hx*1.08,C+y*hy*1.02+.012,Math.cos(a)*Math.sin(r*1.3)*hz*1.05+.006,.027,.027,.027));}
   if(HK==='long'||HK==='bob'||HK==='mullet'){const low=HK==='long'?.69:HK==='bob'?.83:.8,hh=C+.02-low;hair(new THREE.CylinderGeometry(hx*1.12,hx*(HK==='long'?1.2:1.05),hh,16,1,true,Math.PI*.5,Math.PI),mat(0,low+hh/2,-.012,1,1,.95));
    if(HK!=='mullet')for(const sx of [-1,1])hair(cap(.022,hh*.7),mat(sx*hx*1.02,low+hh*.5,.022,1,1,1.3,.06,0,sx*.05));}
   if(HK==='ponytail'){hair(sph(2),mat(0,C+.07,-.07,.03,.03,.03));for(let i=0;i<5;i++)hair(sph(1),mat(0,C+.05-i*.042,-.1-Math.sin(i*.7)*.03,.036-i*.004,.04,.036-i*.004));}
   if(HK==='pigtails')for(const sx of [-1,1])for(let i=0;i<4;i++)hair(sph(1),mat(sx*(hx*1.05+.014+i*.006),C+.03-i*.045,-.02,.03-i*.003,.036,.03-i*.003));
   if(HK==='bun'){hair(sph(2),mat(0,C+.1,-.035,.05,.046,.05));hair(sph(1),mat(0,C+.07,-.03,.03,.02,.03),shade(hc,.8));}
   if(HK==='braids')for(const sx of [-1,1])for(let i=0;i<6;i++)hair(sph(1),mat(sx*hx*1.02,C-.02-i*.036,.02+Math.sin(i)*.004,.02,.024,.02));
   if(f&&['long','ponytail','bun','braids','bob'].includes(HK))for(const sx of [-1,1])hair(cap(.014,.075),mat(sx*hx*.9,C-.01,hz*.72,1,1,1,-.1,0,sx*.18));}}
 // Accessori: cappello, occhiali, collana o sciarpa, borsa o zaino, orologio, orecchini, fiore.
 if(s.hat){const k=s.hat.kind,c=s.hat.color;
  if(k==='cap'||k==='visor'){if(k==='cap')hair(new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,1.35),mat(0,C+.012,-.002,hx*1.16,hy*1.1,hz*1.16,-.12),c);hair(box(.11,.01,.08),mat(0,C+.05,hz*1.5,1,1,1,.12),c);if(k==='visor')hair(new THREE.TorusGeometry(hx*1.08,.012,6,20),mat(0,C+.045,0,1,1.08,1,Math.PI/2),c);}
  else if(k==='beanie'){hair(new THREE.SphereGeometry(1,18,10,0,Math.PI*2,0,1.4),mat(0,C+.02,-.004,hx*1.17,hy*1.25,hz*1.17,-.15),c);hair(new THREE.TorusGeometry(hx*1.12,.014,6,20),mat(0,C+.04,-.004,1,1.08,1,Math.PI/2-.15),shade(c,.85));}
  else if(k==='fedora'||k==='bucket'){hair(new THREE.CylinderGeometry(k==='bucket'?.085:.14,k==='bucket'?.125:.14,k==='bucket'?.05:.01,20),mat(0,C+.05,0),c);hair(new THREE.CylinderGeometry(hx*1.02,hx*1.12,.07,18),mat(0,C+.09,0),c);hair(new THREE.CylinderGeometry(hx*1.14,hx*1.14,.016,18),mat(0,C+.062,0),shade(c,.6));}
  else if(k==='band')hair(new THREE.TorusGeometry(hx*1.1,.012,6,20),mat(0,C+.04,-.004,1,1.08,1,Math.PI/2-.12),c);
  else if(k==='flower'){for(let i=0;i<5;i++)hair(sph(1),mat(hx*.8+Math.cos(i*1.257)*.016,C+.07+Math.sin(i*1.257)*.016,.03,.012,.012,.008),c);hair(sph(1),mat(hx*.8,C+.07,.034,.009,.009,.008),'#ffc928');}}
 if(s.glasses){const c=s.glasses.color||'#22272d',gy=C+.011,gz=hz*1.0;for(const sx of [-1,1]){hair(new THREE.TorusGeometry(.021,.0035,5,16),mat(sx*.032,gy,gz,1,1,1,0,sx*.22),c);if(s.glasses.dark)hair(new THREE.CircleGeometry(.02,14),mat(sx*.032,gy,gz+.001,1,1,1,0,sx*.22),'#15181c');hair(box(.004,.004,.07),mat(sx*.063,gy,gz-.04),c);}hair(box(.022,.004,.004),mat(0,gy+.004,gz+.006),c);}
 if(s.earrings)for(const sx of [-1,1])hair(new THREE.TorusGeometry(.012,.0028,5,12),mat(sx*hx*1.02,C-.04,0,1,1,1,0,Math.PI/2),s.earrings.color||'#d4a73a');
 if(s.neck){if(s.neck.kind==='scarf'){add(new THREE.TorusGeometry(.048,.02,7,16),B.spine,s.neck.color,mat(0,.835,0,1,1.1,1,Math.PI/2));add(box(.04,.13,.02),B.spine,s.neck.color,mat(.03,.76,.08*b));}
  else{add(new THREE.TorusGeometry(.052,.0042,5,22),B.spine,s.neck.color,mat(0,.79,.03*b,1,1,1,Math.PI/2-.55));add(sph(1),B.spine,s.neck.color,mat(0,.748,(f?.086:.082)*b,.01,.013,.006));}}
 if(s.bag){const c=s.bag.color;if(s.bag.kind==='backpack'){add(box(.17,.2,.075),B.spine,c,mat(0,.7,-.118*b));add(box(.13,.07,.02),B.spine,shade(c,.8),mat(0,.66,-.16*b));for(const sx of [-1,1])add(box(.022,.2,.012),B.spine,shade(c,.75),mat(sx*.07,.72,.088*b,1,1,1,-.08));}
  else{add(box(.03,.1,.12),B.hips,c,mat(-(.118*b+.016),.5,.01));add(box(.012,.012,.03),B.hips,'#d4a73a',mat(-(.118*b+.034),.52,.01));add(new THREE.TorusGeometry(.19,.0045,4,20,Math.PI*1.02),B.spine,shade(c,.7),mat(-.005,.665,0,.62,1,.5,0,Math.PI/2+.2,-.72));}}
 if(s.watch)add(new THREE.CylinderGeometry(.03,.03,.016,12),B.foreL,s.watch.color||'#22272d',mat(armX,.5,0));
 const geo=mergeGeometries(parts);for(const p of parts)p.dispose();
 // Scheletro: bacino → schiena → testa e braccia; bacino → gambe.
 const bones=[];const bone=(parent,x,y,z)=>{const o=new THREE.Bone();o.position.set(x,y,z);parent?.add(o);bones.push(o);return o;};
 const hips=bone(null,0,Y.hip,0),spine=bone(hips,0,Y.waist-Y.hip,0),head=bone(spine,0,Y.neck-Y.waist,0);
 for(const sx of [1,-1]){const a=bone(spine,sx*armX,Y.sh-Y.waist,0);bone(a,0,Y.elbow-Y.sh,0);}
 for(const sx of [1,-1]){const l=bone(hips,sx*legX,0,0);bone(l,0,Y.knee-Y.hip,0);}
 const mesh=new THREE.SkinnedMesh(geo,material);mesh.add(hips);mesh.updateMatrixWorld(true);const skeleton=new THREE.Skeleton(bones);mesh.bind(skeleton);mesh.frustumCulled=false;
 // Viso: una calotta sottile davanti alla testa, con la texture delle espressioni.
 const tex=faceTexture(s),fm=gradientMap?new THREE.MeshToonMaterial({map:tex,gradientMap,transparent:true,alphaTest:.3}):new THREE.MeshLambertMaterial({map:tex,transparent:true,alphaTest:.3});fm.userData.outlineParameters={visible:false};
 const face=new THREE.Mesh(new THREE.SphereGeometry(1,16,12,Math.PI/2-.86,1.72,Math.PI/2-.7,1.42),fm);face.scale.set(hx*1.012,hy*1.012,hz*1.012);face.position.set(0,Y.head-Y.neck,0);head.add(face);
 if(s.mask){const mm=gradientMap?new THREE.MeshToonMaterial({color:s.mask.color,gradientMap,side:THREE.DoubleSide}):new THREE.MeshStandardMaterial({color:s.mask.color,roughness:.92,side:THREE.DoubleSide});
  const panel=new THREE.Mesh(new THREE.SphereGeometry(1,12,8),mm);panel.scale.set(.058,.027,.018);panel.position.set(0,-.025,.078);head.add(panel);
  if(s.mask.kind==='gaiter'){const collar=new THREE.Mesh(new THREE.TorusGeometry(.047,.014,6,14),mm);collar.position.set(0,-.073,0);collar.rotation.x=Math.PI/2;head.add(collar);}
  if(s.mask.kind==='balaclava'){const hood=new THREE.Mesh(new THREE.SphereGeometry(1,14,10,0,Math.PI*2,0,Math.PI*.64),mm);hood.scale.set(.083,.097,.086);hood.position.set(0,0,-.002);head.add(hood);for(const sx of [-1,1]){const ear=new THREE.Mesh(new THREE.SphereGeometry(1,8,6),mm);ear.scale.set(.012,.025,.018);ear.position.set(sx*.077,-.006,0);head.add(ear);}}}
 const root=new THREE.Group();root.add(mesh);root.scale.setScalar(s.h);
 return {root,mesh,bones,tex,spec:s,ph:hash(JSON.stringify(s))%7,walk:0,seed:Math.random()*6.28,blink:1+Math.random()*3,
  dispose(){geo.dispose();tex.dispose();fm.dispose();skeleton.dispose();}};}

// ---------- Movimento: fermo, cammina, corre, seduto, alla guida, saluta, balla; battito di ciglia e bocca che parla ----------
export function poseAvatar(av,st,t,dt){const b=av.bones,R=(i,x=0,y=0,z=0)=>b[i].rotation.set(x,y,z),k=Math.min(1,dt*10);
 av.walk+=((st.moving&&!st.sit?1:0)-av.walk)*k;if(st.moving)av.ph+=dt*(st.running?11.5:7.6);
 const w=av.walk,run=st.running?1:0,s=Math.sin(av.ph),c=Math.cos(av.ph),A=(run?.95:.6)*w,idle=1-w,br=Math.sin(t*1.7+av.seed)*.012;
 let hipY=Y.hip+Math.abs(c)*.012*w*(1+run*.6);
 if(st.sit){hipY=Y.hip-.2;R(B.hips);R(B.spine,st.drive?.08:-.03);R(B.legL,-1.5,0,.05);R(B.legR,-1.5,0,-.05);R(B.shinL,1.45);R(B.shinR,1.45);
  if(st.drive){R(B.armL,-1.05,0,.12);R(B.armR,-1.05,0,-.12);R(B.foreL,-.35);R(B.foreR,-.35);}else{R(B.armL,-.45,0,.1);R(B.armR,-.45,0,-.1);R(B.foreL,-.8);R(B.foreR,-.8);}
  R(B.head,0,Math.sin(t*.5+av.seed)*.12,0);}
 else{R(B.hips,0,s*.05*w,0);R(B.spine,.03+run*w*.16+br,-s*.09*w,0);R(B.head,-run*w*.08,Math.sin(t*.45+av.seed)*.1*idle,0);
  R(B.legL,-s*A,0,0);R(B.legR,s*A,0,0);R(B.shinL,Math.max(0,-c)*(run?1.5:.85)*w+.03);R(B.shinR,Math.max(0,c)*(run?1.5:.85)*w+.03);
  R(B.armL,s*A*.8,0,.07+idle*.02);R(B.armR,-s*A*.8,0,-.07-idle*.02);R(B.foreL,-.12-run*w*1.1-Math.max(0,s)*.25*w);R(B.foreR,-.12-run*w*1.1-Math.max(0,-s)*.25*w);
  if(st.action==='WAVE'&&!st.moving){R(B.armR,0,0,-2.6);R(B.foreR,0,0,Math.sin(t*9)*.45-.2);}
  if(st.action==='DANCE'&&!st.moving){const d=Math.sin(t*6.5),e=Math.cos(t*6.5);hipY+=Math.abs(d)*.02;R(B.hips,0,d*.18,d*.06);R(B.spine,.02,-d*.2,-d*.07);R(B.armL,-1.2-e*.5,0,.5);R(B.armR,-1.2+e*.5,0,-.5);R(B.foreL,-1.1);R(B.foreR,-1.1);R(B.legL,-Math.max(0,d)*.4);R(B.legR,-Math.max(0,-d)*.4);R(B.shinL,Math.max(0,d)*.7);R(B.shinR,Math.max(0,-d)*.7);}}
 b[B.hips].position.y=hipY;
 // Espressioni: ciglia ogni pochi secondi, bocca che si apre quando si parla, sorriso quando si saluta o si balla.
 av.blink-=dt;let fr=0;if(av.blink<0){fr=1;if(av.blink<-.13)av.blink=2+Math.random()*3.5;}if(st.talking&&Math.sin(t*16)>0)fr=2;else if((st.action==='WAVE'||st.action==='DANCE')&&fr===0)fr=3;av.tex.offset.x=fr*.25;}
