export default class EnvMapController {
  constructor(hiddenMeshes, cubeCamera, renderer, scene) {
    this.hiddenMeshes = hiddenMeshes;
    this.cubeCamera = cubeCamera;
    this.renderer = renderer;
    this.scene = scene;
  }

  update() {
    this.hiddenMeshes.forEach((mesh) => {
      mesh.visible = false;
    });

    this.cubeCamera.update(this.renderer, this.scene);

    this.hiddenMeshes.forEach((mesh) => {
      mesh.visible = true;
    });
  }
}
