import {defaultFrameRateLimit} from './frame-rate.js';

const PROFILES=[
 {id:'min',name:'Bassa',note:'Più leggera per telefoni meno potenti'},
 {id:'med',name:'Media',note:'Equilibrio per smartphone'},
 {id:'high',name:'Alta',note:'Più dettaglio per PC e tablet'},
 {id:'ultra',name:'Ultra',note:'Qualità massima sui dispositivi compatibili'}
];
const choice=(title,values,value,onChange)=>{
 const row=document.createElement('div');row.className='gs-row';
 const copy=document.createElement('div');copy.className='gs-copy';
 const label=document.createElement('strong');label.textContent=title;copy.append(label);
 const controls=document.createElement('div');controls.className='gs-options';
 const buttons=[];
 for(const [id,name] of values){const b=document.createElement('button');b.type='button';b.textContent=name;b.dataset.value=id;b.setAttribute('aria-pressed',String(id===value));b.onclick=()=>{for(const q of buttons)q.setAttribute('aria-pressed',String(q===b));onChange(id);};buttons.push(b);controls.append(b);}
 row.append(copy,controls);return row;
};
const read=(key,fallback)=>{try{return localStorage.getItem(key)??fallback;}catch{return fallback;}};

export function openGraphicsSettings({modal,getWorld=()=>null}){
 const box=modal('Impostazioni di gioco');
 const root=document.createElement('section');root.className='graphics-settings';root.setAttribute('aria-label','Impostazioni grafiche');
 const state={
  profile:read('humana-gfx',getWorld()?.gfx||'med'),
  fps:read('humana-fps-limit',String(defaultFrameRateLimit())),adaptive:read('humana-adaptive-graphics','on'),
  shadows:read('humana-shadows','auto'),shadowQuality:read('humana-shadow-quality','high'),
  ao:read('humana-ao','on'),detail:read('humana-detail','high'),effects:read('humana-effects','on'),
  distance:Number(read('humana-distance',''))||((getWorld()?.mobile)?260:420)
 };
 const intro=document.createElement('p');intro.className='gs-intro';intro.textContent='Scegli una configurazione adatta al tuo dispositivo. Sui telefoni più potenti il limite predefinito è 60 FPS; sui dispositivi meno potenti resta a 30 FPS.';root.append(intro);
 const profileTitle=document.createElement('h3');profileTitle.textContent='Profilo grafico';root.append(profileTitle);
 const cards=document.createElement('div');cards.className='gs-profiles';const profileButtons=[];
 for(const profile of PROFILES){const b=document.createElement('button');b.type='button';b.className='gs-profile';b.setAttribute('aria-pressed',String(state.profile===profile.id));b.innerHTML='<strong></strong><small></small>';b.querySelector('strong').textContent=profile.name;b.querySelector('small').textContent=profile.note;b.onclick=()=>{state.profile=profile.id;profileButtons.forEach(q=>q.setAttribute('aria-pressed',String(q===b)));};profileButtons.push(b);cards.append(b);}root.append(cards);
 const qualityTitle=document.createElement('h3');qualityTitle.textContent='Qualità e prestazioni';root.append(qualityTitle);
 root.append(choice('Limite fotogrammi',[['30','30 FPS'],['60','60 FPS']],state.fps,v=>state.fps=v));
 root.append(choice('Ombre',[['off','No'],['auto','Auto'],['on','Sì']],state.shadows,v=>state.shadows=v));
 root.append(choice('Qualità ombre',[['low','Bassa'],['medium','Media'],['high','Alta'],['ultra','Ultra']],state.shadowQuality,v=>state.shadowQuality=v));
 root.append(choice('Dettagli degli elementi',[['low','Bassi'],['medium','Medi'],['high','Alti']],state.detail,v=>state.detail=v));
 const toggle=(title,key)=>{const row=document.createElement('label');row.className='gs-toggle';const span=document.createElement('span');span.textContent=title;const input=document.createElement('input');input.type='checkbox';input.checked=state[key]==='on';input.onchange=()=>state[key]=input.checked?'on':'off';row.append(span,input);return row;};
 root.append(toggle('Grafica adattiva: regola la risoluzione se gli FPS calano','adaptive'),toggle('Occlusione ambientale','ao'),toggle('Effetti di immagine cinematografici','effects'));
 const distance=document.createElement('label');distance.className='gs-distance';const head=document.createElement('span');head.innerHTML='<strong>Distanza di visualizzazione</strong><output></output>';const slider=document.createElement('input');slider.type='range';slider.min='180';slider.max='900';slider.step='20';slider.value=String(state.distance);const output=head.querySelector('output');const paint=()=>output.textContent=slider.value+' m';slider.oninput=()=>{state.distance=Number(slider.value);paint();};paint();distance.append(head,slider);root.append(distance);
 const note=document.createElement('p');note.className='gs-note';note.setAttribute('role','status');note.textContent='FPS, ombre, distanza ed effetti si applicano subito. Cambiare profilo grafico richiede il riavvio della scena.';
 const actions=document.createElement('div');actions.className='gs-actions';const save=document.createElement('button');save.type='button';save.className='gs-apply';save.textContent='Applica impostazioni';const back=document.createElement('button');back.type='button';back.className='gs-back';back.textContent='Indietro';back.onclick=()=>{document.getElementById('settings')?.click();};
 save.onclick=()=>{try{localStorage.setItem('humana-gfx',state.profile);localStorage.setItem('humana-fps-limit',state.fps);localStorage.setItem('humana-adaptive-graphics',state.adaptive);localStorage.setItem('humana-shadows',state.shadows);localStorage.setItem('humana-shadow-quality',state.shadowQuality);localStorage.setItem('humana-detail',state.detail);localStorage.setItem('humana-ao',state.ao);localStorage.setItem('humana-effects',state.effects);localStorage.setItem('humana-distance',String(state.distance));}catch{}
  dispatchEvent(new Event('humana:graphics-settings'));const world=getWorld();if(world&&world.gfx!==state.profile){note.textContent='Profilo salvato. Ricarico la scena per applicare il nuovo livello grafico…';setTimeout(()=>location.reload(),250);return;}
  world?.applyGraphicsSettings?.();note.textContent='Impostazioni applicate. Il limite FPS entra in vigore subito.';};
 actions.append(save,back);root.append(note,actions);box.append(root);return root;
}
