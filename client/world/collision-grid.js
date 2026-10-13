// Broad-phase index for fixed world collision data. Exact narrow-phase math stays unchanged.
const CELL_SIZE=16;
const MAX_QUERY_RADIUS=.6; // Largest current caller radius is .55 m.
const key=(x,z)=>x+','+z;

export class CollisionGrid {
 constructor(source,cellSize=CELL_SIZE){
  this.source=source||{c:[],r:[]};this.cellSize=cellSize;this.circles=new Map();this.rects=new Map();this.circleCount=0;this.rectCount=0;this.sync();
 }
 insert(map,minX,minZ,maxX,maxZ,item){
  const size=this.cellSize,fromX=Math.floor((minX-MAX_QUERY_RADIUS)/size),toX=Math.floor((maxX+MAX_QUERY_RADIUS)/size),fromZ=Math.floor((minZ-MAX_QUERY_RADIUS)/size),toZ=Math.floor((maxZ+MAX_QUERY_RADIUS)/size);
  for(let x=fromX;x<=toX;x++)for(let z=fromZ;z<=toZ;z++){const k=key(x,z);let bucket=map.get(k);if(!bucket)map.set(k,bucket=[]);bucket.push(item);}
 }
 sync(){
  const circles=this.source.c||[],rects=this.source.r||[];
  for(let i=this.circleCount;i<circles.length;i++){const q=circles[i];if(!q||q.length<3||!q.slice(0,3).every(Number.isFinite))continue;const r=Math.max(0,q[2]);this.insert(this.circles,q[0]-r,q[1]-r,q[0]+r,q[1]+r,q);}
  for(let i=this.rectCount;i<rects.length;i++){const q=rects[i];if(!q||q.length<4||!q.slice(0,4).every(Number.isFinite))continue;this.insert(this.rects,Math.min(q[0],q[2]),Math.min(q[1],q[3]),Math.max(q[0],q[2]),Math.max(q[1],q[3]),q);}
  this.circleCount=circles.length;this.rectCount=rects.length;
 }
 blocked(x,z,r=.3){
  this.sync();const k=key(Math.floor(x/this.cellSize),Math.floor(z/this.cellSize));
  for(const q of this.rects.get(k)||[])if(x>q[0]-r&&x<q[2]+r&&z>q[1]-r&&z<q[3]+r)return true;
  for(const q of this.circles.get(k)||[]){const dx=x-q[0],dz=z-q[1],l=q[2]+r;if(dx<l&&dx>-l&&dz<l&&dz>-l&&dx*dx+dz*dz<l*l)return true;}
  return false;
 }
}
