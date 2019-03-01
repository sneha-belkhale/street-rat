import GLTFLoader from 'three-gltf-loader';
import { promisifyLoader } from './Utils';

const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE);


export default class TestScene {
  constructor() {
    this.renderer = new THREE.WebGLRenderer();
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    document.body.appendChild(this.renderer.domElement);

    this.scene = new THREE.Scene();
    const aspectRation = window.innerWidth / window.innerHeight;
    this.camera = new THREE.PerspectiveCamera(75, aspectRation, 0.1, 1000);

    const controls = new OrbitControls(this.camera);

    this.camera.position.set(
      183.28854784443533,
      99.17413046911497,
      317.46507731208146,
    );

    controls.update();

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const material = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
    const cube = new THREE.Mesh(geometry, material);

    this.scene.add(cube);

    const pointLight = new THREE.PointLight(0xff0000, 1, 1000);
    pointLight.position.set(100, 100, 100);
    this.scene.add(pointLight);

    const sphereSize = 5;
    const pointLightHelper = new THREE.PointLightHelper(pointLight, sphereSize);
    this.scene.add(pointLightHelper);

    this.loadGLTFScene();
  }

  render = () => {
    this.animate();
  }

  animate = () => {
    requestAnimationFrame(this.animate);
    this.renderer.render(this.scene, this.camera);
  };

  handleSceneLoad = (scene) => {
    
    console.log('[D] scene', scene)

    const group = scene.scene.children[0];
    const scale = 35;
    scene.scene.scale.set(scale, scale, scale);
    scene.scene.updateMatrixWorld();
    group.children.forEach((asset) => {
      asset.children.forEach((child) => {
        switch (child.name) {
          case 'collision': {
            break;
          }
          case 'mesh':
            child.applyMatrix(asset.matrixWorld);
            this.scene.add(child);
            break;
          case 'instances':
            break;
          default:
        }
      });
    });
  }

  handleLoadProgress = (progress) => {
    console.log('[D] progress', progress);
  }

  loadGLTFScene = () => {
    const gltfLoader = promisifyLoader(new GLTFLoader());
    gltfLoader.load('scene/scene.gltf')
      .then(this.handleSceneLoad, this.handleLoadProgress)
      .catch((err) => {
        throw err;
      });
  }
}
