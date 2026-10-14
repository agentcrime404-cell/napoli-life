import test from 'node:test';
import assert from 'node:assert/strict';
import {CollisionGrid} from '../client/world/collision-grid.js';

function linear(source,x,z,r){
 for(const q of source.r)if(x>q[0]-r&&x<q[2]+r&&z>q[1]-r&&z<q[3]+r)return true;
 for(const q of source.c){const dx=x-q[0],dz=z-q[1],l=q[2]+r;if(dx<l&&dx>-l&&dz<l&&dz>-l&&dx*dx+dz*dz<l*l)return true;}
 return false;
}

test('collision grid matches exact checks across cell edges and random positions',()=>{
 const source={c:[[-16,0,.5],[0,16,2.4],[31.5,-31.5,5],[80,80,0]],r:[[-40,-2,-10,2],[15.9,15.9,32,32],[99,90,89,100]]};
 const grid=new CollisionGrid(source);let seed=92831;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
 const radii=[0,.05,.3,.55];
 for(let i=0;i<20000;i++){const x=(random()-.5)*240,z=(random()-.5)*240,r=radii[i%radii.length];assert.equal(grid.blocked(x,z,r),linear(source,x,z,r),'mismatch at '+x+', '+z+', r='+r);}
});

test('collision grid indexes appended objects incrementally',()=>{
 const source={c:[[1,1,.4]],r:[]},grid=new CollisionGrid(source);assert.equal(grid.blocked(1,1),true);
 source.c.push([45,-30,1.2]);source.r.push([70,70,74,74]);
 assert.equal(grid.blocked(45,-30),true);assert.equal(grid.blocked(72,72),true);assert.equal(grid.blocked(30,-30),false);
});

test('collision grid returns the exact nearby rectangles for a camera ray broad phase',()=>{
 const source={c:[],r:[[-40,-2,-10,2],[15.9,15.9,32,32],[99,90,89,100],[-3,40,4,60]]},grid=new CollisionGrid(source);
 const intersects=(q,a,b,c,d,p)=>Math.min(q[0],q[2])-p<=c&&Math.max(q[0],q[2])+p>=a&&Math.min(q[1],q[3])-p<=d&&Math.max(q[1],q[3])+p>=b;
 for(const [a,b,c,d] of [[-25,-1,-20,1],[0,0,20,20],[93,94,100,96],[-10,48,10,52]]){
  const actual=grid.queryRect(a,b,c,d,.5),expected=source.r.filter(q=>intersects(q,a,b,c,d,.5));assert.deepEqual(new Set(actual),new Set(expected));
 }
 source.r.push([200,200,210,210]);assert.deepEqual(grid.queryRect(198,198,201,201,.5),[source.r.at(-1)]);
});

test('camera broad phase fills caller-owned reusable buffers without duplicates',()=>{
 const first=[0,0,12,12],second=[10,0,24,12],source={c:[],r:[first,second]},grid=new CollisionGrid(source),output=[['stale']],seen=new Set(['stale']);
 assert.equal(grid.queryRectInto(8,3,14,9,.5,output,seen),output);
 assert.deepEqual(new Set(output),new Set([first,second]));assert.equal(output.length,2);assert.equal(seen.size,2);
 const oldOutput=output,oldSeen=seen;grid.queryRectInto(100,100,102,102,.5,output,seen);
 assert.equal(output,oldOutput);assert.equal(seen,oldSeen);assert.deepEqual(output,[]);assert.equal(seen.size,0);
});
