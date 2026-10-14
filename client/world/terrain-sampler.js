// Accelerates background-hill sampling without changing the coastline polygon
// or the nearest-coast distance used to shape the terrain.
export class TerrainSampler {
 constructor(polygon,coastPoints,{cellSize=128,distanceLimit=350}={}){
  this.cellSize=cellSize;this.distanceLimit=distanceLimit;this.edgesByY=new Map();this.coastByCell=new Map();
  const edgeKey=y=>Math.floor(y/cellSize);
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[j],b=polygon[i],from=edgeKey(Math.min(a[1],b[1])),to=edgeKey(Math.max(a[1],b[1]));
   for(let row=from;row<=to;row++){let edges=this.edgesByY.get(row);if(!edges)this.edgesByY.set(row,edges=[]);edges.push([a,b]);}
  }
  for(const point of coastPoints){const key=this.key(Math.floor(point[0]/cellSize),Math.floor(point[1]/cellSize));let list=this.coastByCell.get(key);if(!list)this.coastByCell.set(key,list=[]);list.push(point);}
 }
 key(x,y){return x+','+y;}
 contains(x,y){
  let inside=false;for(const [a,b] of this.edgesByY.get(Math.floor(y/this.cellSize))||[]){
   if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  return inside;
 }
 coastDistance(x,y){
  const size=this.cellSize,limit=this.distanceLimit,minX=Math.floor((x-limit)/size),maxX=Math.floor((x+limit)/size),minY=Math.floor((y-limit)/size),maxY=Math.floor((y+limit)/size);let best=limit*limit;
  for(let cx=minX;cx<=maxX;cx++)for(let cy=minY;cy<=maxY;cy++)for(const point of this.coastByCell.get(this.key(cx,cy))||[]){const dx=point[0]-x,dy=point[1]-y,d=dx*dx+dy*dy;if(d<best)best=d;}
  return Math.sqrt(best);
 }
}
