// APK di Napoli life (3D). Il progetto Android è in android-3d/ (unico, il vecchio 2D è stato archiviato).
// È un guscio che apre il gioco all'indirizzo dato: il gioco resta sul server, l'app non va rifatta quando il gioco cambia.
// Uso: node scripts/apk-3d.mjs https://indirizzo-del-gioco/      (senza indirizzo usa quello del PC sulla rete di casa)
// Lavora direttamente in android-3d/: cambia indirizzo e nome, compila con Gradle e copia il file in dist/.
import {spawnSync} from 'node:child_process';import {cp,rm,mkdir,readFile,writeFile,copyFile} from 'node:fs/promises';import {existsSync,readdirSync} from 'node:fs';import {fileURLToPath} from 'node:url';import {networkInterfaces} from 'node:os';import QRCode from 'qrcode';
const root=new URL('../',import.meta.url),dst=new URL('android-3d/',root);
const lan=Object.values(networkInterfaces()).flat().find(a=>a.family==='IPv4'&&!a.internal&&/^192\.168\./.test(a.address))?.address||'192.168.1.36';
const url=(process.argv[2]||`http://${lan}:${Number(process.env.PORT_3D)||3079}/`).replace(/\/?$/,'/'),ID='it.humana.life3d',NAME='Napoli life';
{const t=fileURLToPath(new URL('tools/',root));if(existsSync(t)){const j=readdirSync(t).find(d=>d.startsWith('jdk-21'));if(j)process.env.JAVA_HOME=t+j;}}
const edit=async(rel,fn)=>{const u=new URL(rel,dst);await writeFile(u,fn(await readFile(u,'utf8')));};
await edit('app/build.gradle',s=>s.replace(/applicationId\s+"[^"]+"/,`applicationId "${ID}"`));
await edit('app/src/main/res/values/strings.xml',s=>s.replace(/(<string name="app_name">)[^<]*/,`$1${NAME}`).replace(/(<string name="title_activity_main">)[^<]*/,`$1${NAME}`).replace(/(<string name="custom_url_scheme">)[^<]*/,`$1${ID}`));
await writeFile(new URL('app/src/main/assets/capacitor.config.json',dst),JSON.stringify({appId:ID,appName:NAME,webDir:'public',server:{url,cleartext:true,androidScheme:url.startsWith('https')?'https':'http',allowNavigation:[new URL(url).hostname]},android:{allowMixedContent:true}},null,1));
await mkdir(new URL('app/src/main/assets/public/',dst),{recursive:true});
await writeFile(new URL('app/src/main/assets/public/index.html',dst),`<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><body style="font:18px sans-serif;background:#0b1622;color:#fff;padding:24px"><h2>${NAME}</h2><p>Il gioco non risponde a questo indirizzo:</p><p><a style="color:#8cc8f5" href="${url}">${url}</a></p><p>Controlla la connessione e riapri l'app.</p>`);
const android=fileURLToPath(dst),r=spawnSync(process.platform==='win32'?`"${android}gradlew.bat"`:'./gradlew',['assembleDebug'],{cwd:android,stdio:'inherit',shell:process.platform==='win32'});if(r.status!==0)process.exit(r.status||1);
await mkdir(new URL('dist/',root),{recursive:true});await copyFile(new URL('app/build/outputs/apk/debug/app-debug.apk',dst),new URL('dist/Napoli-Life-3D.apk',root));
const dl=url+'scarica/napoli-life-3d.apk';await QRCode.toFile(fileURLToPath(new URL('dist/qr-scarica-3d.png',root)),dl,{width:640,margin:2});
console.log('APK pronto: dist/Napoli-Life-3D.apk  (apre '+url+')\nQR per scaricarlo: dist/qr-scarica-3d.png  ->  '+dl);
