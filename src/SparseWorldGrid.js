let THREE = require('three');

const DEBUG_MODE = false;

export default class SparseWorldGrid {
    constructor( cellSize ) {
        this.grid = {};
        this.cellSize = cellSize;
        this.helperBbox = new THREE.Box3()
    }

    getHash(posX, posY, posZ) {
        return `${Math.round(posX / this.cellSize)}:${
            Math.round(posY / this.cellSize)}:${
            Math.round(posZ / this.cellSize)}`;
    }

    getHashRaw(posX, posY, posZ) {
        return `${(posX)}:${
            (posY)}:${
            (posZ)}`;
    }

    valueAtWorldPos(posX, posY, posZ) {
        let idx = this.getHash(posX, posY, posZ);
        return this.grid[idx];
    }

    queryPointsInRadius(posX, posY, posZ, r) {
      let meshes = {};
      let meshesArray = [];
      for(let i = -r; i < r+1; i++) {
        for(let j = -r; j < r+1; j++) {
          for(let k = -r; k < r+1; k++) {
            let value = this.valueAtWorldPos(posX + i * this.cellSize, posY + j * this.cellSize, posZ + k * this.cellSize);
            if (value) {
              Object.keys(value).forEach(key => {
                var mesh = value[key];
                if(!meshes[mesh.id]) {
                    meshesArray.push(mesh);
                    meshes[mesh.id] = mesh;
                }
              });
            }
          }
        }
      }
      return meshesArray;
    }

    addForIdx(idx, mesh) {
      if (!this.grid[idx]){
        this.grid[idx] = {}
      }
      this.grid[idx][mesh.id] = mesh;
    }

    fillGridForMesh(mesh) {
        var bbox = this.helperBbox.setFromObject(mesh)
        let minX = Math.floor((bbox.min.x) / this.cellSize);
        let maxX = Math.ceil((bbox.max.x) / this.cellSize);
        let minZ = Math.floor((bbox.min.z) / this.cellSize);
        let maxZ = Math.ceil((bbox.max.z) / this.cellSize);
        let minY = Math.floor((bbox.min.y) / this.cellSize);
        let maxY = Math.ceil((bbox.max.y) / this.cellSize);
        // top bottom
        for (var i = minX; i <= maxX; i++) {
            for (var j = minZ; j <= maxZ; j++) {
                let idx = this.getHashRaw(i, minY, j);
                this.addForIdx(idx, mesh)
                let idx2 = this.getHashRaw(i, maxY, j);
                this.addForIdx(idx2, mesh)
            }
        }
        // left right
        for (var i = minX; i <= maxX; i++) {
            for (var j = minY; j <= maxY; j++) {
                let idx = this.getHashRaw(i, j, minZ);
                this.addForIdx(idx, mesh)
                let idx2 = this.getHashRaw(i, j, maxZ);
                this.addForIdx(idx2, mesh)
            }
        }
        // forward backward
        for (var i = minY; i <= maxY; i++) {
            for (var j = minZ; j <= maxZ; j++) {
                let idx = this.getHashRaw(minX, i, j);
                this.addForIdx(idx, mesh)
                let idx2 = this.getHashRaw(maxX, i, j);
                this.addForIdx(idx2, mesh)
            }
        }
    }
}
