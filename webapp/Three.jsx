import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

import { useEffect, useRef, useState, useContext } from "react";
import { createScene } from './createScene.mjs';
import { loadData } from './loadData.mjs';
import { index } from './parse.mjs';
import { SidePanelContext } from './SidePanelContext.mjs';
import { set } from 'lodash';

function MyThree() {
  const refContainer = useRef(null);
  const [ state, setState ] = useState(false);
  const { setSelection, setLegend } = useContext(SidePanelContext);

  useEffect(() => {
    if (state) return;
    setState(true);
    async function loadThree() {
        if (ignore) return;
        // === THREE.JS CODE START ===
        const renderer = new THREE.WebGLRenderer({antialias: true});
        // document.body.appendChild( renderer.domElement );
        // use ref as a mount point of the Three.js scene instead of the document.body
        if (refContainer.current) {
            while (refContainer.current.firstChild) {
                refContainer.current.removeChild(refContainer.current.lastChild);
            }
            console.log("Appending to refContainer");
            refContainer.current.appendChild( renderer.domElement );        
        }

        const raycaster = new THREE.Raycaster();
        const pointer = new THREE.Vector2();
        renderer.domElement.addEventListener('pointermove',
            event => {
                pointer.x = ((event.clientX-renderer.domElement.offsetLeft) / renderer.domElement.offsetWidth) * 2 - 1;
                pointer.y = -((event.clientY-renderer.domElement.offsetTop) / renderer.domElement.offsetHeight) * 2 + 1;
            });

        const camera = new THREE.PerspectiveCamera(75, renderer.domElement.offsetWidth / renderer.domElement.offsetHeight, 0.1, 1000);
        camera.position.z = 30;
        camera.position.y = 30;
        camera.position.x = 30;     

        const controls = new OrbitControls(camera, renderer.domElement);
        controls.target.set(0, -30, 0);
        controls.update();
        controls.enablePan = true;
        controls.enableDamping = true;
        controls.enableZoom = true;        

        new ResizeObserver(onWindowResize).observe(refContainer.current);
        function onWindowResize(a,b) {

            const refElement = refContainer.current;
            camera.aspect = refElement.offsetWidth / refElement.offsetHeight;
            camera.updateProjectionMatrix();
        
            renderer.setSize( refElement.offsetWidth, refElement.offsetHeight );
        }

        onWindowResize();


        const data = await loadData(["lieux"], "TGV", "all");
        const path = [];
        //const { path, cost }= findPath(data, index, data.origine[0], { x: 65, y: 0, z: 0 });
        //console.log("Cost", cost);
        //console.log("Length", path.length);

        const { scene, origin, update } = await createScene(data, path);

        setLegend(data.groups);

        var currentData = null;

        const animate = function () {
            controls.update();
            raycaster.setFromCamera(pointer, camera);
            if (pointer.x > -1 && pointer.x < 1 && pointer.y > -1 && pointer.y < 1) {
                var intersects = raycaster.intersectObjects(scene.children, true).filter(x=>x.object.visible && x.instanceId && x.object.data && x.object.data[x.instanceId].data);
                if (intersects.length>0) {
                    const intersect = intersects[0];
                    if (currentData != intersect.object.data[intersect.instanceId].data) {
                        currentData = intersect.object.data[intersect.instanceId].data;
                        scene.selectionGizmo.position.set(currentData.x, currentData.z, currentData.y);
                        scene.selectionGizmo.visible=true;
                        selection.innerHTML = JSON.stringify(currentData);
                        console.log(currentData);
                        var dataAtPoint = index.get(currentData);
                        console.log(dataAtPoint);
                        setSelection({currentData, dataAtPoint});
                    } 
                }
                else
                {
                    currentData = null;
                    selection.innerHTML = "&nbsp;";
                }
            }
            renderer.render(scene, camera);
        };
        renderer.setAnimationLoop(animate);

    }
    let ignore = false;
    loadThree();
    return () => {
      ignore = true;
    }
  }, []);
  return (
    <div id="my3dcontainer" ref={refContainer}></div>

  );
}

export default MyThree
