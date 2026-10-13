import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../client/vendor/three/three.module.min.js';
import {finishSea} from '../client/world/sea-appearance.js';

// Il mare usa la normalMap in spazio tangente: le due scale di onde e l'attenuazione all'orizzonte devono stare nel ramo
// USE_NORMALMAP_TANGENTSPACE di normal_fragment_maps (il ramo object-space per il mare non viene compilato).
const branches=fragment=>{
 const start=fragment.indexOf('#ifdef USE_NORMALMAP_OBJECTSPACE'),tangent=fragment.indexOf('#elif defined( USE_NORMALMAP_TANGENTSPACE )',start),bump=fragment.indexOf('#elif defined( USE_BUMPMAP )',tangent);
 assert.ok(start>=0&&tangent>start&&bump>tangent,'normal_fragment_maps inserito per intero');
 return {object:fragment.slice(start,tangent),tangent:fragment.slice(tangent,bump)};
};
for(const [name,material] of [['MeshStandardMaterial (PC)',new THREE.MeshStandardMaterial({normalMap:new THREE.Texture()})],['MeshPhongMaterial (telefono)',new THREE.MeshPhongMaterial({normalMap:new THREE.Texture()})]]){
 test('Sea waves and horizon filtering change the tangent-space normal map branch: '+name,()=>{
  assert.equal(material.normalMapType,THREE.TangentSpaceNormalMap);
  finishSea(material,new THREE.Color('#9fc4d8'));
  const lib=material.isMeshPhongMaterial?THREE.ShaderLib.phong:THREE.ShaderLib.standard,shader={uniforms:{},vertexShader:lib.vertexShader,fragmentShader:lib.fragmentShader};
  material.onBeforeCompile(shader);
  assert.ok(!shader.fragmentShader.includes('#include <normal_fragment_maps>'));
  const {object,tangent}=branches(shader.fragmentShader);
  assert.match(tangent,/vec3 mapN = \(mix\(vec3\(0\.5,0\.5,1\.0\)/);assert.match(tangent,/mat2\(0\.8,-0\.6,0\.6,0\.8\)/);assert.match(tangent,/fwidth\(vNormalMapUv\)/);
  assert.match(tangent,/mapN\.xy \*= normalScale;/);assert.match(tangent,/normal = normalize\( tbn \* mapN \);/);
  assert.ok(!tangent.includes('vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;'),'lettura originale sostituita');
  assert.ok(!object.includes('fwidth'),'ramo object-space invariato');assert.match(object,/normal = texture2D\( normalMap, vNormalMapUv \)\.xyz \* 2\.0 - 1\.0;/);
  const open=(tangent.match(/\(/g)||[]).length,close=(tangent.match(/\)/g)||[]).length;assert.equal(open,close,'parentesi bilanciate');
  assert.match(shader.fragmentShader,/seaFresnel/);assert.ok(shader.uniforms.seaSky.value.isColor);
  assert.notEqual(material.customProgramCacheKey(),'napoli-sea-328','chiave nuova: niente programma vecchio riusato');
 });
}
