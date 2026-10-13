// Città in VISTA FRONTALE: costa dritta in alto (mare, Castel dell'Ovo e Vesuvio sullo sfondo), spiaggia, lungomare, viale,
// e file di edifici rivolti verso chi guarda (il golfo alle spalle). Coordinate in metri: x verso destra, y verso il basso.
// Modalità del mondo condivisa (server e client): false = vista isometrica originale, true = vista frontale.
export const MODE={front:false};
export const F={T:38,K:24,SEA:30,BEACH:38,PROM:46,AVE:54,CITY_W:440,CITY_H:220};
export const fproj=(x,y)=>({x:x*F.T,y:y*F.K});
export const funproj=(X,Y)=>({x:X/F.T,y:Y/F.K});
// File di edifici: il fronte (porta) è sul bordo inferiore; sotto ogni fila passa una strada con marciapiedi.
export const ROWS=[78,128,178];
const STREET=8,BLOCK=60;
export const isRail=(x,y)=>Math.abs(y-F.BEACH)<.35&&!isStair(x);
export const isStair=x=>Math.abs(((x%40)+40)%40-20)<2.2;
export function surfaceFront(x,y){
 if(y<F.SEA)return 'water';if(y<F.BEACH)return 'sand';if(y<F.PROM)return 'stone';if(y<F.AVE)return 'roadline';if(y<F.AVE+2)return 'sidewalk';
 if(x>=F.CITY_W||y>=F.CITY_H)return 'grass';
 for(const r of ROWS){if(y>=r&&y<r+2)return 'sidewalk';if(y>=r+2&&y<r+2+STREET-2)return 'roadline';if(y>=r+STREET&&y<r+STREET+2)return 'sidewalk';}
 const bx=((x%BLOCK)+BLOCK)%BLOCK;if(y>=F.AVE+2){if(bx>=BLOCK-6&&bx<BLOCK-1)return 'road';if(bx>=BLOCK-7&&bx<BLOCK)return 'sidewalk';}
 if(x>=170&&x<230&&y>=F.AVE+2&&y<ROWS[0])return 'tiles';
 return 'cobble';}
// Edifici (stessi id della città originale: si entra negli stessi interni). w×d = larghezza × profondità in metri.
const B=(id,art,name,w,d,extra={})=>({id,art,name,w,d,...extra});
const ROW_A=[B('bar','bar','Bar Vele',10,7),B('pizzeria','pizzeria','Pizzeria Vesuviana',10,7),B('shop','negozio','Emporio Marina',9,6),B('club','discoteca','Orbita · Discoteca',10,7),B('barber','barbiere','Barbiere Raffa',9,6),B('bank','banca','Banca Partenopea',14,8),B('burger','burger','Molo Burger',12,7),B('casino','slot','Sala Fortuna',14,10)];
const ROW_B=[B('osteria','osteria','Osteria Blu',14,9),B('vesuvio','vesuvio','Ristorante Cratere',14,9),B('fashion','moda','Moda Vela',18,12),B('mall','centro-commerciale','Galleria Levante',30,18),B('trattoria','trattoria','Trattoria del Borgo',14,9),B('panorama','panorama','Ristorante Belvedere',14,9)];
const ROW_C=[0,1,2,3].map(i=>B('villa'+i,'villa-'+(i+1),'Villa',14,10,{interior:'villa',private:true})).concat([1,2,3,4].map(i=>B('residence'+(i+90),'palazzo-'+i,'Palazzo',12,10,{enterable:false})));
// Posiziona una fila: da sinistra a destra, saltando le strade verticali.
function place(list,front){const out=[];let x=6;for(const b of list){let bx=((x%BLOCK)+BLOCK)%BLOCK;if(bx+b.w>BLOCK-8){x+=BLOCK-bx+1;}out.push({...b,fx:x,fy:front-b.d,fw:b.w,fh:b.d});x+=b.w+3;}return out;}
export function frontBuildings(){return [...place(ROW_A,ROWS[0]),...place(ROW_B,ROWS[1]),...place(ROW_C,ROWS[2])].map(b=>({id:b.id,name:b.name,proc:true,style:'front',fart:'f-'+b.art,art:b.art,fx:b.fx,fy:b.fy,fw:b.fw,fh:b.fh,height:b.d*14,front:true,...(b.enterable===false?{enterable:false}:{}),...(b.interior?{interior:b.interior}:{}),...(b.private?{private:true}:{})}));}
// Arredo: palme, lampioni e panchine sul lungomare; statua e fontana in piazza; alberi lungo i viali.
export function frontProps(){const p=[],add=(id,kind,x,y,r,extra={})=>p.push({id,kind,x,y,r,...extra});
 for(let x=8;x<F.CITY_W;x+=12){add('fpalm'+x,'palm',x,F.BEACH+2,.4);add('flamp'+x,'lamp',x+6,F.PROM-1.2,.2);if(!isStair(x+3))add('fbench'+x,'bench',x+3,F.BEACH+1.4,.65);}
 add('fstatue','statue',200,64,.9);add('ffountain','fountain',188,66,1.2);add('ffountain2','fountain',212,66,1.2);
 for(const r of ROWS)for(let x=4;x<F.CITY_W;x+=20){const bx=((x%BLOCK)+BLOCK)%BLOCK;if(bx<BLOCK-9)add('ftree'+r+'-'+x,'tree',x,r+STREET+3,.5);}
 return p;}
export const FRONT_SPAWN={x:200,y:72};
