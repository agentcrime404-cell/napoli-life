import test from 'node:test';
import assert from 'node:assert/strict';
import {browserMemory,framePercentile} from '../client/ui/performance-panel.js';

test('diagnostica: P95 frame time usa campioni validi e restituisce millisecondi',()=>{
 assert.equal(framePercentile([16.6,16.7,17,20,100],.95),100);
 assert.equal(framePercentile([16.6,16.7,17,20,100],.8),20);
 assert.equal(framePercentile([0,-1,NaN],.95),null);
});

test('diagnostica: distingue heap libera browser e RAM dispositivo stimata',()=>{
 assert.deepEqual(browserMemory({memory:{usedJSHeapSize:64*1048576,jsHeapSizeLimit:512*1048576}},{deviceMemory:8}),{
  heapFreeMb:448,heapUsedMb:64,deviceRamGbEstimate:8
 });
 assert.deepEqual(browserMemory({},{}),{heapFreeMb:null,heapUsedMb:null,deviceRamGbEstimate:null});
});
