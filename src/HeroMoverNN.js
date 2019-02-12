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

const DEBUG_MODE = true;

export default class HeroMover {
  constructor( hero, worldGrid, camera, scene ) {
    this.hero = hero;
    this.worldGrid = worldGrid;
    this.camera = camera;
    this.pivot = new THREE.Object3D()
    this.pivot.position.copy(hero.position)
    this.hero.add(this.camera)
    scene.add(this.pivot)

    this.camera.position.set(0,10,50)

    //helpers
    this.incomingPos = new THREE.Vector3()
    this.lastMousePos = new THREE.Vector2()
    this.delta = new THREE.Vector2()
    this.velocity = new THREE.Vector3()
    this.moving = true;

    window.addEventListener('keydown', this.moveHero)
    window.addEventListener('mouseup', this.endRotate)
    window.addEventListener('mousemove', this.rotate)


    var origin = this.hero.position;
    var dir = new THREE.Vector3(0,1,0)
    var length = 3;
    var hex = 0x0000ff;


    if (DEBUG_MODE) {
      this.arrowHelper = new THREE.ArrowHelper( dir, origin, length, hex );
      scene.add( this.arrowHelper );

      this.arrowHelperSearch = new THREE.ArrowHelper( dir, origin, length, 0xff0000 );
      scene.add( this.arrowHelperSearch );
    }
  }

  rotate = (event) => {
    if(this.lastMousePos.x == 0 && this.lastMousePos.y == 0) {
      this.lastMousePos.set(event.x, event.y);
      return;
    }
    this.delta.set(event.x, event.y).sub(this.lastMousePos);
    this.lastMousePos.set(event.x, event.y)

    //can only rotate around the y axis
    this.hero.rotateY(this.delta.x*0.01)


    if(DEBUG_MODE){
      var forwards = new THREE.Vector3(0,0,-1).applyQuaternion(this.hero.quaternion)
      var upVector = new THREE.Vector3(0,1,0).applyQuaternion(this.hero.quaternion)
      this.arrowHelper.setDirection(forwards)
      this.arrowHelper.position.copy(this.hero.position)
      this.arrowHelperSearch.setDirection(upVector)
      this.arrowHelperSearch.position.copy(this.hero.position)
    }
  }

  endRotate = (event) => {
    this.lastMousePos.set(0,0)
  }

  moveHero = (event) => {
    var forwards = null;
    switch(event.key){
      case "w":
      forwards = new THREE.Vector3(0,0,-1).applyQuaternion(this.hero.quaternion)
      break;
      case "s":
      forwards = new THREE.Vector3(0,0,1).applyQuaternion(this.hero.quaternion)
      break;
    }
    if(!forwards){
      return;
    }

    var upVector = new THREE.Vector3(0,1,0).applyQuaternion(this.hero.quaternion)
    this.incomingPos.copy(this.hero.position).add(forwards)

    if(DEBUG_MODE){
      this.arrowHelper.setDirection(forwards)
      this.arrowHelper.position.copy(this.hero.position)
      this.arrowHelperSearch.setDirection(upVector)
      this.arrowHelperSearch.position.copy(this.hero.position)
    }

    var nn = this.findNearestCollisionPoint(this.incomingPos, forwards, upVector)

    if(nn[0]) {
      this.incomingPos.copy(this.hero.position).add(nn[1])
      this.incomingPos.set(Math.round(this.incomingPos.x),Math.round(this.incomingPos.y),Math.round(this.incomingPos.z))

      //adjust quaternion for movement direction
      var leftAxis = new THREE.Vector3().crossVectors(forwards, upVector)
      var forwardAdjustAngle = forwards.angleTo(nn[1])

      if(forwardAdjustAngle > 0.01 && forwardAdjustAngle < 3.14){
        var forwardAdjustQuat = new THREE.Quaternion().setFromAxisAngle(leftAxis, forwardAdjustAngle);
        this.hero.quaternion.premultiply(forwardAdjustQuat)
      }

      //adjust quaternion so up vector and surface normal are aligned
      var upNew = new THREE.Vector3(0,1,0).applyQuaternion(this.hero.quaternion).normalize()
      var upAdjustAxis = new THREE.Vector3().crossVectors(upNew, nn[2]).normalize()
      var upAdjustAngle = upNew.angleTo(nn[2])

      if(upAdjustAngle > 0.01 && upAdjustAngle < 3.14){
        var upAdjustQuat = new THREE.Quaternion().setFromAxisAngle(upAdjustAxis, upAdjustAngle);
        this.hero.quaternion.premultiply(upAdjustQuat)
      }

      this.hero.position.copy(this.incomingPos)
      this.pivot.position.copy(this.incomingPos)
    }
  }

  findNearestCollisionPoint(incomingPos, forward, up){
    var minDist = 100
    var min = [0,0,0,0]
    var found = false
    var axis = new THREE.Vector3().crossVectors(forward, up)
    var raycastQuat = new THREE.Quaternion();
    var raycastDir = new THREE.Vector3();

    for ( var i = -Math.PI/2; i < Math.PI/2; i += 0.3){
      raycastQuat.setFromAxisAngle(axis, i)
      raycastDir.copy(forward).applyQuaternion(raycastQuat)
      for ( var j = 3; j > 0; j-=1) {
        var value = this.worldGrid.valueAtWorldPos(this.hero.position.x + j*raycastDir.x, this.hero.position.y + j*raycastDir.y, this.hero.position.z + j*raycastDir.z);
        if(value){
          if(Math.abs(i)< minDist){
            minDist = (Math.abs(i))
            min = [new THREE.Vector3(j*raycastDir.x, j*raycastDir.y, j*raycastDir.z), new THREE.Vector3(value[0], value[1], value[2])]
            found = true;
            break;
          }
        }
      }
    }
    return [found, min[0], min[1]]
  }

  // handleBoundingBoxCollision(boundingBox, incomingPos){
  //   var minmax = [
  //     boundingBox.min,
  //     boundingBox.max,
  //   ]
  //   for(var i =0; i<2; i++){
  //     for(var j =0; j<2; j++){
  //       for(var k =0; k<2; k++){
  //         var value = this.worldGrid.valueAtWorldPos(this.incomingPos.x+minmax[i].x, this.incomingPos.y+minmax[j].y, this.incomingPos.z+minmax[k].z);
  //         if ( value > 0 ) {
  //           return [false, i,j,k]
  //         }
  //       }
  //     }
  //   }
  //   return [true, 1, 1, 1]
  // }

  update() {
  }
}
