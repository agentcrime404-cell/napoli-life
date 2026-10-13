const clamp=(n,a,b)=>Math.max(a,Math.min(b,Number(n)||0));

// Stato input separato per pointerId: sterzo, pedali e gesti esterni restano indipendenti.
export class VehicleInputState{
 constructor(){this.pointers=new Map();this.steer=0;}
 pointerDown(id,action,value=0){this.pointers.set(id,{action,value:clamp(value,-1,1)});}
 pointerMove(id,value){const p=this.pointers.get(id);if(p?.action==='steer')p.value=clamp(value,-1,1);}
 pointerUp(id){this.pointers.delete(id);}
 isHeld(action,keys=new Set()){return [...this.pointers.values()].some(p=>p.action===action)||(action==='brake'&&(keys.has('KeyS')||keys.has('ArrowDown')));}
 peek(keys=new Set()){
  const entries=[...this.pointers.values()],steerPointers=entries.filter(p=>p.action==='steer'),steerPointer=steerPointers[steerPointers.length-1];
  const keyLeft=keys.has('KeyA')||keys.has('ArrowLeft'),keyRight=keys.has('KeyD')||keys.has('ArrowRight');
  const target=steerPointer?steerPointer.value:(Number(keyRight)-Number(keyLeft));
  const brake=entries.some(p=>p.action==='brake')||keys.has('KeyS')||keys.has('ArrowDown');
  const throttle=entries.some(p=>p.action==='gas')||keys.has('KeyW')||keys.has('ArrowUp');
  return {drive:true,steer:clamp(this.steer,-1,1),steeringTarget:clamp(target,-1,1),throttle:throttle&&!brake?1:0,brake:brake?1:0};
 }
 reset(){this.pointers.clear();this.steer=0;}
 read(dt=1/30,keys=new Set()){
  const entries=[...this.pointers.values()],steerPointers=entries.filter(p=>p.action==='steer'),steerPointer=steerPointers[steerPointers.length-1];
  const keyLeft=keys.has('KeyA')||keys.has('ArrowLeft'),keyRight=keys.has('KeyD')||keys.has('ArrowRight');
  const target=steerPointer?steerPointer.value:(Number(keyRight)-Number(keyLeft));
  const safeDt=clamp(dt,0,.1),rate=Math.abs(target)>Math.abs(this.steer)?15:7;
  this.steer+=(target-this.steer)*(1-Math.exp(-rate*safeDt));
  const held=action=>entries.some(p=>p.action===action);
  const brake=held('brake')||keys.has('KeyS')||keys.has('ArrowDown');
  const throttle=held('gas')||keys.has('KeyW')||keys.has('ArrowUp');
  return {drive:true,steer:clamp(this.steer,-1,1),throttle:throttle&&!brake?1:0,brake:brake?1:0};
 }
}

// Gli stessi binding sono usati dal gioco e dal banco prova: ogni dito resta associato al proprio comando.
export function bindVehicleControls(root,state){
 const steerPad=root.querySelector('.dh-steer'),steerThumb=root.querySelector('.dh-steer-thumb');
 const steerValue=e=>{const r=steerPad.getBoundingClientRect();return clamp((e.clientX-r.left-r.width/2)/(r.width*.38),-1,1);};
 const showSteer=e=>{const value=steerValue(e);state.pointerMove(e.pointerId,value);steerThumb.style.transform=`translateX(${value*Math.max(0,steerPad.clientWidth*.34)}px)`;steerPad.setAttribute('aria-valuenow',String(Math.round(value*100)));};
 const steerDown=e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();try{steerPad.setPointerCapture(e.pointerId);}catch{}state.pointerDown(e.pointerId,'steer',steerValue(e));steerPad.classList.add('active');showSteer(e);};
 const steerMove=e=>{if(state.pointers.get(e.pointerId)?.action!=='steer')return;e.preventDefault();showSteer(e);};
 const release=e=>{state.pointerUp(e.pointerId);if(![...state.pointers.values()].some(p=>p.action==='steer')){steerPad.classList.remove('active');steerThumb.style.transform='';steerPad.setAttribute('aria-valuenow','0');}};
 steerPad.addEventListener('pointerdown',steerDown,{passive:false});steerPad.addEventListener('pointermove',steerMove,{passive:false});
 for(const event of ['pointerup','pointercancel','lostpointercapture'])steerPad.addEventListener(event,release,{passive:false});
 root.querySelectorAll('.dh-pedals [data-drive]').forEach(button=>{button.addEventListener('pointerdown',e=>{if(e.pointerType==='mouse'&&e.button!==0)return;e.preventDefault();e.stopPropagation();try{button.setPointerCapture(e.pointerId);}catch{}state.pointerDown(e.pointerId,button.dataset.drive);button.classList.add('active');},{passive:false});for(const event of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(event,e=>{state.pointerUp(e.pointerId);button.classList.remove('active');},{passive:false});});
 return {reset(){state.reset();steerPad.classList.remove('active');steerThumb.style.transform='';steerPad.setAttribute('aria-valuenow','0');root.querySelectorAll('[data-drive]').forEach(button=>button.classList.remove('active'));},state};
}
