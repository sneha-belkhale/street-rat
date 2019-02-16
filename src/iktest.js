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
var testBone;
var ik, target2;
export default function initWebScene() {
  /** BASIC THREE SETUP **/
    scene = new THREE.Scene();
    // set up camera
    camera = new THREE.PerspectiveCamera(35, window.innerWidth / window.innerHeight, 1, 100000);
    scene.add(camera);
    camera.position.z = 10
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

    let sphere = new THREE.Mesh(new THREE.SphereGeometry(100), new THREE.MeshBasicMaterial({
      wireframe:true
    }));
    scene.add(sphere)

    var axesHelper = new THREE.AxesHelper( 5 );
    scene.add( axesHelper );

    /** SCENE ROOM SETUP **/
    var fbxLoader = new FBXLoader()
    fbxLoader.load(require('./assets/rigTest-03.fbx'), (ratMesh) => {
      scene.add(ratMesh)
      ratMesh.children[0].material = new THREE.MeshPhysicalMaterial({
        skinning: true,
        // wireframe: true
      })
      console.log(ratMesh)

      ratMesh.children[0].bind(ratMesh.children[0].skeleton)
      target2 = new THREE.Object3D()
      target2.position.set(0,0, -5)
      scene.add(target2)
      testBone = ratMesh.children[1].children[0].children[0].children[0].children[0]
      var boneGroup = ratMesh.children[1].children[0];
      var helper = new THREE.SkeletonHelper( boneGroup );
      helper.material.linewidth = 5;
      // scene.add( helper )

      ik = new IK();
      const chain = new IKChain();
      var currentBone = boneGroup
      for (let i = 0; i < 4; i++) {
        currentBone = currentBone.children[0]
        var constraints = [new IKBallConstraint(180)];
        // if(i == 1 || i ==0){
        //   constraints = [new IKBallConstraint(90)];
        // }
        // The last IKJoint must be added with a `target` as an end effector.
        const target = i === 3 ? target2 : null;
        chain.add(new IKJoint(currentBone, { constraints }), { target });
      }
      ik.add(chain);
      const helperik = new IKHelper(ik);
      scene.add(helperik);


    },
    console.log,console.log)
    update();
}

var notDone = true
function update() {
    if(ik){
        // target2.position.y = Math.sin(0.001*Date.now())

        ik.solve()

    }

    controls.update()
    renderer.render(scene, camera);
    requestAnimationFrame(update);

}
