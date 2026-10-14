import {PACKS,BANK_NAME} from '/shared/catalog.js';
// Telefono in stile smartphone: schermata home con app, app Telefono per chiamare gli amici, schermate di chiamata.
const ICONS={
 phone:'M6.6 10.8a15 15 0 0 0 6.6 6.6l2.2-2.2a1 1 0 0 1 1-.25 11 11 0 0 0 3.6.6 1 1 0 0 1 1 1V20a1 1 0 0 1-1 1A17 17 0 0 1 3 4a1 1 0 0 1 1-1h3.5a1 1 0 0 1 1 1 11 11 0 0 0 .6 3.6 1 1 0 0 1-.25 1z',
 chat:'M4 4h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H8l-4 4V6a2 2 0 0 1 2-2z',
 friends:'M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm8 0a3 3 0 1 0 0-6M1 21v-1a6 6 0 0 1 6-6h4a6 6 0 0 1 6 6v1M17 14a5 5 0 0 1 6 5v2',
 map:'M9 4 3 6v14l6-2 6 2 6-2V4l-6 2-6-2zm0 0v14m6-12v14',
 wallet:'M3 7a2 2 0 0 1 2-2h13v4M3 7v11a2 2 0 0 0 2 2h15V9H5a2 2 0 0 1-2-2zm14 7h.01',
 calendar:'M4 6h16v15H4zM4 10h16M8 3v5m8-5v5',
 home:'M3 11 12 3l9 8v10h-6v-6H9v6H3z',
 bag:'M6 8h12l1 13H5zM9 8V6a3 3 0 0 1 6 0v2',
 globe:'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-9 9h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18',
 user:'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-8 9a8 8 0 0 1 16 0',
 music:'M9 18V5l12-2v13M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0zm12-2a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
 play:'M8 5v14l11-7z',work:'M4 8h16v11H4zM9 8V5h6v3M4 13h16',car:'M5 11l2-5h10l2 5M3 11h18v6H3zM6 17v2M18 17v2M7 14h.01M17 14h.01',gear:'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm7.4-3a7 7 0 0 0-.1-1.2l2-1.6-2-3.4-2.4 1a7 7 0 0 0-2-1.2L14.5 3h-4l-.4 2.6a7 7 0 0 0-2 1.2l-2.4-1-2 3.4 2 1.6a7 7 0 0 0 0 2.4l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 2 1.2l.4 2.6h4l.4-2.6a7 7 0 0 0 2-1.2l2.4 1 2-3.4-2-1.6c.1-.4.1-.8.1-1.2z',
 mic:'M12 3a3 3 0 0 1 3 3v6a3 3 0 0 1-6 0V6a3 3 0 0 1 3-3zM5 11a7 7 0 0 0 14 0M12 18v3',
 hang:'M3 15c5-5 13-5 18 0l-2 3-4-1v-3a10 10 0 0 0-6 0v3l-4 1z'
};
function svg(name,fill=false){const s=document.createElementNS('http://www.w3.org/2000/svg','svg');s.setAttribute('viewBox','0 0 24 24');s.setAttribute('aria-hidden','true');const p=document.createElementNS(s.namespaceURI,'path');p.setAttribute('d',ICONS[name]);s.append(p);if(fill)s.classList.add('fill');return s;}
export function installPhone(ctx){
 const {calls,api,notify,setControls,apps}=ctx;
 const root=document.createElement('div');root.id='iphone';root.hidden=true;root.innerHTML='<div class="device"><div class="island"></div><div class="status"><b class="clock"></b><span class="bars"><i></i><i></i><i></i><i></i></span><span class="battery"><i></i></span><button class="ph-x" aria-label="Chiudi telefono">✕</button><button class="ph-rot" aria-label="Gira il telefono in verticale">↻</button></div><div class="screen"></div><button class="home-bar" aria-label="Chiudi telefono"></button></div>';
 document.body.append(root);const screen=root.querySelector('.screen');
 const el=(tag,cls,text)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(text!==undefined)e.textContent=text;return e;};
 const tick=()=>{root.querySelector('.clock').textContent=new Date().toLocaleTimeString('it-IT',{hour:'2-digit',minute:'2-digit'});const t=root.querySelector('.call-time');if(t&&calls.startedAt){const s=Math.floor((Date.now()-calls.startedAt)/1000);t.textContent=String(Math.floor(s/60)).padStart(2,'0')+':'+String(s%60).padStart(2,'0');}};
 setInterval(tick,1000);
 function open(){root.hidden=false;setControls(false);render();tick();}
 function close(){if(calls.state!=='idle'){home();return;}ytNow=null;view='home';screen.replaceChildren();if(dlg?.open){try{dlg.close();}catch{}}hosted=false;root.hidden=true;setControls(true);}
 // HUMANA life 3D: le app si aprono DENTRO lo schermo del telefono (la finestra del gioco viene messa sopra lo schermo) e si resta nel telefono finché non lo si chiude.
 // Nel 2D resta tutto com'era: il telefono si chiude e l'app si apre a tutto schermo.
 const inPhone=!!window.HUMANA_3D,dlg=document.getElementById('modal');let hosted=false;
 const fit=()=>{if(!dlg)return;const on=inPhone&&hosted&&!root.hidden&&dlg.open;dlg.classList.toggle('in-phone',on);if(!on){for(const k of ['left','top','width','height'])dlg.style[k]='';return;}const r=root.querySelector('.device').getBoundingClientRect();dlg.style.left=(r.left+12)+'px';dlg.style.top=(r.top+54)+'px';dlg.style.width=(r.width-24)+'px';dlg.style.height=(r.height-54-40)+'px';};
 if(inPhone&&dlg){new MutationObserver(()=>{if(dlg.open){if(!root.hidden)hosted=true;fit();}else{fit();if(hosted&&!root.hidden){setControls(false);view='home';render();}}}).observe(dlg,{attributes:true,attributeFilter:['open']});addEventListener('resize',fit);}
 function launch(fn){if(!inPhone){root.hidden=true;setControls(true);Promise.resolve().then(fn).catch(e=>notify(e.message));return;}
  hosted=true;Promise.resolve().then(fn).then(()=>setTimeout(()=>{if(dlg?.open){setControls(false);fit();}else{hosted=false;root.hidden=true;setControls(true);}},60)).catch(e=>notify(e.message));}
 function app(def){const b=el('button','app');const tile=el('span','tile');tile.style.background=def.bg;tile.append(svg(def.icon));b.append(tile,el('span','label',def.name));b.onclick=()=>{if(def.id==='npl'){view='npl';bank.stage=bank.ok?'home':'login';bank.typed='';render();}else if(def.id==='phone'){view='contacts';render();}else if(def.id==='youtube'){view='youtube';render();}else launch(def.run);};return b;}
 let view='home',ytResults=[],ytQuery='';
 function home(){view='home';render();}
 function render(){screen.replaceChildren();screen.className='screen '+(calls.state!=='idle'?'call':view);
  if(calls.state!=='idle')return callScreen();
  if(view==='contacts')return contacts();
  if(view==='youtube')return youtube();
  if(view==='npl')return npl();
  const grid=el('div','grid');for(const a of apps.filter(a=>!a.dock))grid.append(app(a));
  const dock=el('div','dock');for(const a of apps.filter(a=>a.dock))dock.append(app(a));
  screen.append(el('div','date',new Date().toLocaleDateString('it-IT',{weekday:'long',day:'numeric',month:'long'})),grid,dock);}
 // NPL Bank: app della banca. Si entra con un PIN di 4 cifre scelto la prima volta (resta su questo telefono), poi: saldo, compra crediti,
 // acquisti online dal catalogo e movimenti fatti dall'app. I pagamenti passano dal server come al bancomat (in prova non c'è addebito reale).
 const bank={stage:'login',typed:'',first:'',ok:false,tries:0};
 const pinKey=()=>'humana-npl-pin',pinHash=p=>{let h=2166136261;for(const c of 'npl:'+p)h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0).toString(36);};
 const moves=()=>{try{return JSON.parse(localStorage.getItem('humana-npl-moves')||'[]');}catch{return [];}},addMove=(t,v)=>{try{const m=moves();m.unshift({t,v,d:Date.now()});localStorage.setItem('humana-npl-moves',JSON.stringify(m.slice(0,30)));}catch{}};
 async function npl(){const head=el('div','app-head');const back=el('button','back',bank.stage==='home'||bank.stage==='login'?'‹ Home':'‹ '+BANK_NAME);back.onclick=()=>{if(bank.stage==='home'||bank.stage==='login')home();else{bank.stage='home';render();}};head.append(back,el('h3',null,BANK_NAME));screen.append(head);
  const box=el('div','npl');screen.append(box);const logo=()=>{const l=el('div','npl-logo');l.append(el('b',null,'NPL'),el('span',null,'Bank'));return l;};
  if(bank.stage==='login'){let saved=null;try{saved=localStorage.getItem(pinKey());}catch{}const creating=!saved,msg=creating?(bank.first?'Ripeti il PIN per conferma':'Crea il tuo PIN di 4 cifre'):'Inserisci il PIN';
   const dots=el('div','npl-dots');const paint=()=>{dots.textContent=('●'.repeat(bank.typed.length)+'○'.repeat(4-bank.typed.length)).split('').join(' ');};paint();
   const info=el('p','npl-msg',msg),pad=el('div','dial-pad');
   const done=()=>{if(creating){if(!bank.first){bank.first=bank.typed;bank.typed='';render();return;}if(bank.first!==bank.typed){bank.first='';bank.typed='';notify('I due PIN sono diversi: riprova');render();return;}try{localStorage.setItem(pinKey(),pinHash(bank.typed));}catch{}bank.first='';}
     else if(pinHash(bank.typed)!==saved){bank.typed='';bank.tries++;notify(bank.tries>=3?'PIN errato. Se non lo ricordi tocca "PIN dimenticato".':'PIN errato');render();return;}
     bank.ok=true;bank.tries=0;bank.typed='';bank.stage='home';render();};
   for(const k of ['1','2','3','4','5','6','7','8','9','','0','⌫']){const b=el('button','dial-key',k);if(!k)b.style.visibility='hidden';b.onclick=()=>{if(k==='⌫')bank.typed=bank.typed.slice(0,-1);else if(bank.typed.length<4)bank.typed+=k;paint();if(bank.typed.length===4)setTimeout(done,160);};pad.append(b);}
   box.append(logo(),el('p','npl-sub','La banca digitale del Golfo'),info,dots,pad);
   if(!creating){const fg=el('button','npl-link','PIN dimenticato');fg.onclick=()=>{if(confirm('Vuoi scegliere un nuovo PIN? Il conto resta lo stesso.')){try{localStorage.removeItem(pinKey());}catch{}bank.typed='';bank.first='';render();}};box.append(fg);}
   box.append(el('small','npl-note','Il PIN protegge solo l’app su questo dispositivo. Monete e gemme sono virtuali.'));return;}
  let s;try{s=await api('/state');}catch(e){box.append(el('p','hint',e.message));return;}if(view!=='npl')return;
  const coins=n=>Number(n).toLocaleString('it-IT');
  if(bank.stage==='home'){const card=el('div','npl-card');card.append(el('small',null,'Saldo disponibile'),el('b',null,coins(s.balance)+' 🪙'),el('span',null,(s.gems||0)+' 💎 gemme · Livello '+(s.level||1)));
   const grid=el('div','npl-grid');for(const [ic,t,st] of [['💳','Compra crediti','credits'],['🛒','Acquisti online','shop'],['📄','Movimenti','moves'],['🔒','Esci','out']]){const b=el('button','npl-tile');b.append(el('i',null,ic),el('span',null,t));b.onclick=()=>{if(st==='out'){bank.ok=false;bank.stage='login';bank.typed='';render();}else{bank.stage=st;render();}};grid.append(b);}
   box.append(card,grid,el('small','npl-note','Conto di gioco: valuta virtuale, non convertibile in denaro.'));return;}
  if(bank.stage==='credits'){box.append(el('h4',null,'Compra crediti'),el('p','npl-msg','Saldo: '+coins(s.balance)+' monete · '+(s.gems||0)+' gemme'));
   const pay=async(body,label)=>{try{const r=await api('/checkout','POST',body);if(r.simulated){addMove('Ricarica '+label,'+'+r.coins+' 🪙'+(r.gems?' +'+r.gems+' 💎':''));document.dispatchEvent(new CustomEvent('humana:wallet'));notify('✅ Ricarica accreditata (prova, nessun addebito)');render();return;}try{localStorage.setItem('humana-checkout',r.session);}catch{}addMove('Ricarica '+label,'in attesa del pagamento');const w=window.open(r.url,'_blank');if(!w)location.href=r.url;}catch(e){notify(e.message);}};
   for(const p of PACKS){const row=el('button','npl-row');row.append(el('b',null,p.name),el('span',null,(p.amount/100).toFixed(2).replace('.',',')+' €'));row.onclick=()=>pay({pack:p.id},p.name);box.append(row);}
   const form=el('form','npl-free');const inp=document.createElement('input');inp.type='number';inp.min='1';inp.max='500';inp.placeholder='Importo libero in € (1–500)';const go=el('button','npl-go','Ricarica');go.type='submit';form.append(inp,go);form.onsubmit=e=>{e.preventDefault();const n=Number(inp.value);if(!(n>=1&&n<=500))return notify('Importo da 1 a 500 €');pay({custom:Math.round(n*100)},n+' €');};
   box.append(form,el('small','npl-note','1 € = 250 monete. In modalità di prova l’accredito è immediato e non c’è nessun addebito reale.'));return;}
  if(bank.stage==='shop'){box.append(el('h4',null,'Acquisti online'),el('p','npl-msg','Saldo: '+coins(s.balance)+' monete · '+(s.gems||0)+' gemme. Consegna immediata nell’inventario.'));
   const own=new Set((s.inventory||[]).map(i=>i.item||i.id||i));for(const it of (s.catalog||[]).filter(i=>i.type==='cosmetic'||i.type==='furniture')){const row=el('div','npl-row');const price=it.price+(it.currency==='gems'?' 💎':' 🪙'),has=it.type==='cosmetic'&&own.has(it.id);const b=el('button','npl-go',has?'Tuo':'Compra');b.disabled=has;
     b.onclick=async()=>{try{await api('/purchase','POST',{item:it.id,requestId:'npl'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),online:true});addMove(it.name,'−'+price);document.dispatchEvent(new CustomEvent('humana:wallet'));notify('🛒 '+it.name+' acquistato');render();}catch(e){notify(e.message);}};
     const info=el('div','npl-item');info.append(el('b',null,it.name),el('span',null,(it.type==='cosmetic'?'Accessorio':'Arredo per la casa')+' · '+price));row.append(info,b);box.append(row);}return;}
  if(bank.stage==='moves'){box.append(el('h4',null,'Movimenti'));const m=moves();if(!m.length)box.append(el('p','npl-msg','Nessun movimento fatto da questa app.'));for(const x of m){const row=el('div','npl-row');const info=el('div','npl-item');info.append(el('b',null,x.t),el('span',null,new Date(x.d).toLocaleString('it-IT',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'})));row.append(info,el('b','npl-val',x.v));box.append(row);}
   box.append(el('small','npl-note','Qui compaiono solo le operazioni fatte dall’app su questo dispositivo.'));}}
 // Telefono: il tuo numero, tastierino per comporre (chiama o salva), rubrica e amici. Le chiamate funzionano ovunque sulla mappa.
 let tab='keypad',typed='';
 async function contacts(){const head=el('div','app-head');const back=el('button','back','‹ Home');back.onclick=home;head.append(back,el('h3',null,'Telefono'));screen.append(head);
  const mine=el('p','my-number','Il tuo numero: …');screen.append(mine);const tabs=el('div','ph-tabs');for(const [k,t] of [['keypad','Tastierino'],['book','Rubrica'],['friends','Amici']]){const b=el('button',tab===k?'on':'',t);b.onclick=()=>{tab=k;render();};tabs.append(b);}screen.append(tabs);
  const body=el('div','contacts');screen.append(body);let data;try{data=await api('/phone');}catch(e){body.append(el('p','hint',e.message));return;}if(view!=='contacts')return;mine.textContent='Il tuo numero: '+data.pretty;
  const dial=async number=>{try{const who=await api('/phone/lookup?n='+encodeURIComponent(number));if(!who.online)return notify(who.username+' non è online in questo momento');await calls.start({id:who.id,username:who.username,number});}catch(e){notify(e.message);}};
  if(tab==='keypad'){const disp=el('div','dial-display',typed||'Componi un numero');const pad=el('div','dial-pad');
   for(const k of ['1','2','3','4','5','6','7','8','9','*','0','⌫']){const b=el('button','dial-key',k);b.onclick=()=>{if(k==='⌫')typed=typed.slice(0,-1);else if(k!=='*'&&typed.length<12)typed+=k;disp.textContent=typed||'Componi un numero';};pad.append(b);}
   const row=el('div','dial-row');const callB=el('button','call-btn big');callB.append(svg('phone',true));callB.setAttribute('aria-label','Chiama');callB.onclick=()=>typed&&dial(typed);
   const saveB=el('button','dial-save','Salva');saveB.onclick=async()=>{if(typed.length<6)return notify('Componi prima un numero');const name=prompt('Nome del contatto per '+typed+':');if(!name)return;try{await api('/phone/contacts','POST',{name,number:typed});notify('📇 Contatto salvato');tab='book';render();}catch(e){notify(e.message);}};
   row.append(saveB,callB);body.append(disp,pad,row);return;}
  if(tab==='book'){if(!data.contacts.length)body.append(el('p','hint','Rubrica vuota: componi un numero e premi Salva.'));
   for(const c of data.contacts){const r=el('div','contact');const info=el('div','who');info.append(el('b',null,c.name),el('small',c.online?'online':'offline',c.pretty+(c.online?' · ● online':'')));const call=el('button','call-btn');call.append(svg('phone',true));call.disabled=!c.online;call.onclick=()=>dial(c.number);
    const del=el('button','dial-del','✕');del.title='Elimina';del.onclick=async()=>{if(!confirm('Eliminare '+c.name+'?'))return;await api('/phone/contacts/delete','POST',{number:c.number});render();};r.append(el('span','avatar',c.name[0].toUpperCase()),info,call,del);body.append(r);}return;}
  try{const s=await api('/social');if(view!=='contacts')return;const friends=s.friends.filter(f=>f.status==='accepted').sort((a,b)=>b.online-a.online);if(!friends.length)body.append(el('p','hint','Nessun amico ancora. Puoi chiamare chiunque componendo il suo numero.'));
   for(const f of friends){const row=el('div','contact');const info=el('div','who');info.append(el('b',null,f.user.username),el('small',f.online?'online':'offline',f.online?'● online':'offline'));const call=el('button','call-btn');call.append(svg('phone',true));call.disabled=!f.online;call.onclick=()=>calls.start(f.user).catch(e=>notify(e.message));row.append(el('span','avatar',f.user.username[0].toUpperCase()),info,call);body.append(row);}}catch(e){body.append(el('p','hint',e.message));}}
 // YouTube nel telefono: link o codice → video incorporato; "Cerca" apre YouTube (app sul telefono o browser sul PC).
 const ytId=t=>{t=String(t||'').trim();const m=t.match(/(?:youtu\.be\/|v=|\/shorts\/|\/embed\/|\/live\/)([\w-]{11})/);return m?m[1]:/^[\w-]{11}$/.test(t)?t:null;};
 let ytNow=null;
 function youtube(){const head=el('div','app-head');const back=el('button','back','‹ Home');back.onclick=()=>{ytNow=null;home();};head.append(back,el('h3',null,'YouTube'));screen.append(head);
  const box=el('div','yt');const player=el('div','yt-player');
  if(ytNow){const f=document.createElement('iframe');f.src='https://www.youtube-nocookie.com/embed/'+ytNow+'?autoplay=1&playsinline=1&rel=0';f.allow='autoplay; encrypted-media; picture-in-picture; fullscreen';f.allowFullscreen=true;f.referrerPolicy='strict-origin-when-cross-origin';f.title='Video YouTube';player.append(f);}
  else player.append(el('div','yt-empty','▶ Incolla un link di YouTube oppure cerca un video'));
  const form=el('form','yt-form');const inp=document.createElement('input');inp.placeholder='Scrivi una canzone o un cantante…';inp.enterKeyHint='go';const go=el('button','yt-go','▶');go.type='submit';form.append(inp,go);
  const search=async q=>{list.replaceChildren(el('small','yt-label','Ricerca…'));try{const r=await api('/youtube?q='+encodeURIComponent(q));ytResults=r.videos;ytQuery=q;showResults();}catch(e){list.replaceChildren(el('small','yt-label',e.message));}};
  const play=id=>{ytNow=id;try{const r=JSON.parse(localStorage.getItem('humana-yt')||'[]').filter(x=>x!==id);r.unshift(id);localStorage.setItem('humana-yt',JSON.stringify(r.slice(0,12)));}catch{}render();};
  const list=el('div','yt-results');const showResults=()=>{list.replaceChildren();if(!ytResults.length){if(ytQuery)list.append(el('small','yt-label','Nessun video'));return;}list.append(el('small','yt-label','Risultati: '+ytQuery));for(const v of ytResults){const b=el('button','yt-row');b.type='button';const im=document.createElement('img');im.src='https://i.ytimg.com/vi/'+v.id+'/mqdefault.jpg';im.alt='';b.append(im,el('span',null,v.title));b.onclick=()=>window.humanaCar?.()?(dispatchEvent(new CustomEvent('humana-car-music',{detail:{id:v.id,title:v.title}})),notify('📻 '+v.title+' · suona in auto')):play(v.id);list.append(b);}};showResults();
  form.onsubmit=e=>{e.preventDefault();const id=ytId(inp.value);if(id)play(id);else if(inp.value.trim())search(inp.value.trim()).then(()=>{if(ytResults[0])play(ytResults[0].id);});};
  // Mentre scrivi compaiono già i video (es. "bandito" → la canzone).
  let tm;inp.oninput=()=>{clearTimeout(tm);const q=inp.value.trim();if(q.length>=3&&!ytId(q))tm=setTimeout(()=>search(q),600);};inp.value=ytQuery;
  const s=el('button','yt-search','🔎 Cerca');s.type='button';s.onclick=()=>search(inp.value.trim()||'musica napoletana');
  box.append(player,form,s);if(window.humanaCar?.()){const info=el('small','yt-label','🚗 Sei in auto: tocca un video per metterlo sull’autoradio');const off=el('button','yt-search','⏹ Spegni autoradio');off.type='button';off.onclick=()=>{dispatchEvent(new CustomEvent('humana-car-music',{detail:{id:null}}));notify('Autoradio spenta');};box.append(info,off);}box.append(list);let recent=[];try{recent=JSON.parse(localStorage.getItem('humana-yt')||'[]');}catch{}
  if(recent.length){box.append(el('small','yt-label','Recenti'));const grid=el('div','yt-recent');for(const id of recent){const b=el('button','yt-thumb');const im=document.createElement('img');im.src='https://i.ytimg.com/vi/'+id+'/mqdefault.jpg';im.alt='';b.append(im);b.onclick=()=>{ytNow=id;render();};grid.append(b);}box.append(grid);}
  screen.append(box);}
 function callScreen(){const c=el('div','calling');c.append(el('span','avatar big',calls.peer.name[0].toUpperCase()),el('h2',null,calls.peer.name));
  const status=calls.state==='ringing'?'Chiamata Napoli Life in arrivo…':calls.state==='calling'?'Squilla…':'';const st=el('p','call-time',status);c.append(st);
  const row=el('div','call-actions');
  const round=(cls,icon,label,fn)=>{const w=el('div','act');const b=el('button',cls);b.append(svg(icon,true));b.setAttribute('aria-label',label);b.onclick=()=>Promise.resolve().then(fn).catch(e=>notify(e.message));w.append(b,el('small',null,label));return w;};
  if(calls.state==='ringing')row.append(round('decline','hang','Rifiuta',()=>calls.reject()),round('accept','phone','Rispondi',()=>calls.accept()));
  else row.append(round('mute'+(calls.muted?' on':''),'mic',calls.muted?'Riattiva':'Muto',()=>calls.toggleMute()),round('decline','hang','Chiudi',()=>calls.end()));
  c.append(row);screen.append(c);}
 calls.addEventListener('change',()=>{if(calls.state==='ringing'&&root.hidden){root.hidden=false;setControls(false);}render();tick();});
 root.querySelector('.home-bar').onclick=close;{const rot=root.querySelector('.ph-rot');rot.onclick=async e=>{e.stopPropagation();const land=innerWidth>innerHeight,want=land?'portrait':'landscape';try{if(!document.fullscreenElement)await document.documentElement.requestFullscreen?.();await screen.orientation.lock(want);notify(land?'📱 Telefono in verticale':'📱 Telefono in orizzontale');}catch{notify(land?'📱 Ruota il telefono in verticale: lo schermo si adatta da solo':'📱 Ruota il telefono in orizzontale');}};const x=root.querySelector('.ph-x');let tapped=0;const go=e=>{e.stopPropagation();e.preventDefault?.();if(Date.now()-tapped<350)return;tapped=Date.now();if(view!=='home'&&calls.state==='idle')home();else close();};x.onclick=go;x.addEventListener('pointerup',go);x.addEventListener('touchend',go,{passive:false});}root.addEventListener('click',e=>{if(e.target===root)close();});
 addEventListener('keydown',e=>{if(e.key==='Escape'&&!root.hidden)close();});
 // Indietro di Android (tasto o gesto): nel telefono torna alla schermata precedente, poi chiude; altrimenti chiude la finestra aperta in cima.
 const back=()=>{if(!root.hidden){if(view!=='home'&&calls.state==='idle'){home();}else close();return true;}
  const btn=[...document.querySelectorAll('button[aria-label^="Chiudi"],button.close,.close-btn')].filter(b=>b.offsetParent!==null&&!root.contains(b)).pop();if(btn){btn.click();return true;}return false;};
 window.humanaBack=back;
 return {open,close};
}
