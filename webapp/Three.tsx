import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { useEffect, useLayoutEffect, useRef } from "react";
import { createScene } from './createScene.ts';
import { useData } from './DataContext.ts';
import { usePathFinding } from './PathFindingContext.ts';
import type { InteractiveScene } from './createScene.ts';
import type { CoordinateIndexedItem, PathStep, SceneMesh } from './types';

function disposeScene(scene: THREE.Scene | null) {
    if (!scene) return;

    const geometries = new Set<THREE.BufferGeometry>();
    const materials = new Set<THREE.Material>();
    scene.traverse(object => {
        if (object instanceof THREE.Mesh) {
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

function MyThree() {
    const refContainer = useRef<HTMLDivElement>(null);
        const pathUpdater = useRef<((nextPath: PathStep[]) => void) | null>(null);
    const { setHighlighted, setSelection, index, data, registerSceneRenderer } = useData();
    const { path } = usePathFinding();
    const currentPath = useRef<PathStep[]>(path);

  useEffect(() => {
        const container = refContainer.current;
        if (!index || !data || !container) return;

        let disposed = false;
        let frameId: number | null = null;
        let scene: InteractiveScene | null = null;
        let updatePath: ((nextPath: PathStep[]) => void) | null = null;
        let renderPath: ((nextPath: PathStep[]) => void) | null = null;
        let unregisterSceneRenderer: () => void = () => {};
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

            if (pointerInside) {
                raycaster.setFromCamera(pointer, camera);
                const intersect = raycaster.intersectObjects(interactiveMeshes, false)
                    .find((hit): hit is THREE.Intersection<SceneMesh> & { instanceId: number } =>
                        hit.object instanceof THREE.InstancedMesh &&
                        hit.instanceId !== undefined &&
                        Boolean((hit.object as SceneMesh).data[hit.instanceId]?.data)
                    );
                const nextData = intersect?.object.data[intersect.instanceId].data ?? null;

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
        };
        const onPointerMove = (event: PointerEvent) => {
            if (pointerDownPosition) {
                const deltaX = event.clientX - pointerDownPosition.x;
                const deltaY = event.clientY - pointerDownPosition.y;
                didDrag = didDrag || Math.hypot(deltaX, deltaY) > 5;
            }

            const bounds = renderer.domElement.getBoundingClientRect();
            pointer.x = ((event.clientX - bounds.left) / bounds.width) * 2 - 1;
            pointer.y = -((event.clientY - bounds.top) / bounds.height) * 2 + 1;
            pointerInside = true;
            requestRender();
        };
        const onPointerLeave = () => {
            pointerInside = false;
            pointerDownPosition = null;
            if (currentData) {
                currentData = null;
                if (scene) scene.selectionGizmo.visible = false;
                setHighlighted(null);
                const selection = document.getElementById('selection');
                if (selection) selection.textContent = '';
                requestRender();
            }
        };
        const onClick = () => {
            if (!didDrag && currentData) setSelection(currentData);
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
        renderer.domElement.addEventListener('click', onClick);
        const resizeObserver = new ResizeObserver(onWindowResize);
        resizeObserver.observe(container);
        onWindowResize();

        const loadScene = async () => {
            const result = await createScene(data, index, path);
            if (disposed) {
                disposeScene(result.scene);
                return;
            }

            scene = result.scene;
            updatePath = result.updatePath;
            unregisterSceneRenderer = registerSceneRenderer(requestRender);
            renderPath = (nextPath: PathStep[]) => {
                if (!scene || !updatePath) return;
                updatePath(nextPath);
                updateLineMaterialResolution(scene, renderer);
                renderer.render(scene, camera);
                requestRender();
            };
            pathUpdater.current = renderPath;
            renderPath(currentPath.current);
            interactiveMeshes.push(...scene.children.filter((object): object is SceneMesh =>
                object instanceof THREE.InstancedMesh && 'data' in object
            ));
            requestRender();
        };
        loadScene().catch(error => console.error('Unable to create Three.js scene:', error));

    return () => {
            disposed = true;
            unregisterSceneRenderer();
            if (frameId !== null) cancelAnimationFrame(frameId);
            resizeObserver.disconnect();
            renderer.domElement.removeEventListener('pointerdown', onPointerDown);
            renderer.domElement.removeEventListener('pointermove', onPointerMove);
            renderer.domElement.removeEventListener('pointerleave', onPointerLeave);
            renderer.domElement.removeEventListener('click', onClick);
            controls.removeEventListener('change', onControlsChange);
            controls.dispose();
            disposeScene(scene);
            renderer.dispose();
            renderer.domElement.remove();
            if (pathUpdater.current === renderPath) pathUpdater.current = null;
        };
    }, [data, index, registerSceneRenderer]);

    useLayoutEffect(() => {
        currentPath.current = path;
        pathUpdater.current?.(path);
    }, [path]);
  return (
    <div id="my3dcontainer" ref={refContainer}></div>

  );
}

export default MyThree
