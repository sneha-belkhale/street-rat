import { Vector3, Matrix4, Quaternion, Plane, ArrowHelper } from 'three';
import { setQuaternionFromDirection } from './utils.js';

const t = new Vector3();
const q = new Quaternion();
const p = new Plane();
const RESETQUAT = new Quaternion();
const Y_AXIS = new Vector3(0,1,0);
const X_AXIS = new Vector3(1,0,0);
const Z_AXIS = new Vector3(0,0,1);

function getAlignmentQuaternion(fromDir, toDir) {
  const adjustAxis = t.crossVectors(fromDir, toDir).normalize();
  const adjustAngle = fromDir.angleTo(toDir);
  if (adjustAngle) {
    const adjustQuat = q.setFromAxisAngle(adjustAxis, adjustAngle);
    return adjustQuat;
  }
  return null;
}

function getOriginalWorldPositions(rootBone, worldPos) {
  var rootBoneWorldPos = rootBone.getWorldPosition(new Vector3())
  var rootBoneUpDir = _localToWorldDirection(Y_AXIS.clone(), rootBone);
  worldPos[rootBone.id] = [rootBoneWorldPos, rootBoneUpDir];
  rootBone.children.forEach((child) => {
    getOriginalWorldPositions(child, worldPos)
  })
}

function _worldToLocalDirection(direction, sparent) {
    const inverseParent = new Matrix4().getInverse(sparent.matrixWorld);
    direction.transformDirection(inverseParent);
  return direction;
}

function _localToWorldDirection(direction, sparent) {
  const parent = sparent.matrixWorld;
  direction.transformDirection(parent);
  return direction;
}

export function setZForward(rootBone, scene) {
  var worldPos = {}
  getOriginalWorldPositions(rootBone, worldPos)
  updateTransformations(rootBone, worldPos, scene);
}

function updateTransformations(parentBone, worldPos, scene) {
    var averagedDir = new Vector3();
    parentBone.children.forEach((childBone) => {
      //average the child bone world pos
      var childBonePosWorld = worldPos[childBone.id][0];
      averagedDir.add(childBonePosWorld);
    });

    averagedDir.multiplyScalar(1/(parentBone.children.length));

    //set quaternion
    parentBone.quaternion.copy(RESETQUAT);
    parentBone.updateMatrixWorld();
    //get the child bone position in local coordinates
    var childBoneDir = parentBone.worldToLocal(averagedDir.clone()).normalize();
    //set the direction to child bone to the forward direction
    var y = _worldToLocalDirection(worldPos[parentBone.id][1].clone(), parentBone)
    setQuaternionFromDirection(childBoneDir, y, parentBone.quaternion)
    parentBone.updateMatrixWorld();

    // var arrowHelper = new ArrowHelper(worldPos[parentBone.id][1], worldPos[parentBone.id][0], 2, 0xff00ff);
    // scene.add(this.arrowHelper);

    //set child bone position relative to the new parent matrix.
    parentBone.children.forEach((childBone) => {
      var childBonePosWorld = worldPos[childBone.id][0].clone();
      parentBone.worldToLocal(childBonePosWorld);
      childBone.position.copy(childBonePosWorld);
    });

    parentBone.children.forEach((childBone) => {
      updateTransformations(childBone, worldPos, scene);
    })
}
