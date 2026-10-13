import * as THREE from '../vendor/three/three.module.min.js';

// Two wave scales, filtered towards the horizon. No reflection render target,
// extra geometry or extra draw call is required on the mobile profile.
export function finishSea(material,skyColor){
 material.onBeforeCompile=shader=>{
  shader.uniforms.seaSky={value:skyColor};
  shader.fragmentShader='uniform vec3 seaSky;\n'+shader.fragmentShader;
  // Il mare usa la normalMap in spazio tangente (USE_NORMALMAP_TANGENTSPACE): si cambia la riga "vec3 mapN = ..." di quel ramo.
  // La stessa lettura senza "vec3 mapN =" sta anche nel ramo object-space, che per il mare non viene compilato.
  shader.fragmentShader=shader.fragmentShader.replace('#include <normal_fragment_maps>',
   THREE.ShaderChunk.normal_fragment_maps.replace(
    'vec3 mapN = texture2D( normalMap, vNormalMapUv ).xyz * 2.0 - 1.0;',
    `vec3 mapN = (mix(vec3(0.5,0.5,1.0), texture2D(normalMap,vNormalMapUv).xyz,
      clamp(1.0-length(fwidth(vNormalMapUv))*8.0,0.0,1.0))*0.65
      +mix(vec3(0.5,0.5,1.0),texture2D(normalMap,mat2(0.8,-0.6,0.6,0.8)*vNormalMapUv*0.23+vec2(0.31,0.67)).xyz,
      clamp(1.0-length(fwidth(vNormalMapUv))*2.0,0.0,1.0))*0.35)*2.0-1.0;`));
  shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
   float seaFresnel=pow(1.0-clamp(dot(normal,normalize(vViewPosition)),0.0,1.0),4.0);
   outgoingLight=mix(outgoingLight,seaSky*0.72,seaFresnel*0.55);
   #include <opaque_fragment>`);
 };
 material.customProgramCacheKey=()=> 'napoli-sea-330-tangent';
 return material;
}
