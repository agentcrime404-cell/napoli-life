import {test} from 'node:test';
import assert from 'node:assert/strict';
import {VehicleInputState} from '../client/player/vehicle-input.js';

test('Guida mobile: sterzo analogico, acceleratore e camera usano pointer ID indipendenti',()=>{
 const input=new VehicleInputState();
 input.pointerDown(11,'steer',.8);
 input.pointerDown(22,'gas');
 input.pointerDown(33,'camera');
 const first=input.read(1/30);
 assert.ok(first.steer>0&&first.steer<.8,'lo sterzo entra in modo progressivo');
 assert.equal(first.throttle,1);
 input.pointerUp(22);
 const afterGasRelease=input.read(1/30);
 assert.equal(afterGasRelease.throttle,0,'il rilascio dell’acceleratore non azzera lo sterzo');
 assert.ok(afterGasRelease.steer>first.steer);
 input.pointerMove(11,-.55);
 const moved=input.read(1/30).steer;
 assert.ok(moved<afterGasRelease.steer,'la corsa orizzontale del dito cambia solo lo sterzo');
 input.pointerUp(11);
 const returning=input.read(1/30);
 assert.ok(Math.abs(returning.steer)<Math.abs(moved),'rilasciando il dito lo sterzo torna gradualmente al centro');
 for(let i=0;i<24;i++)input.read(1/30);
 assert.ok(Math.abs(input.read(1/30).steer)<.02,'lo sterzo rilasciato non resta bloccato');
});

test('Guida mobile: freno e acceleratore contemporanei danno priorità al freno',()=>{
 const input=new VehicleInputState();
 input.pointerDown(1,'gas');input.pointerDown(2,'brake');
 assert.deepEqual(input.read(.05),{drive:true,steer:0,throttle:0,brake:1});
 input.pointerUp(2);
 assert.equal(input.read(.05).throttle,1);
 input.reset();
 assert.deepEqual(input.read(.05),{drive:true,steer:0,throttle:0,brake:0});
});

test('Guida: la R si può mostrare quando si tiene il freno da fermo',()=>{
 const input=new VehicleInputState();
 assert.equal(input.isHeld('brake'),false);
 input.pointerDown(12,'brake');
 assert.equal(input.isHeld('brake'),true);
 input.pointerUp(12);
 assert.equal(input.isHeld('brake'),false);
 assert.equal(input.isHeld('brake',new Set(['KeyS'])),true);
 assert.equal(input.isHeld('brake',new Set(['ArrowDown'])),true);
});

test('QA guida: la lettura passiva espone i target touch senza avanzare la fisica',()=>{
 const input=new VehicleInputState();
 input.pointerDown(41,'steer',.7);input.pointerDown(42,'gas');
 const before=input.steer,peek=input.peek();
 assert.equal(peek.steeringTarget,.7);
 assert.equal(peek.throttle,1);
 assert.equal(peek.brake,0);
 assert.equal(input.steer,before,'la telemetria non deve consumare un tick di guida');
 input.pointerUp(41);input.pointerUp(42);
});

test('Guida da tastiera: sterzo dolce e comandi senza pointer',()=>{
 const input=new VehicleInputState(),keys=new Set(['ArrowLeft','ArrowUp']);
 const first=input.read(.05,keys);
 assert.ok(first.steer<0&&first.steer>-.6);
 assert.equal(first.throttle,1);
 assert.ok(input.read(.05,new Set()).steer>first.steer,'rilasciando il tasto lo sterzo rientra');
});
