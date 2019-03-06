import Stats from 'stats-js';
import GLTFLoader from 'three-gltf-loader';
import GlowShader from './shaders/GlowShader';
import ParallaxCorrectPhysicalMaterial from './shaders/ParallaxCorrectPhysicalMaterial';
import HeroMoverNN from './HeroMoverNN';
import EnvMapController from './EnvMapController';
import {
  IK, IKChain, IKJoint, IKBallConstraint, IKHelper,
} from './three-ik/src';
import FBXLoader from './libs/FBXLoader';
import SparseWorldGrid from './SparseWorldGrid';

import initRect from './libs/rectAreaLights';

initRect();
const THREE = require('three');
const OBJLoader = require('three-obj-loader')(THREE);
const OrbitControls = require('three-orbit-controls')(THREE);

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

let scene; let camera; let renderer; let
  controls;
let stats; let envMapController; let
  heroMover;
let cubeCamera; let
  groundFloor;
let worldGrid; let backHip; let tailPoint; let bonePoints; let
  vent;
const mouse = new THREE.Vector2();
export default function initWebScene() {
  /** BASIC THREE SETUP * */
  scene = new THREE.Scene();
  // set up camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 25, 100000);
  scene.add(camera);
  // set up controls
  controls = new OrbitControls(camera);
  // restrict movement to stay within the room
  renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.antialias = true;
  renderer.setSize(window.innerWidth, window.innerHeight);
  document.body.appendChild(renderer.domElement);
  document.addEventListener('mousemove', onDocumentMouseMove, false);
  // set up stats
  stats = new Stats();
  stats.showPanel(0);
  document.body.appendChild(stats.dom);

  /** LIGHTS * */
  // var neonPos = new THREE.Vector3(10,10,-45)
  const neonPos = new THREE.Vector3(10, 10, -45);

  const rectLight = new THREE.RectAreaLight(0xff00ff, 800, 5, 5);
  rectLight.position.copy(neonPos);
  rectLight.lookAt(0, 0, -1);
  scene.add(rectLight);

  const pointLight = new THREE.PointLight();
  pointLight.position.set(0, 50, 0);
  scene.add(pointLight);

  /** SCENE ROOM SETUP * */
  // Create cube camera
  cubeCamera = new THREE.CubeCamera(1, 1000, 128);
  cubeCamera.renderTarget.texture.generateMipmaps = true;
  cubeCamera.renderTarget.texture.minFilter = THREE.LinearMipMapLinearFilter;
  cubeCamera.renderTarget.texture.magFilter = THREE.LinearFilter;
  cubeCamera.renderTarget.texture.mapping = THREE.CubeReflectionMapping;
  scene.add(cubeCamera);

  const physicalShader = THREE.ShaderLib.physical;

  const uniforms = {
    cubeMapSize: { type: 'v3', value: new THREE.Vector3(200, 200, 100) },
    cubeMapPos: { type: 'v3', value: new THREE.Vector3(0, -50, 0) },
  };
  const chromeUniforms = THREE.UniformsUtils.merge([physicalShader.uniforms, uniforms]);

  const chromeMaterial = new THREE.ShaderMaterial({
    uniforms: chromeUniforms,
    vertexShader: ParallaxCorrectPhysicalMaterial.vertexShader,
    fragmentShader: ParallaxCorrectPhysicalMaterial.fragmentShader,
    transparent: true,
    lights: true,
    defines: {
      PARALLAX_CORRECT: '',
    },
  });

  const loader = new THREE.TextureLoader();
  const tex = loader.load(require('./assets/spec.jpg'));
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
  const glowTorusGeo = new THREE.TorusGeometry(10, 0.5, 20, 60);
  const glowMat = new THREE.ShaderMaterial({
    uniforms: {},
    vertexShader: GlowShader.vertexShader,
    fragmentShader: GlowShader.fragmentShader,
    transparent: true,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  const glowTorus = new THREE.Mesh(glowTorusGeo, glowMat);
  scene.add(glowTorus);
  glowTorus.position.copy(neonPos);

  const glowTorusMain = new THREE.Mesh(glowTorusGeo, new THREE.MeshPhysicalMaterial({
    emissive: new THREE.Color('#ff00ff'),
  }));
  scene.add(glowTorusMain);
  glowTorusMain.position.copy(neonPos);

  const gltfLoader = promisifyLoader(new GLTFLoader());
  const gltf = gltfLoader.load('scene/scene.gltf').then((asset) => {
    // scene.add(asset.scene)
    const group = asset.scene.children[0];
    const scale = 35;
    asset.scene.scale.set(scale, scale, scale);
    asset.scene.updateMatrixWorld();
    group.children.forEach((c) => {
      let collision; let mesh; let
        instance;
      c.children.forEach((child) => {
        switch (child.name) {
          case 'collision':
            collision = child;
            break;
          case 'mesh':
            mesh = child;
            break;
          case 'instances':
            instance = child;
            break;
        }
      });
      if (instance) {
        const posArray = instance.geometry.attributes.position.array;
        const scaleArray = instance.geometry.attributes.color.array;
        const normalArray = instance.geometry.attributes.normal.array;

        for (let i = 0; i < instance.geometry.attributes.position.count; i += 3) {
          const instancedMesh = new THREE.Mesh();
          instancedMesh.geometry = mesh.geometry;
          instancedMesh.material = mesh.material;
          instancedMesh.position.set(scale * posArray[3 * i], scale * posArray[3 * i + 1], scale * posArray[3 * i + 2]);
          instancedMesh.scale.set(scale * scaleArray[3 * i], scale * scaleArray[3 * i], scale * scaleArray[3 * i]);
          instancedMesh.lookAt(new THREE.Vector3(instancedMesh.position.x + normalArray[3 * i], instancedMesh.position.y + normalArray[3 * i + 1], instancedMesh.position.z + normalArray[3 * i + 2]));
          scene.add(instancedMesh);
          const instancedMeshCollision = new THREE.Mesh();
          instancedMeshCollision.geometry = collision.geometry;
          instancedMeshCollision.material.visible = false;
          instancedMeshCollision.position.copy(instancedMesh.position);
          instancedMeshCollision.scale.copy(instancedMesh.scale);
          instancedMeshCollision.quaternion.copy(instancedMesh.quaternion);
          scene.add(instancedMeshCollision);
          worldGrid.fillGridForMesh(instancedMeshCollision);
        }
      } else {
        collision.applyMatrix(c.matrixWorld);
        // collision.material.visible = false;
        mesh.applyMatrix(c.matrixWorld);
        scene.add(mesh);
        scene.add(collision);
        worldGrid.fillGridForMesh(collision);
      }
    });
  }, console.log, console.log);


  /** LOADING HERO MESH. SOMEONE HELP HERE THIS IS A MESS

    #1 set rat feet target points
    #2 iterate through the bones and add ik for two legs
    #3 start the hero mover

    * */
  const fbxLoader = promisifyLoader(new FBXLoader());

  const ratPromise = fbxLoader.load(require('./assets/rat-03.fbx')).then((ratMesh) => {
    scene.add(ratMesh);
    const hero = ratMesh;
    hero.position.set(30, 0, -30);
    hero.scale.set(1, 1, 1);
    bonePoints = [];
    const boneGeo = new THREE.BoxGeometry(1, 1, 1);
    const boneMat = new THREE.MeshBasicMaterial({ color: '0xff00ff', wireframe: true });
    const numFeet = 2;
    // backfeet
    for (let i = 0; i < numFeet; i++) {
      const mesh = new THREE.Mesh(boneGeo, boneMat);
      mesh.position.set(3 * (2 * i - 1), 0, 2);
      bonePoints.push(mesh);
      scene.add(mesh);
    }
    // front feet
    for (let i = 0; i < numFeet; i++) {
      const mesh = new THREE.Mesh(boneGeo, boneMat);
      mesh.position.set(3 * (2 * i - 1), 0, -10);
      bonePoints.push(mesh);
      scene.add(mesh);
    }
    const headPoint = new THREE.Mesh(boneGeo, boneMat);
    headPoint.position.set(0, 7, -12);
    bonePoints.push(headPoint);
    scene.add(headPoint);

    tailPoint = new THREE.Mesh(boneGeo, boneMat);
    tailPoint.position.set(-1, 2, 11);
    bonePoints.push(tailPoint);
    scene.add(tailPoint);


    const rat = ratMesh.children[0];

    rat.material = new THREE.MeshPhysicalMaterial({
      skinning: true,
      color: new THREE.Color('#0ff0ff'),
      // opacity: 0.01,
      transparent: true,
    });

    let boneGroup = ratMesh.children[1];
    boneGroup.position.set(0, 0, 0);
    boneGroup.rotateY(Math.PI / 2);
    boneGroup.position.set(0, 6.33, 0);

    const helper = new THREE.SkeletonHelper(boneGroup);
    helper.material.linewidth = 5;
    scene.add(helper);

    const iks = [];
    // backfeet
    for (let j = 0; j < 2; j++) {
      addIKForGroup(boneGroup.children[j + 1], iks, 3, bonePoints[j]);
    }
    // front feet
    boneGroup = ratMesh.children[1].children[3].children[0].children[0];
    for (let j = 0; j < 2; j++) {
      addIKForGroup(boneGroup.children[j], iks, 3, bonePoints[j + 2]);
    }
    // ad ik for the spine
    backHip = ratMesh.children[1].children[3];
    addIKForSpine(backHip, iks);
    // ad ik for the tail
    const tail = ratMesh.children[1].children[0];
    addIKForGroup(tail, iks, 7, bonePoints[5]);
    heroMover = new HeroMoverNN(hero, iks, bonePoints, worldGrid, camera, scene);
  });

  // start the render loop once all objs/fbx things are done loading
  Promise.all([gltf, ratPromise]).then(() => {
    update();
  });

  envMapController = new EnvMapController([groundFloor], cubeCamera, renderer, scene);

  // initialize collision world grid and fill in the necessary meshes
  worldGrid = new SparseWorldGrid(20);
}

function addIKForSpine(boneGroup, iks) {
  const ik = new IK();
  const chain = new IKChain();
  let currentBone = boneGroup.children[0];
  for (let i = 0; i < 5; i++) {
    if (i == 1) {
      currentBone = currentBone.children[2];
    } else {
      currentBone = currentBone.children[0];
    }
    const constraints = [new IKBallConstraint(180)];
    // The last IKJoint must be added with a `target` as an end effector.
    const target = i === 4 ? bonePoints[4] : null;
    chain.add(new IKJoint(currentBone, { constraints }), { target });
  }
  ik.add(chain);
  iks.push(ik);
  const helper = new IKHelper(ik);
  scene.add(helper);
}

function addIKForGroup(boneGroup, iks, length, boneTarget) {
  const ik = new IK();
  const chain = new IKChain();
  let currentBone = boneGroup;
  for (let i = 0; i < length; i++) {
    currentBone = currentBone.children[0];
    const constraints = [new IKBallConstraint(360, false)];
    // The last IKJoint must be added with a `target` as an end effector.
    const target = i === (length - 1) ? boneTarget : null;
    chain.add(new IKJoint(currentBone, { constraints }), { target });
  }
  ik.add(chain);
  iks.push(ik);
  const helper = new IKHelper(ik);
  scene.add(helper);
}
function onDocumentMouseMove(event) {
  event.preventDefault();
  mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
  mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;
}

function update() {
  backHip.position.y = 0.5 + 0.5 * Math.sin(Date.now() * 0.001);
  requestAnimationFrame(update);
  stats.begin();
  envMapController.update();
  if (heroMover) {
    heroMover.update();
  }
  // sorry about dis
  groundFloor.material.uniforms.maxMipLevel.value = renderer.properties.get(groundFloor.material.envMap).__maxMipLevel;
  renderer.render(scene, camera);
  stats.end();
}
