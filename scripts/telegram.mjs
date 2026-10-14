// Aggiornamenti in tempo reale su Telegram (bot @Napolilife_bot). Il token sta in .env (non va nel repository); l'id della chat si salva in data/telegram-chat.json
// al primo messaggio che l'utente scrive al bot (/start).
// Uso: node --env-file-if-exists=.env scripts/telegram.mjs "testo"        invia un messaggio
//      node --env-file-if-exists=.env scripts/telegram.mjs --qr            invia il QR di scarico + il link
//      node --env-file-if-exists=.env scripts/telegram.mjs --apk           invia il file APK
//      node --env-file-if-exists=.env scripts/telegram.mjs --foto file.jpg "didascalia"   invia una foto
import fs from 'node:fs';
// Il token si legge da .env (ha la precedenza su una variabile di sistema con lo stesso nome, che qui conteneva solo un segnaposto).
const fromFile=(()=>{try{return (fs.readFileSync('.env','utf8').match(/^TELEGRAM_BOT_TOKEN=(.*)$/m)||[])[1]?.trim();}catch{return '';}})();
const TOKEN=(fromFile||process.env.TELEGRAM_BOT_TOKEN||'').trim(),API='https://api.telegram.org/bot'+TOKEN+'/',FILE='data/telegram-chat.json',SITE=process.env.PUBLIC_URL||'https://humana-life-3d.onrender.com';
if(!TOKEN){console.error('Manca TELEGRAM_BOT_TOKEN in .env');process.exit(2);}
const call=async(m,body,form)=>{const r=await fetch(API+m,{method:'POST',headers:form?undefined:{'Content-Type':'application/json'},body:form||JSON.stringify(body)});return r.json();};
// Si scrive SOLO al proprietario (TELEGRAM_OWNER_ID in .env): nessuna scoperta automatica della chat.
const fromEnv=(()=>{try{return Number((fs.readFileSync('.env','utf8').match(/^TELEGRAM_OWNER_ID=(.*)$/m)||[])[1]);}catch{return 0;}})();
async function chatId(){const id=fromEnv||Number(process.env.TELEGRAM_OWNER_ID)||0;if(!id){console.error('Manca TELEGRAM_OWNER_ID in .env: per sicurezza non si scrive a nessuno.');process.exit(3);}return id;}
const arg=process.argv.slice(2),id=await chatId();
const keyboard={inline_keyboard:[[{text:'📱 Scarica APK',url:SITE+'/scarica-3d'},{text:'▶️ Gioca online',url:SITE+'/'}]]};
if(arg[0]==='--qr'){const {default:QR}=await import('qrcode');const png=await QR.toBuffer(SITE+'/scarica-3d',{width:520,margin:2});const f=new FormData();f.append('chat_id',String(id));f.append('caption','📷 QR per scaricare Napoli life sul telefono\n'+SITE+'/scarica-3d');f.append('photo',new Blob([png],{type:'image/png'}),'qr.png');const r=await call('sendPhoto',null,f);console.log(r.ok?'QR inviato':JSON.stringify(r));}
else if(arg[0]==='--apk'){const p='dist/Napoli-Life-3D.apk';const f=new FormData();f.append('chat_id',String(id));f.append('caption','📦 APK Android di Napoli life (apre il gioco online)');f.append('document',new Blob([fs.readFileSync(p)]),'Napoli-Life-3D.apk');const r=await call('sendDocument',null,f);console.log(r.ok?'APK inviato':JSON.stringify(r));}
else if(arg[0]==='--foto'){const f=new FormData();f.append('chat_id',String(id));f.append('caption',arg.slice(2).join(' ')||'Napoli life');f.append('photo',new Blob([fs.readFileSync(arg[1])],{type:'image/jpeg'}),'foto.jpg');const r=await call('sendPhoto',null,f);console.log(r.ok?'Foto inviata':JSON.stringify(r));}
else{const text=arg.join(' ')||'Prova';const r=await call('sendMessage',{chat_id:id,text,reply_markup:keyboard,disable_web_page_preview:true});console.log(r.ok?'Messaggio inviato':JSON.stringify(r));}
