const RESETQUAT = new THREE.Quaternion();
const t1 = new THREE.Vector3();
const t2 = new THREE.Vector3();
const t3 = new THREE.Vector3();
const m1 = new THREE.Matrix4();

/**
 * Takes in a rootBone and recursively traverses the bone heirarchy,
 * setting each bone's +Z axis to face it's child bones. The IK system follows this
 * convention, so this step is necessary to update the bindings of a skinned mesh. 
 *
 * @param {THREE.BONE} rootBone
 * @param {THREE.Scene} scene
 */

function setZForward(rootBone, scene) {
  var worldPos = {}
  getOriginalWorldPositions(rootBone, worldPos)
  updateTransformations(rootBone, worldPos, scene);
}

function updateTransformations(parentBone, worldPos, scene) {
    var averagedDir = new THREE.Vector3();
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

    //preserve the original up vectors
    var up = _worldToLocalDirection(worldPos[parentBone.id][1].clone(), parentBone)
    setQuaternionFromDirection(childBoneDir, up, parentBone.quaternion)
    parentBone.updateMatrixWorld();

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

//borrowing this from utils.js , not sure how to import it
function setQuaternionFromDirection(direction, up, target) {
  const x = t1;
  const y = t2;
  const z = t3;
  const m = m1;
  const el = m1.elements;

  z.copy(direction);
  x.crossVectors(up, z);

  if (x.lengthSq() === 0) {
    // parallel
    if (Math.abs(up.z) === 1) {
      z.x += 0.0001;
    } else {
      z.z += 0.0001;
    }
    z.normalize();
    x.crossVectors(up, z);
  }

  x.normalize();
  y.crossVectors(z, x);

  el[ 0 ] = x.x; el[ 4 ] = y.x; el[ 8 ] = z.x;
  el[ 1 ] = x.y; el[ 5 ] = y.y; el[ 9 ] = z.y;
  el[ 2 ] = x.z; el[ 6 ] = y.z; el[ 10 ] = z.z;

  target.setFromRotationMatrix(m);
}

function getOriginalWorldPositions(rootBone, worldPos) {
  var rootBoneWorldPos = rootBone.getWorldPosition(new THREE.Vector3())
  var rootBoneUpDir = _localToWorldDirection(Y_AXIS.clone(), rootBone);
  worldPos[rootBone.id] = [rootBoneWorldPos, rootBoneUpDir];
  rootBone.children.forEach((child) => {
    getOriginalWorldPositions(child, worldPos)
  })
}

function _worldToLocalDirection(direction, sparent) {
    const inverseParent = new THREE.Matrix4().getInverse(sparent.matrixWorld);
    direction.transformDirection(inverseParent);
  return direction;
}

function _localToWorldDirection(direction, sparent) {
  const parent = sparent.matrixWorld;
  direction.transformDirection(parent);
  return direction;
}
