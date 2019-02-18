import Stats from 'stats-js';
import GlowShader from './GlowShader';
import ParallaxCorrectPhysicalMaterial from './ParallaxCorrectPhysicalMaterial';
import WorldGrid from './WorldGrid';
import HeroMoverNN from './HeroMoverNN';
import EnvMapController from './EnvMapController';
import { IK, IKChain, IKJoint, IKBallConstraint, IKHelper } from './three-ik/src';
import FBXLoader from './FBXLoader'

import initRect from './rectAreaLights';
initRect();
let THREE = require('three');
let OBJLoader = require('three-obj-loader')(THREE);
let OrbitControls = require('three-orbit-controls')(THREE);

let scene, camera, renderer, controls;
let stats, envMapController, heroMover;
let cubeCamera, groundFloor;
let worldGrid;
export default function initWebScene() {
  /** BASIC THREE SETUP **/
    scene = new THREE.Scene();
    // set up camera
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 100000);
    scene.add(camera);
    // set up controls
    controls = new OrbitControls(camera);
    // restrict movement to stay within the room
    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.antialias = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    // window.addEventListener('keydown', moveHero)
    // set up stats
    stats = new Stats();
    stats.showPanel(0);
    document.body.appendChild(stats.dom);

    /** LIGHTS **/
    // var neonPos = new THREE.Vector3(10,10,-45)
    let neonPos = new THREE.Vector3(10, 10, -45);

    let rectLight = new THREE.RectAreaLight(0xff00ff, 800, 5, 5);
    rectLight.position.copy(neonPos);
    rectLight.lookAt(0, 0, -1);
    scene.add(rectLight);

    let pointLight = new THREE.PointLight();
    pointLight.position.set(0, 50, 0);
    scene.add(pointLight);

    /** SCENE ROOM SETUP **/
    // Create cube camera
    cubeCamera = new THREE.CubeCamera(1, 1000, 128);
    cubeCamera.renderTarget.texture.generateMipmaps = true;
    cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
    cubeCamera.renderTarget.texture.magFilter = THREE.LinearFilter;
    cubeCamera.renderTarget.texture.mapping = THREE.CubeReflectionMapping;
    scene.add(cubeCamera);

    let physicalShader = THREE.ShaderLib.physical;

    let uniforms = {
        cubeMapSize : { type: 'v3', value: new THREE.Vector3(200, 200, 100) },
        cubeMapPos : { type: 'v3', value: new THREE.Vector3(0, -50, 0) },
    };
    let chromeUniforms = THREE.UniformsUtils.merge([ physicalShader.uniforms, uniforms ]);

    let chromeMaterial = new THREE.ShaderMaterial({
        uniforms: chromeUniforms,
        vertexShader: ParallaxCorrectPhysicalMaterial.vertexShader,
        fragmentShader: ParallaxCorrectPhysicalMaterial.fragmentShader,
        transparent: true,
        lights: true,
        defines: {
            PARALLAX_CORRECT: ''
        }
    });

    let loader = new THREE.TextureLoader();
    let tex = loader.load(require('./assets/spec.jpg'));
    chromeMaterial.uniforms.roughnessMap.value = tex;
    chromeMaterial.uniforms.roughnessMap.value.needsUpdate = true;
    chromeMaterial.uniforms.roughness.value = 1.0;
    chromeMaterial.roughnessMap = tex;

    groundFloor = new THREE.Mesh(new THREE.PlaneGeometry(200, 100), chromeMaterial);
    chromeMaterial.uniforms.envMap.value = cubeCamera.renderTarget.texture;
    chromeMaterial.uniforms.envMap.value.needsUpdate = true;
    chromeMaterial.uniforms.flipEnvMap.value = true;

    groundFloor.rotateX(-Math.PI / 2);

    chromeMaterial.envMap = cubeCamera.renderTarget.texture;
    chromeMaterial.envMap.needsUpdate = true;
    groundFloor.position.set(0, -49, 0);
    groundFloor.geometry.computeVertexNormals();
    // scene.add(groundFloor);
    cubeCamera.position.copy(groundFloor.position);

    // add something glow
    let glowTorusGeo = new THREE.TorusGeometry(10, 0.5, 20, 60);
    let glowMat = new THREE.ShaderMaterial({
        uniforms : {},
        vertexShader: GlowShader.vertexShader,
        fragmentShader: GlowShader.fragmentShader,
        transparent: true,
        side: THREE.DoubleSide,
        blending:THREE.AdditiveBlending,
    });
    let glowTorus = new THREE.Mesh(glowTorusGeo, glowMat);
    scene.add(glowTorus);
    glowTorus.position.copy(neonPos);

    let glowTorusMain = new THREE.Mesh(glowTorusGeo, new THREE.MeshPhysicalMaterial({
        emissive: new THREE.Color('#ff00ff')
    }));
    scene.add(glowTorusMain);
    glowTorusMain.position.copy(neonPos);

    let roomWall = new THREE.Mesh(new THREE.BoxGeometry(200, 100, 100), new THREE.MeshPhysicalMaterial({
        side: THREE.BackSide,
        map: loader.load(require('./assets/checkerboard.png'))
    }));
    roomWall.geometry.computeFaceNormals();
    scene.add(roomWall);

    let hemisphere = new THREE.Mesh(new THREE.SphereGeometry(40), new THREE.MeshPhysicalMaterial({
    }));
    hemisphere.geometry.computeFaceNormals();
    hemisphere.position.set(80,-80,0)
    scene.add(hemisphere);

    let objLoader = new THREE.OBJLoader();

    objLoader.load(require('./assets/pipe-01.obj'), (asset) => {
        let mesh = asset.children[0];
        mesh.scale.set(50, 50, 50);
        // mesh.position.set(10, -40, 35);
        scene.add(mesh);
        worldGrid.fillGridForBufferMesh(mesh, scene);
    });


    worldGrid = new WorldGrid(300, 200, 300, new THREE.Vector3(150, 100, 150));
    worldGrid.fillGridForMesh(roomWall, scene);
    worldGrid.fillGridForMesh(glowTorusMain, scene);
    worldGrid.fillGridForMesh(hemisphere, scene);

    /** LOADING HERO MESH. SOMEONE HELP HERE THIS IS A MESS

    #1 set rat feet target points
    #2 iterate through the bones and add ik for two legs
    #3 start the hero mover

    **/
    var fbxLoader = new FBXLoader()

    fbxLoader.load(require('./assets/rat-03.fbx'), (ratMesh) => {
      scene.add(ratMesh)
      var hero = ratMesh;
      hero.scale.set(1,1,1)
      hero.position.set(0,-55,0)
      var bonePoints = []
      var boneGeo = new THREE.BoxGeometry(1,1,1)
      var boneMat = new THREE.MeshPhysicalMaterial({color:'0xff00ff', wireframe: true})
      var numBones = 2;
      for(var i =0 ; i < numBones; i++){
        var mesh = new THREE.Mesh(boneGeo, boneMat)
        mesh.position.set(3*(2*i - 1), -49, 2)
        bonePoints.push(mesh)
        scene.add(mesh)
      }
      console.log(ratMesh)

      var rat = ratMesh.children[0]
      rat.material = new THREE.MeshPhysicalMaterial({
        skinning: true,
        color: new THREE.Color("#0ff0ff"),
        // opacity: 0.4,
        transparent: true,
      })

      var boneGroup = ratMesh.children[1].children[0];
      var helper = new THREE.SkeletonHelper( boneGroup );
      helper.material.linewidth = 5;
      scene.add( helper )

      // rat
      //make a chain connecting the legs
      var iks = []
      for (var j = 0; j < 2; j++){
        var ik = new IK();
        const chain = new IKChain();
        var currentBone = boneGroup.children[j];
        for (let i = 0; i < 4; i++) {
          currentBone = currentBone.children[0]
          var constraints = [new IKBallConstraint(180)];
          if(i==3){
            constraints = [new IKBallConstraint(10)];
          }
          if(i==0){
            constraints = null;
          }
          // The last IKJoint must be added with a `target` as an end effector.
          const target = i === 3 ? bonePoints[Math.abs(1-j)] : null;
          chain.add(new IKJoint(currentBone, { constraints }), { target });
        }
        ik.add(chain);
        iks.push(ik)

        var helper2 = new IKHelper(ik);
        scene.add(helper2)
      }
      heroMover = new HeroMoverNN(hero, iks, bonePoints, worldGrid, camera, scene);

    },console.log,console.log)
    envMapController = new EnvMapController([ groundFloor ], cubeCamera, renderer, scene);
    update();
}

function update() {
    requestAnimationFrame(update);
    stats.begin();
    envMapController.update();
    if(heroMover){
      heroMover.update();
    }
    // sorry about dis
    groundFloor.material.uniforms.maxMipLevel.value = renderer.properties.get(groundFloor.material.envMap).__maxMipLevel;
    renderer.render(scene, camera);
    stats.end();
}
