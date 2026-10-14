// Visit only occupied cells in the packed Napoli walkability grid, in the
// same row-major order as scanning every x/y coordinate.
export function forEachSetGridCell(grid,width,height,visit,margin=1){
 if(!grid||!Number.isInteger(width)||!Number.isInteger(height)||width<=0||height<=0||typeof visit!=='function')return 0;
 let count=0;
 for(let y=margin;y<height-margin;y++){
  const rowOffset=y*width,rowStart=rowOffset+margin,rowEnd=rowOffset+width-margin-1;
  if(rowEnd<rowStart)continue;
  const firstByte=rowStart>>3,lastByte=rowEnd>>3;
  for(let byte=firstByte;byte<=lastByte;byte++){
   let bits=grid[byte]||0;
   if(byte===firstByte)bits&=0xff<<(rowStart&7);
   const endBit=rowEnd&7;if(byte===lastByte&&endBit<7)bits&=(1<<(endBit+1))-1;
   while(bits){const bit=31-Math.clz32(bits&-bits),index=byte*8+bit;visit(index-rowOffset,y);count++;bits&=bits-1;}
  }
 }
 return count;
}
