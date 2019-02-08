var THREE = require('three');

/**
Hero Mover:: Third Person controls for the hero that
are in sync with a given collision grid

keys:
W - move hero forward
A - rotate hero to the left
S - rotate hero to the right
D - move hero backwards

mouse:
move mouse to rotate camera around the hero

**/

export default class HeroMover {
  constructor( hero, worldGrid, camera, scene ) {
    this.hero = hero;
    this.worldGrid = worldGrid;
    this.camera = camera;
    this.pivot = new THREE.Object3D()
    this.pivot.position.copy(hero.position)
    this.pivot.add(this.camera)
    scene.add(this.pivot)

    this.camera.position.set(0,10,50)

    //helpers
    this.incomingPos = new THREE.Vector3()
    this.lastMousePos = new THREE.Vector2()
    this.delta = new THREE.Vector2()

    window.addEventListener('keydown', this.moveHero)
    window.addEventListener('mouseup', this.endRotate)
    window.addEventListener('mousemove', this.rotate)
  }

  rotate = (event) => {
    if(this.lastMousePos.x == 0 && this.lastMousePos.y == 0) {
      this.lastMousePos.set(event.x, event.y);
      return;
    }
    this.delta.set(event.x, event.y).sub(this.lastMousePos);
    this.lastMousePos.set(event.x, event.y)

    //can only rotate around the y axis
    this.pivot.rotateY(this.delta.x*0.01)
  }

  endRotate = (event) => {
    this.lastMousePos.set(0,0)
  }

  moveHero = (event) => {
    var rotateY = null
    switch(event.key){
      case "a":
      rotateY = 0.1
      break;
      case "w":
      var forward = new THREE.Vector3(0,0,-1).applyQuaternion(this.hero.quaternion)
      this.incomingPos.copy(this.hero.position).add(forward)
      break;
      case "d":
      rotateY = -0.1
      break;
      case "s":
      var backward = new THREE.Vector3(0,0,1).applyQuaternion(this.hero.quaternion)
      this.incomingPos.copy(this.hero.position).add(backward)
      break;
    }

    if(rotateY){
      this.hero.rotateY(rotateY)
      return;
    }

    var passed = this.handleBoundingBoxCollision(this.hero.geometry.boundingBox, this.incomingPos)
    if(passed){
      this.hero.position.copy(this.incomingPos)
      this.pivot.position.copy(this.incomingPos)
    }
  }

  handleBoundingBoxCollision(boundingBox, incomingPos){
    var minmax = [
      boundingBox.min,
      boundingBox.max,
    ]
    for(var i =0; i<2; i++){
      for(var j =0; j<2; j++){
        for(var k =0; k<2; k++){
          var value = this.worldGrid.valueAtWorldPos(this.incomingPos.x+minmax[i].x, this.incomingPos.y+minmax[j].y, this.incomingPos.z+minmax[k].z);
          if ( value > 0 ) {
            return false
          }
        }
      }
    }
    return true
  }
}
