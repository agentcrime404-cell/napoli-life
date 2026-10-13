import {readdir,stat,writeFile} from 'node:fs/promises';
import {join,relative} from 'node:path';
const root=process.cwd(),base=join(root,'client','assets');
const files=[];
async function walk(dir){for(const n of await readdir(dir)){const p=join(dir,n),s=await stat(p);if(s.isDirectory())await walk(p);else files.push({path:relative(root,p).replaceAll('\\','/'),bytes:s.size});}}
await walk(base);
const classify=p=>{
 if(p.includes('/vehicles/moto-vere/')||p.includes('/vehicles/auto-vere/'))return {status:'excluded-runtime',license:'unverified-external'};
 if(p.includes('/kenney-')||p.includes('/kenney/'))return {status:'runtime',license:'CC0 documented'};
 if(p.includes('/polyhaven')||p.includes('/threejs/'))return {status:'runtime',license:p.includes('/threejs/')?'MIT documented':'CC0 documented'};
 if(p.includes('/persone-vere/'))return {status:'runtime',license:'MIT documented'};
 if(p.includes('/facciate/')||p.includes('/castello/'))return {status:'runtime',license:'public-domain source documented'};
 if(p.endsWith('.glb')||p.endsWith('.gltf')||p.endsWith('.jpg')||p.endsWith('.png')||p.endsWith('.webp')||p.endsWith('.hdr'))return {status:'review-required',license:'see LICENZE.md'};
 return {status:'runtime',license:'project/generated or documented'};
};
const manifest={generatedAt:new Date().toISOString(),note:'Audit inventory; not a legal opinion.',files:files.map(f=>({...f,...classify(f.path)}))};
manifest.summary=manifest.files.reduce((a,f)=>(a[f.status]=(a[f.status]||0)+1,a),{});
await writeFile(join(root,'docs','release-assets-manifest.json'),JSON.stringify(manifest,null,2));
console.log(JSON.stringify(manifest.summary));
