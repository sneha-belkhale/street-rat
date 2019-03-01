import Stats from 'stats-js';
import GlowShader from './shaders/GlowShader';
import ParallaxCorrectPhysicalMaterial from './shaders/ParallaxCorrectPhysicalMaterial';
import HeroMoverNN from './HeroMoverNN';
import EnvMapController from './EnvMapController';
import { IK, IKChain, IKJoint, IKBallConstraint, IKHelper } from './three-ik/src';
import FBXLoader from './libs/FBXLoader';
import SparseWorldGrid from './SparseWorldGrid';
import GLTFLoader from 'three-gltf-loader';

import initRect from './libs/rectAreaLights';
initRect();
let THREE = require('three');
let OBJLoader = require('three-obj-loader')(THREE);
let OrbitControls = require('three-orbit-controls')(THREE);

function promisifyLoader(loader, onProgress) {
    function promiseLoader(url) {
        return new Promise((resolve, reject) => {
            loader.load(url, resolve, onProgress, reject);
        });
    }
    return {
        originalLoader: loader,
        load: promiseLoader,
    };
}

let scene, camera, renderer, controls;
let stats, envMapController, heroMover;
let cubeCamera, groundFloor;
let worldGrid, backHip, tailPoint, bonePoints, vent;
var mouse = new THREE.Vector2()
export default function initWebScene() {
  /** BASIC THREE SETUP **/
    scene = new THREE.Scene();
    // set up camera
    camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 35, 100000);
    scene.add(camera);
    // set up controls
    controls = new OrbitControls(camera);
    // restrict movement to stay within the room
    renderer = new THREE.WebGLRenderer({ antialias:true });
    renderer.antialias = true;
    renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(renderer.domElement);
    document.addEventListener( 'mousemove', onDocumentMouseMove, false );
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

    const gltfLoader = promisifyLoader(new GLTFLoader());
    let gltf = gltfLoader.load('scene/scene.gltf').then((asset) => {
      // scene.add(asset.scene)
      var group = asset.scene.children[0];
      var scale = 35;
      asset.scene.scale.set(scale,scale,scale)
      asset.scene.updateMatrixWorld()
      group.children.forEach((c) => {
        var collision, mesh, instance;
        c.children.forEach((child) => {
          switch(child.name) {
            case "collision":
              collision = child;
            break;
            case "mesh":
              mesh = child;
            break;
            case "instances":
              instance = child;
            break;
          }
        })
        if(instance){
          var posArray = instance.geometry.attributes.position.array;
          var scaleArray = instance.geometry.attributes.color.array;
          var normalArray = instance.geometry.attributes.normal.array;

          for (var i = 0; i < instance.geometry.attributes.position.count; i+=3) {
            var instancedMesh = new THREE.Mesh();
            instancedMesh.geometry = mesh.geometry;
            instancedMesh.material = mesh.material;
            instancedMesh.position.set(scale*posArray[3*i], scale*posArray[3*i+1], scale*posArray[3*i+2])
            instancedMesh.scale.set(scale*scaleArray[3*i], scale*scaleArray[3*i], scale*scaleArray[3*i])
            instancedMesh.lookAt(new THREE.Vector3(instancedMesh.position.x + normalArray[3*i], instancedMesh.position.y + normalArray[3*i+1], instancedMesh.position.z +normalArray[3*i+2]))
            scene.add(instancedMesh)
            var instancedMeshCollision = new THREE.Mesh();
            instancedMeshCollision.geometry = collision.geometry;
            instancedMeshCollision.material.visible = false;
            instancedMeshCollision.position.copy(instancedMesh.position)
            instancedMeshCollision.scale.copy(instancedMesh.scale)
            instancedMeshCollision.quaternion.copy(instancedMesh.quaternion)
            scene.add(instancedMeshCollision)
            worldGrid.fillGridFromBoundingBox(instancedMeshCollision, scene, scale);
          }
        } else {
          collision.applyMatrix( c.matrixWorld );
          // collision.material.visible = false;
          mesh.applyMatrix( c.matrixWorld );
          scene.add( mesh );
          scene.add(collision)
          worldGrid.fillGridFromBoundingBox(collision, scene, scale);
        }
      });
    }, console.log, console.log);


    /** LOADING HERO MESH. SOMEONE HELP HERE THIS IS A MESS

    #1 set rat feet target points
    #2 iterate through the bones and add ik for two legs
    #3 start the hero mover

    **/
    const fbxLoader = promisifyLoader(new FBXLoader());

    let ratPromise = fbxLoader.load(require('./assets/rat-03.fbx')).then((ratMesh) => {
        scene.add(ratMesh);
        let hero = ratMesh;
        hero.position.set(30,0,-30)
        hero.scale.set(1, 1, 1);
        bonePoints = [];
        let boneGeo = new THREE.BoxGeometry(1, 1, 1);
        let boneMat = new THREE.MeshBasicMaterial({ color:'0xff00ff', depthWrite: true });
        let numFeet = 2;
        //backfeet
        for(let i = 0; i < numFeet; i++) {
            let mesh = new THREE.Mesh(boneGeo, boneMat);
            mesh.position.set(3 * (2 * i - 1), 0, 2);
            bonePoints.push(mesh);
            scene.add(mesh);
        }
        //front feet
        for(let i = 0; i < numFeet; i++) {
            let mesh = new THREE.Mesh(boneGeo, boneMat);
            mesh.position.set(3 * (2 * i - 1), 0, -10);
            bonePoints.push(mesh);
            scene.add(mesh);
        }
        let headPoint = new THREE.Mesh(boneGeo, boneMat);
        headPoint.position.set(0, 7, -12);
        bonePoints.push(headPoint);
        scene.add(headPoint)

        tailPoint = new THREE.Mesh(boneGeo, boneMat);
        tailPoint.position.set(-1, 2, 11);
        bonePoints.push(tailPoint);
        scene.add(tailPoint)


        let rat = ratMesh.children[0];

        rat.material = new THREE.MeshPhysicalMaterial({
            skinning: true,
            color: new THREE.Color('#0ff0ff'),
            // opacity: 0.01,
            transparent: true,
        });

        let boneGroup = ratMesh.children[1];
        boneGroup.position.set(0,0,0)
        boneGroup.rotateY(Math.PI/2)
        boneGroup.position.set(0,6.33,0)

        let helper = new THREE.SkeletonHelper(boneGroup);
        helper.material.linewidth = 5;
        scene.add(helper);

        let iks = [];
        //backfeet
        for (let j = 0; j < 2; j++) {
          addIKForGroup(boneGroup.children[j+1], iks, 3, bonePoints[j])
        }
        //front feet
        boneGroup = ratMesh.children[1].children[3].children[0].children[0]
        for (let j = 0; j < 2; j++) {
          addIKForGroup(boneGroup.children[j], iks, 3, bonePoints[j+2])
        }
        //ad ik for the spine
        backHip = ratMesh.children[1].children[3]
        addIKForSpine(backHip, iks)
        // ad ik for the tail
        var tail = ratMesh.children[1].children[0]
        addIKForGroup(tail, iks, 7, bonePoints[5])
        heroMover = new HeroMoverNN(hero, iks, bonePoints, worldGrid, camera, scene);
    });

    // start the render loop once all objs/fbx things are done loading
    Promise.all([ gltf, ratPromise ]).then(() => {
        update();
    });

    envMapController = new EnvMapController([ groundFloor ], cubeCamera, renderer, scene);

    // initialize collision world grid and fill in the necessary meshes
    worldGrid = new SparseWorldGrid();

}

function addIKForSpine(boneGroup, iks) {
  let ik = new IK();
  const chain = new IKChain();
  let currentBone = boneGroup.children[0];
  for (let i = 0; i < 5; i++) {
      if(i==1){
        currentBone = currentBone.children[2];
      } else {
        currentBone = currentBone.children[0];
      }
      let constraints = [ new IKBallConstraint(180) ];
      // The last IKJoint must be added with a `target` as an end effector.
      const target = i === 4 ? bonePoints[4]: null;
      chain.add(new IKJoint(currentBone, { constraints: constraints }), { target: target });
  }
  ik.add(chain);
  iks.push(ik);
  let helper = new IKHelper(ik);
  scene.add(helper);
}

function addIKForGroup (boneGroup, iks, length, boneTarget) {
  let ik = new IK();
  const chain = new IKChain();
  var currentBone = boneGroup
  for (let i = 0; i < length; i++) {
      currentBone = currentBone.children[0];
      let constraints = [ new IKBallConstraint(360, false) ];
      // The last IKJoint must be added with a `target` as an end effector.
      const target = i === (length-1) ? boneTarget: null;
      chain.add(new IKJoint(currentBone, { constraints: constraints }), { target: target });
  }
  ik.add(chain);
  iks.push(ik);
  let helper = new IKHelper(ik);
  scene.add(helper);
}
function onDocumentMouseMove( event ) {
      event.preventDefault();
      mouse.x = ( event.clientX / window.innerWidth ) * 2 - 1;
      mouse.y = - ( event.clientY / window.innerHeight ) * 2 + 1;
}

function update() {
    backHip.position.y = 0.5 + 0.5*Math.sin(Date.now()*0.001)
    requestAnimationFrame(update);
    stats.begin();
    envMapController.update();
    if(heroMover) {
        heroMover.update();
    }
    // sorry about dis
    groundFloor.material.uniforms.maxMipLevel.value = renderer.properties.get(groundFloor.material.envMap).__maxMipLevel;
    renderer.render(scene, camera);
    stats.end();
}
