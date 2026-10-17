import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createInstancedMesh, createPath, createXYZCube, createXYZGizmo, setInstanceVisibility } from './geometryHelpers.ts';
import { MaterialHandler } from './MaterialHandler';
import type { Line2 } from 'three/addons/lines/Line2.js';
import type { AppData, GeoIndex, PathStep, Point3D } from '../../shared/types';

export interface InteractiveScene extends THREE.Scene {
    selectionGizmo: THREE.Mesh;
    orbitCenterGizmo: THREE.AxesHelper;
}

export interface CreatedScene {
    scene: InteractiveScene;
    origin: Point3D;
    update: () => void;
    updatePath: (nextPath: PathStep[]) => void;
}

export async function createScene(data: AppData, index: GeoIndex, path: PathStep[]): Promise<CreatedScene> {

    console.log("CreateScene",data, index);
    //var data = { lieux: [...(await getData("Raccourcis")).lieux, ...(await getData("Gares TGV")).lieux ] };
    const origin = (data.groups.origine?.items ?? [{ x: 0, y: 0, z: 0 }])[0];

    const scene = new THREE.Scene() as InteractiveScene;
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

    console.log("MaterialHandler setup for autocolor groups", data.groups);
    for (const i of Object.keys(data.groups)) {
        if (data.groups[i].autocolor) {
            materialHandler.setupMaterial(i);
        }
    }

    for (const i of Object.keys(data.groups)) {
        if (data.groups[i].autocolor) {
            const material = materialHandler.getMaterial(i);
            const d = data.groups[i].items.map(x => { return { x: x.x, y: x.z, z: x.y, data: x }; });
            const mesh = createInstancedMesh(geometry, material, d);
            data.groups[i].mesh = mesh;
            data.groups[i].color = material.color;
            scene.add(mesh);
        }
    }

    data.groups.trolls.mesh=createInstancedMesh(smallBox, material_trolls, (data.groups.trolls.items ?? []).map(x => { return { x: x.x - 0.25, y: x.z, z: x.y, data: x }; }))
    data.groups.trolls.color=material_trolls.color;
    scene.add(data.groups.trolls.mesh);
    data.groups.monstres.mesh=createInstancedMesh(smallBox, material_monstres, (data.groups.monstres.items ?? []).map(x => { return { x: x.x + 0.1, y: x.z - 0.25, z: x.y, data: x }; }))
    data.groups.monstres.itemVisibility?.forEach((isVisible, index) => {
        setInstanceVisibility(data.groups.monstres.mesh!, index, isVisible);
    });
    data.groups.monstres.color=material_monstres.color;
    scene.add(data.groups.monstres.mesh);
    data.groups.tresors.mesh=createInstancedMesh(smallBox, material_tresors, (data.groups.tresors.items ?? []).map(x => { return { x: x.x, y: x.z + 0.1, z: x.y - 0.25, data: x }; }))
    data.groups.tresors.color=material_tresors.color;
    scene.add(data.groups.tresors.mesh);

    scene.add(createXYZGizmo({ x: 0, y: 0, z: 0 }, 100, -1, new LineMaterial({ color: 0x0000ff, linewidth: 5 })));
    scene.add(createXYZGizmo({ x: origin.x, y: origin.z, z: origin.y }, 5, 1, new LineMaterial({ color: 0xff00ff, linewidth: 2 })));

    const orbitCenterGizmo = new THREE.AxesHelper(5);
    orbitCenterGizmo.name = 'orbit-center-gizmo';
    orbitCenterGizmo.renderOrder = 10;
    for (const material of Array.isArray(orbitCenterGizmo.material) ? orbitCenterGizmo.material : [orbitCenterGizmo.material]) {
        material.depthTest = false;
        material.depthWrite = false;
    }
    scene.orbitCenterGizmo = orbitCenterGizmo;
    scene.add(orbitCenterGizmo);
    
    let pathLines: Line2[] = [];
    const pathMaterial = new LineMaterial({
        color: 0xff3030,
        linewidth: 3,
        depthTest: true,
        depthWrite: false,
    });
    const shortcutPathMaterial = new LineMaterial({
        color: 0xff3030,
        linewidth: 3,
        depthTest: true,
        depthWrite: false,
        dashed: true,
        dashSize: 8,
        gapSize: 5,
    });
    shortcutPathMaterial.onBeforeCompile = shader => {
        const projectedEndAssignment = 'vec3 ndcEnd = clipEnd.xyz / clipEnd.w;';
        if (
            !shader.vertexShader.includes('varying float vLineDistance;') ||
            !shader.vertexShader.includes(projectedEndAssignment) ||
            !shader.fragmentShader.includes('mod( vLineDistance + dashOffset, dashSize + gapSize )')
        ) {
            throw new Error('Unable to configure screen-space shortcut dashes for the current Three.js line shader.');
        }

        shader.vertexShader = shader.vertexShader
            .replace(
                'varying float vLineDistance;',
                `varying float vLineDistance;
				varying vec2 vDashStart;
				varying vec2 vDashDirection;`,
            )
            .replace(projectedEndAssignment, `vec3 ndcEnd = clipEnd.xyz / clipEnd.w;
				vDashStart = ( ndcStart.xy * 0.5 + 0.5 ) * resolution;
				vDashDirection = normalize( ( ndcEnd.xy - ndcStart.xy ) * resolution * 0.5 );`,
            );
        shader.fragmentShader = shader.fragmentShader
            .replace(
                'varying float vLineDistance;',
                `varying float vLineDistance;
				varying vec2 vDashStart;
				varying vec2 vDashDirection;
				uniform float dashPixelRatio;`,
            )
            .replace(
                'mod( vLineDistance + dashOffset, dashSize + gapSize )',
                'mod( dot( gl_FragCoord.xy / dashPixelRatio - vDashStart, vDashDirection ) + dashOffset, dashSize + gapSize )',
            );
        shader.uniforms.dashPixelRatio = { value: Math.min(window.devicePixelRatio || 1, 1.5) };
    };
    shortcutPathMaterial.customProgramCacheKey = () => 'screen-space-dashes';

    function updatePath(nextPath: PathStep[]) {
        for (const pathLine of pathLines) {
            scene.remove(pathLine);
            pathLine.geometry.dispose();
        }
        pathLines = [];

        if ((nextPath ?? []).length > 1) {
            let segmentStart = 1;
            while (segmentStart < nextPath.length) {
                const isShortcut = nextPath[segmentStart].shortcut;
                let segmentEnd = segmentStart + 1;
                while (segmentEnd < nextPath.length && nextPath[segmentEnd].shortcut === isShortcut) {
                    segmentEnd += 1;
                }

                const pathLine = createPath(
                    nextPath.slice(segmentStart - 1, segmentEnd),
                    isShortcut ? shortcutPathMaterial : pathMaterial,
                );
                if (isShortcut) pathLine.computeLineDistances();
                pathLine.renderOrder = 10;
                scene.add(pathLine);
                pathLines.push(pathLine);
                segmentStart = segmentEnd;
            }
        }
    }

    updatePath(path);

    scene.add(new THREE.GridHelper(200, 10));

    const selectionGizmo = createXYZCube(1, new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.25,
        depthWrite: false,
        side: THREE.DoubleSide,
    }));
    scene.selectionGizmo=selectionGizmo;
    selectionGizmo.visible=false;
    scene.add(selectionGizmo);

    return { scene, origin, update: () => { /*cube.rotation.y += 0.01*/ }, updatePath };
}
