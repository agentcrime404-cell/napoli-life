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
