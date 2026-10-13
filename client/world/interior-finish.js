import * as THREE from '../vendor/three/three.module.min.js';

// Finiture leggere, condivise tra le stanze. Gli elementi a terra rimangono
// nell'impronta degli arredi esistenti; tappeti e dettagli non bloccano i percorsi.
export function finishInterior(world,theme,map,root){
 const home=theme.art==='home',bar=theme.art==='bar';if(!home&&!bar)return;
 const W=map.bounds.w,D=map.bounds.h,g=new THREE.Group();g.name='interior-finish';
 const materials=new Map(),mat=(color,roughness=.7,metalness=0)=>{const key=[color,roughness,metalness].join();if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color,roughness,metalness}));return materials.get(key);};
 const wood=world.interiorMaterial('wood','#86654b'),ivory=world.interiorMaterial('plaster','#ede7dc'),brass=mat('#99815a',.3,.7),iron=mat('#323534',.38,.55);
 const mesh=(geo,m,x,y,z)=>{const o=new THREE.Mesh(geo,m);o.position.set(x,y,z);o.castShadow=!world.lite;o.receiveShadow=true;g.add(o);return o;};
 const box=(w,h,d,x,y,z,m)=>mesh(new THREE.BoxGeometry(w,h,d),m,x,y,z);
 const cylinder=(r1,r2,h,x,y,z,m)=>mesh(new THREE.CylinderGeometry(r1,r2,h,16),m,x,y,z);
 const linen=world.interiorMaterial('fabric','#d9d2c3');
 const rug=(x,z,w,d)=>{const q=box(w,.012,d,x,.018,z,linen);q.castShadow=false;for(const sd of [-1,1])box(w-.1,.006,.035,x,.028,z+sd*(d/2-.12),mat('#9c9385'));};
 const cup=(x,y,z)=>{cylinder(.047,.035,.072,x,y+.036,z,mat('#eee9df',.24));cylinder(.043,.043,.006,x,y+.075,z,mat('#34231b',.85));const h=mesh(new THREE.TorusGeometry(.022,.007,5,12),mat('#eee9df',.24),x+.052,y+.039,z);h.rotation.y=Math.PI/2;cylinder(.08,.08,.008,x,y-.003,z,mat('#eee9df',.24));};
 const vase=(x,y,z)=>{cylinder(.06,.09,.18,x,y+.09,z,mat('#b7a38c'));for(let i=0;i<5;i++){const stem=cylinder(.003,.003,.34,x+(i-2)*.012,y+.34,z,mat('#536049'));stem.rotation.z=(i-2)*.08;const leaf=mesh(new THREE.SphereGeometry(.035,8,5),mat('#667350'),x+(i-2)*.038,y+.43,z);leaf.scale.set(1,.3,2);}};
 // Battiscopa, cornice del soffitto e piccoli faretti incassati.
 for(const z of [0,D]){box(W,.12,.055,W/2,.065,z+(z===0?.03:-.03),ivory);box(W,.07,.15,W/2,3.27,z+(z===0?.07:-.07),ivory);}
 for(const x of [0,W]){box(.055,.12,D,x+(x===0?.03:-.03),.065,D/2,ivory);box(.15,.07,D,x+(x===0?.07:-.07),3.27,D/2,ivory);}
 const luminous=new THREE.MeshStandardMaterial({color:'#fff1d6',emissive:'#ffe1a9',emissiveIntensity:2});
 for(const x of [2,W-2])for(const z of [3,D-3]){cylinder(.11,.11,.018,x,3.32,z,mat('#e7e3d9'));cylinder(.075,.075,.022,x,3.305,z,luminous);}
 if(home){
  const sofa=map.props.find(p=>p.kind==='sofa'),bed=map.props.find(p=>p.kind==='bed');
  if(sofa){rug(sofa.x,sofa.y+.15,3.6,2.5);const x=sofa.x,z=sofa.y+.7;
   box(1.25,.05,.36,x,.38,z,wood);for(const dx of [-.5,.5])box(.035,.34,.22,x+dx,.19,z,iron);cup(x-.35,.415,z);box(.28,.035,.2,x+.2,.417,z,mat('#6b777c'));vase(x+.43,.415,z);world.contactShadow(root,x,z,1.6,.8);
  }
  if(bed){rug(bed.x,bed.y+.3,2.7,3.2);box(2.7,1.55,.085,bed.x,.85,bed.y-1.13,wood);for(let i=0;i<19;i++)box(.018,1.5,.025,bed.x-1.25+i*.14,.85,bed.y-1.07,mat('#534737'));
   for(const sd of [-1,1]){const x=bed.x+sd*1.08;box(.42,.28,.38,x,.37,bed.y-.63,wood);box(.36,.025,.32,x,.53,bed.y-.63,ivory);cylinder(.075,.1,.12,x,.6,bed.y-.63,brass);cylinder(.12,.17,.19,x,.755,bed.y-.63,linen);}
  }
  // Boiserie e quadro astratto sulla parete laterale: oggetti montati, niente finestre dipinte.
  for(let i=0;i<5;i++){const z=3+i*2;box(.024,1.9,1.55,.032,1.6,z,ivory);box(.035,.025,1.57,.053,.66,z,brass);}
  const art=document.createElement('canvas');art.width=384;art.height=512;const ctx=art.getContext('2d');ctx.fillStyle='#d6c9b3';ctx.fillRect(0,0,384,512);ctx.fillStyle='#6c8588';ctx.beginPath();ctx.arc(178,205,114,0,Math.PI*2);ctx.fill();ctx.fillStyle='#ad8061';ctx.fillRect(110,300,190,145);ctx.fillStyle='#ece6d8';ctx.fillRect(47,55,72,370);
  const texture=new THREE.CanvasTexture(art);texture.colorSpace=THREE.SRGBColorSpace;box(.065,1.5,1.12,.065,1.9,5,wood);const picture=mesh(new THREE.PlaneGeometry(1.02,1.4),new THREE.MeshStandardMaterial({map:texture,roughness:.9}),.103,1.9,5);picture.rotation.y=Math.PI/2;
  // Mensola leggera all'ingresso, lontana dal corridoio centrale.
  box(2,.06,.3,3.2,.9,D-.18,wood);for(let i=0;i<7;i++)box(.09,.22+(i%3)*.04,.16,2.5+i*.12,1.03,D-.2,mat(['#6a7372','#a49580','#d5cbb9'][i%3]));vase(3.8,.93,D-.18);
 }else{
  // Banco del caffè: macchina espresso in metallo, tazzine e vetrina dei dolci.
  const p=map.props.find(p=>p.kind==='counter');if(p){const x=p.x,z=p.y,y=1.08;
   box(.65,.3,.34,x-.6,y+.18,z-.08,iron);box(.69,.055,.38,x-.6,y+.35,z-.08,brass);box(.55,.2,.012,x-.6,y+.18,z+.1,mat('#9ca09e',.24,.85));
   for(const dx of [-.15,.15]){cylinder(.035,.035,.05,x-.6+dx,y+.13,z+.13,iron).rotation.x=Math.PI/2;box(.025,.02,.14,x-.6+dx,y+.11,z+.2,iron);cup(x-.6+dx,y+.028,z+.13);}for(let i=0;i<3;i++)cup(x-.85+i*.15,y+.385,z-.08);
   box(.62,.045,.35,x+.6,y+.025,z,wood);const glass=new THREE.MeshStandardMaterial({color:'#dce7e8',transparent:true,opacity:.13,roughness:.06,metalness:.08,depthWrite:false});box(.63,.24,.36,x+.6,y+.17,z,glass);
   for(let i=0;i<3;i++){const pastry=mesh(new THREE.TorusGeometry(.052,.023,7,12,Math.PI*1.55),mat('#b47c3e'),x+.42+i*.18,y+.07,z);pastry.rotation.x=Math.PI/2;}
  }
  for(const p of map.props.filter(p=>p.kind==='table')){cup(p.x-.2,.8,p.y+.08);vase(p.x+.15,.8,p.y-.09);}
  // Pannellatura in legno sotto la vetrina e rivestimento a doghe dietro il bancone.
  box(W*.58,2.3,.045,W*.48,1.9,.035,wood);for(let i=0;i<54;i++)box(.012,2.24,.025,W*.19+i*W*.0108,1.9,.071,mat('#4d4035'));
 }
 root.add(g);world.mergeGroup(g);
}

export function homeDining(world,g,kind){
 const wood=world.interiorMaterial('wood','#977759'),metal=new THREE.MeshStandardMaterial({color:'#343836',roughness:.4,metalness:.5});
 const add=(w,h,d,x,y,z,m)=>{const o=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),m);o.position.set(x,y,z);o.castShadow=!world.lite;o.receiveShadow=true;g.add(o);return o;};
 if(kind==='table'){add(1.15,.055,.85,0,.76,0,wood);for(const x of [-.46,.46])for(const z of [-.32,.32])add(.045,.73,.045,x,.365,z,metal);}
 else{world.upholstered(g,.45,.095,.46,0,.47,0,'#b5aa96');world.upholstered(g,.45,.4,.09,.19,.72,0,'#c9beaa').rotation.z=-.09;for(const x of [-.17,.17])for(const z of [-.17,.17])add(.025,.43,.025,x,.215,z,metal);}
}
