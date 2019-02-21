import ParabolicFootTweener from './Tweener'

var THREE = require('three');
var TWEEN = require('tween');

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

//hero constants
const HERO_HALF_WIDTH = 3;
const HERO_HEIGHT = 4;
const HERO_LEG_FORWARD_OFFSET = 2;

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
    // this.hero.add(this.camera)
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
    this.startTime = Date.now()
    this.raycaster = new THREE.Raycaster()

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

    //deprecated after world grid changes. TODO; come back to this.
    //step both feet when necessary while turning
    // for (var i = 0; i < 2; i++){
    //   var foot = this.bonePoints[i];
    //   //set foot position to the left of mouse base
    //   this.incomingPos.x = this.hero.position.x + 3*(2*i-1)*this.worldAxis.left.x -3*this.worldAxis.up.x + 0.5*this.worldAxis.forward.x
    //   this.incomingPos.y = this.hero.position.y + 3*(2*i-1)*this.worldAxis.left.y -3*this.worldAxis.up.y + 0.5*this.worldAxis.forward.y
    //   this.incomingPos.z = this.hero.position.z + 3*(2*i-1)*this.worldAxis.left.z -3*this.worldAxis.up.z + 0.5*this.worldAxis.forward.z
    //
    //   var nn = this.findNearestCollisionPoint(this.incomingPos)
    //
    //   if(nn[0]) {
    //     this.incomingPos.add(nn[1])
    //
    //     if(this.incomingPos.distanceTo(foot.position) < 3){
    //       return;
    //     }
    //
    //     this.incomingPos.set(Math.round(this.incomingPos.x),Math.round(this.incomingPos.y),Math.round(this.incomingPos.z))
    //     // foot.position.copy(this.incomingPos)
    //     this.tweener.addTween(i, foot.position, this.incomingPos, this.worldAxis.up.clone().multiplyScalar(2), 20);
    //   }
    // }
  }

  endRotate = (event) => {
    this.lastMousePos.set(0,0)
  }

  moveHero = (event) => {

    if(event.key !== 'w') {
      return;
    }

    var msElapsed = Date.now() - this.startTime;
    if(msElapsed < 1000){
      return;
    }

    this.startTime = Date.now()
    this.curBone += 1;
    this.recalculateWorldAxis()

    //base position is going to correspond to the foot ..
    var foot = this.bonePoints[(this.curBone+1)%2];
    var curFootOffset = HERO_HALF_WIDTH*(2*((this.curBone+1)%2)-1);
    //set foot position to the left of mouse base
    this.incomingPos.x = this.hero.position.x + curFootOffset*this.worldAxis.left.x  + HERO_LEG_FORWARD_OFFSET*this.worldAxis.forward.x + HERO_HEIGHT*this.worldAxis.up.x
    this.incomingPos.y = this.hero.position.y + curFootOffset*this.worldAxis.left.y  + HERO_LEG_FORWARD_OFFSET*this.worldAxis.forward.y + HERO_HEIGHT*this.worldAxis.up.y
    this.incomingPos.z = this.hero.position.z + curFootOffset*this.worldAxis.left.z  + HERO_LEG_FORWARD_OFFSET*this.worldAxis.forward.z + HERO_HEIGHT*this.worldAxis.up.z

    if(DEBUG_MODE){
      this.alignArrowHelper();
    }
    var tt = this.findNearestCollisionPoint(this.incomingPos)
    if(tt[0]) {
      this.incomingPos.copy(tt[1])
      this.incomingPos.set(Math.round(this.incomingPos.x),Math.round(this.incomingPos.y),Math.round(this.incomingPos.z))
      var upNew = this.alignHeroToGround(tt);

      //tween hero foot position
      this.tweener.addTween((this.curBone)%2, foot.position, this.incomingPos, this.worldAxis.up, 60);

      //tween hero body position
      this.incomingPos.sub(this.worldAxis.forward.multiplyScalar(5))
      this.incomingPos.sub(this.worldAxis.left.multiplyScalar(curFootOffset))
      var tween = new TWEEN.Tween(this.hero.position).to(this.incomingPos, 200).delay(200).start();
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
    var meshes = this.worldGrid.queryPointsInRadius(basePos.x, basePos.y, basePos.z)

    for ( var i = -Math.PI/2; i < Math.PI/5; i += 0.3){
      raycastQuat.setFromAxisAngle(axis, i)
      raycastDir.copy(forward).applyQuaternion(raycastQuat)
      this.raycaster.set(basePos, raycastDir)
      var n = this.raycaster.intersectObjects(meshes);
      if(Math.abs(i)< minDist && n[0] && n[0].point.distanceTo(basePos) < 20){
        minDist = (Math.abs(i))
        var mult = 1
        if(n[0].object.material.side == THREE.BackSide){
          mult = -1
        }
        min = [n[0].point, n[0].face.normal.clone().multiplyScalar(mult)]
        found = true;
      }
    }
    return [found, min[0], min[1]]
  }

  alignHeroToGround = (nn) => {
    var {forward, up} = this.worldAxis;

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
    TWEEN.update()
    this.tweener.update()
    if(this.iks){
      this.iks.forEach((ik)=>{
        ik.solve()
      })
    }
  }
}
