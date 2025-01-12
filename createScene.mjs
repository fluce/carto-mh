import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createInstancedMesh, createPath, createXYZCube, createXYZGizmo } from './geometryHelpers.mjs';
import { MaterialHandler } from './MaterialHandler';

export async function createScene(data, path) {

    console.dir(data);
    //var data = { lieux: [...(await getData("Raccourcis")).lieux, ...(await getData("Gares TGV")).lieux ] };
    var origin = (data.origine ?? [{ x: 0, y: 0, z: 0 }])[0];

    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight(0x777777));

    const light = new THREE.DirectionalLight(0xffffff, 3);
    light.position.set(100, 100, 50);
    scene.add(light);

    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const smallBox = new THREE.BoxGeometry(0.6, 0.6, 0.6);//.translate(0.25, 0.25, 0.25);

    const material = new THREE.MeshPhongMaterial({
        color: 0x7f00ff00,
        transparent: true,
        opacity: 0.25,
        //wireframe: true
    });
    const material_monstres = new THREE.MeshPhongMaterial({
        color: 0xff0000,
    });
    const material_trolls = new THREE.MeshPhongMaterial({
        color: 0x0000ff,
    });
    const material_tresors = new THREE.MeshPhongMaterial({
        color: 0xffff00,
    });
    const cube = new THREE.Mesh(geometry, material);
    scene.add(cube);

    const materialHandler = MaterialHandler();

    for (var i of Object.keys(data.groups)) {
        materialHandler.setupMaterial(i);
    }

    for (var i of Object.keys(data.groups)) {
        const material = materialHandler.getMaterial(i);
        const d = data.groups[i].items.map(x => { return { x: x.x, y: x.z, z: x.y, data: x }; });
        const mesh = createInstancedMesh(geometry, material, d);
        data.groups[i].mesh = mesh;
        data.groups[i].color = material.color;
        scene.add(mesh);
    }

    scene.add(createInstancedMesh(smallBox, material_trolls, (data.trolls ?? []).map(x => { return { x: x.x - 0.25, y: x.z, z: x.y, data: x }; })));
    scene.add(createInstancedMesh(smallBox, material_monstres, (data.monstres ?? []).map(x => { return { x: x.x + 0.1, y: x.z - 0.25, z: x.y, data: x }; }), true));
    scene.add(createInstancedMesh(smallBox, material_tresors, (data.tresors ?? []).map(x => { return { x: x.x, y: x.z + 0.1, z: x.y - 0.25, data: x }; })));

    scene.add(createXYZGizmo({ x: 0, y: 0, z: 0 }, 100, -1, new LineMaterial({ color: 0x0000ff, linewidth: 5 })));
    scene.add(createXYZGizmo({ x: origin.x, y: origin.z, z: origin.y }, 5, 1, new LineMaterial({ color: 0xff00ff, linewidth: 2 })));
    
    if ((path??[]).length>1)
        scene.add(createPath(path, new LineMaterial({ color: 0xff0000, linewidth: 2 })));

    scene.add(new THREE.GridHelper(200, 10));

    const selectionGizmo=createXYZCube(1, new LineMaterial({ color: 0xffffff, linewidth: 3 }))
    scene.selectionGizmo=selectionGizmo;
    selectionGizmo.visible=false;
    scene.add(selectionGizmo);

    return { scene, origin, update: () => { /*cube.rotation.y += 0.01*/ } };
}
