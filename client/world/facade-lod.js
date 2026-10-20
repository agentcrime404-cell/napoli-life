// A detailed facade may replace the flat wall only when it contains drawable
// surface geometry. Empty or malformed LOD data must leave the base wall intact.
export function hasFacadeDetail(value, keys) {
 for (const key of keys) {
  const positions=value?.[key]?.p;
  if(!positions||positions.length<9)continue;
  let valid=true;
  for(let i=0;i<9;i++)if(!Number.isFinite(positions[i])){valid=false;break;}
  if(valid)return true;
 }
 return false;
}
