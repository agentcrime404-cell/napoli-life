// Prezzi e categorie sono definiti dal server, mai dal carrello inviato dal client.
export const CATALOG=[
 {id:'palette-jade',name:'Palette giada',type:'cosmetic',slot:'outfit',value:'jade',color:'#65d6a6',price:3,currency:'gems'},
 {id:'cap-gold',name:'Cappello dorato',type:'cosmetic',slot:'accessory',value:'cap',color:'#dfbd65',price:25},
 {id:'flower-red',name:'Fiore rosso',type:'cosmetic',slot:'accessory',value:'flower',price:20},
 {id:'jacket-sea',name:'Palette avatar mare',type:'cosmetic',slot:'outfit',value:'sea',color:'#52b4c8',price:35},
 {id:'plant',name:'Pianta mediterranea',type:'furniture',kind:'plant',price:15},
 {id:'chair',name:'Sedia',type:'furniture',kind:'seat',price:10},
 {id:'table',name:'Tavolo',type:'furniture',kind:'table',price:20},
 {id:'lamp',name:'Lampada',type:'furniture',kind:'lamp',price:15},
 {id:'sofa',name:'Divano',type:'furniture',kind:'sofa',price:30},
 {id:'bed',name:'Letto',type:'furniture',kind:'bed',price:30},
 {id:'picture',name:'Quadro del golfo',type:'furniture',kind:'picture',price:15},
 {id:'coffee',name:'Caffè virtuale',type:'food',room:'bar',price:2},
 {id:'pizza',name:'Margherita virtuale',type:'food',room:'pizzeria',price:5},
 {id:'pasta',name:'Spaghetti alle vongole virtuali',type:'food',room:'osteria',price:8},
 {id:'frittura',name:'Frittura di mare virtuale',type:'food',room:'vesuvio',price:9},
 {id:'genovese',name:'Pasta alla genovese virtuale',type:'food',room:'trattoria',price:7},
 {id:'baba',name:'Babà virtuale',type:'food',room:'panorama',price:4},
 {id:'burger',name:'Burger virtuale',type:'food',room:'burger',price:6},
 {id:'fries',name:'Patatine virtuali',type:'food',room:'burger',price:3},
 {id:'cap-red',name:'Cappellino rosso',type:'cosmetic',slot:'accessory',value:'cap',color:'#e5484d',price:15},
 {id:'palette-sunset',name:'Palette tramonto',type:'cosmetic',slot:'outfit',value:'sunset',color:'#ff8a5b',price:40},
 {id:'palette-night',name:'Palette notte',type:'cosmetic',slot:'outfit',value:'night',color:'#5b6cff',price:2,currency:'gems'}
];
// Moda: articoli generati da modelli × colori (oltre mille). Ogni articolo imposta uno slot dell'avatar.
export const COLORS=[['nero','#1f2226'],['bianco','#f2f2f2'],['grigio','#8a9099'],['blu navy','#1f3a6b'],['azzurro','#5fb6ff'],['rosso','#d93a3a'],['bordeaux','#7a1f2b'],['rosa','#ff7ab6'],['verde','#2f9e5b'],['oliva','#6b7a3a'],['giallo','#ffc928'],['arancio','#ff8a3d'],['beige','#d8c3a0'],['marrone','#7a5236'],['viola','#8a5cff'],['turchese','#2ec4c4'],['corallo','#ff6f61'],['cammello','#c19a6b'],['jeans','#3d5f8f'],['oro','#d4a73a']];
export const WEAR={
 top:{label:'Giacche e felpe',models:['Felpa','Giacca','Bomber','Cappotto','Giubbotto','Cardigan','Blazer','Piumino','Gilet','Trench','Giacca di pelle','Maglione'],base:30},
 pants:{label:'Pantaloni',models:['Jeans','Chino','Cargo','Tuta','Elegante','Shorts','Palazzo'],base:25},
 shoes:{label:'Scarpe',models:['Sneakers','Mocassini','Stivaletti','Running','Sandali','Décolleté','Anfibi','Slip-on'],base:28},
 hat:{label:'Cappelli',models:['Cappellino','Berretto','Borsalino','Pescatore','Coppola','Cowboy','Bandana','Fascia','Visiera'],base:18},
 bag:{label:'Borse',models:['Zaino','Tracolla','Marsupio','Shopper','Pochette','Bauletto','Borsone'],base:35},
 glasses:{label:'Occhiali',models:['Da sole','Tondi','Aviator','Vista','Sportivi','Cat-eye'],base:22},
 neck:{label:'Collane',models:['Catena','Perle','Pendente','Sciarpa','Foulard'],base:40},
 watch:{label:'Orologi',models:['Sportivo','Classico','Smart','Cronografo','Bracciale'],base:45}
};
export const WEAR_ITEMS=[];
for(const [slot,w] of Object.entries(WEAR))w.models.forEach((model,m)=>COLORS.forEach(([cname,hex],c)=>WEAR_ITEMS.push({id:`${slot}-${m}-${c}`,name:`${model} ${cname}`,type:'wear',slot,style:m,color:hex,price:w.base+m*5+(c%5)*3})));
// Barbiere: 18 tagli e 12 barbe (30 stili) più 12 colori di capelli.
export const HAIR_STYLES=['Originale','Rasato','Corto','Ciuffo','Cresta','Mohicano','Afro','Ricci','Lunghi','Coda','Chignon','Trecce','Caschetto','Undercut','Pompadour','Mullet','Codini','Calvo'];
export const BEARD_STYLES=['Nessuna','Barba corta','Barba lunga','Pizzetto','Baffi','Baffi a manubrio','Basette','Barba hipster','Mosca','Barba squadrata','Ancoraggio','Barbetta'];
export const HAIR_COLORS=[['Nero','#1c1a1a'],['Castano scuro','#3d2618'],['Castano','#6b4226'],['Biondo','#d9b46a'],['Biondo platino','#efe2b8'],['Rosso','#a5361f'],['Rame','#c26a2e'],['Grigio','#9a9a9a'],['Bianco','#e8e8e8'],['Blu','#2a6fd6'],['Rosa','#ff7ab6'],['Verde','#2f9e5b']];
export const BARBER_PRICE=15;
// Rooms dove si comprano cosmetici e arredi.
export const SHOP_ROOMS=['shop','mall','mall2'];
// Pacchetti a pagamento reale (Stripe). Importi in centesimi di euro, decisi solo dal server.
export const PACKS=[
 {id:'gems-10',name:'10 gemme',gems:10,coins:0,amount:99},
 {id:'coins-500',name:'500 monete',gems:0,coins:500,amount:199},
 {id:'gems-60',name:'60 gemme + 300 monete',gems:60,coins:300,amount:499}
];
export const ATM_RATE=40;
// Ville: acquisto definitivo o affitto settimanale, solo con monete di gioco.
export const VILLA_PRICE=5000,VILLA_RENT=400,VILLA_RENT_DAYS=7;
// Sala slot: fiches gratuite giornaliere, non acquistabili né convertibili (nessun gioco con denaro reale).
export const DAILY_FICHES=100,SLOT_BETS=[1,5,10];
export const SLOT_SYMBOLS=[{s:'🍋',w:30,x:3},{s:'🍒',w:25,x:5},{s:'🔔',w:18,x:10},{s:'⭐',w:12,x:15},{s:'7️⃣',w:8,x:30},{s:'💎',w:4,x:60}];
export function cleanSettings(s={}){const out={};for(const key of ['master','music','ambient','voice'])out[key]=Number.isFinite(s[key])?Math.max(0,Math.min(1,s[key])):.6;out.zoom=Number.isFinite(s.zoom)?Math.max(.65,Math.min(1.4,s.zoom)):1;return out;}
// Mobilità: monopattino e bici si sbloccano per sempre con le monete, gli altri mezzi si noleggiano a tempo.
export const VEHICLES=[
 {id:'monopattino',name:'Monopattino elettrico',emoji:'🛴',buy:250,speed:1.8,color:'#1f2937'},
 {id:'bici',name:'Bici da città',emoji:'🚲',buy:400,speed:1.7,color:'#0e7490'},
 {id:'scooter',name:'Scooter 125',emoji:'🛵',rent:60,minutes:15,speed:2.3,color:'#e11d48'},
 {id:'auto',name:'Utilitaria',emoji:'🚗',rent:120,minutes:15,speed:2.8,color:'#2563eb'},
 {id:'furgone',name:'Furgoncino',emoji:'🚐',rent:150,minutes:20,speed:2.5,color:'#f5f5f4'},
 {id:'cabrio',name:'Cabrio di lusso',emoji:'🏎️',rent:400,minutes:15,speed:3.2,color:'#facc15'}];
export const VEHICLE=Object.fromEntries(VEHICLES.map(v=>[v.id,v]));

// Distributori di bevande (HUMANA life 3D): nomi generici, niente marchi.
export const DRINKS=[{id:'acqua',name:'Acqua fresca',icon:'💧',price:1},{id:'aranciata',name:'Aranciata',icon:'🍊',price:2},{id:'gassosa',name:'Gassosa al limone',icon:'🍋',price:2},{id:'te',name:'Tè freddo alla pesca',icon:'🍑',price:2},{id:'chinotto',name:'Chinotto',icon:'🥤',price:2},{id:'energia',name:'Bibita energetica',icon:'⚡',price:3},{id:'caffe',name:'Caffè freddo',icon:'☕',price:2}];

// Jukebox nei locali (HUMANA life 3D): posizione nella sala, prezzo in monete, durata massima di un brano.
export const JUKEBOX_PRICE=5,JUKEBOX_MINUTES=6;const JB={x:14,y:2.6};
export const JUKEBOX={bar:JB,pizzeria:JB,osteria:JB,vesuvio:JB,trattoria:JB,panorama:JB,burger:JB,club:{x:2.2,y:2.6}};

// Negozi di mezzi (HUMANA life 3D): autosalone, moto e bici. I modelli somigliano a mezzi veri ma hanno nomi generici (niente marchi).
// "base" è il mezzo di partenza per guida e regole (auto, cabrio, scooter, bici); "model" è la forma disegnata nel 3D.
export const DEALERS=[
 {id:'auto',name:'Autosalone del Golfo',icon:'🚘',x:136,y:96,w:11,h:8,color:'#b3261e'},
 {id:'moto',name:'Moto e Scooter Vesuvio',icon:'🏍️',x:96,y:40,w:11,h:8,color:'#1d4e89'},
 {id:'bici',name:'Ciclofficina Partenope',icon:'🚲',x:36,y:104,w:11,h:8,color:'#1f6f50'}];
export const VEHICLES_3D=[
 {id:'a-500',shop:'auto',base:'auto',model:'fiat500',name:'Compatta Tonda',emoji:'🚗',buy:700,speed:2.7,color:'#8b9098'},{id:'a-panda',shop:'auto',base:'auto',model:'panda',name:'Compatta Quadra',emoji:'🚙',buy:600,speed:2.6,color:'#eceeee'},{id:'a-rossa',shop:'auto',base:'auto',model:'sportscar',name:'Sportiva Rossa',emoji:'🏎️',buy:3800,speed:3.6,color:'#a31621'},{id:'a-city',shop:'auto',base:'auto',model:'city',name:'Citycar Tre Porte',emoji:'🚗',buy:900,speed:2.7,color:'#f4f4ef'},
 {id:'a-berlina',shop:'auto',base:'auto',model:'sedan',name:'Berlina sportiva',emoji:'🚘',buy:1800,speed:3,color:'#1f3a6b'},
 {id:'a-suv',shop:'auto',base:'auto',model:'suv',name:'Fuoristrada 4x4',emoji:'🚙',buy:2600,speed:2.9,color:'#2b2f36'},
 {id:'a-gt',shop:'auto',base:'auto',model:'gt',name:'Granturismo a motore anteriore',emoji:'🏎️',buy:4200,speed:3.5,color:'#0b0b0f'},
 {id:'a-spider',shop:'auto',base:'cabrio',model:'super',name:'Spider scoperta',emoji:'🏎️',buy:3800,speed:3.4,color:'#c9ccd3'},
 {id:'a-coupe',shop:'auto',base:'auto',model:'coupe',name:'Berlinetta rossa da corsa',emoji:'🏎️',buy:6000,speed:3.9,color:'#c1121f'},
 {id:'a-wedge',shop:'auto',base:'auto',model:'wedge',name:'Supercar a cuneo',emoji:'🏎️',buy:7500,speed:4.1,color:'#f2c400'},
 {id:'m-50',shop:'moto',base:'scooter',model:'scooter',name:'Scooter 50',emoji:'🛵',buy:350,speed:2.2,color:'#2ec4c4'},
 {id:'m-epoca',shop:'moto',base:'scooter',model:'scooter',name:'Scooter d’epoca',emoji:'🛵',buy:700,speed:2.3,color:'#e9e1d2'},
 {id:'m-naked',shop:'moto',base:'scooter',model:'naked',name:'Moto naked',emoji:'🏍️',buy:1500,speed:3,color:'#2b2f36'},
 {id:'m-xadv',shop:'moto',base:'scooter',model:'xadv',name:'Maxi Scooter Sportivo',emoji:'🛵',buy:2400,speed:3.1,color:'#2b2f36'},{id:'m-enduro',shop:'moto',base:'scooter',model:'africa',name:'Maxi Enduro Bimotore',emoji:'🏍️',buy:2200,speed:3.2,color:'#f4f4ef'},
 {id:'m-cruiser',shop:'moto',base:'scooter',model:'cruiser',name:'Custom da viaggio',emoji:'🏍️',buy:2600,speed:2.9,color:'#7a1f2b'},
 {id:'m-sport',shop:'moto',base:'scooter',model:'sport',name:'Sportiva carenata',emoji:'🏍️',buy:3400,speed:3.7,color:'#c1121f'},
 {id:'b-bmx',shop:'bici',base:'bici',model:'bmx',name:'BMX',emoji:'🚲',buy:300,speed:1.8,color:'#e5484d'},
 {id:'b-mtb',shop:'bici',base:'bici',model:'mtb',name:'Mountain bike',emoji:'🚵',buy:450,speed:1.9,color:'#2f9e5b'},
 {id:'b-corsa',shop:'bici',base:'bici',model:'corsa',name:'Bici da corsa',emoji:'🚴',buy:700,speed:2.2,color:'#ffc928'},
 {id:'b-cargo',shop:'bici',base:'bici',model:'cargo',name:'Bici da passeggio con cestino',emoji:'🚲',buy:380,speed:1.7,color:'#ff7ab6'},
 {id:'b-ebike',shop:'bici',base:'bici',model:'ebike',name:'Bici elettrica',emoji:'🚲',buy:950,speed:2.4,color:'#3b4250'}];
for(const v of VEHICLES_3D)VEHICLE[v.id]=v;

// Banca digitale del telefono (HUMANA life 3D).
export const BANK_NAME='NPL Bank';

// Negozi dentro il centro commerciale (HUMANA life 3D): stanno ai banconi della sala. kind: fashion = abiti, shop = accessori e arredi, sim = scelta del numero di telefono.
export const MALL_SHOPS=[{id:'abiti',name:'Abbigliamento',icon:'👗',kind:'fashion',slots:['top','pants','hat'],x:8,y:3},{id:'sim',name:'Negozio SIM',icon:'📱',kind:'sim',x:3,y:7},{id:'accessori',name:'Accessori e arredi',icon:'🕶️',kind:'shop',x:13,y:7},
 {id:'scarpe',room:'mall2',name:'Scarpe e borse',icon:'👟',kind:'fashion',slots:['shoes','bag'],x:8,y:3},{id:'gioielli',room:'mall2',name:'Orologi e gioielli',icon:'⌚',kind:'fashion',slots:['watch','neck','glasses'],x:3,y:7},{id:'casa',room:'mall2',name:'Casa e arredo',icon:'🛋️',kind:'shop',x:13,y:6}];
export const SIM_PRICE=50;
// Noleggio barche: un giro guidato nel golfo. dock = dove si sale (a terra), route = punti in mare (andata; il ritorno è lo stesso percorso al contrario).
export const BOAT_PRICE=40,BOAT_SPEED=9;
export const BOATS={lungomare:{name:'Noleggio barche del Golfo',dock:{x:19,y:17},route:[[13,11],[2,2],[-34,-12],[-70,14],[-52,46],[-14,30]]},
 mergellina:{name:'Noleggio barche Mergellina',dock:{x:281,y:311},speed:22,route:[[292,312],[364,348],[452,364],[720,336],[728,336],[744,356],[756,556],[1500,520],[2350,620],[3150,720]]}};

// Luna park di HUMANA life 3D (il 2D non lo usa): biglietteria con il giostraio e le giostre su cui si sale. Prezzi in monete.
// Misure e percorsi stanno qui perché li usano sia il server (dove si siede chi sale) sia il disegno 3D delle giostre.
export const FUNFAIR={booth:{x:153,y:54},rides:{
 'ruota-panoramica':{name:'Ruota panoramica',emoji:'🎡',price:8,x:162,y:40,w:9,seconds:40,laps:2,note:'Cabina chiusa e vista sul golfo dall’alto'},
 'giostra-cavalli':{name:'Giostra dei cavalli',emoji:'🎠',price:5,x:162,y:54,w:7,seconds:28,laps:5,note:'Cavalli che salgono e scendono'},
 'calcinculo':{name:'Calcinculo (seggiolini volanti)',emoji:'🎪',price:6,x:162,y:68,w:8,seconds:30,laps:6,note:'Seggiolini che volano in tondo'},
 'tazze':{name:'Tazze che girano',emoji:'☕',price:5,x:176,y:68,w:7,seconds:26,laps:4,note:'Una tazza tutta per te'}}};
export const rideGeom=art=>{const R=FUNFAIR.rides[art];if(!R)return null;const S=Math.max(8,R.w);
 if(art==='ruota-panoramica'){const r=S*.48;return {S,r,cy:r+1.4,rho:r};}
 if(art==='giostra-cavalli')return {S,rho:S*.46*.72};
 if(art==='calcinculo'){const top=S*.42*.9;return {S,rho:top+3.4*Math.sin(.3),top,chain:3.4,tilt:.3};}
 return {S,rho:S*.46*.66};};
// Percorso di chi sale: lo stesso numero di punti per ogni giro; il server li percorre in modo uniforme nel tempo (ride.uniform).
export function ridePlan(art){const R=FUNFAIR.rides[art],G=rideGeom(art);if(!R)return null;const N=40,pts=[],wheel=art==='ruota-panoramica',a0=wheel?Math.PI:0,da=Math.PI*2*R.laps;
 for(let k=0;k<=N*R.laps;k++){const a=a0+Math.PI*2*k/N;pts.push(wheel?{x:R.x+G.rho*Math.sin(a),y:R.y}:{x:R.x+G.rho*Math.cos(a),y:R.y+G.rho*Math.sin(a)});}
 return {pts,a0,da,to:{x:R.x-G.S/2-1.8,y:R.y+(wheel?3.5:0),name:R.name}};}

// Arena paintball (solo HUMANA life 3D): campo recintato nello spiazzo a est del Lungomare, con squadre rossa e blu, armi a vernice (nessun sangue)
// e chiosco-armeria all'ingresso. Si entra solo dal chiosco (il server ti sposta dentro); fuori dal campo nessuno può essere colpito.
// Ostacoli = [x,y,larghezza,altezza,colore]: fermano i passi e i colpi.
export const ARENA={x0:150,y0:80,x1:182,y1:118,kiosk:{x:147.2,y:110.5},exit:{x:148.2,y:114},target:15,hp:100,downSec:4,reward:10,
 weapons:{
  pistola:{name:'Pistola a vernice',emoji:'🔫',rent:0,dmg:34,cd:.33,mag:12,reload:1.6,range:22,spread:2,assist:6,note:'Leggera e precisa, 3 colpi per eliminare'},
  fucile:{name:'Fucile a vernice',emoji:'🎯',rent:5,dmg:70,cd:1.1,mag:5,reload:2.4,range:38,spread:.4,assist:4,note:'Lento ma a lunga distanza, 2 colpi'},
  mitraglietta:{name:'Mitraglietta a vernice',emoji:'💥',rent:8,dmg:14,cd:.11,mag:40,reload:2.2,range:18,spread:6,assist:5,note:'Raffica veloce, poco precisa'}},
 spawns:{red:[[152.6,88],[152.6,92],[152.6,96],[152.6,102],[152.6,106],[152.6,110]],blue:[[179.4,88],[179.4,92],[179.4,96],[179.4,102],[179.4,106],[179.4,110]]},
 obstacles:[[163,95.5,6,7,'#2ec4b6'],[155,88,4,2.2,'#ffb703'],[173,88,4,2.2,'#ffb703'],[155,108.8,4,2.2,'#ffb703'],[173,108.8,4,2.2,'#ffb703'],
  [158,97,2.2,5,'#3a86ff'],[171.8,97,2.2,5,'#e63946'],[154.4,92,1.6,5,'#e63946'],[154.4,101,1.6,5,'#e63946'],[176,92,1.6,5,'#3a86ff'],[176,101,1.6,5,'#3a86ff'],
  [160,84,2,2,'#8338ec'],[170,84,2,2,'#8338ec'],[160,113,2,2,'#8338ec'],[170,113,2,2,'#8338ec'],[165,87.5,2,2,'#ff8a3d'],[165,109.5,2,2,'#ff8a3d']]};
// Rettangoli [x0,y0,x1,y1] che bloccano chi cammina: recinto (spesso mezzo metro) e ostacoli. Registrati in EXTRA_BLOCKS di shared/world.js (solo 3D).
export const arenaBlocks=()=>{const A=ARENA,t=.5;return [[A.x0-t,A.y0-t,A.x1+t,A.y0],[A.x0-t,A.y1,A.x1+t,A.y1+t],[A.x0-t,A.y0,A.x0,A.y1],[A.x1,A.y0,A.x1+t,A.y1],...A.obstacles.map(([x,y,w,h])=>[x,y,x+w,y+h])];};

// ---- Benzina, distributori, polizia, servizio ai banconi (solo HUMANA life 3D; il 2D non li usa) ----
// Benzina: serbatoio 100, si consuma col movimento dei mezzi a motore (non bici e monopattino); a zero il mezzo non va più.
export const FUEL={motor:['auto','cabrio','furgone','scooter'],tank:100,perMeter:.05,price:.5,seconds:4,low:25,zone:7};
// Distributori: lotto (x,y,w,h) accanto a una strada; face = lato della strada ('S' strada a sud, 'N' a nord).
export const GAS=[{id:'g1',name:'Distributore Golfo Nord',x:108.5,y:36.5,w:11,h:8,face:'S'},{id:'g2',name:'Distributore Partenope',x:14,y:70,w:11,h:8,face:'S'}];
export const gasGeom=g=>{const s=g.face==='S'?1:-1,cx=g.x+g.w/2,iy=s>0?g.y+g.h-3.3:g.y+3.3;return {cx,s,island:{x:cx,y:iy},pumps:[-3.8,0,3.8].map(d=>({x:cx+d,y:iy})),shop:[cx-4,s>0?g.y+.2:g.y+g.h-2.7,cx+4,s>0?g.y+2.7:g.y+g.h-.2],att:{x:cx+2.2,y:iy-s*1.3}};};
// Caserme di polizia: edificio sul lato lontano dalla strada, due auto di servizio davanti, bandiera, due agenti al portone.
export const POLICE=[{id:'p1',name:'Caserma di Polizia Centro',x:116.5,y:17.5,w:12,h:9,face:'S'},{id:'p2',name:'Caserma di Polizia Vomero',x:26,y:27.5,w:12,h:9,face:'S'}];
export const policeGeom=c=>({door:{x:c.x+c.w/2,y:c.y+5.9},build:[c.x+1,c.y,c.x+c.w-1,c.y+5],cars:[[c.x+.8,c.y+6.4,c.x+5.2,c.y+8.4],[c.x+c.w-5.2,c.y+6.4,c.x+c.w-.8,c.y+8.4]],guards:[{x:c.x+c.w/2-1.3,y:c.y+6.1},{x:c.x+c.w/2+1.3,y:c.y+6.1}],flag:{x:c.x+c.w/2+3.2,y:c.y+6.4}});
// Banconi dei locali: stesso punto in tutte le sale (16x14): il personale sta dietro, i clienti davanti.
export const COUNTER={x:8,y:3},STAFF_SPOT={x:8,y:1.7};
// Menu: kind drink|food; alc = quanto sale (o scende, se negativo) il livello di alcol 0-100. Dopo una bevanda alcolica si resta "brilli" 50 s (il livello scende a zero in 50 s).
export const ALCOHOL_SECONDS=50;
const D=(id,name,icon,price,alc=0)=>({id,name,icon,price,kind:'drink',alc}),Fd=(id,name,icon,price)=>({id,name,icon,price,kind:'food',alc:0});
const BEER=D('birra','Birra alla spina','🍺',4,30),WINE=D('vino','Calice di vino','🍷',5,35),SPRITZ=D('spritz','Spritz','🍹',6,35),LIMON=D('limoncello','Limoncello','🍋',5,50),WATER=D('acqua','Acqua fresca','💧',1,-4),COLA=D('aranciata','Aranciata','🍊',2),COFFEE=D('caffe','Caffè','☕',2,-8);
export const MENU={
 bar:[COFFEE,Fd('cornetto','Cornetto','🥐',2),WATER,COLA,BEER,WINE,SPRITZ,LIMON],
 pizzeria:[Fd('pizza','Pizza margherita','🍕',5),WATER,COLA,BEER,WINE],
 osteria:[Fd('pasta','Pasta alla napoletana','🍝',8),WATER,WINE,BEER,LIMON],
 vesuvio:[Fd('frittura','Frittura di paranza','🍤',9),WATER,COLA,WINE,SPRITZ],
 trattoria:[Fd('genovese','Genovese','🍲',7),WATER,WINE,BEER,COFFEE],
 panorama:[Fd('baba','Babà','🍰',4),COFFEE,WATER,SPRITZ,WINE],
 burger:[Fd('burger','Hamburger','🍔',6),Fd('fries','Patatine','🍟',3),COLA,WATER,BEER],
 club:[WATER,D('energia','Bibita energetica','⚡',3),BEER,SPRITZ,D('cocktail','Cocktail della casa','🍸',8,40),LIMON]};
export const STAFF_ROLE={bar:'Barista',pizzeria:'Pizzaiolo',osteria:'Oste',vesuvio:'Cuoco',trattoria:'Cameriere',panorama:'Cameriera',burger:'Addetto al banco',club:'Barman'};
// Rettangoli [x0,y0,x1,y1] che bloccano i passi: arena, distributori (negozio, pompe, pali) e caserme (edificio, auto, bandiera).
export const solidBlocks=()=>{const out=[...arenaBlocks()];
 for(const g of GAS){const G=gasGeom(g);out.push(G.shop);for(const p of G.pumps)out.push([p.x-.45,p.y-.6,p.x+.45,p.y+.6]);for(const dx of [-6,6])out.push([G.cx+dx-.2,G.island.y-1.9,G.cx+dx+.2,G.island.y-1.5]);}
 for(const c of POLICE){const P=policeGeom(c);out.push(P.build,...P.cars,[P.flag.x-.2,P.flag.y-.2,P.flag.x+.2,P.flag.y+.2]);}
 out.push(esiGeom(ESI).build,hospGeom(HOSPITAL).build);for(const m of MODERN)out.push(...modernGeom(m).houses);
 return out;};
// Furti e prigione (solo HUMANA life 3D): si può prendere tutto senza pagare, ma se un agente ti vede finisci in cella per un minuto, poi ti liberano.
export const PRISON={escape:60,seconds:60,catch:.8,delay:[12,18]};
export const prisonCell=c=>{const P=policeGeom(c);return {x:(P.build[0]+P.build[2])/2,y:(P.build[1]+P.build[3])/2};};
export const STEAL_PATHS=['/api/purchase','/api/barber','/api/vending','/api/service/order','/api/fuel/refill','/api/vehicle/buy','/api/vehicle/rent'];
export const JAIL_BLOCK=[...STEAL_PATHS,'/api/vehicle','/api/arena','/api/giostra','/api/boat','/api/home/enter'];
export const CAR_BASES=['auto','cabrio','furgone'];
// ESI · Raccolta rifiuti (solo HUMANA life 3D): il deposito a ovest e i camion che passano per le strade di mattina; gli operatori svuotano i bidoni e spazzano.
export const ESI={id:'esi',name:'ESI · Raccolta rifiuti',x:26,y:76,w:12,h:8};
export const esiGeom=e=>({build:[e.x+1,e.y,e.x+e.w-1,e.y+4.5],door:{x:e.x+e.w/2,y:e.y+5.6},yard:[e.x+.6,e.y+5,e.x+e.w-.6,e.y+e.h-.2]});
// Ospedale del Golfo (solo HUMANA life 3D) e mercato rionale (evento di giorno, nell'isolato centrale-ovest).
export const HOSPITAL={id:'hosp',name:'Ospedale del Golfo',x:68,y:118,w:14,h:10};
export const hospGeom=h=>({build:[h.x+1,h.y,h.x+h.w-1,h.y+5.8],door:{x:h.x+h.w/2,y:h.y+7},bays:[[h.x+1,h.y+7.4,h.x+4.5,h.y+9.6],[h.x+h.w-4.5,h.y+7.4,h.x+h.w-1,h.y+9.6]]});
export const MARKET={name:'Mercato rionale',x:70,y:98,w:12,h:7};
// Residenze moderne (solo HUMANA life 3D): due gruppi di case bianche a tetto piatto con giardino e piscina, nella zona est.
export const MODERN=[{id:'mod1',x:151,y:11,w:16,h:9,name:'Residenze moderne Nord'},{id:'mod2',x:155,y:26,w:16,h:9,name:'Residenze moderne Est'}];
export const modernGeom=m=>({houses:[[m.x+1,m.y+.5,m.x+6.5,m.y+5],[m.x+8.8,m.y+1,m.x+15,m.y+5.5]],pool:[m.x+2,m.y+6.2,m.x+6.5,m.y+8.4]});
// Mestieri "roleplay" (stile FiveM): turno di servizio con stipendio ogni RP.payEvery secondi; la polizia dei giocatori arresta i ricercati e fa multe.
export const WORKS={polizia:{name:'Polizia',icon:'👮',salary:60,desc:'Ricevi gli allarmi dei furti, insegui i ricercati, arrestali e fai multe.'},medico:{name:'Paramedico 118',icon:'🚑',salary:55,desc:'Soccorri chi è a terra: arrivano le chiamate del 118, rianima i feriti.'},meccanico:{name:'Meccanico',icon:'🔧',salary:45,desc:'Ripara e rifornisci i mezzi degli altri giocatori.'},taxi:{name:'Taxi',icon:'🚕',salary:40,desc:'Porta in giro gli altri giocatori con la tua auto.'}};
export const RP={payEvery:300,reach:4,chase:90,arrestReward:150,fine:[20,500],fineCut:.2,downSeconds:120,faintAlcohol:80,reviveReward:120,hospitalFee:50,callEvery:20,breakEvery:2000,breakChance:.1,repairFee:60,repairReward:40,breakAuto:300,towFee:80,mechFuel:50,mechFuelFee:25,taxiBase:10,taxiPerKm:60};
// Rapine (stile FiveM): dentro un locale, con la modalità furto accesa, «Rapina la cassa» e si resta dentro sec secondi. Bottino in monete (loot = da…a);
// cool = secondi di pausa prima che lo stesso tipo di locale si possa rapinare di nuovo. Le ville private non si rapinano.
export const HEIST_TIERS={small:{sec:30,loot:[120,260],cool:480,label:'la cassa'},big:{sec:45,loot:[300,600],cool:900,label:'la cassa'},bank:{sec:90,loot:[900,1600],cool:1800,label:'il caveau'}};
export const HEISTS={bar:'small',pizzeria:'small',shop:'small',burger:'small',osteria:'small',vesuvio:'small',trattoria:'small',panorama:'small',fashion:'small',barber:'small',club:'big',casino:'big',mall:'big',bank:'bank'};
// Zaino (stile FiveM): oggetti da usare, dare a un giocatore vicino o buttare. Si comprano nella Bottega Marina / Centro Commerciale (type 'item')
// e pesano (kg): lo zaino ne porta al massimo BAG.max. use: 'drink'/'food' = si consuma con l'animazione del locale (alc come nei bar), 'fuel' = benzina al mezzo, 'gift' = da regalare.
export const BAG={max:20,slots:20,reach:3,fuel:40};
export const BAG_ITEMS=[
 {id:'zaino-birra',name:'Birra',icon:'🍺',type:'item',price:4,kg:.5,use:'drink',alc:30,desc:'Si beve ovunque. Attenzione: fa girare la testa.'},
 {id:'zaino-acqua',name:'Bottiglia d’acqua',icon:'💧',type:'item',price:1,kg:.5,use:'drink',alc:-40,desc:'Rinfresca e fa passare la sbornia.'},
 {id:'zaino-caffe',name:'Caffè da asporto',icon:'☕',type:'item',price:2,kg:.2,use:'drink',alc:-25,desc:'Un espresso per svegliarsi.'},
 {id:'zaino-panino',name:'Panino',icon:'🥪',type:'item',price:3,kg:.3,use:'food',alc:0,desc:'Un panino napoletano da mangiare per strada.'},
 {id:'zaino-tanica',name:'Tanica di benzina',icon:'⛽',type:'item',price:25,kg:5,use:'fuel',desc:'+'+40+'% di benzina al tuo mezzo, ovunque ti trovi.'},
 {id:'zaino-rosa',name:'Rosa rossa',icon:'🌹',type:'item',price:5,kg:.1,use:'gift',desc:'Da regalare a qualcuno di speciale.'}];
CATALOG.push(...BAG_ITEMS);
// Locali da comprare e gestire (stile FiveM): prezzo per tipo di locale, cut = parte della spesa dei clienti che va nella cassa del proprietario,
// passive = monete ogni every secondi per ogni locale (proprietario in gioco), sell = quota restituita se si rivende.
export const BIZ={price:{bar:2500,pizzeria:3000,trattoria:3500,osteria:3500,vesuvio:4000,panorama:4500,burger:2500,shop:3000,fashion:4000,barber:2000,club:6000,casino:8000},cut:.2,passive:40,every:600,sell:.5};
// Gang (stile FiveM): price = costo per fondarla, max membri, cut = parte del bottino delle rapine dei membri che va nella cassa della gang, reach = metri per invitare.
export const GANG={price:1000,max:8,cut:.1,reach:6,colors:['#e11d48','#2563eb','#16a34a','#f59e0b','#7c3aed','#0f172a','#ec4899','#06b6d4']};
