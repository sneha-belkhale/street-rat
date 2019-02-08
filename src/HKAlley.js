import Stats from 'stats-js'
import GlowShader from './GlowShader'
import ParallaxCorrectPhysicalMaterial from './ParallaxCorrectPhysicalMaterial'
import WorldGrid from './WorldGrid'
import HeroMover from './HeroMover'
import EnvMapController from './EnvMapController'

import initRect from './rectAreaLights'
initRect()
var THREE = require('three');
var OrbitControls = require('three-orbit-controls')(THREE);

var scene, camera, renderer, controls;
var mouse, stats, envMapController;
var cubeCamera, groundFloor;
var worldGrid;

export default function initWebScene() {
  /** BASIC THREE SETUP **/
  scene = new THREE.Scene();
  //set up camera
  camera = new THREE.PerspectiveCamera( 35, window.innerWidth / window.innerHeight, 1, 100000 );
  camera.position.set(372, 156,372)
  scene.add( camera );
  //set up controls
  controls = new OrbitControls(camera);
  //restrict movement to stay within the room
  renderer = new THREE.WebGLRenderer({antialias:true});
  renderer.antialias = true
  renderer.setSize( window.innerWidth, window.innerHeight );
  document.body.appendChild( renderer.domElement );
  // window.addEventListener('keydown', moveHero)
  //set up stats
  stats = new Stats();
  stats.showPanel( 0 );
  document.body.appendChild( stats.dom );

  /** LIGHTS **/
  var neonPos = new THREE.Vector3(10,10,-45)
  var rectLight = new THREE.RectAreaLight( 0xff00ff, 800,  5, 5 );
  rectLight.position.copy( neonPos );
  rectLight.lookAt( 0, 0, -1 );
  scene.add( rectLight )

  var pointLight = new THREE.PointLight()
  pointLight.position.set(0,50,0)
  scene.add(pointLight)

  /** SCENE ROOM SETUP **/
  // Create cube camera
  cubeCamera = new THREE.CubeCamera( 1, 1000, 128 );
  cubeCamera.renderTarget.texture.generateMipmaps = true;
	cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
  cubeCamera.renderTarget.texture.magFilter = THREE.LinearFilter;
  cubeCamera.renderTarget.texture.mapping = THREE.CubeReflectionMapping;
  scene.add( cubeCamera );

  var physicalShader = THREE.ShaderLib.physical;

  var uniforms = ({
     cubeMapSize : {type: 'v3', value: new THREE.Vector3(200,200,100)},
     cubeMapPos : {type: 'v3', value: new THREE.Vector3(0,-50,0)},
   });
   var chromeUniforms = THREE.UniformsUtils.merge([physicalShader.uniforms, uniforms]);

  var chromeMaterial = new THREE.ShaderMaterial({
    uniforms: chromeUniforms,
    vertexShader: ParallaxCorrectPhysicalMaterial.vertexShader,
    fragmentShader: ParallaxCorrectPhysicalMaterial.fragmentShader,
    transparent: true,
    lights: true,
    defines: {
      PARALLAX_CORRECT: ''
    }
  });

  var loader = new THREE.TextureLoader()
  var tex = loader.load(require('./assets/spec.jpg'))
  chromeMaterial.uniforms.roughnessMap.value =tex
  chromeMaterial.uniforms.roughnessMap.value.needsUpdate = true
  chromeMaterial.uniforms.roughness.value = 1.0
  chromeMaterial.roughnessMap = tex;

  groundFloor = new THREE.Mesh( new THREE.PlaneGeometry(200,100), chromeMaterial);
  chromeMaterial.uniforms.envMap.value = cubeCamera.renderTarget.texture;
  chromeMaterial.uniforms.envMap.value.needsUpdate = true
  chromeMaterial.uniforms.flipEnvMap.value = true

  groundFloor.rotateX(-Math.PI/2)

  chromeMaterial.envMap = cubeCamera.renderTarget.texture;
  chromeMaterial.envMap.needsUpdate = true;
  groundFloor.position.set(0,-49,0)
  groundFloor.geometry.computeVertexNormals()
  scene.add( groundFloor );
  cubeCamera.position.copy(groundFloor.position)

  //add something glow
  var glowTorusGeo = new THREE.TorusGeometry(10,0.5,20,60)
  var glowMat = new THREE.ShaderMaterial ({
    uniforms : {},
    vertexShader: GlowShader.vertexShader,
    fragmentShader: GlowShader.fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    blending:THREE.AdditiveBlending,
  });
  var glowTorus = new THREE.Mesh(glowTorusGeo, glowMat)
  scene.add(glowTorus)
  glowTorus.position.copy(neonPos)

  var glowTorusMain = new THREE.Mesh(glowTorusGeo, new THREE.MeshPhysicalMaterial({
    emissive: new THREE.Color("#ff00ff")
  }))
  scene.add(glowTorusMain)
  glowTorusMain.position.copy(neonPos)

  var roomWall = new THREE.Mesh(new THREE.BoxGeometry(200,100,100), new THREE.MeshPhysicalMaterial({
    side: THREE.BackSide,
    map: loader.load(require('./assets/checkerboard.png'))
  }))
  scene.add(roomWall)

  worldGrid = new WorldGrid(300,200,300, new THREE.Vector3(150,100,150))
  worldGrid.fillGridForMesh(roomWall, scene)
  worldGrid.fillGridForMesh(glowTorusMain, scene)

  mouse = new THREE.Mesh(new THREE.BoxGeometry(5,5,5), new THREE.MeshPhysicalMaterial())
  scene.add(mouse)
  mouse.position.y = -40
  mouse.geometry.computeBoundingBox()

  var heroMover = new HeroMover(mouse, worldGrid);
  envMapController = new EnvMapController([groundFloor, mouse], cubeCamera, renderer, scene)
  update()
}

function update() {
    requestAnimationFrame(update);
    controls.update()
    // Update the render target cube
    stats.begin()
    envMapController.update()
    groundFloor.material.uniforms.maxMipLevel.value = renderer.properties.get( groundFloor.material.envMap ).__maxMipLevel;
    renderer.render( scene, camera );
    stats.end()
}
