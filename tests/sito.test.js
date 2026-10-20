import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.js';

test('il sito è servito su /sito e collegato al gioco',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`;
 for(const path of ['/sito','/sito/']){const page=await fetch(base+path);assert.equal(page.status,200);const html=await page.text();assert.match(html,/<title>Napoli life/);assert.match(html,/href="\/"/);assert.match(html,/href="\/scarica-3d"/);}
 const html=await fetch(base+'/sito').then(r=>r.text());
 for(const src of new Set([...html.matchAll(/(?:src|url\()=?"?(\/sito\/img\/[\w.-]+\.(?:webp|png|svg|jpg))/g)].map(m=>m[1])))assert.equal((await fetch(base+src)).status,200,src);
 const stato=await fetch(base+'/api/stato').then(r=>r.json());
 assert.equal(stato.gioco,'Napoli life');assert.equal(stato.online,0);assert.equal(typeof stato.build,'string');assert.deepEqual(Object.keys(stato).sort(),['build','capienza','gioco','online']);
 assert.match(await fetch(base+'/').then(r=>r.text()),/id="auth"/);
});
