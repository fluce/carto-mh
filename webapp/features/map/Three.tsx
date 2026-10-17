import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createScene } from './createScene.ts';
import { useData } from '../../data/DataContext.ts';
import { usePathFinding } from '../pathfinding/PathFindingContext.ts';
import CenterViewButton from '../../shared/CenterViewButton';
import type { InteractiveScene } from './createScene.ts';
import type { CoordinateIndexedItem, PathStep, Point3D, SceneMesh } from '../../shared/types';

function disposeScene(scene: THREE.Scene | null) {
    if (!scene) return;

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
        if (object instanceof THREE.Mesh || object instanceof THREE.Line) {
            geometries.add(object.geometry);
            for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
                materials.add(material);
            }
        }
    });

    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
}

function updateLineMaterialResolution(scene: THREE.Scene | null, renderer: THREE.WebGLRenderer) {
    if (!scene) return;
    const resolution = renderer.getSize(new THREE.Vector2());
    scene.traverse(object => {
        if (!(object instanceof THREE.Mesh)) return;
        for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
            const materialWithResolution = material as THREE.Material & { resolution?: THREE.Vector2 };
            if (materialWithResolution.resolution) {
                materialWithResolution.resolution.set(resolution.x, resolution.y);
            }
        }
    });
}

function fitCameraToPath(camera: THREE.PerspectiveCamera, controls: OrbitControls, path: PathStep[]) {
    if (path.length === 0) return;

    const bounds = new THREE.Box3().setFromPoints(
        path.map(step => new THREE.Vector3(step.x, step.z, step.y)),
    );
    const center = bounds.getCenter(new THREE.Vector3());
    const radius = bounds.getBoundingSphere(new THREE.Sphere()).radius;
    const verticalHalfFov = THREE.MathUtils.degToRad(camera.fov / 2);
    const horizontalHalfFov = Math.atan(Math.tan(verticalHalfFov) * camera.aspect);
    const limitingHalfFov = Math.min(verticalHalfFov, horizontalHalfFov);
    const distance = radius > 0 ? (radius / Math.sin(limitingHalfFov)) * 1.2 : 10;
    const viewDirection = camera.position.clone().sub(controls.target);
    if (viewDirection.lengthSq() === 0) {
        viewDirection.set(1, 1, 1);
    }

    controls.target.copy(center);
    camera.position.copy(center).addScaledVector(viewDirection.normalize(), distance);
    camera.far = Math.max(camera.far, distance + radius * 2);
    camera.updateProjectionMatrix();
    controls.update();
}

function MyThree() {
    const refContainer = useRef<HTMLDivElement>(null);
    const pathUpdater = useRef<((nextPath: PathStep[]) => void) | null>(null);
    const pathFitter = useRef<((nextPath: PathStep[]) => void) | null>(null);
    const [origin, setOrigin] = useState<Point3D | null>(null);
    const { setHighlighted, setSelection, index, data, registerSceneRenderer, registerCenterOnCell } = useData();
    const dataRef = useRef(data);
    dataRef.current = data;
    const hasData = data !== null;
    const { path } = usePathFinding();
    const currentPath = useRef<PathStep[]>(path);

  useEffect(() => {
        const container = refContainer.current;
        const sceneData = dataRef.current;
        if (!index || !sceneData || !container) return;

        let disposed = false;
        let frameId: number | null = null;
        let scene: InteractiveScene | null = null;
        let updatePath: ((nextPath: PathStep[]) => void) | null = null;
        let renderPath: ((nextPath: PathStep[]) => void) | null = null;
        let fitPath: ((nextPath: PathStep[]) => void) | null = null;
        let unregisterSceneRenderer: () => void = () => {};
        let unregisterCenterOnCell: () => void = () => {};
        let currentData: CoordinateIndexedItem | null = null;
        let pointerInside = false;
        let pointerDownPosition: { x: number; y: number } | null = null;
        let didDrag = false;

        const renderer = new THREE.WebGLRenderer({ antialias: true });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        container.replaceChildren(renderer.domElement);

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        const camera = new THREE.PerspectiveCamera(75, 1, 0.1, 1000);
        camera.position.set(30, 30, 30);

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, -30, 0);
        controls.enableDamping = true;
        controls.update();

        const getDataAtPointer = () => {
            if (!scene) return null;
            camera.updateMatrixWorld();
            raycaster.setFromCamera(pointer, camera);
            const intersect = raycaster.intersectObjects(interactiveMeshes, false)
                .find((hit): hit is THREE.Intersection<SceneMesh> & { instanceId: number } =>
                    hit.object instanceof THREE.InstancedMesh &&
                    hit.object.visible &&
                    hit.instanceId !== undefined &&
                    Boolean((hit.object as SceneMesh).data[hit.instanceId]?.data)
                );
            return intersect?.object.data[intersect.instanceId].data ?? null;
        };

        const updatePointer = (event: MouseEvent) => {
            const bounds = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
        };

        const requestRender = () => {
            if (!disposed && frameId === null) {
                frameId = requestAnimationFrame(renderFrame);
            }
        };

        const renderFrame = () => {
            frameId = null;
            if (disposed) return;

            controls.update();
            if (!scene) return;
            scene.orbitCenterGizmo.position.copy(controls.target);

            if (pointerInside) {
                const nextData = getDataAtPointer();

                if (nextData !== currentData) {
                    currentData = nextData;
                    scene.selectionGizmo.visible = Boolean(currentData);
                    if (currentData) {
                        scene.selectionGizmo.position.set(currentData.x, currentData.z, currentData.y);
                    }
                    setHighlighted(currentData);
                    const selection = document.getElementById('selection');
                    if (selection) selection.textContent = currentData ? JSON.stringify(currentData) : '';
                }
            }

            renderer.render(scene, camera);
        };

        const interactiveMeshes: SceneMesh[] = [];
        const onControlsChange = () => requestRender();
        controls.addEventListener('change', onControlsChange);

        const onPointerDown = (event: PointerEvent) => {
            pointerDownPosition = { x: event.clientX, y: event.clientY };
            didDrag = false;
            updatePointer(event);
            pointerInside = true;
        };
        const onPointerMove = (event: PointerEvent) => {
            if (pointerDownPosition) {
                const deltaX = event.clientX - pointerDownPosition.x;
                const deltaY = event.clientY - pointerDownPosition.y;
                didDrag = didDrag || Math.hypot(deltaX, deltaY) > 5;
            }

            updatePointer(event);
            pointerInside = true;
            requestRender();
        };
        const onPointerLeave = () => {
            pointerInside = false;
            if (currentData) {
                currentData = null;
                if (scene) scene.selectionGizmo.visible = false;
                setHighlighted(null);
                const selection = document.getElementById('selection');
                if (selection) selection.textContent = '';
                requestRender();
            }
        };
        const onPointerUp = (event: PointerEvent) => {
            if (pointerDownPosition) {
                const deltaX = event.clientX - pointerDownPosition.x;
                const deltaY = event.clientY - pointerDownPosition.y;
                didDrag = didDrag || Math.hypot(deltaX, deltaY) > 5;
                updatePointer(event);
            }
            pointerDownPosition = null;
        };
        const onClick = (event: MouseEvent) => {
            if (didDrag) return;
            updatePointer(event);
            const selectedData = getDataAtPointer();
            if (selectedData) setSelection(selectedData);
        };
        const onPointerCancel = () => {
            pointerDownPosition = null;
            didDrag = false;
        };
        const onWindowResize = () => {
            const width = container.clientWidth;
            const height = container.clientHeight;
            if (!width || !height) return;

            camera.aspect = width / height;
            camera.updateProjectionMatrix();
            renderer.setSize(width, height);
            updateLineMaterialResolution(scene, renderer);
            requestRender();
        };

        renderer.domElement.addEventListener('pointerdown', onPointerDown);
        renderer.domElement.addEventListener('pointermove', onPointerMove);
        renderer.domElement.addEventListener('pointerleave', onPointerLeave);
        renderer.domElement.addEventListener('pointerup', onPointerUp);
        renderer.domElement.addEventListener('pointercancel', onPointerCancel);
        renderer.domElement.addEventListener('click', onClick);
        const resizeObserver = new ResizeObserver(onWindowResize);
        resizeObserver.observe(container);
        onWindowResize();

        const loadScene = async () => {
            const result = await createScene(sceneData, index, path);
            if (disposed) {
                disposeScene(result.scene);
                return;
            }

            scene = result.scene;
            updatePath = result.updatePath;
            const centerOnPosition = (position: Point3D) => {
                const target = new THREE.Vector3(position.x, position.z, position.y);
                const offset = target.clone().sub(controls.target);
                controls.target.copy(target);
                camera.position.add(offset);
                controls.update();
                requestRender();
            };
            setOrigin(result.origin);
            unregisterCenterOnCell = registerCenterOnCell(centerOnPosition);
            unregisterSceneRenderer = registerSceneRenderer(() => {
                result.update();
                requestRender();
            });
            fitPath = nextPath => {
                fitCameraToPath(camera, controls, nextPath);
                requestRender();
            };
            pathFitter.current = fitPath;
            renderPath = (nextPath: PathStep[]) => {
                if (!scene || !updatePath) return;
                updatePath(nextPath);
                updateLineMaterialResolution(scene, renderer);
                renderer.render(scene, camera);
                requestRender();
            };
            pathUpdater.current = renderPath;
            renderPath(currentPath.current);
            fitPath(currentPath.current);
            interactiveMeshes.length = 0;
            interactiveMeshes.push(...scene.children.filter((object): object is SceneMesh =>
                object instanceof THREE.InstancedMesh && 'data' in object
            ));
            requestRender();
        };
        loadScene().catch(error => console.error('Unable to create Three.js scene:', error));

    return () => {
            disposed = true;
            setOrigin(null);
            unregisterSceneRenderer();
            unregisterCenterOnCell();
            if (frameId !== null) cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
            renderer.domElement.removeEventListener('pointerup', onPointerUp);
            renderer.domElement.removeEventListener('pointercancel', onPointerCancel);
            renderer.domElement.removeEventListener('click', onClick);
            controls.removeEventListener('change', onControlsChange);
            controls.dispose();
            disposeScene(scene);
            renderer.dispose();
            renderer.domElement.remove();
            if (pathUpdater.current === renderPath) pathUpdater.current = null;
            if (pathFitter.current === fitPath) pathFitter.current = null;
        };
    }, [hasData, index, registerCenterOnCell, registerSceneRenderer]);

    useLayoutEffect(() => {
        currentPath.current = path;
        pathUpdater.current?.(path);
        if (path.length > 0) pathFitter.current?.(path);
    }, [path]);
  return (
    <div className="three-view">
      <div id="my3dcontainer" ref={refContainer}></div>
      <div className="three-view__controls">
        <CenterViewButton
          position={origin}
          className="three-view__center-origin"
          label="Centrer la vue sur l’origine"
        />
      </div>
    </div>
  );
}

export default MyThree
