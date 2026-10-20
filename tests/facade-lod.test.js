import test from 'node:test';
import assert from 'node:assert/strict';
import {hasFacadeDetail} from '../client/world/facade-lod.js';

const keys=['pl','bg','gl','sh','ir','dr','fl'];

test('facade LOD keeps the base wall when the generated detail is empty or invalid',()=>{
 assert.equal(hasFacadeDetail({pl:{p:[]},ao:{p:[0,0,0,1,0,0,1,1,0]}},keys),false,'ambient occlusion alone is not a replacement wall');
 assert.equal(hasFacadeDetail({pl:{p:[0,0,0,1,0,0,1,1,0]}},keys),true);
 assert.equal(hasFacadeDetail({pl:{p:[0,0,0,1,0,0,NaN,1,0]}},keys),false,'invalid vertices cannot hide the intact fallback');
});
