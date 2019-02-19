import ParabolicFootTweener from './Tweener'

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

const DEBUG_MODE = false;

export default class HeroMover {
  constructor( hero, iks, bonePoints, worldGrid, camera, scene ) {
    this.scene = scene
    this.hero = hero;
    this.iks = iks;
    this.bonePoints = bonePoints;

    this.worldGrid = worldGrid;
    this.camera = camera;
    this.pivot = new THREE.Object3D()
    this.pivot.position.copy(hero.position)
    this.hero.add(this.camera)
    scene.add(this.pivot)

    this.camera.position.set(0,10,50)

    //set up the hero // right now will be the positions of two boxes
    this.curBone = 0;

    //helpers
    this.incomingPos = new THREE.Vector3()
    this.lastMousePos = new THREE.Vector2()
    this.delta = new THREE.Vector2()
    this.velocity = new THREE.Vector3()
    this.moving = true;
    this.pos = 0
    this.tweener = new ParabolicFootTweener()

    //worldAxis helpers
    this.worldAxis = {
      forward: new THREE.Vector3(),
      up: new THREE.Vector3(),
      left: new THREE.Vector3()
    }

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
    if(this.lastMousePos.x === 0 && this.lastMousePos.y === 0) {
      this.lastMousePos.set(event.x, event.y);
      return;
    }
    this.delta.set(event.x, event.y).sub(this.lastMousePos);
    this.lastMousePos.set(event.x, event.y)

    //can only rotate around the y axis
    this.hero.rotateY(this.delta.x*0.01)

    this.recalculateWorldAxis();

    if(DEBUG_MODE){
      this.alignArrowHelper()
    }

    //step both feet when necessary while turning

    for (var i = 0; i < 2; i++){
      var foot = this.bonePoints[i];
      //set foot position to the left of mouse base

      var tmpPos = new THREE.Vector3();
      tmpPos.x = this.hero.position.x + 3*(2*i-1)*this.worldAxis.left.x -3*this.worldAxis.up.x + 0.5*this.worldAxis.forward.x
      tmpPos.y = this.hero.position.y + 3*(2*i-1)*this.worldAxis.left.y -3*this.worldAxis.up.y + 0.5*this.worldAxis.forward.y
      tmpPos.z = this.hero.position.z + 3*(2*i-1)*this.worldAxis.left.z -3*this.worldAxis.up.z + 0.5*this.worldAxis.forward.z

      var nn = this.findNearestCollisionPoint(tmpPos)

      if(nn[0]) {
        this.incomingPos.copy(tmpPos).add(nn[1])

        if(this.incomingPos.distanceTo(foot.position) < 3){
          return;
        }

        this.incomingPos.set(Math.round(this.incomingPos.x),Math.round(this.incomingPos.y),Math.round(this.incomingPos.z))
        // foot.position.copy(this.incomingPos)
        this.tweener.addTween(i, foot.position, this.incomingPos, this.worldAxis.up.clone().multiplyScalar(2), 20);
      }
    }
  }

  endRotate = (event) => {
    this.lastMousePos.set(0,0)
  }

  moveHero = (event) => {

    if(event.key !== 'w') {
      return;
    }

    this.curBone += 1;
    this.recalculateWorldAxis()

    //base position is going to correspond to the foot ..
    var foot = this.bonePoints[(this.curBone+1)%2];

    //set foot position to the left of mouse base
    foot.position.x = this.hero.position.x + 3*(2*((this.curBone+1)%2)-1)*this.worldAxis.left.x -2*this.worldAxis.up.x + 4*this.worldAxis.forward.x
    foot.position.y = this.hero.position.y + 3*(2*((this.curBone+1)%2)-1)*this.worldAxis.left.y -2*this.worldAxis.up.y + 4*this.worldAxis.forward.y
    foot.position.z = this.hero.position.z + 3*(2*((this.curBone+1)%2)-1)*this.worldAxis.left.z -2*this.worldAxis.up.z + 4*this.worldAxis.forward.z

    if(DEBUG_MODE){
      this.alignArrowHelper();
    }
    var nn = this.findNearestCollisionPoint(foot.position)
    if(nn[0]) {
      this.incomingPos.copy(foot.position).add(nn[1])
      this.incomingPos.set(Math.round(this.incomingPos.x),Math.round(this.incomingPos.y),Math.round(this.incomingPos.z))
      var upNew = this.alignHeroToGround(nn);

      //with the new forward, move the hero forward a bit
      var foot2 = this.bonePoints[(this.curBone)%2];

      var newHeroPos = new THREE.Vector3().addVectors(foot2.position, foot.position).multiplyScalar(0.5)
      newHeroPos.add(upNew.multiplyScalar(1))
      this.hero.position.copy(newHeroPos)
      this.pivot.position.copy(newHeroPos)

      this.tweener.addTween(this.curBone, foot.position, this.incomingPos, upNew, 60);
    }
  }


  findNearestCollisionPoint = (basePos) => {
    var {forward, up} = this.worldAxis;

    var minDist = 100
    var min = [0,0,0,0]
    var found = false
    var axis = new THREE.Vector3().crossVectors(forward, up)
    var raycastQuat = new THREE.Quaternion();
    var raycastDir = new THREE.Vector3();

    for ( var i = -Math.PI/2; i < Math.PI/2; i += 0.3){
      raycastQuat.setFromAxisAngle(axis, i)
      raycastDir.copy(forward).applyQuaternion(raycastQuat)
      for ( var j = 0; j < 10; j+=1) {
        var value = this.worldGrid.valueAtWorldPos(basePos.x + j*raycastDir.x, basePos.y + j*raycastDir.y, basePos.z + j*raycastDir.z);
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

  alignHeroToGround = (nn) => {
    var {forward, up} = this.worldAxis;

    var leftAxis = new THREE.Vector3().crossVectors(forward, up)
    var forwardAdjustAngle = forward.angleTo(nn[1])

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
    return upNew;
  }

  alignArrowHelper = () => {
    this.arrowHelper.setDirection(this.worldAxis.forward)
    this.arrowHelper.position.copy(this.hero.position)
    this.arrowHelperSearch.setDirection(this.worldAxis.up)
    this.arrowHelperSearch.position.copy(this.hero.position)
  }

  recalculateWorldAxis = () => {
    this.worldAxis.forward.set(0,0,1).applyQuaternion(this.hero.quaternion)
    this.worldAxis.up.set(0,1,0).applyQuaternion(this.hero.quaternion)
    this.worldAxis.left.set(1,0,0).applyQuaternion(this.hero.quaternion)
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
    this.tweener.update()
    if(this.iks){
      this.iks.forEach((ik)=>{
        ik.solve()
      })
    }
  }
}
