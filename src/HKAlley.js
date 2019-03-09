import Stats from 'stats-js';
// import GlowShader from './shaders/GlowShader';
import HeroMoverNN from './HeroMoverNN';
import {
  IK, IKChain, IKJoint, IKBallConstraint, IKHingeConstraint, IKHelper, setZForward,
} from './three-ik/src';
import FBXLoader from './libs/FBXLoader';
import SparseWorldGrid from './SparseWorldGrid';
import MainScene from './MainScene';

import { promisifyLoader } from './Utils';

import initRect from './libs/rectAreaLights';

initRect();
const THREE = require('three');
// const OrbitControls = require('three-orbit-controls')(THREE);

const DEBUG_MODE = true;

let scene; let camera; let renderer; let mainScene;
let stats; let
  heroMover;
let worldGrid; let backHip; let tailPoint; let bonePoints;
const mouse = new THREE.Vector2();
export default function initWebScene() {
  /** BASIC THREE SETUP * */
  scene = new THREE.Scene();
  // set up camera
  camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 25, 100000);
  scene.add(camera);
  // set up controls
  // const controls = new OrbitControls(camera);
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

  /** SCENE ROOM SETUP * */

  // add something glow
  // var neonPos = new THREE.Vector3(0,0,0)
  // const glowTorusGeo = new THREE.TorusGeometry(10, 0.5, 20, 60);
  // const glowMat = new THREE.ShaderMaterial({
  //   uniforms: {},
  //   vertexShader: GlowShader.vertexShader,
  //   fragmentShader: GlowShader.fragmentShader,
  //   transparent: true,
  //   side: THREE.DoubleSide,
  //   blending: THREE.AdditiveBlending,
  // });
  // const glowTorus = new THREE.Mesh(glowTorusGeo, glowMat);
  // scene.add(glowTorus);
  // glowTorus.position.copy(neonPos);
  //
  // const glowTorusMain = new THREE.Mesh(glowTorusGeo, new THREE.MeshPhysicalMaterial({
  //   emissive: new THREE.Color('#ff00ff'),
  // }));
  // scene.add(glowTorusMain);
  // glowTorusMain.position.copy(neonPos);

  /** LOADING HERO MESH. SOMEONE HELP HERE THIS IS A MESS

    #1 set rat feet target points
    #2 iterate through the bones and add ik for two legs
    #3 start the hero mover

    * */
  const fbxLoader = promisifyLoader(new FBXLoader());

  const ratPromise = fbxLoader.load(require('./assets/rat-03.fbx')).then((ratMesh) => {
    scene.add(ratMesh);
    const hero = ratMesh;
    hero.updateMatrixWorld();
    hero.position.set(30, 0, -30);
    hero.scale.set(1, 1, 1);
    bonePoints = [];
    const boneGeo = new THREE.BoxGeometry(1, 1, 1);
    const boneMat = new THREE.MeshBasicMaterial({ color: '0xff00ff', wireframe: true });
    if (!DEBUG_MODE) {
      boneMat.visible = false;
    }
    const numFeet = 2;
    // backfeet
    for (let i = 0; i < numFeet; i += 1) {
      const mesh = new THREE.Mesh(boneGeo, boneMat);
      mesh.position.set(3 * (2 * i - 1), 0, 2);
      bonePoints.push(mesh);
      scene.add(mesh);
    }
    // front feet
    for (let i = 0; i < numFeet; i += 1) {
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
    rat.castShadow = true;
    rat.receiveShadow = true;

    let boneGroup = ratMesh.children[1];
    boneGroup.position.set(0, 0, 0);
    boneGroup.rotateY(Math.PI / 2);
    boneGroup.position.set(0, 6.33, 0);
    // boneGroup.updateMatrixWorld()

    setZForward(boneGroup.children[0]);
    setZForward(boneGroup.children[1]);
    setZForward(boneGroup.children[2]);
    setZForward(boneGroup.children[3]);

    rat.bind(rat.skeleton);


    if (DEBUG_MODE) {
      const helper = new THREE.SkeletonHelper(boneGroup);
      helper.material.linewidth = 5;
      scene.add(helper);
    }

    const iks = [];
    // backfeet
    const axes = [new THREE.Vector3(0.9,-0.7,0).normalize(), new THREE.Vector3(0.1,-0.9,0).normalize()]
    for (let j = 0; j < 2; j += 1) {
      addIKForBackFeet(boneGroup.children[j + 1], iks, 4, bonePoints[j], axes[j]);
    }

    // front feet
    const { children } = ratMesh;
    /* eslint-disable-next-line prefer-destructuring */
    boneGroup = children[1].children[3].children[0].children[0];
    for (let j = 0; j < 2; j += 1) {
      addIKForGroup(boneGroup.children[j], iks, 4, bonePoints[j + 2]);
    }
    // ad ik for the spine
    /* eslint-disable-next-line prefer-destructuring */
    backHip = ratMesh.children[1].children[3];
    addIKForSpine(backHip, iks);
    // ad ik for the tail
    /* eslint-disable-next-line prefer-destructuring */
    const tail = ratMesh.children[1].children[0];
    addIKForGroup(tail, iks, 7, bonePoints[5]);
    heroMover = new HeroMoverNN(hero, iks, bonePoints, worldGrid, camera, scene);
  });

  // start the render loop once all objs/fbx things are done loading
  Promise.all([ratPromise]).then(() => {
    update();
  });

  // initialize collision world grid and fill in the necessary meshes
  worldGrid = new SparseWorldGrid(20);
  mainScene = new MainScene(scene, renderer, worldGrid);
}

function addIKForSpine(boneGroup, iks) {
  const ik = new IK();
  const chain = new IKChain();
  let currentBone = boneGroup.children[0];
  for (let i = 0; i < 5; i += 1) {
    if (i === 1) {
      /* eslint-disable-next-line prefer-destructuring */
      currentBone = currentBone.children[2];
    } else {
      /* eslint-disable-next-line prefer-destructuring */
      currentBone = currentBone.children[0];
    }
    const constraints = [new IKBallConstraint(180)];
    // The last IKJoint must be added with a `target` as an end effector.
    const target = i === 4 ? bonePoints[4] : null;
    chain.add(new IKJoint(currentBone, { constraints }), { target });
  }
  ik.add(chain);
  iks.push(ik);
  if (DEBUG_MODE) {
    const helper = new IKHelper(ik);
    scene.add(helper);
  }
}

function addIKForBackFeet(boneGroup, iks, length, boneTarget, axis) {
  const ik = new IK();
  const chain = new IKChain();
  let currentBone = boneGroup;

  const constraintBall = new IKBallConstraint(360);
  const constraintHinge = new IKHingeConstraint(360, axis, scene);
  for (let i = 0; i < length; i += 1) {
    /* eslint-disable-next-line prefer-destructuring */
    currentBone = currentBone.children[0];
    let constraints;
    if(i === 0) {
      constraints = [constraintBall];
    } else if (i === (length - 2)){
      constraints = [new IKHingeConstraint(120, axis, scene)];
    } else {
      constraints = [constraintHinge];
    }
    // The last IKJoint must be added with a `target` as an end effector.
    const target = i === (length - 1) ? boneTarget : null;
    chain.add(new IKJoint(currentBone, { constraints }), { target });
  }
  ik.add(chain);
  iks.push(ik);
  if (DEBUG_MODE) {
    const helper = new IKHelper(ik);
    scene.add(helper);
  }
}

function addIKForGroup(boneGroup, iks, length, boneTarget) {
  const ik = new IK();
  const chain = new IKChain();
  let currentBone = boneGroup;
  for (let i = 0; i < length; i += 1) {
    /* eslint-disable-next-line prefer-destructuring */
    currentBone = currentBone.children[0];
    const constraints = [new IKBallConstraint(360, false)];
    // The last IKJoint must be added with a `target` as an end effector.
    const target = i === (length - 1) ? boneTarget : null;
    chain.add(new IKJoint(currentBone, { constraints }), { target });
  }
  ik.add(chain);
  iks.push(ik);
  if (DEBUG_MODE) {
    const helper = new IKHelper(ik);
    scene.add(helper);
  }
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
  mainScene.update();
  if (heroMover) {
    heroMover.update();
  }
  renderer.render(scene, camera);
  stats.end();
}
