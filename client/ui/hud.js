// HUD con icone vettoriali originali. Tutti i pulsanti aprono funzioni del gioco.
import {installPhone} from './phone.js';
const paths={
 profile:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8M4 21v-2a8 8 0 0 1 16 0v2',
 friends:'M9 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6M2 20v-2a7 7 0 0 1 14 0v2M17 5a3 3 0 0 1 0 6M18 14a5 5 0 0 1 4 5',
 chat:'M4 4h16v12H9l-5 4V4M8 9h.01M12 9h.01M16 9h.01',
 mic:'M9 5a3 3 0 0 1 6 0v7a3 3 0 0 1-6 0V5M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8',
 hand:'M7 12V6a2 2 0 0 1 4 0v5-7a2 2 0 0 1 4 0v7-5a2 2 0 0 1 4 0v8l-2 7H9l-6-7a2 2 0 0 1 3-3l3 3',
 run:'M15 6a2 2 0 1 0 0-4 2 2 0 0 0 0 4M5 9l5-2 5 4 5 1M11 8l-3 7-5 5M8 15l6 1 2 6',
 bag:'M9 5V4a3 3 0 0 1 6 0v1M6 9a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v12H6V9M8 14h8v4H8v-4M10 9h4M6 13H4v6h2M18 13h2v6h-2',
 send:'m3 3 19 9-19 9 4-9-4-9M7 12h15',
 smile:'M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20M8 8h.01M16 8h.01M7 14q5 7 10 0'
};
const PHONE_ART='<rect x="3" y="1" width="26" height="46" rx="5" fill="#1b2433" stroke="#c9d6e6" stroke-width="1.4"/><rect x="5.5" y="5" width="21" height="36" rx="2" fill="url(#phone-sky)"/><defs><linearGradient id="phone-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#5ec8ff"/><stop offset="1" stop-color="#8a5cff"/></linearGradient></defs><g><rect x="8" y="9" width="6" height="6" rx="1.5" fill="#ffcf3f"/><rect x="18" y="9" width="6" height="6" rx="1.5" fill="#ff6b8a"/><rect x="8" y="18" width="6" height="6" rx="1.5" fill="#4be08a"/><rect x="18" y="18" width="6" height="6" rx="1.5" fill="#ffffff"/><rect x="8" y="27" width="6" height="6" rx="1.5" fill="#ff9a3c"/><rect x="18" y="27" width="6" height="6" rx="1.5" fill="#3cd6ff"/></g><rect x="12" y="43" width="8" height="1.6" rx=".8" fill="#c9d6e6"/>';
function icon(name){if(name==='phone'){const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 32 48');svg.setAttribute('aria-hidden','true');svg.classList.add('art');svg.innerHTML=PHONE_ART;return svg;}const svg=document.createElementNS('http://www.w3.org/2000/svg','svg');svg.setAttribute('viewBox','0 0 24 24');svg.setAttribute('aria-hidden','true');const p=document.createElementNS(svg.namespaceURI,'path');p.setAttribute('d',paths[name]);svg.append(p);return svg;}
export function installHUD(ctx){
 const {net,api,renderer,livingUI,modal,button,el,notify,profile,social,openMap,toggleVoice,getUser,getMe,calls,setControls}=ctx;
 const $=id=>document.getElementById(id);
 const needsBadge=document.createElement('span');needsBadge.id='hud-needs';needsBadge.title='Fame e sete';needsBadge.setAttribute('aria-label','Fame e sete');needsBadge.textContent='🍽️ 100 · 💧 100';document.querySelector('.identity .id-main')?.append(needsBadge);
 for(const [id,name] of Object.entries({profile:'profile',friends:'friends','chat-toggle':'chat',voice:'mic',interact:'hand',run:'run',inventory:'bag',phone:'phone','chat-mic':'mic','chat-send':'send',emote:'smile'})){
  const b=$(id);for(const child of [...b.childNodes])if(child.nodeType===3)b.removeChild(child);b.prepend(icon(name));
 }
 for(const b of document.querySelectorAll('.social button'))b.addEventListener('click',()=>{for(const item of document.querySelectorAll('.social button'))item.classList.toggle('selected',item===b);});
 $('inventory').onclick=()=>(window.humanaBag?window.humanaBag():livingUI.inventory()).catch(e=>notify(e.message));/* 🎒 = zaino in stile FiveM (ui/bag.js) */
 $('chat-mic').onclick=toggleVoice;
 $('map-open').onclick=openMap;
 $('map-plus').onclick=()=>renderer.miniZoom=Math.min(3,(renderer.miniZoom||1)+.5);
 $('map-minus').onclick=()=>renderer.miniZoom=Math.max(1,(renderer.miniZoom||1)-.5);
 $('wallet-plus').onclick=()=>{const box=modal('Monete, gemme e livello');box.append(el('p','Cammina per guadagnare esperienza: 100 metri = un livello. Dopo 500 XP ricevi il titolo community VIP, gratuito e senza vantaggi competitivi.'),el('p','Ogni giorno, dopo 100 metri, puoi riscuotere 30 monete e 1 gemma. Nessuna valuta è convertibile in denaro.'),button('Riscuoti premio',async()=>{await api('/reward','POST',{});await refresh();notify('Premio ricevuto: 30 monete e 1 gemma');}),button('Apri inventario / negozio',()=>livingUI.inventory()));};
 // Gli stessi pulsanti mantengono i propri eventi: cambia la disposizione, non le funzioni.
 if(window.HUMANA_3D){
  const socialBar=document.querySelector('.social'),actions=document.querySelector('.actions');
  for(const id of ['voice','friends','settings']){const b=$(id);b.setAttribute('aria-label',b.getAttribute('aria-label')||b.textContent.trim());socialBar.append(b);}
  // La chat resta nella barra sociale: nel gruppo delle azioni invade il salto
  // e può intercettare il pollice durante il movimento.
  socialBar.append($('chat-toggle'));
  $('chat-toggle').setAttribute('aria-label','Apri o chiudi chat');
  for(const [id,label] of [['profile','Profilo'],['friends','Amici'],['voice','Microfono'],['interact','Interagisci'],['inventory','Inventario'],['phone','Telefono']])$(id).setAttribute('aria-label',label);
  $('minimap').width=240;$('minimap').height=240;
 }
 const g=(a,b)=>`linear-gradient(160deg,${a},${b})`;
 const phone=installPhone({calls,api,notify,setControls,apps:[
  window.HUMANA_3D?{id:'npl',name:'NPL Bank',icon:'wallet',bg:g('#19c3a6','#0b5d7a')}:{name:'Banca',icon:'wallet',bg:g('#ffd86b','#f5a623'),run:()=>ctx.city.atm(true)},{id:'youtube',name:'YouTube',icon:'play',bg:g('#ff5a50','#e62117')},{name:'Lavoro',icon:'work',bg:g('#fbbf24','#d97706'),run:()=>ctx.jobs.open()},{name:'Mobilità',icon:'car',bg:g('#5eead4','#0d9488'),run:()=>ctx.city.garage()},{name:'Eventi',icon:'calendar',bg:g('#ff8a80','#ff3b30'),run:()=>livingUI.events()},
  {name:'Casa',icon:'home',bg:g('#ffb36b','#ff9500'),run:()=>livingUI.home()},{name:'Shop',icon:'bag',bg:g('#d59cff','#af52de'),run:()=>livingUI.inventory()},
  {name:'Mondo',icon:'globe',bg:g('#8e9bff','#5856d6'),run:()=>livingUI.menu()},{name:'Profilo',icon:'user',bg:g('#c7ccd6','#8e8e93'),run:profile},
  {name:'Musica',icon:'music',bg:g('#ff8fb1','#ff2d55'),run:()=>livingUI.audioSettings()},{name:'Impostazioni',icon:'gear',bg:g('#b9bec7','#636366'),run:()=>$('settings').click()},
  {id:'phone',name:'Telefono',icon:'phone',bg:g('#7be495','#34c759'),dock:true},{name:'Messaggi',icon:'chat',bg:g('#7be495','#30d158'),dock:true,run:()=>livingUI.inbox()},
  {name:'Amici',icon:'friends',bg:g('#5ac8fa','#007aff'),dock:true,run:social},{name:'Mappa',icon:'map',bg:g('#7be495','#34c759'),dock:true,run:openMap}
 ]});
 $('phone').onclick=()=>phone.open();
 function paint(s){$('hud-coins').textContent=s.balance.toLocaleString('it-IT');$('hud-gems').textContent=s.gems||0;$('hud-level').textContent='Lv. '+(s.level||1);$('hud-xp').value=(s.xp||0)%100;$('hud-xp').title=(s.xp||0)+' XP';$('hud-vip').querySelector('span').textContent=s.vip?'VIP':'Cittadino';$('hud-vip').classList.toggle('vip',!!s.vip);
  if(window.HUMANA_3D&&window.humanaPortrait){const u=getUser?.(),av=u?.avatar||{},src=(renderer.assetBase||'')+window.humanaPortrait(Number.isInteger(av.look)?av.look:0,av.photo?.model);const c=$('hud-avatar').getContext('2d');if(!window.__hudPort||window.__hudPort.src.indexOf(src)<0){const img=new Image();img.onload=()=>{window.__hudPort=img;paintFace(img);};img.src=src;window.__hudPort=img;}else paintFace(window.__hudPort);}
  else{const im=renderer.images.avatar;if(im){const c=$('hud-avatar').getContext('2d');c.clearRect(0,0,96,96);c.save();c.beginPath();c.arc(48,48,45,0,7);c.clip();c.fillStyle='#287995';c.fillRect(0,0,96,96);c.drawImage(im,im.width*.065,im.height*.02,im.width*.14,im.height*.145,2,1,92,105);c.restore();}}
 }
 function paintFace(img){const c=$('hud-avatar').getContext('2d');if(!img.complete||!img.naturalWidth)return;c.clearRect(0,0,96,96);c.save();c.beginPath();c.arc(48,48,45,0,7);c.clip();c.fillStyle='#287995';c.fillRect(0,0,96,96);c.drawImage(img,img.naturalWidth*.12,img.naturalHeight*.03,img.naturalWidth*.76,img.naturalHeight*.6,0,2,96,96);c.restore();}
 document.addEventListener('humana:wallet',e=>{if(e.detail?.balance!==undefined&&e.detail.gems!==undefined)paint(e.detail);else api('/state').then(paint).catch(()=>{});});
 let busy=false;async function refresh(){if(busy||!getUser()||net.ws?.readyState!==1)return;busy=true;try{const [wallet,people]=await Promise.all([api('/state'),api('/social')]);paint(wallet);renderer.friendIds=new Set(people.friends.filter(f=>f.status==='accepted').map(f=>f.user.id));const n=people.friends.filter(f=>f.status==='pending'&&f.receiver===net.id).length;$('friends').dataset.badge=n||'';}catch(e){notify(e.message);}finally{busy=false;}}
 const timer=setInterval(refresh,10000);setInterval(()=>api('/needs').then(n=>{needsBadge.textContent=`🍽️ ${n.hunger} · 💧 ${n.thirst}`;needsBadge.classList.toggle('low',Math.min(n.hunger,n.thirst)<25);}).catch(()=>{}),10000);addEventListener('pagehide',()=>clearInterval(timer),{once:true});
 net.addEventListener('state',e=>{const hour=Math.floor((e.detail.now%2400000)/2400000*24),minute=Math.floor((e.detail.now%100000)/100000*60);$('world-clock').textContent=(hour>=6&&hour<18?'☀ ':'☾ ')+String(hour).padStart(2,'0')+':'+String(minute).padStart(2,'0');const me=getMe();if(me)$('interact').classList.toggle('available',!!document.getElementById('nearby-hint').textContent);});
 net.addEventListener('notification',()=>{$('phone').classList.add('unread');});$('phone').addEventListener('click',()=>$('phone').classList.remove('unread'));
 $('chat-input').addEventListener('focus',()=>document.body.classList.add('typing'));$('chat-input').addEventListener('blur',()=>document.body.classList.remove('typing'));
}
