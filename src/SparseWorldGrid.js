function getHash(posX, posY, posZ) {
  return `${Math.round(posX / 20)}:${
    Math.round(posY / 20)}:${
    Math.round(posZ / 20)}`;
}

function getHashRaw(posX, posY, posZ) {
  return `${(posX)}:${
    (posY)}:${
    (posZ)}`;
}

export default class SparseWorldGrid {
  constructor() {
    this.grid = {};
  }

  valueAtWorldPos(posX, posY, posZ) {
    const idx = getHash(posX, posY, posZ);
    return this.grid[idx];
  }

  queryPointsInRadius(posX, posY, posZ, r) {
    const meshes = {};
    const meshesArray = [];
    for (let i = -1; i < 2; i++) {
      for (let j = -1; j < 2; j++) {
        for (let k = -1; k < 2; k++) {
          const value = this.valueAtWorldPos(posX + i * 20, posY + j * 20, posZ + k * 20);
          if (value) {
            Object.keys(value).forEach((key) => {
              const mesh = value[key];
              if (!meshes[mesh.id]) {
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
    if (!this.grid[idx]) {
      this.grid[idx] = {};
    }
    this.grid[idx][mesh.id] = mesh;
  }

  fillGridFromBoundingBox(mesh, scene, scale) {
    mesh.geometry.computeBoundingBox();
    const bbox = mesh.geometry.boundingBox;
    const minX = Math.floor((mesh.position.x + scale * bbox.min.x) / 20);
    const maxX = Math.ceil((mesh.position.x + scale * bbox.max.x) / 20);
    const minZ = Math.floor((mesh.position.z + scale * bbox.min.z) / 20);
    const maxZ = Math.ceil((mesh.position.z + scale * bbox.max.z) / 20);
    const minY = Math.floor((mesh.position.y + scale * bbox.min.y) / 20);
    const maxY = Math.ceil((mesh.position.y + scale * bbox.max.y) / 20);
    // top bottom
    for (let i = minX; i <= maxX; i++) {
      for (let j = minZ; j <= maxZ; j++) {
        const idx = getHashRaw(i, minY, j);
        this.addForIdx(idx, mesh);
        const idx2 = getHashRaw(i, maxY, j);
        this.addForIdx(idx2, mesh);
      }
    }

    // left right
    for (let i = minX; i <= maxX; i++) {
      for (let j = minY; j <= maxY; j++) {
        const idx = getHashRaw(i, j, minZ);
        this.addForIdx(idx, mesh);
        const idx2 = getHashRaw(i, j, maxZ);
        this.addForIdx(idx2, mesh);
      }
    }

    // forward backward
    for (let i = minY; i <= maxY; i++) {
      for (let j = minZ; j <= maxZ; j++) {
        const idx = getHashRaw(minX, i, j);
        this.addForIdx(idx, mesh);
        const idx2 = getHashRaw(maxX, i, j);
        this.addForIdx(idx2, mesh);
      }
    }
  }
}
