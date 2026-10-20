// Funzioni legacy da escludere dalla modalità Napoli Life: vita sociale.
// I dati economici, gli oggetti e i gruppi sociali non vengono cancellati.
export const SOCIAL_LIFE_MODE='social-life';

const disabledApiPrefixes=['/api/firearms','/api/arena','/api/heist','/api/gang'];
const disabledApiPaths=new Set(['/api/rp/arrest','/api/rp/fine']);

export function socialLifeApiDisabled(path,body={}){
 return disabledApiPaths.has(path)||disabledApiPrefixes.some(prefix=>path===prefix||path.startsWith(prefix+'/'))||
  path==='/api/rp/work'&&body?.work==='polizia';
}

export function removeLegacyCrimeProgress(progress={}){
 const next={...progress};let changed=false;
 for(const key of ['wanted','jail','heist','firearms','equippedWeapon'])if(Object.hasOwn(next,key)){delete next[key];changed=true;}
 if(next.work==='polizia'){next.work=null;next.duty=false;changed=true;}
 return {progress:next,changed};
}
