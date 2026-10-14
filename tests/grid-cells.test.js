import {test} from 'node:test';
import assert from 'node:assert/strict';
import {forEachSetGridCell} from '../client/world/grid-cells.js';

function set(grid,width,x,y){const index=y*width+x;grid[index>>3]|=1<<(index&7);}

test('forEachSetGridCell visits every interior bit once and preserves row-major order',()=>{
 const width=29,height=17,grid=new Uint8Array(Math.ceil(width*height/8));
 let seed=0x51f15e;const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/0x100000000;};
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)if(random()<.31)set(grid,width,x,y);
 const expected=[];for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const index=y*width+x;if(grid[index>>3]&(1<<(index&7)))expected.push([x,y]);}
 const actual=[],count=forEachSetGridCell(grid,width,height,(x,y)=>actual.push([x,y]));
 assert.equal(count,expected.length);assert.deepEqual(actual,expected);
});

test('forEachSetGridCell honors custom margins, empty grids, and map edges',()=>{
 const width=10,height=8,grid=new Uint8Array(Math.ceil(width*height/8));
 for(let y=0;y<height;y++)for(let x=0;x<width;x++)set(grid,width,x,y);
 const cells=[];forEachSetGridCell(grid,width,height,(x,y)=>cells.push([x,y]),2);
 assert.deepEqual(cells,Array.from({length:4},(_,row)=>Array.from({length:6},(_,column)=>[column+2,row+2])).flat());
 assert.equal(forEachSetGridCell(null,width,height,()=>{}),0);
 assert.equal(forEachSetGridCell(grid,3,2,()=>{},1),0);
});
