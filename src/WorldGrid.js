let THREE = require('three');

const DEBUG_MODE = false;

class Line {
    constructor(start, dir, length) {
        this.start = start;
        this.dir = dir.normalize();
        this.length = length;
    }

    intersect(line) {
        let nom = line.dir.dot(this.dir);
        let s = (this.start.clone()
            .sub(line.start)
            .dot(line.dir) + line.start.clone()
                .sub(this.start)
                .dot(this.dir) * nom) / (1 - nom * nom);
        let point = line.start.clone().add(line.dir.clone().multiplyScalar(s));

        return point;
    }
}

export default class WorldGrid {
    constructor(width, height, depth, offset) {
        this.grid = {};
        this.width = width;
        this.height = height;
        this.depth = depth;
        this.offset = offset;
    }

    getHash(posX, posY, posZ) {
        return `${Math.round(posX + this.offset.x)}:${
            Math.round(posY + this.offset.y)}:${
            Math.round(posZ + this.offset.z)}`;
    }

    valueAtWorldPos(posX, posY, posZ) {
        let idx = this.getHash(posX, posY, posZ);
        return this.grid[idx];
    }

    setValueAtWorldPos(posX, posY, posZ, normal) {
        let idx = this.getHash(posX, posY, posZ);
        this.grid[idx] = [ normal.x, normal.y, normal.z ];
    }

    // call this after setting scale and position. mesh must have faces.
    fillGridForMesh(mesh, scene) {
        if (DEBUG_MODE) {
            var starsGeometry = new THREE.Geometry();
        }
        var flip = 1;
        if(mesh.material.side == THREE.BackSide){
          flip = -1;
        }
        mesh.geometry.faces.forEach((face) => {
            let vertexA = mesh.geometry.vertices[face.a].clone().add(mesh.position).multiplyScalar(mesh.scale.x);
            let vertexB = mesh.geometry.vertices[face.b].clone().add(mesh.position).multiplyScalar(mesh.scale.x);
            let vertexC = mesh.geometry.vertices[face.c].clone().add(mesh.position).multiplyScalar(mesh.scale.x);
            // fill all from A - B
            let lineAB = vertexB.clone().sub(vertexA);
            let lineCA = vertexA.clone().sub(vertexC);
            let lineBC = vertexC.clone().sub(vertexB);

            let lengthAB = lineAB.length();
            let lengthCA = lineCA.length();
            let lengthBC = lineBC.length();

            let baseLine, sideLine1, sideLine2;

            if (lengthAB > lengthCA && lengthAB > lengthBC) {
                baseLine = new Line(vertexA, lineAB, lengthAB);
                sideLine1 = new Line(vertexA, lineCA.multiplyScalar(-1), lengthCA);
                sideLine2 = new Line(vertexC, lineBC, lengthBC);
            } else if (lengthCA > lengthAB && lengthCA > lengthBC) {
                baseLine = new Line(vertexC, lineCA, lengthCA);
                sideLine1 = new Line(vertexC, lineBC.multiplyScalar(-1), lengthBC);
                sideLine2 = new Line(vertexB, lineAB, lengthAB);
            } else {
                baseLine = new Line(vertexB, lineBC, lengthBC);
                sideLine1 = new Line(vertexB, lineAB.multiplyScalar(-1), lengthAB);
                sideLine2 = new Line(vertexA, lineCA, lengthCA);
            }

            for (let j = 0; j < sideLine1.length; j++) {
                let nextPoint = sideLine1.start.clone().add(sideLine1.dir.normalize().clone()
                    .multiplyScalar(j));
                let scanLine = new Line(nextPoint, baseLine.dir);
                let intersectionPoint = scanLine.intersect(sideLine2);

                // lenght is this intersection point - start point
                let length = nextPoint.clone().sub(intersectionPoint)
                    .length();
                for (let i = 0; i < length; i++) {
                    this.setValueAtWorldPos(nextPoint.x, nextPoint.y, nextPoint.z, face.normal.clone().multiplyScalar(flip));
                    if (DEBUG_MODE) {
                        starsGeometry.vertices.push(nextPoint.clone());
                    }
                    nextPoint.add(baseLine.dir);
                }
            }
        });
        if (DEBUG_MODE) {
            let starsMaterial = new THREE.PointsMaterial({ color: 0x888888 });
            let starField = new THREE.Points(starsGeometry, starsMaterial);
            scene.add(starField);
        }
    }

    // call this after setting scale and position. mesh must have faces.
    fillGridForBufferMesh(mesh, scene) {
        if (DEBUG_MODE) {
            var starsGeometry = new THREE.Geometry();
        }
        let pos = mesh.geometry.attributes.position.array;
        for(let i = 0; i < mesh.geometry.attributes.position.count; i = i + 3) {
            let vertexA = new THREE.Vector3(pos[3 * i], pos[3 * i + 1], pos[3 * i + 2]).multiplyScalar(mesh.scale.x).add(mesh.position);
            let vertexB = new THREE.Vector3(pos[3 * i + 3], pos[3 * i + 4], pos[3 * i + 5]).multiplyScalar(mesh.scale.x).add(mesh.position);
            let vertexC = new THREE.Vector3(pos[3 * i + 6], pos[3 * i + 7], pos[3 * i + 8]).multiplyScalar(mesh.scale.x).add(mesh.position);
            // fill all from A - B
            let lineAB = vertexB.clone().sub(vertexA);
            let lineCA = vertexA.clone().sub(vertexC);
            let lineBC = vertexC.clone().sub(vertexB);

            let lengthAB = lineAB.length();
            let lengthCA = lineCA.length();
            let lengthBC = lineBC.length();

            let baseLine, sideLine1, sideLine2;

            if (lengthAB > lengthCA && lengthAB > lengthBC) {
                baseLine = new Line(vertexA, lineAB, lengthAB);
                sideLine1 = new Line(vertexA, lineCA.multiplyScalar(-1), lengthCA);
                sideLine2 = new Line(vertexC, lineBC, lengthBC);
            } else if (lengthCA > lengthAB && lengthCA > lengthBC) {
                baseLine = new Line(vertexC, lineCA, lengthCA);
                sideLine1 = new Line(vertexC, lineBC.multiplyScalar(-1), lengthBC);
                sideLine2 = new Line(vertexB, lineAB, lengthAB);
            } else {
                baseLine = new Line(vertexB, lineBC, lengthBC);
                sideLine1 = new Line(vertexB, lineAB.multiplyScalar(-1), lengthAB);
                sideLine2 = new Line(vertexA, lineCA, lengthCA);
            }

            for (let j = 0; j < sideLine1.length; j++) {
                let nextPoint = sideLine1.start.clone().add(sideLine1.dir.normalize().clone()
                    .multiplyScalar(j));
                let scanLine = new Line(nextPoint, baseLine.dir);
                let intersectionPoint = scanLine.intersect(sideLine2);

                // lenght is this intersection point - start point
                let length = nextPoint.clone().sub(intersectionPoint)
                    .length();
                for (let i = 0; i < length; i++) {
                    this.setValueAtWorldPos(nextPoint.x, nextPoint.y, nextPoint.z, 1);
                    if (DEBUG_MODE) {
                        starsGeometry.vertices.push(nextPoint.clone());
                    }
                    nextPoint.add(baseLine.dir);
                }
            }
        }
        if (DEBUG_MODE) {
            let starsMaterial = new THREE.PointsMaterial({ color: 0x888888 });
            let starField = new THREE.Points(starsGeometry, starsMaterial);
            scene.add(starField);
        }
    }
}
