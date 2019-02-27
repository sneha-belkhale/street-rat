let THREE = require('three');

const DEBUG_MODE = false;

export default class SparseWorldGrid {
    constructor() {
        this.grid = {};
    }

    getHash(posX, posY, posZ) {
        return `${Math.round(posX / 20)}:${
            Math.round(posY / 20)}:${
            Math.round(posZ / 20)}`;
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
        for(let i = -1; i < 2; i++) {
            for(let j = -1; j < 2; j++) {
                for(let k = -1; k < 2; k++) {
                    let value = this.valueAtWorldPos(posX + i * 20, posY + j * 20, posZ + k * 20);
                    if (value) {
                      Object.keys(value).forEach(key => {
                          var mesh = value[key];
                          if(!meshes[mesh.id]) {
                              meshesArray.push(mesh);
                              meshes[mesh.id] = mesh;
                          }
                        }
                      );

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

    fillGridFromBoundingBox(mesh, scene) {
        mesh.geometry.computeBoundingBox();
        let bbox = mesh.geometry.boundingBox;
        let minX = Math.floor((mesh.position.x + bbox.min.x) / 20);
        let maxX = Math.ceil((mesh.position.x + bbox.max.x) / 20);
        let minZ = Math.floor((mesh.position.z + bbox.min.z) / 20);
        let maxZ = Math.ceil((mesh.position.z + bbox.max.z) / 20);
        let minY = Math.floor((mesh.position.y + bbox.min.y) / 20);
        let maxY = Math.ceil((mesh.position.y + bbox.max.y) / 20);
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
