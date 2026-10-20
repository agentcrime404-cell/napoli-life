import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createBuildingEdgeIndex} from '../client/world/building-edge-index.js';

const map=JSON.parse(readFileSync('client/assets/world/napoli/map/mergellina.json','utf8'));
function reference(buildings,x,y){
 let best=null,bestSq=64;
 for(const building of buildings){const points=building.p||[];for(let i=0;i<points.length;i++){
  const a=points[i],c=points[(i+1)%points.length],dx=c[0]-a[0],dy=c[1]-a[1],lenSq=dx*dx+dy*dy;
  if(lenSq<1)continue;
  const t=Math.max(.15,Math.min(.85,((x-a[0])*dx+(y-a[1])*dy)/lenSq)),fx=a[0]+dx*t,fy=a[1]+dy*t,sq=(fx-x)**2+(fy-y)**2;
  if(sq<bestSq){bestSq=sq;let nx=-dy/Math.sqrt(lenSq),ny=dx/Math.sqrt(lenSq);if(nx*(x-fx)+ny*(y-fy)<0){nx=-nx;ny=-ny;}best={x:fx,y:fy,nx,ny};}
 }}
 return best;
}

test('l’indice spaziale dei fronti conserva i risultati della ricerca completa sulla mappa OSM',()=>{
 const nearest=createBuildingEdgeIndex(map.buildings),queries=[];
 let seed=0x2f41a9;
 const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/0x100000000;};
 const points=map.buildings.flatMap(b=>b.p||[]),xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
 const minX=Math.min(...xs),maxX=Math.max(...xs),minY=Math.min(...ys),maxY=Math.max(...ys);
 for(let i=0;i<300;i++)queries.push([minX+random()*(maxX-minX),minY+random()*(maxY-minY)]);
 for(let i=0;i<120;i++){
  const building=map.buildings[Math.floor(random()*map.buildings.length)],polygon=building.p||[];
  if(polygon.length<2)continue;
  const a=polygon[Math.floor(random()*polygon.length)],b=polygon[(polygon.indexOf(a)+1)%polygon.length],dx=b[0]-a[0],dy=b[1]-a[1],len=Math.hypot(dx,dy);
  if(len<1)continue;
  const t=.15+random()*.7,side=random()<.5?-1:1,distance=random()*7.9;
  queries.push([a[0]+dx*t-dy/len*distance*side,a[1]+dy*t+dx/len*distance*side]);
 }
 queries.push([minX-100,minY-100],[maxX+100,maxY+100],[NaN,0],[Infinity,0]);
 for(const [x,y] of queries){
  const actual=nearest(x,y),expected=Number.isFinite(x)&&Number.isFinite(y)?reference(map.buildings,x,y):null;
  assert.equal(actual===null,expected===null,`presenza fronte per (${x}, ${y})`);
  if(!actual)continue;
  for(const key of ['x','y','nx','ny'])assert.ok(Math.abs(actual[key]-expected[key])<1e-10,`${key} diverso in (${x}, ${y}): ${actual[key]} vs ${expected[key]}`);
 }
});
