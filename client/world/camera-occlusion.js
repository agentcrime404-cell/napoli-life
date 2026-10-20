// Precise camera occlusion against OSM building footprints. The broad phase is
// supplied by CollisionGrid; this narrow phase only checks nearby polygons.
export function firstBuildingSegmentHit(from,to,footprints){
 const dx=to.x-from.x,dz=to.z-from.z,dy=to.y-from.y,length=Math.hypot(dx,dy,dz);
 if(!Number.isFinite(length)||length<1e-6)return null;
 let nearest=Infinity,building=null;
 for(const item of footprints||[]){
  const polygon=item?.polygon,height=item?.height;
  if(!Array.isArray(polygon)||polygon.length<3||!Number.isFinite(height))continue;
  let inside=false;
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[i],b=polygon[j];
   if((a[1]>from.z)!==(b[1]>from.z)&&from.x<(b[0]-a[0])*(from.z-a[1])/(b[1]-a[1])+a[0])inside=!inside;
  }
  if(inside&&from.y<height){nearest=0;building=item;break;}
  for(let i=0,j=polygon.length-1;i<polygon.length;j=i++){
   const a=polygon[j],b=polygon[i],sx=b[0]-a[0],sz=b[1]-a[1],den=dx*sz-dz*sx;
   if(Math.abs(den)<1e-9)continue;
   const ax=a[0]-from.x,az=a[1]-from.z,t=(ax*sz-az*sx)/den,u=(ax*dz-az*dx)/den;
   if(t<0||t>1||u<0||u>1||t>=nearest)continue;
   const y=from.y+dy*t;
   if(y<0||y>=height)continue;
   nearest=t;building=item;
  }
 }
 return building?{building,t:nearest,distance:nearest*length}:null;
}
