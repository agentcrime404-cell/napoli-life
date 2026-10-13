import {test} from 'node:test';import assert from 'node:assert/strict';import {spawn} from 'node:child_process';import {once} from 'node:events';import {mkdtemp,rm} from 'node:fs/promises';import {tmpdir} from 'node:os';import {join} from 'node:path';
test('Avvio del pacchetto: server risponde e si arresta correttamente',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'humana-launch-'));
 const child=spawn(process.execPath,['scripts/play-3d.mjs'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT_3D:'31987',HOST:'127.0.0.1',DATABASE_PATH_3D:join(dir,'test.sqlite'),TLS_CERT:'',TLS_KEY:''},stdio:['ignore','pipe','pipe']});
 let log='';child.stdout.on('data',b=>log+=b);child.stderr.on('data',b=>log+=b);
 try{let ready=false;for(let i=0;i<600;i++){if(log.includes('pronta sul PC')){ready=true;break;}if(child.exitCode!==null)break;await new Promise(r=>setTimeout(r,50));}
 assert.ok(ready,log);const response=await fetch('http://127.0.0.1:31987/health');assert.equal(response.status,200);assert.equal((await response.json()).status,'ok');
 }finally{const ended=once(child,'exit');child.kill('SIGTERM');if(child.exitCode===null)await ended;await rm(dir,{recursive:true,force:true});}
});
