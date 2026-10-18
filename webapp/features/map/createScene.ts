import * as THREE from 'three';
import { LineMaterial } from 'three/addons/lines/LineMaterial.js';
import { createInstancedMesh, createPath, createXYZCube, createXYZGizmo, setInstanceVisibility } from './geometryHelpers.ts';
import { MaterialHandler } from './MaterialHandler';
import type { Line2 } from 'three/addons/lines/Line2.js';
import type { AppData, CoordinateIndexedItem, GeoIndex, PathStep, Point3D, RenderItem, SceneMesh } from '../../shared/types';
import { MONSTER_LEVEL_MAX } from '../../shared/constants';

const MIN_CREATURE_CUBE_SIDE = 0.1;
const MAX_CREATURE_CUBE_SIDE = 0.6;
const TREASURE_CUBE_SIDE = MIN_CREATURE_CUBE_SIDE * 2;

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

function getCubeSizeFromLevels(levels: number[]): number {
    const knownLevels = levels.filter(Number.isFinite);
    if (knownLevels.length === 0) return (MIN_CREATURE_CUBE_SIDE + MAX_CREATURE_CUBE_SIDE) / 2;

    const averageLevel = knownLevels.reduce((sum, value) => sum + value, 0) / knownLevels.length;
    const normalizedLevel = Math.min(1, Math.max(0, averageLevel / MONSTER_LEVEL_MAX));
    const maximumVolume = MAX_CREATURE_CUBE_SIDE ** 3;
    const volume = normalizedLevel * maximumVolume;
    return Math.min(MAX_CREATURE_CUBE_SIDE, Math.max(MIN_CREATURE_CUBE_SIDE, Math.cbrt(volume)));
}

function getMonsterCubeSize(item: AppData['groups'][string]['items'][number]): number {
    const level = item.details?.niv;
    return getCubeSizeFromLevels([level?.min, level?.max, level?.min2, level?.max2]
        .filter((value): value is number => typeof value === 'number' && Number.isFinite(value)));
}

function getTrollCubeSize(item: CoordinateIndexedItem): number {
    const level = typeof item.level === 'number'
        ? item.level
        : typeof item.level === 'string' && item.level.trim() !== ''
            ? Number(item.level)
            : Number.NaN;
    return getCubeSizeFromLevels(Number.isFinite(level) ? [level] : []);
}

function getCellDistributedRenderItems(
    trolls: CoordinateIndexedItem[],
    monsters: CoordinateIndexedItem[],
    treasures: CoordinateIndexedItem[],
) {
    type EntityKind = 'trolls' | 'monstres' | 'tresors';
    type CellEntity = { kind: EntityKind; index: number; item: CoordinateIndexedItem };
    const renderItems: Record<EntityKind, RenderItem[]> = {
        trolls: trolls.map(item => ({ x: item.x - 0.25, y: item.z, z: item.y, data: item })),
        monstres: monsters.map(item => ({ x: item.x + 0.1, y: item.z - 0.25, z: item.y, data: item })),
        tresors: treasures.map(item => ({ x: item.x, y: item.z + 0.1, z: item.y - 0.25, data: item })),
    };
    const entitiesByCell = new Map<string, CellEntity[]>();

    const addToCell = (kind: EntityKind, items: CoordinateIndexedItem[]) => {
        items.forEach((item, index) => {
            const cell = JSON.stringify([item.x, item.y, item.z]);
            const entities = entitiesByCell.get(cell) ?? [];
            entities.push({ kind, index, item });
            entitiesByCell.set(cell, entities);
        });
    };
    addToCell('trolls', trolls);
    addToCell('monstres', monsters);
    addToCell('tresors', treasures);

    for (const entities of entitiesByCell.values()) {
        if (entities.length < 2) continue;
        const radius = 0.5 * Math.sqrt(Math.min(1, (entities.length - 1) / 5));

        entities.sort((left, right) => {
            if (left.kind !== right.kind) return left.kind < right.kind ? -1 : 1;
            if (left.item.id !== right.item.id) return left.item.id < right.item.id ? -1 : 1;
            return left.index - right.index;
        });

        entities.forEach((entity, positionIndex) => {
            const vertical = 1 - (2 * (positionIndex + 0.5)) / entities.length;
            const ringRadius = Math.sqrt(1 - vertical * vertical);
            const angle = positionIndex * Math.PI * (3 - Math.sqrt(5));
            renderItems[entity.kind][entity.index] = {
                x: entity.item.x + Math.cos(angle) * ringRadius * radius,
                y: entity.item.z + vertical * radius,
                z: entity.item.y + Math.sin(angle) * ringRadius * radius,
                data: entity.item,
            };
        });
    }

    return renderItems;
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
    const smallBox = new THREE.BoxGeometry(
        TREASURE_CUBE_SIDE,
        TREASURE_CUBE_SIDE,
        TREASURE_CUBE_SIDE,
    );

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
            mesh.data.forEach((_, index) => {
                if (data.groups[i].itemVisibility?.[index] === false) {
                    setInstanceVisibility(mesh, index, false);
                }
            });
            data.groups[i].mesh = mesh;
            data.groups[i].color = material.color;
            scene.add(mesh);
        }
    }

    const cellDistributedRenderItems = getCellDistributedRenderItems(
        data.groups.trolls.items ?? [],
        data.groups.monstres.items ?? [],
        data.groups.tresors.items ?? [],
    );
    data.groups.trolls.mesh=createInstancedMesh(geometry, material_trolls, cellDistributedRenderItems.trolls)
    data.groups.trolls.color=material_trolls.color;
    scene.add(data.groups.trolls.mesh);
    data.groups.monstres.mesh = createInstancedMesh(geometry, material_monstres, cellDistributedRenderItems.monstres);
    data.groups.monstres.color = material_monstres.color;
    scene.add(data.groups.monstres.mesh);

    function updateMeshSizes(
        mesh: SceneMesh | undefined,
        getSize: (item: CoordinateIndexedItem) => number,
        itemVisibility?: boolean[],
    ) {
        if (!mesh) return;

        const position = new THREE.Vector3();
        for (let instanceIndex = 0; instanceIndex < mesh.data.length; instanceIndex += 1) {
            const item = mesh.data[instanceIndex];
            position.set(item.x, item.y, item.z);
            const size = getSize(item.data);
            const baseMatrix = new THREE.Matrix4().makeScale(size, size, size).setPosition(position);
            mesh.baseMatrices[instanceIndex] = baseMatrix.clone();
            if (itemVisibility?.[instanceIndex] === false) {
                baseMatrix.scale(new THREE.Vector3(0, 0, 0));
            }
            mesh.setMatrixAt(instanceIndex, baseMatrix);
        }
        mesh.instanceMatrix.needsUpdate = true;
    }
    function updateCreatureSizes() {
        updateMeshSizes(data.groups.trolls.mesh, getTrollCubeSize, data.groups.trolls.itemVisibility);
        updateMeshSizes(data.groups.monstres.mesh, getMonsterCubeSize, data.groups.monstres.itemVisibility);
    }
    updateCreatureSizes();
    data.groups.tresors.mesh=createInstancedMesh(smallBox, material_tresors, cellDistributedRenderItems.tresors)
    data.groups.tresors.mesh.data.forEach((_, index) => {
        if (data.groups.tresors.itemVisibility?.[index] === false) {
            setInstanceVisibility(data.groups.tresors.mesh!, index, false);
        }
    });
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

    return { scene, origin, update: updateCreatureSizes, updatePath };
}
