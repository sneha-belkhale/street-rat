
var THREE = require('three');

export default class ParabolicFootTweener {
  constructor() {
    this.tweens = []
    this.helperVec = new THREE.Vector3();
  }

  addTween(fromVector, toVector, upVector, totalSteps){
    var step = fromVector.distanceTo(toVector)/totalSteps;
    var dirVector = toVector.clone().sub(fromVector).normalize().multiplyScalar(step);
    this.tweens.push({
      fromVector: fromVector,
      dirVector: dirVector,
      upVector: upVector,
      step: step,
      count: 0,
      totalSteps: totalSteps,
    })
  }

  update(){
    this.tweens.forEach((tweener, index, object) => {
      tweener.fromVector.add(tweener.dirVector)
      var x = (tweener.count-0.5*tweener.totalSteps)/(0.5*tweener.totalSteps)
      var parabolicIdx = 1.5*x*x;
      if(tweener.count > 0.5*tweener.totalSteps){
        parabolicIdx *= -1
      }

      this.helperVec.copy(tweener.upVector).multiplyScalar(parabolicIdx*tweener.step);
      tweener.fromVector.add(this.helperVec)

      tweener.count += 1;
      if(tweener.count >= tweener.totalSteps){
        object.splice(index, 1);
      }
    })

  }
}
