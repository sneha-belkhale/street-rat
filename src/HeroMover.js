var THREE = require('three');

export default class HeroMover {
  constructor( hero, worldGrid ) {
    this.hero = hero;
    this.worldGrid = worldGrid;
    this.incomingPos = new THREE.Vector3()
    window.addEventListener('keydown', this.moveHero)
  }

  moveHero = (event) => {

    switch(event.key){
      case "a":
      this.incomingPos.set(this.hero.position.x, this.hero.position.y, this.hero.position.z+1)
      break;
      case "w":
      this.incomingPos.set(this.hero.position.x-1, this.hero.position.y, this.hero.position.z)
      break;
      case "d":
      this.incomingPos.set(this.hero.position.x, this.hero.position.y, this.hero.position.z-1)
      break;
      case "s":
      this.incomingPos.set(this.hero.position.x+1, this.hero.position.y, this.hero.position.z)
      break;
    }

    var passed = this.handleBoundingBoxCollision(this.hero.geometry.boundingBox, this.incomingPos)

    if(passed){
      this.hero.position.copy(this.incomingPos)
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
