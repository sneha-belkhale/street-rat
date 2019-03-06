const ParallaxCorrectPhysicalMaterial = {
    fragmentShader: `
  #define PHYSICAL
  uniform vec3 diffuse;
  uniform vec3 emissive;
  uniform float roughness;
  uniform float metalness;
  uniform float opacity;
  #ifndef STANDARD
  	uniform float clearCoat;
  	uniform float clearCoatRoughness;
  #endif
  varying vec3 vViewPosition;
  #ifndef FLAT_SHADED
  	varying vec3 vNormal;
  #endif
  #include <common>
  #include <packing>
  #include <dithering_pars_fragment>
  #include <color_pars_fragment>
  #include <uv_pars_fragment>
  #include <uv2_pars_fragment>
  #include <map_pars_fragment>
  #include <alphamap_pars_fragment>
  #include <aomap_pars_fragment>
  #include <lightmap_pars_fragment>
  #include <emissivemap_pars_fragment>
  #include <bsdfs>
  #include <cube_uv_reflection_fragment>
  #include <roughnessmap_pars_fragment>

  #if defined( USE_ENVMAP ) || defined( PHYSICAL )
   	uniform float reflectivity;
   	uniform float envMapIntensity;
   #endif
   #ifdef USE_ENVMAP

    #ifdef PARALLAX_CORRECT
      uniform vec3 cubeMapSize;
      uniform vec3 cubeMapPos;
      varying vec3 vWorldPosition;

      vec3 parallaxCorrectNormal( vec3 v, vec3 cubeSize, vec3 cubePos ) {

        vec3 nDir = normalize(v);
        vec3 rbmax = (   .5 * ( cubeSize + cubePos ) + cubePos - vWorldPosition ) / nDir;
        vec3 rbmin = ( - .5 * ( cubeSize - cubePos ) + cubePos - vWorldPosition ) / nDir;

        vec3 rbminmax;
        rbminmax.x = ( nDir.x > 0. )?rbmax.x:rbmin.x;
        rbminmax.y = ( nDir.y > 0. )?rbmax.y:rbmin.y;
        rbminmax.z = ( nDir.z > 0. )?rbmax.z:rbmin.z;

        float correction = min(min(rbminmax.x, rbminmax.y), rbminmax.z);
        vec3 boxIntersection = vWorldPosition + nDir * correction;

        return boxIntersection - cubePos;
      }
    #endif
   	#if ! defined( PHYSICAL ) && ( defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) )
   		varying vec3 vWorldPosition;
   	#endif
   	#ifdef ENVMAP_TYPE_CUBE
   		uniform samplerCube envMap;
   	#else
   		uniform sampler2D envMap;
   	#endif
   	uniform float flipEnvMap;
   	uniform int maxMipLevel;
   	#if defined( USE_BUMPMAP ) || defined( USE_NORMALMAP ) || defined( PHONG ) || defined( PHYSICAL )
   		uniform float refractionRatio;
   	#else
   		varying vec3 vReflect;
   	#endif
   #endif
   #if defined( USE_ENVMAP ) && defined( PHYSICAL )
   	vec3 getLightProbeIndirectIrradiance( const in GeometricContext geometry, const in int maxMIPLevel ) {
   		vec3 worldNormal = inverseTransformDirection( geometry.normal, viewMatrix );
   		#ifdef ENVMAP_TYPE_CUBE
        vec3 worldNormalFinal = worldNormal;
        #ifdef PARALLAX_CORRECT
         worldNormalFinal = parallaxCorrectNormal( worldNormal, cubeMapSize, cubeMapPos );
        #endif
   			vec3 queryVec = vec3( flipEnvMap * worldNormalFinal.x, worldNormalFinal.yz );
   			#ifdef TEXTURE_LOD_EXT
   				vec4 envMapColor = textureCubeLodEXT( envMap, queryVec, float( maxMIPLevel ) );
   			#else
   				vec4 envMapColor = textureCube( envMap, queryVec, float( maxMIPLevel ) );
   			#endif
   			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
   		#elif defined( ENVMAP_TYPE_CUBE_UV )
   			vec3 queryVec = vec3( flipEnvMap * worldNormal.x, worldNormal.yz );
   			vec4 envMapColor = textureCubeUV( envMap, queryVec, 1.0 );
   		#else
   			vec4 envMapColor = vec4( 0.0 );
   		#endif
   		return PI * envMapColor.rgb * envMapIntensity;
   	}
   	float getSpecularMIPLevel( const in float blinnShininessExponent, const in int maxMIPLevel ) {
   		float maxMIPLevelScalar = float( maxMIPLevel );
   		float desiredMIPLevel = maxMIPLevelScalar + 0.79248 - 0.5 * log2( pow2( blinnShininessExponent ) + 1.0 );
   		return clamp( desiredMIPLevel, 0.0, maxMIPLevelScalar );
   	}
   	vec3 getLightProbeIndirectRadiance( const in GeometricContext geometry, const in float blinnShininessExponent, const in int maxMIPLevel ) {
   		#ifdef ENVMAP_MODE_REFLECTION
   			vec3 reflectVec = reflect( -geometry.viewDir, geometry.normal );
   		#else
   			vec3 reflectVec = refract( -geometry.viewDir, geometry.normal, refractionRatio );
   		#endif
   		reflectVec = inverseTransformDirection( reflectVec, viewMatrix );
   		float specularMIPLevel = getSpecularMIPLevel( blinnShininessExponent, maxMIPLevel );
   		#ifdef ENVMAP_TYPE_CUBE
        vec3 reflectVecFinal = reflectVec;
        #ifdef PARALLAX_CORRECT
         reflectVecFinal = parallaxCorrectNormal( reflectVec, cubeMapSize, cubeMapPos );
        #endif
   			vec3 queryReflectVec = vec3( flipEnvMap * reflectVecFinal.x, reflectVecFinal.yz );
   			#ifdef TEXTURE_LOD_EXT
   				vec4 envMapColor = textureCubeLodEXT( envMap, queryReflectVec, specularMIPLevel );
   			#else
   				vec4 envMapColor = textureCube( envMap, queryReflectVec, specularMIPLevel );
   			#endif
   			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
   		#elif defined( ENVMAP_TYPE_CUBE_UV )
   			vec3 queryReflectVec = vec3( flipEnvMap * reflectVec.x, reflectVec.yz );
   			vec4 envMapColor = textureCubeUV( envMap, queryReflectVec, BlinnExponentToGGXRoughness(blinnShininessExponent ));
   		#elif defined( ENVMAP_TYPE_EQUIREC )
   			vec2 sampleUV;
   			sampleUV.y = asin( clamp( reflectVec.y, - 1.0, 1.0 ) ) * RECIPROCAL_PI + 0.5;
   			sampleUV.x = atan( reflectVec.z, reflectVec.x ) * RECIPROCAL_PI2 + 0.5;
   			#ifdef TEXTURE_LOD_EXT
   				vec4 envMapColor = texture2DLodEXT( envMap, sampleUV, specularMIPLevel );
   			#else
   				vec4 envMapColor = texture2D( envMap, sampleUV, specularMIPLevel );
   			#endif
   			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
   		#elif defined( ENVMAP_TYPE_SPHERE )
   			vec3 reflectView = normalize( ( viewMatrix * vec4( reflectVec, 0.0 ) ).xyz + vec3( 0.0,0.0,1.0 ) );
   			#ifdef TEXTURE_LOD_EXT
   				vec4 envMapColor = texture2DLodEXT( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );
   			#else
   				vec4 envMapColor = texture2D( envMap, reflectView.xy * 0.5 + 0.5, specularMIPLevel );
   			#endif
   			envMapColor.rgb = envMapTexelToLinear( envMapColor ).rgb;
   		#endif
   		return envMapColor.rgb * envMapIntensity;
   	}
  #endif
  #include <fog_pars_fragment>
  #include <lights_pars_begin>
  #include <lights_physical_pars_fragment>
  #include <shadowmap_pars_fragment>
  #include <bumpmap_pars_fragment>
  #include <normalmap_pars_fragment>
  #include <metalnessmap_pars_fragment>
  #include <logdepthbuf_pars_fragment>
  #include <clipping_planes_pars_fragment>
  void main() {
  	#include <clipping_planes_fragment>
  	vec4 diffuseColor = vec4( diffuse, opacity );
  	ReflectedLight reflectedLight = ReflectedLight( vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ), vec3( 0.0 ) );
  	vec3 totalEmissiveRadiance = emissive;
  	#include <logdepthbuf_fragment>
  	#include <map_fragment>
  	#include <color_fragment>
  	#include <alphamap_fragment>
  	#include <alphatest_fragment>
  	#include <roughnessmap_fragment>
  	#include <metalnessmap_fragment>
  	#include <normal_fragment_begin>
  	#include <normal_fragment_maps>
  	#include <emissivemap_fragment>
  	#include <lights_physical_fragment>
  	#include <lights_fragment_begin>
  	#include <lights_fragment_maps>
  	#include <lights_fragment_end>
  	#include <aomap_fragment>
  	vec3 outgoingLight = reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + reflectedLight.directSpecular + reflectedLight.indirectSpecular + totalEmissiveRadiance;
  	gl_FragColor = vec4( outgoingLight, diffuseColor.a );
  	#include <tonemapping_fragment>
  	#include <encodings_fragment>
  	#include <fog_fragment>
  	#include <premultiplied_alpha_fragment>
  	#include <dithering_fragment>
  }
  `,

    vertexShader: `
  #define PHYSICAL
  varying vec3 vViewPosition;
  #ifndef FLAT_SHADED
  	varying vec3 vNormal;
  #endif
  #include <common>
  #include <uv_pars_vertex>
  #include <uv2_pars_vertex>
  #include <displacementmap_pars_vertex>
  #include <color_pars_vertex>
  #include <fog_pars_vertex>
  #include <morphtarget_pars_vertex>
  #include <skinning_pars_vertex>
  #include <shadowmap_pars_vertex>
  #include <logdepthbuf_pars_vertex>
  #include <clipping_planes_pars_vertex>
  #ifdef PARALLAX_CORRECT
    varying vec3 vWorldPosition;
  #endif
  void main() {
  	#include <uv_vertex>
  	#include <uv2_vertex>
  	#include <color_vertex>
  	#include <beginnormal_vertex>
  	#include <morphnormal_vertex>
  	#include <skinbase_vertex>
  	#include <skinnormal_vertex>
  	#include <defaultnormal_vertex>
  #ifndef FLAT_SHADED
  	vNormal = normalize( transformedNormal );
  #endif
  	#include <begin_vertex>
  	#include <morphtarget_vertex>
  	#include <skinning_vertex>
  	#include <displacementmap_vertex>
  	#include <project_vertex>
  	#include <logdepthbuf_vertex>
  	#include <clipping_planes_vertex>
  	vViewPosition = - mvPosition.xyz;
    #if defined( USE_ENVMAP ) || defined( DISTANCE ) || defined ( USE_SHADOWMAP )
    	vec4 worldPosition = modelMatrix * vec4( transformed, 1.0 );
      #ifdef PARALLAX_CORRECT
        vWorldPosition = worldPosition.xyz;
      #endif
    #endif
  	#include <shadowmap_vertex>
  	#include <fog_vertex>
  }
  `
};

export default ParallaxCorrectPhysicalMaterial;
