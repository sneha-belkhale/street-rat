const THREE = require('three');
const OrbitControls = require('three-orbit-controls')(THREE);

export default function initTestScene() {
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 35, 100000);
}