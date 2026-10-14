import {test} from 'node:test';
import assert from 'node:assert/strict';
import {TerrainSampler} from '../client/world/terrain-sampler.js';

function referenceContains(poly,x,y){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const p=poly[i],q=poly[j];if((p[1]>y)!==(q[1]>y)&&x<(q[0]-p[0])*(y-p[1])/(q[1]-p[1])+p[0])inside=!inside;}return inside;}
function referenceDistance(points,x,y,limit){let best=limit*limit;for(const p of points){const dx=p[0]-x,dy=p[1]-y;best=Math.min(best,dx*dx+dy*dy);}return Math.sqrt(best);}

test('TerrainSampler conserva il poligono e la distanza dalla costa del calcolo completo',()=>{
 const coast=[[-40,-20],[-12,-7],[15,2],[48,26],[72,64],[95,82]],poly=[...coast,[130,-110],[-120,-110],[-120,-5]],sampler=new TerrainSampler(poly,coast,{cellSize:32,distanceLimit:55});
 for(let y=-130;y<=110;y+=7)for(let x=-140;x<=145;x+=9){
  assert.equal(sampler.contains(x,y),referenceContains(poly,x,y),`terra a ${x},${y}`);
  assert.ok(Math.abs(sampler.coastDistance(x,y)-referenceDistance(coast,x,y,55))<1e-9,`costa a ${x},${y}`);
 }
 for(const [x,y] of coast)assert.equal(sampler.coastDistance(x,y),0);
});
