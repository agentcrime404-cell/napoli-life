import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Controls} from '../client/player/controls.js';
function fixture(){
 const handlers={};globalThis.addEventListener=(name,fn)=>handlers[name]=fn;
 globalThis.document={activeElement:{tagName:'BODY'},hidden:false,addEventListener:(name,fn)=>handlers[name]=fn};
 const element=()=>{const classes=new Set(),attrs=new Map(),captures=new Set();return {firstElementChild:{style:{}},classList:{add(name){classes.add(name);},remove(name){classes.delete(name);},toggle(name,force){if(force)classes.add(name);else classes.delete(name);},contains:name=>classes.has(name)},setAttribute:(name,value)=>attrs.set(name,value),getAttribute:name=>attrs.get(name),setPointerCapture:id=>captures.add(id),hasPointerCapture:id=>captures.has(id),releasePointerCapture:id=>{captures.delete(id);},getBoundingClientRect:()=>({x:0,y:0,width:100,height:100})};};
 const stick=element(),run=element(),controls=new Controls(stick,run,()=>{});return {handlers,stick,run,controls};
}
test('Multitouch: corsa resta attiva dopo il tocco e il joystick si rilascia senza input fantasma',()=>{
 const {stick,run,controls}=fixture(),event={preventDefault(){},stopPropagation(){}};stick.onpointerdown({...event,pointerId:1,clientX:80,clientY:50});run.onpointerdown({...event,pointerId:2});
 assert.ok(controls.input().x>0);assert.equal(controls.input().run,true);
 stick.onpointerup({pointerId:2});assert.ok(controls.input().x>0);
 run.onpointerup({pointerId:2});run.onlostpointercapture({pointerId:2});assert.equal(controls.input().run,true);assert.equal(run.getAttribute('aria-pressed'),'true');
 stick.onpointercancel({pointerId:1});assert.equal(controls.input().x,0);assert.equal(controls.input().run,true);
 run.onpointerdown({...event,pointerId:3});run.onpointerup({pointerId:3});assert.equal(controls.input().run,false);assert.equal(run.getAttribute('aria-pressed'),'false');
});
test('un tocco annullato sul comando corsa ripristina lo stato precedente',()=>{
 const {run,controls}=fixture(),event={preventDefault(){},stopPropagation(){}};
 run.onpointerdown({...event,pointerId:4});assert.equal(controls.input().run,true);
 run.onpointercancel({pointerId:4});assert.equal(controls.input().run,false);assert.equal(run.getAttribute('aria-pressed'),'false');
 run.onpointerdown({...event,pointerId:5});run.onpointerup({pointerId:5});
 run.onpointerdown({...event,pointerId:6});run.onlostpointercapture({pointerId:6});
 assert.equal(controls.input().run,true);assert.equal(run.getAttribute('aria-pressed'),'true');
});
test('Shift resta una corsa momentanea indipendente dal toggle mobile',()=>{
 const {handlers,run,controls}=fixture(),event={preventDefault(){},stopPropagation(){}};
 handlers.keydown({code:'ShiftLeft',preventDefault(){}});assert.equal(controls.input().run,true);
 handlers.keyup({code:'ShiftLeft'});assert.equal(controls.input().run,false);
 run.onpointerdown({...event,pointerId:7});run.onpointerup({pointerId:7});
 handlers.keydown({code:'ShiftRight',preventDefault(){}});handlers.keyup({code:'ShiftRight'});
 assert.equal(controls.input().run,true);
 controls.reset();assert.equal(controls.input().run,false);assert.equal(run.getAttribute('aria-pressed'),'false');
});
test('Cambio app, chat e menu azzerano gli input',()=>{
 const {handlers,controls}=fixture();handlers.keydown({code:'KeyW',preventDefault(){}});assert.notEqual(controls.input().x,0);
 handlers.blur();assert.equal(controls.input().x,0);
 handlers.keydown({code:'KeyD',preventDefault(){}});document.activeElement.tagName='INPUT';handlers.focusin();assert.equal(controls.input().x,0);
 controls.enabled=false;handlers.keydown({code:'KeyW',preventDefault(){}});assert.equal(controls.input().x,0);
});
