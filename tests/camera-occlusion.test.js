import test from 'node:test';
import assert from 'node:assert/strict';
import {firstBuildingSegmentHit} from '../client/world/camera-occlusion.js';

const box=(minX,minZ,maxX,maxZ,height=20)=>({polygon:[[minX,minZ],[maxX,minZ],[maxX,maxZ],[minX,maxZ]],height});

test('camera ray stops at the nearest building footprint below its roof',()=>{
 const first=box(3,-2,4,2),second=box(6,-2,7,2),hit=firstBuildingSegmentHit({x:0,y:1.6,z:0},{x:10,y:2.8,z:0},[second,first]);
 assert.equal(hit.building,first);
 assert.ok(Math.abs(hit.t-.3)<1e-9);
 assert.ok(Math.abs(hit.distance-Math.hypot(10,1.2)*.3)<1e-9);
});

test('camera ray ignores roofs above it and polygons it does not cross',()=>{
 const roof=box(3,-2,4,2,2),side=box(3,3,4,4,20);
 assert.equal(firstBuildingSegmentHit({x:0,y:4,z:0},{x:10,y:4,z:0},[roof,side]),null);
});

test('camera ray retracts when it starts inside a building footprint',()=>{
 const hit=firstBuildingSegmentHit({x:3.5,y:1.6,z:0},{x:10,y:2,z:0},[box(3,-2,4,2)]);
 assert.equal(hit.t,0);
 assert.equal(hit.distance,0);
});
