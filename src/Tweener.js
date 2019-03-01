
const THREE = require('three');

export default class ParabolicFootTweener {
  constructor(mover) {
    this.tweens = [];
    this.helperVec = new THREE.Vector3();
    this.tweenKeys = {};
    this.mover = mover;
  }

  addTween(key, fromVector, toVector, upVector, totalSteps, rotator) {
    // do not add tween if there is already a tween for this vector
    if (this.tweenKeys[key]) {
      return false;
    }

    this.tweenKeys[key] = 1;
    const step = fromVector.distanceTo(toVector) / totalSteps;
    const dirVector = toVector.clone().sub(fromVector).normalize().multiplyScalar(step);
    this.tweens.push({
      fromVector,
      dirVector,
      upVector,
      step,
      count: 0,
      totalSteps,
      key,
      rotator,
    });
    return true;
  }

  update() {
    this.tweens.forEach((tweener, index, object) => {
      tweener.fromVector.add(tweener.dirVector);
      const x = (tweener.count - 0.5 * tweener.totalSteps) / (0.5 * tweener.totalSteps);
      let parabolicIdx = 1.5 * x * x;
      if (tweener.count > 0.5 * tweener.totalSteps) {
        parabolicIdx *= -1;
      }

      this.helperVec.copy(tweener.upVector).multiplyScalar(0.45 * parabolicIdx * tweener.step);
      tweener.fromVector.add(this.helperVec);

      tweener.count += 1;
      if (tweener.count >= tweener.totalSteps) {
        object.splice(index, 1);
        delete this.tweenKeys[tweener.key];
      }
    });
  }
}
