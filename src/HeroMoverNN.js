import ParabolicFootTweener from './Tweener';
import TweenController from './TweenController';
import { addScalarMultiple, getAlignmentQuaternion, getAlignmentQuaternionOnPlane } from './MathUtils';

const THREE = require('three');
const TWEEN = require('tween');

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

* */

const DEBUG_MODE = false;

// hero constants
const HERO_HALF_WIDTH = 1.4;
const HERO_HEIGHT = 4;
const HERO_LEG_FORWARD_OFFSET = 1;

export default class HeroMover {
  constructor(hero, iks, bonePoints, worldGrid, camera, scene) {
    this.scene = scene;
    this.hero = hero;
    this.iks = iks;
    this.bonePoints = bonePoints;
    this.bonePoints[2].normal = new THREE.Vector3();
    this.bonePoints[3].normal = new THREE.Vector3();


    this.worldGrid = worldGrid;

    this.camera = camera;
    this.pivot = new THREE.Object3D();
    this.pivot.position.copy(hero.position);
    // this.hero.add(this.camera)
    scene.add(this.pivot);

    this.heroCamera = new THREE.Object3D();
    scene.add(this.heroCamera);
    this.heroCamera.add(this.camera);
    this.camera.position.set(0, 20, 40);
    this.cameraTweener = new TweenController(this.heroCamera, scene);
    this.heroTweener = new TweenController(this.hero, scene);

    // set up the hero // right now will be the positions of two boxes
    this.curBone = 0;
    this.curRotBone = 0;

    // helpers
    this.incomingPos = new THREE.Vector3();
    this.lastMousePos = new THREE.Vector2();
    this.delta = new THREE.Vector2();
    this.velocity = new THREE.Vector3();
    this.moving = true;
    this.pos = 0;
    this.tweener = new ParabolicFootTweener(this);
    this.startTime = Date.now();
    this.raycaster = new THREE.Raycaster();
    this.tailMotionCounter = -1;

    // worldAxis helpers
    this.worldAxis = {
      forward: new THREE.Vector3(),
      up: new THREE.Vector3(),
      left: new THREE.Vector3(),
    };
    this.heroAxis = {
      forward: new THREE.Vector3(),
      up: new THREE.Vector3(),
      left: new THREE.Vector3(),
    };

    window.addEventListener('keydown', this.moveHero);
    window.addEventListener('keyup', this.onKeyUp);

    window.addEventListener('mouseup', this.endRotate);
    window.addEventListener('mousemove', this.rotate);


    const origin = this.hero.position;
    const dir = new THREE.Vector3(0, 1, 0);
    const length = 3;
    const hex = 0x0000ff;
    this.winningDir = new THREE.Vector3();


    if (DEBUG_MODE) {
      this.arrowHelper = new THREE.ArrowHelper(dir, origin, length, hex);
      scene.add(this.arrowHelper);

      this.arrowHelperSearch = new THREE.ArrowHelper(dir, origin, length, 0xff0000);
      scene.add(this.arrowHelperSearch);

      this.rayHelper = new THREE.Mesh(
        new THREE.BoxGeometry(0.5, 0.5, 20),
        new THREE.MeshBasicMaterial(
          {
            color: new THREE.Color('#7fffd4'),
            wireframe: true,
          },
        ),
      );
      scene.add(this.rayHelper);
    }
  }

  rotate = (event) => {
    if (this.lastMousePos.x === 0 && this.lastMousePos.y === 0) {
      this.lastMousePos.set(event.x, event.y);
      return;
    }
    this.delta.set(event.x, event.y).sub(this.lastMousePos);
    this.lastMousePos.set(event.x, event.y);

    this.cameraTweener.rotateY(this.delta.x * 0.01);
    this.recalculateWorldAxis();
    if (this.walking) {
      this.tweenHeroToCameraForward();
    }
  }

  endRotate = () => {
    this.lastMousePos.set(0, 0);
  }

  onKeyUp = () => {
    this.walking = false;
  }

  moveHero = (event) => {
    if (event.key !== 'w') {
      return;
    }

    const msElapsed = Date.now() - this.startTime;
    if (msElapsed < 1000 / 3) {
      return;
    }

    this.startTime = Date.now();
    this.curBone += 1;
    this.tailMotionCounter = 0;

    this.recalculateWorldAxis();

    // base position is going to correspond to the foot ..
    const foot = this.bonePoints[(this.curBone + 1) % 2];
    const forwardFoot = this.bonePoints[((this.curBone + 1) % 2) + 2];
    const tailBone = this.bonePoints[5];
    const headBone = this.bonePoints[4];

    const curFootOffset = HERO_HALF_WIDTH * (2 * ((this.curBone + 1) % 2) - 1);
    // set foot position to the left of mouse base
    this.incomingPos = this.getProjectedFrontFootPos(this.incomingPos, curFootOffset);

    if (DEBUG_MODE) {
      this.alignArrowHelper();
    }
    const tt = this.findNearestCollisionPoint(this.incomingPos);
    if (tt[0]) {
      this.incomingPos.copy(tt[1]);
      this.incomingPos.set(
        Math.round(this.incomingPos.x),
        Math.round(this.incomingPos.y),
        Math.round(this.incomingPos.z),
      );

      forwardFoot.normal.copy(tt[2]);
      const upNew = this.alignHeroToGround();

      // realign hero
      if (!this.walking) {
        this.tweenHeroToCameraForward();
        this.walking = true;
      }

      // get head position
      const headPos = this.adjustPosForHead(this.incomingPos.clone(), curFootOffset, upNew);
      new TWEEN.Tween(headBone.position).to(headPos, 400 / 3).start();

      // tween forward foot position
      addScalarMultiple(this.incomingPos, upNew, 1);
      const frontFootPos = addScalarMultiple(this.incomingPos.clone(), this.worldAxis.forward, 2);

      this.tweener.addTween(
        ((this.curBone) % 2) + 2, forwardFoot.position, frontFootPos, this.worldAxis.up, 80 / 3,
      );

      // tween back foot position
      const backFootPos = addScalarMultiple(this.incomingPos.clone(), this.worldAxis.forward, -4);
      this.tweener.addTween(
        ((this.curBone) % 2), foot.position, backFootPos, this.worldAxis.up, 80 / 3,
      );

      // tween body position
      const heroPos = this.adjustPosForHero(this.incomingPos.clone(), curFootOffset, upNew);
      new TWEEN.Tween(this.hero.position)
        .to(heroPos, 200 / 3).delay(200 / 3).start();
      new TWEEN.Tween(this.heroCamera.position)
        .to(heroPos, 200 / 3).delay(200 / 3).start();

      // tween tail position
      const tailPos = this.adjustPosForTail(this.incomingPos.clone(), curFootOffset, upNew);
      new TWEEN.Tween(tailBone.position).to(tailPos, 300).start();
      this.stagnantTale = true;
      setTimeout(() => { this.stagnantTale = false; }, 300);
    }
  }

  getProjectedFootPos = (incomingPos, curFootOffset) => {
    incomingPos.copy(this.hero.position);
    addScalarMultiple(this.incomingPos, this.worldAxis.left, curFootOffset);
    addScalarMultiple(this.incomingPos, this.worldAxis.up, HERO_HEIGHT);
    addScalarMultiple(this.incomingPos, this.worldAxis.forward, HERO_LEG_FORWARD_OFFSET);
    return incomingPos;
  }

  getProjectedFrontFootPos = (incomingPos, curFootOffset) => {
    incomingPos.copy(this.hero.position);
    addScalarMultiple(this.incomingPos, this.worldAxis.left, curFootOffset);
    addScalarMultiple(this.incomingPos, this.worldAxis.up, HERO_HEIGHT + 3);
    addScalarMultiple(this.incomingPos, this.worldAxis.forward, 14);
    return incomingPos;
  }

  adjustPosForHero = (incomingPos, curFootOffset, up) => {
    addScalarMultiple(incomingPos, this.worldAxis.forward, -6);
    addScalarMultiple(incomingPos, this.worldAxis.left, -curFootOffset);
    addScalarMultiple(incomingPos, up, 1.5);
    return incomingPos;
  }

  adjustPosForHead = (incomingPos, curFootOffset, up) => {
    addScalarMultiple(incomingPos, this.worldAxis.forward, 8);
    addScalarMultiple(incomingPos, this.worldAxis.left, -curFootOffset);
    addScalarMultiple(incomingPos, up, 6);
    return incomingPos;
  }

  adjustPosForTail = (incomingPos, curFootOffset, up) => {
    incomingPos.add(up);
    addScalarMultiple(incomingPos, this.worldAxis.forward, -16.9);
    addScalarMultiple(incomingPos, this.worldAxis.left, -2 * curFootOffset);
    return incomingPos;
  }


  findNearestCollisionPoint = (basePos) => {
    const { forward, up } = this.worldAxis;
    let min = [0, 0, 0, 0];
    let found = false;
    const axis = new THREE.Vector3().crossVectors(forward, up);
    const raycastQuat = new THREE.Quaternion();
    const raycastDir = new THREE.Vector3();
    const meshes = this.worldGrid.queryPointsInRadius(basePos.x, basePos.y, basePos.z, 1);
    meshes.forEach((mesh) => {
      mesh.material.side = THREE.DoubleSide;
    });
    const angles = [-5 * Math.PI / 8, -5.5 * Math.PI / 8, -7 * Math.PI / 8];
    angles.forEach((i) => {
      if (found) {
        return;
      }
      raycastQuat.setFromAxisAngle(axis, i);
      raycastDir.copy(forward).applyQuaternion(raycastQuat);
      this.raycaster.set(basePos, raycastDir);
      const n = this.raycaster.intersectObjects(meshes);
      if (n[0]) {
        // console.log(n[0].point, n[0].face.normal);
        if (n[0].point.distanceTo(basePos) < 15) {
          const adjustedNormal = n[0].face.normal.clone()
            .transformDirection(n[0].object.matrixWorld);
          min = [n[0].point, adjustedNormal];
          found = true;
        }
      }
      this.winningDir.copy(this.raycaster.ray.direction);
    });

    meshes.forEach((mesh) => {
      mesh.material.side = THREE.FrontSide;
    });
    return [found, min[0], min[1], meshes];
  }

  alignHeroToGround = () => {
    // adjust quaternion so up vector and surface normal are aligned
    const upNew = new THREE.Vector3(0, 1, 0).applyQuaternion(
      this.cameraTweener.getTargetQuat(),
    ).normalize();
    const avgNormal = new THREE.Vector3().addVectors(
      this.bonePoints[2].normal, this.bonePoints[3].normal,
    );
    if (!avgNormal) return null;
    const upAdjustQuat = getAlignmentQuaternion(upNew, avgNormal);
    if (upAdjustQuat) {
      this.heroTweener.applyToTargetQuaternion(upAdjustQuat);
      this.cameraTweener.applyToTargetQuaternion(upAdjustQuat);
    }
    return upNew;
  }

  alignArrowHelper = () => {
    this.arrowHelper.setDirection(this.worldAxis.forward);
    this.arrowHelper.position.copy(this.hero.position);
    this.arrowHelperSearch.setDirection(this.worldAxis.up);
    this.arrowHelperSearch.position.copy(this.hero.position);
  }

  recalculateWorldAxis = () => {
    this.worldAxis.forward.set(0, 0, -1).applyQuaternion(this.cameraTweener.getTargetQuat());
    this.worldAxis.up.set(0, 1, 0).applyQuaternion(this.cameraTweener.getTargetQuat());
    this.worldAxis.left.set(1, 0, 0).applyQuaternion(this.cameraTweener.getTargetQuat());
  }

  recalculateHeroAxis = () => {
    this.heroAxis.forward.set(0, 0, -1).applyQuaternion(this.heroTweener.getTargetQuat());
    this.heroAxis.up.set(0, 1, 0).applyQuaternion(this.heroTweener.getTargetQuat());
    this.heroAxis.left.set(1, 0, 0).applyQuaternion(this.heroTweener.getTargetQuat());
  }

  updateTailPos = () => {
    this.tailMotionCounter += 0.02;
    const tailBone = this.bonePoints[5];
    addScalarMultiple(tailBone.position,
      this.worldAxis.left, 0.015 * Math.sin(this.tailMotionCounter));
  }

  tweenHeroToCameraForward = () => {
    this.recalculateHeroAxis();
    const forwardAdjustQuat = getAlignmentQuaternionOnPlane(
      this.worldAxis.forward, this.heroAxis.forward, this.heroAxis.up,
    );
    if (forwardAdjustQuat) {
      this.heroTweener.applyToTargetQuaternion(forwardAdjustQuat);
    }
  }

  update() {
    this.heroTweener.update();
    this.cameraTweener.update();

    if (DEBUG_MODE) {
      const pos = new THREE.Vector3();
      pos.addVectors(this.winningDir, this.raycaster.ray.origin);
      this.rayHelper.lookAt(pos);
      this.rayHelper.position.copy(this.raycaster.ray.origin);
    }

    if (!this.stagnantTale) {
      this.updateTailPos();
    }
    TWEEN.update();
    this.tweener.update();
    if (this.iks) {
      this.iks.forEach((ik) => {
        ik.solve();
      });
    }
  }
}
