import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Controls} from '../client/player/controls.js';
function fixture(){
 const handlers={};globalThis.addEventListener=(name,fn)=>handlers[name]=fn;
 globalThis.document={activeElement:{tagName:'BODY'},hidden:false,addEventListener:(name,fn)=>handlers[name]=fn};
 const element=()=>({firstElementChild:{style:{}},classList:{add(){},remove(){}},setPointerCapture(){},getBoundingClientRect:()=>({x:0,y:0,width:100,height:100})});
 const stick=element(),run=element(),controls=new Controls(stick,run,()=>{});return {handlers,stick,run,controls};
}
test('Multitouch: joystick e corsa indipendenti, rilascio non lascia movimento bloccato',()=>{
 const {stick,run,controls}=fixture(),event={preventDefault(){},stopPropagation(){}};stick.onpointerdown({...event,pointerId:1,clientX:80,clientY:50});run.onpointerdown({...event,pointerId:2});
 assert.ok(controls.input().x>0);assert.equal(controls.input().run,true);
 stick.onpointerup({pointerId:2});assert.ok(controls.input().x>0);
 stick.onpointercancel({pointerId:1});assert.equal(controls.input().x,0);assert.equal(controls.input().run,true);
 run.onlostpointercapture({pointerId:2});assert.equal(controls.input().run,false);
});
test('Cambio app, chat e menu azzerano gli input',()=>{
 const {handlers,controls}=fixture();handlers.keydown({code:'KeyW',preventDefault(){}});assert.notEqual(controls.input().x,0);
 handlers.blur();assert.equal(controls.input().x,0);
 handlers.keydown({code:'KeyD',preventDefault(){}});document.activeElement.tagName='INPUT';handlers.focusin();assert.equal(controls.input().x,0);
 controls.enabled=false;handlers.keydown({code:'KeyW',preventDefault(){}});assert.equal(controls.input().x,0);
});
