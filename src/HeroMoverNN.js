import ParabolicFootTweener from './Tweener'
import { addScalarMultiple, getAlignmentQuaternion, getAlignmentQuaternionOnPlane } from './MathUtils'
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

const DEBUG_MODE = true;

//hero constants
const HERO_HALF_WIDTH = 1.5;
const HERO_HEIGHT = 4;
const HERO_LEG_FORWARD_OFFSET = 1;

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

    this.heroCamera = new THREE.Object3D()
    scene.add(this.heroCamera)
    this.heroCamera.add(this.camera)

    this.camera.position.set(0,10,70)

    //set up the hero // right now will be the positions of two boxes
    this.curBone = 0;
    this.curRotBone = 0;

    //helpers
    this.incomingPos = new THREE.Vector3()
    this.lastMousePos = new THREE.Vector2()
    this.delta = new THREE.Vector2()
    this.velocity = new THREE.Vector3()
    this.moving = true;
    this.pos = 0
    this.tweener = new ParabolicFootTweener(this)
    this.startTime = Date.now()
    this.raycaster = new THREE.Raycaster()
    this.tailMotionCounter = -1;

    //worldAxis helpers
    this.worldAxis = {
      forward: new THREE.Vector3(),
      up: new THREE.Vector3(),
      left: new THREE.Vector3()
    }
    this.heroAxis = {
      forward: new THREE.Vector3(),
      up: new THREE.Vector3(),
      left: new THREE.Vector3()
    }

    window.addEventListener('keydown', this.moveHero)
    window.addEventListener('keyup', this.onKeyUp)

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

      this.rayHelper = new THREE.Mesh(new THREE.BoxGeometry(0.5,0.5,10), new THREE.MeshBasicMaterial({color:new THREE.Color("#7fffd4")}))
      scene.add(this.rayHelper)
      this.winningDir = new THREE.Vector3()
    }
  }

  rotate = (event) => {
    if(this.walking){
      return;
    }
    if(this.lastMousePos.x === 0 && this.lastMousePos.y === 0) {
      this.lastMousePos.set(event.x, event.y);
      return;
    }
    this.delta.set(event.x, event.y).sub(this.lastMousePos);
    this.lastMousePos.set(event.x, event.y)

    //can only rotate around the y axis
    this.heroCamera.rotateY(this.delta.x*0.01)
    this.recalculateWorldAxis();

    if(DEBUG_MODE){
      this.alignArrowHelper()
    }

    var  i = this.curRotBone;
    this.curRotBone++;
    if(this.curRotBone > 3){
      this.curRotBone = 0
    }
    //deprecated after world grid changes. TODO; come back to this.
    //step both feet when necessary while turning
      var tailBone = this.bonePoints[5]
      var foot = this.bonePoints[i];
      var headBone = this.bonePoints[4]
      //set foot position to the left of mouse base
      if(i > 1){
        this.incomingPos = this.getProjectedFrontFootPos(this.incomingPos, 3*(2*(i%2)-1))
      } else {
        this.incomingPos = this.getProjectedFootPos(this.incomingPos, 3*(2*(i%2)-1))
      }
      var nn = this.findNearestCollisionPoint(this.incomingPos, true)

      if(nn[0]) {
        this.incomingPos.copy(nn[1])
        if(this.incomingPos.distanceTo(foot.position) < 2){
          return;
        }

        if(i == 0){
          // addScalarMultiple(headBone.position, this.worldAxis.left, 3)
          var incomingPos = this.incomingPos.clone()
          if(i == 0){
            addScalarMultiple(incomingPos, this.heroAxis.forward,9)
            addScalarMultiple(incomingPos, this.heroAxis.up, 3)
            addScalarMultiple(incomingPos, this.heroAxis.left, 3)
            var headTween = new TWEEN.Tween(headBone.position).to(incomingPos, 500).start();
          }
        }

        this.incomingPos.set(Math.round(this.incomingPos.x),Math.round(this.incomingPos.y),Math.round(this.incomingPos.z))
        this.tweener.addTween(i, foot.position, this.incomingPos, this.worldAxis.up.clone().multiplyScalar(4), 40, true);
    }
  }

  endRotate = (event) => {
    this.lastMousePos.set(0,0)
  }

  onKeyUp = (event) => {
    this.walking = false;
  }

  moveHero = (event) => {

    if(event.key !== 'w') {
      return;
    }

    var msElapsed = Date.now() - this.startTime;
    if(msElapsed < 1000/3){
      return;
    }

    this.startTime = Date.now()
    this.curBone += 1;
    this.tailMotionCounter = 0

    this.recalculateWorldAxis()

    //base position is going to correspond to the foot ..
    var foot = this.bonePoints[(this.curBone+1)%2];
    var forwardFoot = this.bonePoints[(this.curBone+1)%2+2];
    var tailBone = this.bonePoints[5];
    var headBone = this.bonePoints[4];

    var curFootOffset = HERO_HALF_WIDTH*(2*((this.curBone+1)%2)-1);
    //set foot position to the left of mouse base
    this.incomingPos = this.getProjectedFootPos(this.incomingPos, curFootOffset)

    if(DEBUG_MODE){
      this.alignArrowHelper();
    }
    var tt = this.findNearestCollisionPoint(this.incomingPos)
    if(tt[0]) {
      this.incomingPos.copy(tt[1])
      this.incomingPos.set(Math.round(this.incomingPos.x),Math.round(this.incomingPos.y),Math.round(this.incomingPos.z))

      var upNew = this.alignHeroToGround(tt);

      //realign hero
      // if(!this.walking){
      //   this.tweenHeroToCameraForward()
      //   this.walking = true;
      //   return;
      // }
      // this.tweenHeroToCameraForward()

      this.updateHeroRotation()
      //tween back foot position
      addScalarMultiple(this.incomingPos, upNew, 1)
      this.tweener.addTween((this.curBone)%2, foot.position, this.incomingPos, this.worldAxis.up, 60/3);

      //tween front foot position
      var forwardFootPos = addScalarMultiple(this.incomingPos.clone(), this.worldAxis.forward, 4)
      this.tweener.addTween((this.curBone)%2+2, forwardFoot.position, forwardFootPos, this.worldAxis.up, 60/3);

      //tween body position
      var heroPos = this.adjustPosForHero(this.incomingPos.clone(), curFootOffset, upNew)
      var tween = new TWEEN.Tween(this.hero.position).to(heroPos, 200/3).delay(200/3).start();
      var tween2 = new TWEEN.Tween(this.heroCamera.position).to(heroPos, 200/3).delay(200/3).start();

      //tween tail position
      var tailPos = this.adjustPosForTail(this.incomingPos.clone(), curFootOffset, upNew)
      var tailTween = new TWEEN.Tween(tailBone.position).to(tailPos, 400/3).delay(200/3).start();
      this.stagnantTale = true;
      setTimeout(() => {this.stagnantTale = false}, 400/3)

      //tween head position
      var headPos = this.adjustPosForHead(this.incomingPos.clone(), curFootOffset, upNew)
      var headTween = new TWEEN.Tween(headBone.position).to(headPos, 400/3).delay(200/3).start();
    }
  }

  getProjectedFootPos = (incomingPos, curFootOffset) => {
    incomingPos.copy(this.hero.position)
    addScalarMultiple(this.incomingPos, this.worldAxis.left, curFootOffset)
    addScalarMultiple(this.incomingPos, this.worldAxis.up, HERO_HEIGHT)
    addScalarMultiple(this.incomingPos, this.worldAxis.forward, HERO_LEG_FORWARD_OFFSET)
    return incomingPos;
  }
  getProjectedFrontFootPos = (incomingPos, curFootOffset) => {
    incomingPos.copy(this.hero.position)
    addScalarMultiple(this.incomingPos, this.worldAxis.left, curFootOffset)
    addScalarMultiple(this.incomingPos, this.worldAxis.up, HERO_HEIGHT)
    addScalarMultiple(this.incomingPos, this.worldAxis.forward, 6)
    return incomingPos;
  }

  adjustPosForHero = (incomingPos, curFootOffset, up) => {
    addScalarMultiple(incomingPos, this.worldAxis.forward, -5)
    addScalarMultiple(incomingPos, this.worldAxis.left, -curFootOffset)
    incomingPos.add(up)
    return incomingPos;
  }

  adjustPosForHead = (incomingPos, curFootOffset, up) => {
    addScalarMultiple(incomingPos, this.worldAxis.forward, 7)
    addScalarMultiple(incomingPos, this.worldAxis.left, -curFootOffset)
    addScalarMultiple(incomingPos, up, 3)
    return incomingPos;
  }

  adjustPosForTail = (incomingPos, curFootOffset, up) => {
    incomingPos.add(up)
    addScalarMultiple(incomingPos, this.worldAxis.forward, -15.5)
    addScalarMultiple(incomingPos, this.worldAxis.left, -2*curFootOffset)
    return incomingPos;
  }


  findNearestCollisionPoint = (basePos, grounded=false) => {
    var {forward, up} = this.worldAxis;
    var minDist = 100
    var min = [0,0,0,0]
    var found = false
    var axis = new THREE.Vector3().crossVectors(forward, up)
    var raycastQuat = new THREE.Quaternion();
    var raycastDir = new THREE.Vector3();
    var meshes = this.worldGrid.queryPointsInRadius(basePos.x, basePos.y, basePos.z)
    for ( var i = -Math.PI/3; i < Math.PI/3; i += 0.1){
      raycastQuat.setFromAxisAngle(axis, i)
      raycastDir.copy(forward).applyQuaternion(raycastQuat)
      this.raycaster.set(basePos, raycastDir)
      var n = this.raycaster.intersectObjects(meshes);

      if(Math.abs(i)< minDist && n[0] && n[0].point.distanceTo(basePos) < 13 && n[0].point.distanceTo(basePos) > 8){
        console.log('found at distance', n[0].point.distanceTo(basePos))
        minDist = (Math.abs(i))
        var mult = 1
        if(n[0].object.material.side == THREE.BackSide){
          mult = -1
        }
        this.winningDir.copy(this.raycaster.ray.direction)
        min = [n[0].point, n[0].face.normal.clone().multiplyScalar(mult)]
        found = true;
        if(grounded){
          break;
        }
      }
    }

    if(!found){
      console.log('nothing found, trying extremities')
      //push base pos forwards
      var bpforward = addScalarMultiple(basePos.clone(), forward, 10)
      for ( var i = -7*Math.PI/8; i < -Math.PI/3; i += 0.05){
        raycastQuat.setFromAxisAngle(axis, i)
        raycastDir.copy(forward).applyQuaternion(raycastQuat)
        this.raycaster.set(bpforward, raycastDir)
        var n = this.raycaster.intersectObjects(meshes);
        if(!n[0]) break;
        var dist = n[0].point.distanceTo(bpforward)
        if(dist < minDist && n[0] && dist < 18 ){
          console.log('found at distance', dist, "rayDegrees", i)
          this.winningDir.copy(this.raycaster.ray.direction)

          minDist = dist
          var mult = 1
          if(n[0].object.material.side == THREE.BackSide){
            mult = -1
          }
          this.winningDir.copy(this.raycaster.ray.direction)
          min = [n[0].point, n[0].face.normal.clone().multiplyScalar(mult)]
          found = true;
          if(grounded){
            break;
          }
        }
      }

    }

    return [found, min[0], min[1]]
  }

  alignHeroToGround = (nn) => {
    var {forward, up} = this.worldAxis;
    //adjust quaternion so up vector and surface normal are aligned
    var upNew = new THREE.Vector3(0,1,0).applyQuaternion(this.hero.quaternion).normalize()
    var upAdjustQuat = getAlignmentQuaternion(upNew, nn[2]);
    if(upAdjustQuat){
      this.hero.quaternion.premultiply(upAdjustQuat)
      this.heroCamera.quaternion.premultiply(upAdjustQuat)
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
    this.worldAxis.forward.set(0,0,-1).applyQuaternion(this.heroCamera.quaternion)
    this.worldAxis.up.set(0,1,0).applyQuaternion(this.heroCamera.quaternion)
    this.worldAxis.left.set(1,0,0).applyQuaternion(this.heroCamera.quaternion)
  }

  recalculateHeroAxis = () => {
    this.heroAxis.forward.set(0,0,-1).applyQuaternion(this.hero.quaternion)
    this.heroAxis.up.set(0,1,0).applyQuaternion(this.hero.quaternion)
    this.heroAxis.left.set(1,0,0).applyQuaternion(this.hero.quaternion)
  }

  updateTailPos = () => {
    this.tailMotionCounter += 0.02
    var tailBone = this.bonePoints[5];
    addScalarMultiple(tailBone.position, this.worldAxis.left, 0.015*Math.sin(this.tailMotionCounter))
  }

  tweenHeroToCameraForward = () => {
    this.recalculateHeroAxis()
    var forwardAdjustQuat = getAlignmentQuaternionOnPlane(this.worldAxis.forward, this.heroAxis.forward, this.heroAxis.up)
    if(forwardAdjustQuat){
      // var finalQuat = this.hero.quaternion.clone().premultiply(forwardAdjustQuat)
      // var o = {t: 0};
      // function tenStepEasing(k) {
      // 	return Math.floor(k * 10) / 10;
      // }
      // new TWEEN.Tween(o).to({t: 1}, 1000).onUpdate(() => {
      //   console.log(o.t)
      //   this.hero.quaternion.slerp(finalQuat, 0.1)
      // }).easing(tenStepEasing).start();
      this.hero.quaternion.premultiply(forwardAdjustQuat)
    }
  }

  updateHeroRotation() {
    var forwardFootLeft = this.bonePoints[2]
    var forwardFootRight = this.bonePoints[3]
    var tailBone = this.bonePoints[5];
    var headBone = this.bonePoints[4];

    this.recalculateHeroAxis()

    var newForward = new THREE.Vector3().addVectors(forwardFootLeft.position, forwardFootRight.position).multiplyScalar(0.5)
    newForward.sub(this.hero.position).normalize()

    var forwardAdjustQuat = getAlignmentQuaternionOnPlane(newForward, this.heroAxis.forward, this.heroAxis.up)
    if(forwardAdjustQuat){
      this.hero.quaternion.premultiply(forwardAdjustQuat)
    }

    //move tail behind
    var incomingPos = new THREE.Vector3().addVectors(forwardFootLeft.position, forwardFootRight.position).multiplyScalar(0.5)
    addScalarMultiple(incomingPos, this.heroAxis.forward, -14.5)
    var tailTween = new TWEEN.Tween(tailBone.position).to(incomingPos, 50).start();
    this.stagnantTale = true;
    setTimeout(() => {this.stagnantTale = false}, 50)

    //move head forward
    // var incomingPos = new THREE.Vector3().addVectors(forwardFootLeft.position, forwardFootRight.position).multiplyScalar(0.5)
    // addScalarMultiple(incomingPos, this.heroAxis.forward, 6)
    // addScalarMultiple(incomingPos, this.heroAxis.up, 2)
    // var headTween = new TWEEN.Tween(headBone.position).to(incomingPos, 50).start();
  }

  update() {
    // this.tweenHeroToCameraForward()
    var pos = new THREE.Vector3();
    pos.addVectors(this.winningDir, this.raycaster.ray.origin);
    this.rayHelper.lookAt(pos);
    this.rayHelper.position.copy(this.raycaster.ray.origin)
    if(!this.stagnantTale){
      this.updateTailPos();
    }
    TWEEN.update()
    this.tweener.update()
    if(this.iks){
      this.iks.forEach((ik)=>{
        // ik.solve()
      })
    }
  }
}
