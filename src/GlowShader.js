const GlowShader = {

  vertexShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main()
    {
        vNormal = normalize( normalMatrix * normal );
        vec3 newPos = position + normal;
        vec4 modelViewPosition = modelViewMatrix * vec4( newPos, 1.0 );
        vViewPosition = - normalize(modelViewPosition.xyz);
        gl_Position = projectionMatrix * modelViewPosition;
    }
`,
  fragmentShader: `
    varying vec3 vNormal;
    varying vec3 vViewPosition;
    void main()
    {
    	float intensity = pow(dot( vNormal, vViewPosition ), 1.5);
        gl_FragColor = 0.8*vec4( 1.0, 0.0, 1.0, 1.0 )*intensity ;
    }`
}

export default GlowShader
