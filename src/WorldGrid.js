var THREE = require('three');

const DEBUG_MODE = false;

class Line {
  constructor(start, dir, length){
    this.start = start;
    this.dir = dir.normalize();
    this.length = length
  }
  intersect(line){
    var nom = line.dir.dot(this.dir)
    var s = (this.start.clone().sub(line.start).dot(line.dir) + line.start.clone().sub(this.start).dot(this.dir)*nom)/(1 - nom*nom)
    var point = line.start.clone().add(line.dir.clone().multiplyScalar(s))
    return point
  }
}

export default class WorldGrid {
  constructor(width, height, depth, offset){
    this.grid = new Int8Array(width*height*depth);
    this.width = width;
    this.height = height;
    this.depth = depth;
    this.offset = offset;
  }
  valueAtWorldPos(posX, posY, posZ){
    posX = Math.ceil(posX + this.offset.x); //conversion to positive indices
    posY = Math.ceil(posY + this.offset.y);
    posZ = Math.ceil(posZ + this.offset.z);
    var idx = posY*this.width*this.depth + posZ*this.width + posX;
    return this.grid[idx];
  }
  setValueAtWorldPos(posX, posY, posZ, itemId){
    posX = Math.ceil(posX + this.offset.x);
    posY = Math.ceil(posY + this.offset.y);
    posZ = Math.ceil(posZ + this.offset.z);
    var idx = posY*this.width*this.depth + posZ*this.width + posX;
    this.grid[idx]=itemId;
  }

  //call this after setting scale and position. mesh must have faces.
  fillGridForMesh(mesh, scene){
    if (DEBUG_MODE){
      var starsGeometry = new THREE.Geometry();
    }
    mesh.geometry.faces.forEach((face)=>{
      var vertexA = mesh.geometry.vertices[face.a].clone().add(mesh.position);
      var vertexB = mesh.geometry.vertices[face.b].clone().add(mesh.position);
      var vertexC = mesh.geometry.vertices[face.c].clone().add(mesh.position);
      //fill all from A - B
      var lineAB = vertexB.clone().sub(vertexA)
      var lineCA = vertexA.clone().sub(vertexC)
      var lineBC = vertexC.clone().sub(vertexB)

      var lengthAB = lineAB.length()
      var lengthCA = lineCA.length()
      var lengthBC = lineBC.length()

      var baseLine, sideLine1, sideLine2

      if (lengthAB > lengthCA && lengthAB > lengthBC){
        baseLine = new Line(vertexA, lineAB, lengthAB)
        sideLine1 = new Line(vertexA, lineCA.multiplyScalar(-1), lengthCA)
        sideLine2 = new Line(vertexC, lineBC, lengthBC)
      }
      else if (lengthCA > lengthAB && lengthCA > lengthBC){
        baseLine = new Line(vertexC, lineCA, lengthCA)
        sideLine1 = new Line(vertexC, lineBC.multiplyScalar(-1), lengthBC)
        sideLine2 = new Line(vertexB, lineAB, lengthAB)

      } else {
        baseLine = new Line(vertexB, lineBC, lengthBC)
        sideLine1 = new Line(vertexB, lineAB.multiplyScalar(-1), lengthAB)
        sideLine2 = new Line(vertexA, lineCA, lengthCA)
      }

      for (var j = 0; j< sideLine1.length; j++){
        var nextPoint = sideLine1.start.clone().add(sideLine1.dir.normalize().clone().multiplyScalar(j))
        var scanLine = new Line(nextPoint, baseLine.dir)
        var intersectionPoint = scanLine.intersect(sideLine2)

        //lenght is this intersection point - start point
        var length = nextPoint.clone().sub(intersectionPoint).length()
        for ( var i = 0; i < length; i ++ ) {
            this.setValueAtWorldPos(nextPoint.x, nextPoint.y, nextPoint.z, 1)
            if ( DEBUG_MODE ) {
              starsGeometry.vertices.push( nextPoint.clone() );
            }
            nextPoint.add(baseLine.dir)
        }
      }
    })
    if( DEBUG_MODE ){
      var starsMaterial = new THREE.PointsMaterial( { color: 0x888888 } );
      var starField = new THREE.Points( starsGeometry, starsMaterial );
      scene.add( starField );
    }
  }
}
