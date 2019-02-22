import Stats from 'stats-js';
import GlowShader from './GlowShader';
import ParallaxCorrectPhysicalMaterial from './ParallaxCorrectPhysicalMaterial';
import HeroMoverNN from './HeroMoverNN';
import EnvMapController from './EnvMapController';
import { IK, IKChain, IKJoint, IKBallConstraint, IKHelper } from './three-ik/src';
import FBXLoader from './FBXLoader';
import SparseWorldGrid from './SparseWorldGrid';

import initRect from './rectAreaLights';
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
let worldGrid, backHip, tailPoint;
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
    hemisphere.position.set(80, -80, 0);
    scene.add(hemisphere);

    const objLoader = promisifyLoader(new THREE.OBJLoader());

    let pipes = objLoader.load(require('./assets/pipe-01.obj')).then((asset) => {
        let mesh = asset.children[0];
        mesh.scale.set(50, 50, 50);
        scene.add(mesh);
    });

    let buildings = objLoader.load(require('./assets/building-01.obj')).then((asset) => {
        let mesh = asset.children[0];
        mesh.material = new THREE.MeshPhysicalMaterial()
        // scene.add(mesh);
    });

    let rat = objLoader.load(require('./assets/rat-01.obj')).then((asset) => {
        let mesh = asset.children[0];
        mesh.scale.set(10,10,10)
        mesh.material = new THREE.MeshPhysicalMaterial()
        scene.add(mesh);
    });

    /** LOADING HERO MESH. SOMEONE HELP HERE THIS IS A MESS

    #1 set rat feet target points
    #2 iterate through the bones and add ik for two legs
    #3 start the hero mover

    **/
    const fbxLoader = promisifyLoader(new FBXLoader());

    let ratPromise = fbxLoader.load(require('./assets/rat-03.fbx')).then((ratMesh) => {
        scene.add(ratMesh);
        let hero = ratMesh;
        hero.scale.set(1, 1, 1);
        hero.position.set(0, -48, 0);
        let bonePoints = [];
        let boneGeo = new THREE.BoxGeometry(1, 1, 1);
        let boneMat = new THREE.MeshPhysicalMaterial({ color:'0xff00ff', wireframe: true });
        let numFeet = 2;
        //backfeet
        for(let i = 0; i < numFeet; i++) {
            let mesh = new THREE.Mesh(boneGeo, boneMat);
            mesh.position.set(3 * (2 * i - 1), -49, 2);
            bonePoints.push(mesh);
            scene.add(mesh);
        }
        //front feet
        for(let i = 0; i < numFeet; i++) {
            let mesh = new THREE.Mesh(boneGeo, boneMat);
            mesh.position.set(3 * (2 * i - 1), -49, -10);
            bonePoints.push(mesh);
            scene.add(mesh);
        }
        let headPoint = new THREE.Mesh(boneGeo, boneMat);
        headPoint.position.set(0, -43, -12);
        bonePoints.push(headPoint);
        scene.add(headPoint)

        tailPoint = new THREE.Mesh(boneGeo, boneMat);
        tailPoint.position.set(-1, -47, 11);
        bonePoints.push(tailPoint);
        scene.add(tailPoint)


        let rat = ratMesh.children[0];

        rat.material = new THREE.MeshPhysicalMaterial({
            skinning: true,
            color: new THREE.Color('#0ff0ff'),
            // opacity: 0.4,
            transparent: true,
        });

        let boneGroup = ratMesh.children[1];
        boneGroup.position.set(0,0,0)
        boneGroup.rotateY(Math.PI/2)
        boneGroup.position.set(0,6.33,0)

        let helper = new THREE.SkeletonHelper(boneGroup);
        helper.material.linewidth = 5;
        scene.add(helper);
        console.log(boneGroup)

        // rat
        // make a chain connecting the legs
        let iks = [];
        //backfeet
        for (let j = 0; j < 2; j++) {
            let ik = new IK();
            const chain = new IKChain();
            let currentBone = boneGroup.children[j+1];
            for (let i = 0; i < 4; i++) {
                currentBone = currentBone.children[0];
                let constraints = [ new IKBallConstraint(180) ];
                if(i == 3) {
                    constraints = [ new IKBallConstraint(10) ];
                }
                if(i == 0) {
                    constraints = null;
                }
                // The last IKJoint must be added with a `target` as an end effector.
                const target = i === 3 ? bonePoints[j] : null;
                chain.add(new IKJoint(currentBone, { constraints: constraints }), { target: target });
            }
            ik.add(chain);
            iks.push(ik);

            let helper2 = new IKHelper(ik);
            scene.add(helper2);
        }
        boneGroup = ratMesh.children[1].children[3].children[0].children[0]
        //front feet
        for (let j = 0; j < 2; j++) {
            let ik = new IK();
            const chain = new IKChain();
            let currentBone = boneGroup.children[j];
            for (let i = 0; i < 4; i++) {
                currentBone = currentBone.children[0];
                let constraints = [ new IKBallConstraint(180) ];
                if(i == 3) {
                    constraints = [ new IKBallConstraint(10) ];
                }
                if(i == 0) {
                    constraints = null;
                }
                // The last IKJoint must be added with a `target` as an end effector.
                const target = i === 3 ? bonePoints[j+2] : null;
                chain.add(new IKJoint(currentBone, { constraints: constraints }), { target: target });
            }
            ik.add(chain);
            iks.push(ik);
            let helper2 = new IKHelper(ik);
            scene.add(helper2);
        }

        //ad ik for the spine
        // boneGroup = ratMesh.children[1].children[3]
        backHip = ratMesh.children[1].children[3]
        // let ik = new IK();
        // const chain = new IKChain();
        // let currentBone = boneGroup.children[0];
        // for (let i = 0; i < 5; i++) {
        //     if(i==1){
        //       currentBone = currentBone.children[2];
        //     } else {
        //       currentBone = currentBone.children[0];
        //     }
        //     console.log(currentBone)
        //     let constraints = [ new IKBallConstraint(180) ];
        //     // The last IKJoint must be added with a `target` as an end effector.
        //     const target = i === 4 ? null: null;
        //     chain.add(new IKJoint(currentBone, { constraints: constraints }), { target: target });
        // }
        // ik.add(chain);
        // iks.push(ik);
        // let helper2 = new IKHelper(ik);
        // scene.add(helper2);

        // ad ik for the tail
        var currentBone = ratMesh.children[1].children[0]
        var tail = ratMesh.children[1].children[0]
        let ik = new IK();
        const chain = new IKChain();
        for (let i = 0; i < 7; i++) {
            currentBone = currentBone.children[0];
            console.log(currentBone)
            let constraints = [ new IKBallConstraint(360, false) ];
            // The last IKJoint must be added with a `target` as an end effector.
            const target = i === 6 ? bonePoints[5]: null;
            chain.add(new IKJoint(currentBone, { constraints: constraints }), { target: target });
        }
        ik.add(chain);
        iks.push(ik);
        let helper2 = new IKHelper(ik);
        scene.add(helper2);
        heroMover = new HeroMoverNN(hero, iks, bonePoints, worldGrid, camera, scene);
    });

    // start the render loop once all objs/fbx things are done loading
    Promise.all([ pipes, ratPromise ]).then(() => {
        update();
    });

    envMapController = new EnvMapController([ groundFloor ], cubeCamera, renderer, scene);

    // initialize collision world grid and fill in the necessary meshes
    worldGrid = new SparseWorldGrid();
    worldGrid.fillGridFromBoundingBox(roomWall, scene);
    worldGrid.fillGridFromBoundingBox(hemisphere, scene);
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
