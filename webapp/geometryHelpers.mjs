import * as THREE from 'three';

import { LineGeometry } from 'three/addons/lines/LineGeometry.js';
import { LineSegmentsGeometry } from 'three/addons/lines/LineSegmentsGeometry.js';
import { LineSegments2 } from 'three/addons/lines/LineSegments2.js';
import { Line2 } from 'three/addons/lines/Line2.js';

export function createXYZGizmo(coord, size, dir, materialLine) {
    const points = [];
    points.push(new THREE.Vector3(0, size * dir, 0));
    points.push(new THREE.Vector3(0, 0, 0));
    points.push(new THREE.Vector3(size, 0, 0));
    points.push(new THREE.Vector3(size, 0, size));
    points.push(new THREE.Vector3(0, 0, size));
    points.push(new THREE.Vector3(0, 0, 0));

    const geometryLine = new LineGeometry();
    geometryLine.setPositions(points.map(x => [x.x + coord.x, x.y + coord.y, x.z + coord.z]).flat());

    const line = new Line2(geometryLine, materialLine);
    return line;
}

export function createPath(path, materialLine) {
    const geometryLine = new LineGeometry();
    geometryLine.setPositions(path.map(x => [x.x, x.z, x.y]).flat());

    const line = new Line2(geometryLine, materialLine);
    return line;
}

export function createXYZCube(size, materialLine) {
    const geometry = new THREE.BoxGeometry(size, size, size);
    return new THREE.Mesh(geometry, materialLine);
}

export function createInstancedMesh(geometry, material, d, log=false) {
    const mesh = new THREE.InstancedMesh(geometry, material, d.length);
    mesh.data = d;
    const matrix = new THREE.Matrix4();
    for (var j = 0; j < d.length; j++) {
        if (d[j].z===26 && log)
            console.log("Hello",j,d[j]);
        matrix.makeTranslation(d[j].x, d[j].y, d[j].z);
        mesh.setMatrixAt(j, matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return mesh;
}
