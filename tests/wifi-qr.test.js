import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createApp} from '../server/index.js';

test('QR Wi-Fi apre Napoli life 3D e non viene esposto dal server 2D',async t=>{
 const app=createApp({dbPath:':memory:',edition:'3d'});await new Promise(resolve=>app.server.listen(0,'127.0.0.1',resolve));t.after(()=>app.close());
 const base=`http://127.0.0.1:${app.server.address().port}`,response=await fetch(base+'/api/wifi'),data=await response.json();
 assert.equal(response.status,200);assert.match(data.url,/^http:\/\/\d{1,3}(\.\d{1,3}){3}:\d+\/$/);assert.match(data.qrDataUrl,/^data:image\/png;base64,/);assert.ok(data.urls.some(item=>item.url===data.url));assert.equal(typeof data.apkAvailable,'boolean');assert.match(data.apkUrl,/\/scarica\/napoli-life-3d\.apk$/);
 const download=await fetch(base+'/scarica-3d').then(r=>r.text());assert.match(download,/href="\/scarica\/napoli-life-3d\.apk"/);
 const game=await fetch(base+'/').then(r=>r.text());assert.match(game,/title="Telefono Napoli Life"/);
 const html=await fetch(base+'/').then(r=>r.text());assert.match(html,/id="wifi-share"/);assert.match(await fetch(base+'/app.js').then(r=>r.text()),/showWifiQr/);
 const legacy=createApp({dbPath:':memory:'});await new Promise(resolve=>legacy.server.listen(0,'127.0.0.1',resolve));t.after(()=>legacy.close());
 assert.equal((await fetch(`http://127.0.0.1:${legacy.server.address().port}/api/wifi`)).status,404);
});
