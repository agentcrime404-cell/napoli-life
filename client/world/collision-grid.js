// Broad-phase index for fixed world collision data. Exact narrow-phase math stays unchanged.
const CELL_SIZE=16;
const MAX_QUERY_RADIUS=.6; // Largest current caller radius is .55 m.
function bucketAt(map,x,z,create=false){
 let column=map.get(x);
 if(!column&&create){column=new Map();map.set(x,column);}
 if(!column)return null;
 let bucket=column.get(z);
 if(!bucket&&create){bucket=[];column.set(z,bucket);}
 return bucket||null;
}

export class CollisionGrid {
 constructor(source,cellSize=CELL_SIZE){
  this.source=source||{c:[],r:[]};this.cellSize=cellSize;this.circles=new Map();this.rects=new Map();this.circleCount=0;this.rectCount=0;this.sync();
 }
 insert(map,minX,minZ,maxX,maxZ,item){
  const size=this.cellSize,fromX=Math.floor((minX-MAX_QUERY_RADIUS)/size),toX=Math.floor((maxX+MAX_QUERY_RADIUS)/size),fromZ=Math.floor((minZ-MAX_QUERY_RADIUS)/size),toZ=Math.floor((maxZ+MAX_QUERY_RADIUS)/size);
  for(let x=fromX;x<=toX;x++)for(let z=fromZ;z<=toZ;z++)bucketAt(map,x,z,true).push(item);
 }
 sync(){
  const circles=this.source.c||[],rects=this.source.r||[];
  for(let i=this.circleCount;i<circles.length;i++){const q=circles[i];if(!q||q.length<3||!q.slice(0,3).every(Number.isFinite))continue;const r=Math.max(0,q[2]);this.insert(this.circles,q[0]-r,q[1]-r,q[0]+r,q[1]+r,q);}
  for(let i=this.rectCount;i<rects.length;i++){const q=rects[i];if(!q||q.length<4||!q.slice(0,4).every(Number.isFinite))continue;this.insert(this.rects,Math.min(q[0],q[2]),Math.min(q[1],q[3]),Math.max(q[0],q[2]),Math.max(q[1],q[3]),q);}
  this.circleCount=circles.length;this.rectCount=rects.length;
 }
 blocked(x,z,r=.3,ignoredRectangles=null){
  this.sync();const cellX=Math.floor(x/this.cellSize),cellZ=Math.floor(z/this.cellSize),rects=bucketAt(this.rects,cellX,cellZ),circles=bucketAt(this.circles,cellX,cellZ);
  if(rects)for(const q of rects){if(ignoredRectangles?.has(q))continue;if(x>q[0]-r&&x<q[2]+r&&z>q[1]-r&&z<q[3]+r)return true;}
  if(circles)for(const q of circles){const dx=x-q[0],dz=z-q[1],l=q[2]+r;if(dx<l&&dx>-l&&dz<l&&dz>-l&&dx*dx+dz*dz<l*l)return true;}
  return false;
 }
 // Candidate rectangles for a segment/region query. The returned set is only
 // broad phase; callers keep their existing exact geometry test.
 queryRect(minX,minZ,maxX,maxZ,padding=.25){
  return this.queryRectInto(minX,minZ,maxX,maxZ,padding,[],new Set());
 }
 // Reusable buffers let the camera broad phase avoid a Set, copied array and
 // filtered array on every rendered frame. queryRect remains the simple API
 // for callers that need an owned result.
 queryRectInto(minX,minZ,maxX,maxZ,padding,output,seen){
  output.length=0;seen.clear();this.sync();if(![minX,minZ,maxX,maxZ,padding].every(Number.isFinite))return output;
  const left=Math.min(minX,maxX),right=Math.max(minX,maxX),top=Math.min(minZ,maxZ),bottom=Math.max(minZ,maxZ),pad=Math.max(0,padding),size=this.cellSize;
  for(let x=Math.floor((left-pad)/size);x<=Math.floor((right+pad)/size);x++)for(let z=Math.floor((top-pad)/size);z<=Math.floor((bottom+pad)/size);z++){const bucket=bucketAt(this.rects,x,z);if(bucket)for(const q of bucket)seen.add(q);}
  for(const q of seen)if(Math.min(q[0],q[2])-pad<=right&&Math.max(q[0],q[2])+pad>=left&&Math.min(q[1],q[3])-pad<=bottom&&Math.max(q[1],q[3])+pad>=top)output.push(q);
  return output;
 }
}
